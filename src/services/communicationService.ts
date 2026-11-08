// ============================================================
// PedaClic — Phase 54 : communicationService.ts
// Espace classe : annonces, messages privés (prof → élève) et
// forum public du groupe. Collection Firestore : `messages_classe`.
//
// Fonctions disponibles :
//   • publierMessage()               — prof (annonce / privé / forum) ou élève (forum)
//   • ecouterMessagesGroupe()        — fil public d'un groupe (annonces + forum)
//   • ecouterMessagesPrivesProf()    — messages privés envoyés par le prof dans un groupe
//   • ecouterMessagesPrivesEleve()   — messages privés reçus par un élève
//   • basculerEpingle()              — épingler / désépingler une annonce
//   • supprimerMessage()             — supprimer (auteur ou prof du groupe)
//   • notifierElevesSeance()         — notification « séance saisie / mise à jour »
//   • derniereVisiteForum / marquerForumVu — badge « non lus » (navigateur)
//
// Les notifications partent APRÈS l'écriture du message, sans jamais
// bloquer ni faire échouer la publication (try/catch silencieux).
// ============================================================

import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { creerNotification, envoyerNotificationGroupe } from './notificationService';
import type { MessageClasse, NouveauMessage, RoleAuteurMessage } from '../types/communication.types';
import { MAX_CONTENU_MESSAGE, MAX_TITRE_MESSAGE } from '../types/communication.types';

const COL_MESSAGES = 'messages_classe';
const LIMITE_FIL = 150; // messages chargés par fil (les plus récents)

/** Lien profond vers l'espace classe d'un groupe (côté élève) */
export const lienEspaceEleve = (groupeId: string, onglet = 'annonce') =>
  `/eleve/communication?groupe=${encodeURIComponent(groupeId)}&onglet=${onglet}`;

/** Lien profond vers l'espace classe d'un groupe (côté professeur) */
export const lienEspaceProf = (groupeId: string, onglet = 'forum') =>
  `/prof/communication?groupe=${encodeURIComponent(groupeId)}&onglet=${onglet}`;

/** Extrait court pour le corps d'une notification */
const extrait = (txt: string, n = 140) => (txt.length > n ? `${txt.slice(0, n - 1)}…` : txt);

// ============================================================
// PUBLICATION
// ============================================================

/**
 * Publie un message dans l'espace classe puis prévient les destinataires.
 * - Prof  : annonce (tout le groupe), privé (un élève) ou forum.
 * - Élève : forum uniquement (inscriptionId obligatoire).
 */
export async function publierMessage(
  msg: NouveauMessage,
  auteur: { id: string; nom: string; role: RoleAuteurMessage }
): Promise<string> {
  // ── Garde-fous côté client (doublés par les règles Firestore) ──
  const contenu = msg.contenu.trim();
  if (!contenu) throw new Error('Le message est vide.');
  if (contenu.length > MAX_CONTENU_MESSAGE) throw new Error(`Message trop long (${MAX_CONTENU_MESSAGE} caractères maximum).`);
  if (auteur.role === 'eleve' && msg.nature !== 'forum') throw new Error('Les élèves écrivent uniquement dans le forum de classe.');
  if (auteur.role === 'eleve' && !msg.inscriptionId) throw new Error('Inscription au groupe introuvable.');
  if (msg.nature === 'prive' && !msg.destinataireId) throw new Error('Choisissez l\'élève destinataire.');

  const titre = (msg.titre ?? '').trim().slice(0, MAX_TITRE_MESSAGE);
  const now = Timestamp.now();

  const ref = await addDoc(collection(db, COL_MESSAGES), {
    groupeId:        msg.groupeId,
    groupeNom:       msg.groupeNom,
    profId:          msg.profId,
    nature:          msg.nature,
    portee:          msg.nature === 'prive' ? 'individuel' : 'groupe',
    destinataireId:  msg.nature === 'prive' ? msg.destinataireId : null,
    destinataireNom: msg.nature === 'prive' ? (msg.destinataireNom ?? '') : null,
    auteurId:        auteur.id,
    auteurNom:       auteur.nom || (auteur.role === 'prof' ? 'Professeur' : 'Élève'),
    auteurRole:      auteur.role,
    inscriptionId:   msg.inscriptionId ?? null,
    titre,
    contenu,
    evenementDate:   msg.nature === 'annonce' ? (msg.evenementDate || null) : null,
    evenementHeure:  msg.nature === 'annonce' ? (msg.evenementHeure || null) : null,
    important:       msg.nature === 'annonce' ? Boolean(msg.important) : false,
    epingle:         false,
    createdAt:       now,
    updatedAt:       now,
  });

  // ── Notifications (jamais bloquantes) ──
  try {
    await notifierPublication(ref.id, msg, auteur, titre, contenu);
  } catch (e) {
    console.warn('[communicationService] notification non envoyée :', e);
  }
  return ref.id;
}

/** Choisit les destinataires de la notification selon la nature du message */
async function notifierPublication(
  messageId: string,
  msg: NouveauMessage,
  auteur: { id: string; nom: string; role: RoleAuteurMessage },
  titre: string,
  contenu: string
): Promise<void> {
  const base = {
    emetteurId: auteur.id,
    emetteurNom: auteur.nom,
    entiteId: msg.groupeId,       // groupe concerné (utilisé par les règles)
    entiteType: 'autre' as const,
    canal: 'in_app' as const,     // pas d'e-mail automatique
  };

  if (auteur.role === 'eleve') {
    // Élève → forum : seul le professeur du groupe est prévenu
    // (les camarades voient la pastille « nouveaux » dans le forum).
    await creerNotification({
      ...base,
      destinataireId: msg.profId,
      destinataireRole: 'prof',
      type: 'message_forum',
      titre: `💬 Forum ${msg.groupeNom}`,
      message: `${auteur.nom} : ${extrait(contenu)}`,
      lienAction: lienEspaceProf(msg.groupeId, 'forum'),
      labelAction: 'Voir le forum',
    });
    return;
  }

  // ── Professeur ──
  if (msg.nature === 'prive' && msg.destinataireId) {
    await creerNotification({
      ...base,
      destinataireId: msg.destinataireId,
      destinataireRole: 'eleve',
      type: 'message_prof',
      titre: titre || `✉️ Message de ${auteur.nom}`,
      message: extrait(contenu),
      lienAction: lienEspaceEleve(msg.groupeId, 'prive'),
      labelAction: 'Lire le message',
    });
    return;
  }

  if (msg.nature === 'annonce') {
    const quand = msg.evenementDate
      ? ` — le ${new Date(`${msg.evenementDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${msg.evenementHeure ? ` à ${msg.evenementHeure}` : ''}`
      : '';
    await envoyerNotificationGroupe(msg.groupeId, {
      ...base,
      type: 'annonce',
      titre: `📢 ${titre || 'Nouvelle annonce'}${quand}`,
      message: `${msg.groupeNom} · ${extrait(contenu)}`,
      lienAction: lienEspaceEleve(msg.groupeId, 'annonce'),
      labelAction: 'Voir l\'annonce',
    });
    return;
  }

  // Forum (prof) : tout le groupe est prévenu
  await envoyerNotificationGroupe(msg.groupeId, {
    ...base,
    type: 'message_forum',
    titre: `💬 Forum ${msg.groupeNom}`,
    message: `${auteur.nom} : ${extrait(contenu)}`,
    lienAction: lienEspaceEleve(msg.groupeId, 'forum'),
    labelAction: 'Voir le forum',
  });
  void messageId;
}

// ============================================================
// LECTURE EN TEMPS RÉEL
// ============================================================

const versMessage = (id: string, data: Record<string, unknown>) => ({ id, ...data } as MessageClasse);

/**
 * Fil PUBLIC d'un groupe (annonces + forum), du plus récent au plus ancien.
 * Index : groupeId ASC, portee ASC, createdAt DESC.
 */
export function ecouterMessagesGroupe(
  groupeId: string,
  onData: (liste: MessageClasse[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, COL_MESSAGES),
    where('groupeId', '==', groupeId),
    where('portee', '==', 'groupe'),
    orderBy('createdAt', 'desc'),
    limit(LIMITE_FIL)
  );
  return onSnapshot(q, s => onData(s.docs.map(d => versMessage(d.id, d.data()))), e => onError?.(e));
}

/**
 * Messages privés envoyés par le prof dans un groupe.
 * La requête filtre sur profId : Firestore peut prouver la règle de lecture.
 * Index : profId ASC, groupeId ASC, portee ASC, createdAt DESC.
 */
export function ecouterMessagesPrivesProf(
  profId: string,
  groupeId: string,
  onData: (liste: MessageClasse[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, COL_MESSAGES),
    where('profId', '==', profId),
    where('groupeId', '==', groupeId),
    where('portee', '==', 'individuel'),
    orderBy('createdAt', 'desc'),
    limit(LIMITE_FIL)
  );
  return onSnapshot(q, s => onData(s.docs.map(d => versMessage(d.id, d.data()))), e => onError?.(e));
}

/**
 * Messages privés reçus par un élève (tous groupes confondus).
 * Index : destinataireId ASC, createdAt DESC.
 */
export function ecouterMessagesPrivesEleve(
  eleveId: string,
  onData: (liste: MessageClasse[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(
    collection(db, COL_MESSAGES),
    where('destinataireId', '==', eleveId),
    orderBy('createdAt', 'desc'),
    limit(LIMITE_FIL)
  );
  return onSnapshot(q, s => onData(s.docs.map(d => versMessage(d.id, d.data()))), e => onError?.(e));
}

/**
 * Inscriptions ACTIVES d'un élève : groupeId → inscriptionId.
 * L'inscriptionId prouve l'appartenance au groupe lors d'un message forum.
 */
export async function getInscriptionsActivesEleve(eleveId: string): Promise<Map<string, string>> {
  const snap = await getDocs(query(
    collection(db, 'inscriptions_groupe'),
    where('eleveId', '==', eleveId),
    where('statut', '==', 'actif')
  ));
  return new Map(snap.docs.map(d => [String(d.data().groupeId), d.id]));
}

// ============================================================
// ACTIONS
// ============================================================

/** Épingle / désépingle une annonce (professeur du groupe) */
export async function basculerEpingle(messageId: string, epingle: boolean): Promise<void> {
  await updateDoc(doc(db, COL_MESSAGES, messageId), { epingle, updatedAt: Timestamp.now() });
}

/** Supprime un message (son auteur, ou le professeur du groupe pour modérer) */
export async function supprimerMessage(messageId: string): Promise<void> {
  await deleteDoc(doc(db, COL_MESSAGES, messageId));
}

// ============================================================
// BADGE « NON LUS » DU FORUM (mémorisé dans le navigateur)
// ============================================================

const cleVu = (uid: string, groupeId: string, nature: string) => `pedaclic:vu:${nature}:${uid}:${groupeId}`;

/** Date (ms) de la dernière consultation d'un onglet — 0 si jamais vu */
export function derniereVisite(uid: string, groupeId: string, nature: string): number {
  try { return Number(localStorage.getItem(cleVu(uid, groupeId, nature)) || 0); } catch { return 0; }
}

/** Mémorise la consultation d'un onglet (maintenant) */
export function marquerVu(uid: string, groupeId: string, nature: string): void {
  try { localStorage.setItem(cleVu(uid, groupeId, nature), String(Date.now())); } catch { /* stockage indisponible */ }
}

// ============================================================
// NOTIFICATIONS « CAHIER DE TEXTES » (appelées par cahierTextesService)
// ============================================================

// Anti-rafale : une même séance ne notifie pas plus d'une fois toutes les 15 min
const DELAI_ANTI_RAFALE_MS = 15 * 60 * 1000;
const dernieresNotifsSeance = new Map<string, number>();

/**
 * Prévient les élèves des groupes liés au cahier qu'une séance a été
 * saisie, planifiée ou mise à jour. Ne fait rien si le cahier n'est
 * pas partagé avec les élèves. N'échoue jamais (erreurs journalisées).
 */
export async function notifierElevesSeance(params: {
  entreeId: string;
  cahierId: string;
  chapitre?: string;
  statut?: string;
  date?: Date | null;
  nature: 'creation' | 'mise_a_jour';
}): Promise<void> {
  try {
    // Anti-rafale (enregistrements successifs d'une même séance)
    const derniere = dernieresNotifsSeance.get(params.entreeId) ?? 0;
    if (Date.now() - derniere < DELAI_ANTI_RAFALE_MS) return;

    const snap = await getDoc(doc(db, 'cahiers_textes', params.cahierId));
    if (!snap.exists()) return;
    const cahier = snap.data() as { isPartage?: boolean; groupeIds?: string[]; titre?: string; classe?: string; matiere?: string; profNom?: string };
    if (!cahier.isPartage || !cahier.groupeIds?.length) return; // cahier non partagé → silence

    dernieresNotifsSeance.set(params.entreeId, Date.now());

    const libelleCahier = cahier.titre || [cahier.classe, cahier.matiere].filter(Boolean).join(' · ') || 'Cahier de textes';
    const quand = params.date ? ` du ${params.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : '';
    const chapitre = params.chapitre ? ` : « ${extrait(params.chapitre, 80)} »` : '';
    const titre = params.nature === 'mise_a_jour'
      ? `🔄 Séance mise à jour — ${libelleCahier}`
      : params.statut === 'planifie'
        ? `🗓️ Séance prévue — ${libelleCahier}`
        : `📒 Nouvelle séance — ${libelleCahier}`;

    await Promise.all(cahier.groupeIds.map(gid =>
      envoyerNotificationGroupe(gid, {
        type: 'seance_cahier',
        titre,
        message: `Séance${quand}${chapitre}`,
        lienAction: `/eleve/cahiers/${params.cahierId}`,
        labelAction: 'Ouvrir le cahier',
        emetteurNom: cahier.profNom,
        entiteId: params.cahierId,
        entiteType: 'autre',
        canal: 'in_app',
      }).catch(e => console.warn('[communicationService] notif séance (groupe', gid, ') :', e))
    ));
  } catch (e) {
    console.warn('[communicationService] notifierElevesSeance :', e);
  }
}
