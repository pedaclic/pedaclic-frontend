// ============================================================
// PedaClic — liveService.ts
// Phase 28 : Service Firestore — Sessions YouTube Live
//
// Fonctions disponibles :
//   • extractYoutubeIdLive()     — extraire l'ID d'une URL YouTube Live
//   • creerSession()             — créer une session live
//   • modifierSession()          — modifier une session
//   • changerStatutSession()     — planifie → en_direct → termine / annule
//   • supprimerSession()         — supprimer une session
//   • getSessionsPubliques()     — catalogue élève (toutes sessions)
//   • getSessionsProf()          — sessions du prof connecté
//   • getSessionById()           — détail d'une session
//   • incrementerVues()          — compteur de vues
//   • envoyerNotifSession()      — notification via Phase 26
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  LiveSession,
  LiveSessionFormData,
  StatutLive,
  FiltresLive,
} from './live_types';
import {
  envoyerNotificationGroupe,
  envoyerNotificationRole,
} from './notificationService';

// ─────────────────────────────────────────────────────────────
// CONSTANTE — Nom de la collection Firestore
// ─────────────────────────────────────────────────────────────
const COL_LIVE = 'live_sessions';

// ─────────────────────────────────────────────────────────────
// UTILITAIRE — Extraction de l'ID YouTube (Live + VOD)
// ─────────────────────────────────────────────────────────────

/**
 * Extrait l'ID YouTube depuis les formats d'URL Live courants.
 * Formats supportés :
 *   https://www.youtube.com/watch?v=XXXX
 *   https://youtu.be/XXXX
 *   https://www.youtube.com/live/XXXX
 *   https://www.youtube.com/embed/XXXX
 * Retourne null si l'URL n'est pas reconnue.
 */
export function extractYoutubeIdLive(url: string): string | null {
  const regexes = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/live\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const re of regexes) {
    const match = url.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Construit l'URL d'embed YouTube pour un live ou un replay.
 * Paramètres :
 *   autoplay=0       → ne démarre pas seul (économie bande passante)
 *   rel=0            → pas de suggestions YouTube à la fin
 *   modestbranding=1 → logo YouTube réduit
 */
export function buildEmbedUrl(youtubeId: string): string {
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&modestbranding=1`;
}

// ─────────────────────────────────────────────────────────────
// CONVERSION — Document Firestore → objet typé
// ─────────────────────────────────────────────────────────────

function docToSession(id: string, data: Record<string, unknown>): LiveSession {
  return {
    id,
    profId:              data.profId              as string,
    profNom:             data.profNom             as string,
    titre:               data.titre               as string,
    description:         data.description         as string,
    matiere:             data.matiere             as string,
    niveau:              data.niveau              as string,
    classe:              data.classe              as string,
    urlYoutube:          data.urlYoutube          as string,
    youtubeId:           data.youtubeId           as string,
    dateDebut:           data.dateDebut           as Timestamp,
    dureeEstimee:        data.dureeEstimee        as number,
    acces:               data.acces               as LiveSession['acces'],
    groupeId:            data.groupeId            as string | undefined,
    groupeNom:           data.groupeNom           as string | undefined,
    statut:              data.statut              as StatutLive,
    replayDisponible:    data.replayDisponible    as boolean,
    messageAnnulation:   data.messageAnnulation   as string | undefined,
    notificationEnvoyee: data.notificationEnvoyee as boolean,
    nombreVues:          data.nombreVues          as number,
    createdAt:           data.createdAt           as Timestamp,
    updatedAt:           data.updatedAt           as Timestamp,
  };
}

// ─────────────────────────────────────────────────────────────
// CRÉATION
// ─────────────────────────────────────────────────────────────

/**
 * Crée une nouvelle session live dans Firestore.
 *
 * @param form      - Données du formulaire
 * @param profId    - UID du prof connecté
 * @param profNom   - Nom affiché du prof
 * @returns         - L'objet LiveSession complet avec son ID Firestore
 * @throws          - Si l'URL YouTube est invalide
 */
export async function creerSession(
  form: LiveSessionFormData,
  profId: string,
  profNom: string
): Promise<LiveSession> {
  // Validation URL YouTube
  const youtubeId = extractYoutubeIdLive(form.urlYoutube);
  if (!youtubeId) {
    throw new Error('URL YouTube invalide. Exemples : https://youtu.be/XXXX ou https://www.youtube.com/live/XXXX');
  }

  const now = Timestamp.now();
  const dateDebut = Timestamp.fromDate(new Date(form.dateDebut));

  const payload: Omit<LiveSession, 'id'> = {
    profId,
    profNom,
    titre:               form.titre.trim(),
    description:         form.description.trim(),
    matiere:             form.matiere,
    niveau:              form.niveau,
    classe:              form.classe,
    urlYoutube:          form.urlYoutube.trim(),
    youtubeId,
    dateDebut,
    dureeEstimee:        form.dureeEstimee,
    acces:               form.acces,
    groupeId:            form.groupeId  || undefined,
    groupeNom:           form.groupeNom || undefined,
    statut:              'planifie',
    replayDisponible:    false,
    notificationEnvoyee: false,
    nombreVues:          0,
    createdAt:           now,
    updatedAt:           now,
  };

  const ref = await addDoc(collection(db, COL_LIVE), payload);
  const session: LiveSession = { id: ref.id, ...payload };

  // Envoi de la notification si demandé
  if (form.envoyerNotif) {
    await envoyerNotifSession(session, profId, profNom);
    // Marquer comme envoyée
    await updateDoc(ref, { notificationEnvoyee: true });
    session.notificationEnvoyee = true;
  }

  return session;
}

// ─────────────────────────────────────────────────────────────
// MODIFICATION
// ─────────────────────────────────────────────────────────────

/**
 * Met à jour les informations d'une session existante.
 * Ne peut être appelée que si la session est encore 'planifie'.
 */
export async function modifierSession(
  sessionId: string,
  form: Partial<LiveSessionFormData>
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  // Champs texte
  if (form.titre       !== undefined) updates.titre       = form.titre.trim();
  if (form.description !== undefined) updates.description = form.description.trim();
  if (form.matiere     !== undefined) updates.matiere     = form.matiere;
  if (form.niveau      !== undefined) updates.niveau      = form.niveau;
  if (form.classe      !== undefined) updates.classe      = form.classe;
  if (form.dureeEstimee !== undefined) updates.dureeEstimee = form.dureeEstimee;
  if (form.acces       !== undefined) updates.acces       = form.acces;
  if (form.groupeId    !== undefined) updates.groupeId    = form.groupeId  || null;
  if (form.groupeNom   !== undefined) updates.groupeNom   = form.groupeNom || null;

  // Recalcul de l'ID YouTube si l'URL change
  if (form.urlYoutube !== undefined) {
    const newId = extractYoutubeIdLive(form.urlYoutube);
    if (!newId) throw new Error('URL YouTube invalide.');
    updates.urlYoutube = form.urlYoutube.trim();
    updates.youtubeId  = newId;
  }

  // Reconversion de la date
  if (form.dateDebut !== undefined && form.dateDebut) {
    updates.dateDebut = Timestamp.fromDate(new Date(form.dateDebut));
  }

  await updateDoc(doc(db, COL_LIVE, sessionId), updates);
}

// ─────────────────────────────────────────────────────────────
// CHANGEMENT DE STATUT
// ─────────────────────────────────────────────────────────────

/**
 * Change le statut d'une session.
 *
 * Transitions autorisées :
 *   planifie   → en_direct  (prof démarre le live)
 *   en_direct  → termine    (prof termine le live, replay activé)
 *   planifie   → annule     (prof annule avant le début)
 *   en_direct  → annule     (prof annule en cours)
 *
 * @param sessionId         - ID de la session
 * @param nouveauStatut     - Nouveau statut cible
 * @param messageAnnulation - Message optionnel si annule
 */
export async function changerStatutSession(
  sessionId: string,
  nouveauStatut: StatutLive,
  messageAnnulation?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    statut:    nouveauStatut,
    updatedAt: Timestamp.now(),
  };

  // Le replay devient disponible quand la session se termine
  if (nouveauStatut === 'termine') {
    updates.replayDisponible = true;
  }

  // Message d'annulation optionnel
  if (nouveauStatut === 'annule' && messageAnnulation) {
    updates.messageAnnulation = messageAnnulation.trim();
  }

  await updateDoc(doc(db, COL_LIVE, sessionId), updates);
}

// ─────────────────────────────────────────────────────────────
// SUPPRESSION
// ─────────────────────────────────────────────────────────────

/**
 * Supprime définitivement une session.
 * Réservé aux sessions annulées ou au prof propriétaire.
 */
export async function supprimerSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, COL_LIVE, sessionId));
}

// ─────────────────────────────────────────────────────────────
// LECTURE — Catalogue public
// ─────────────────────────────────────────────────────────────

/**
 * Récupère toutes les sessions visibles dans le catalogue élève.
 * Exclut les sessions annulées sauf si demandé.
 * Tri : en_direct > planifie > termine (côté client après chargement).
 *
 * @param filtres - Filtres optionnels (statut, matière, niveau)
 * @returns       - Tableau de sessions triées
 */
export async function getSessionsPubliques(
  filtres?: FiltresLive
): Promise<LiveSession[]> {
  // Requête de base : toutes les sessions non annulées
  let q = query(
    collection(db, COL_LIVE),
    where('statut', 'in', ['planifie', 'en_direct', 'termine']),
    orderBy('dateDebut', 'desc'),
    limit(50)
  );

  const snap = await getDocs(q);
  let sessions = snap.docs.map(d => docToSession(d.id, d.data() as Record<string, unknown>));

  // ── Filtrage côté client ──────────────────────────────────
  if (filtres?.statut)  sessions = sessions.filter(s => s.statut  === filtres.statut);
  if (filtres?.matiere) sessions = sessions.filter(s => s.matiere === filtres.matiere);
  if (filtres?.niveau)  sessions = sessions.filter(s => s.niveau  === filtres.niveau);

  // ── Tri personnalisé : en_direct en premier, puis planifié, puis terminé ──
  const ordre: Record<StatutLive, number> = {
    en_direct: 0,
    planifie:  1,
    termine:   2,
    annule:    3,
  };
  sessions.sort((a, b) => {
    const diff = ordre[a.statut] - ordre[b.statut];
    if (diff !== 0) return diff;
    // À statut égal : les plus récents en premier
    return b.dateDebut.seconds - a.dateDebut.seconds;
  });

  return sessions;
}

// ─────────────────────────────────────────────────────────────
// LECTURE — Dashboard prof
// ─────────────────────────────────────────────────────────────

/**
 * Récupère toutes les sessions créées par un prof (incluant annulées).
 * Utilisé dans le dashboard `/prof/live`.
 */
export async function getSessionsProf(profId: string): Promise<LiveSession[]> {
  const q = query(
    collection(db, COL_LIVE),
    where('profId', '==', profId),
    orderBy('dateDebut', 'desc'),
    limit(100)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => docToSession(d.id, d.data() as Record<string, unknown>));
}

// ─────────────────────────────────────────────────────────────
// LECTURE — Détail d'une session
// ─────────────────────────────────────────────────────────────

/**
 * Récupère une session par son ID.
 * Retourne null si non trouvée.
 */
export async function getSessionById(sessionId: string): Promise<LiveSession | null> {
  const snap = await getDoc(doc(db, COL_LIVE, sessionId));
  if (!snap.exists()) return null;
  return docToSession(snap.id, snap.data() as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────
// STATISTIQUES
// ─────────────────────────────────────────────────────────────

/**
 * Incrémente le compteur de vues d'une session.
 * Appelé quand un élève ouvre la page de la session.
 * Silencieux en cas d'erreur pour ne pas bloquer l'affichage.
 */
export async function incrementerVues(sessionId: string): Promise<void> {
  try {
    await updateDoc(doc(db, COL_LIVE, sessionId), {
      nombreVues: increment(1),
    });
  } catch {
    // Silencieux — non critique
  }
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS — Phase 26
// ─────────────────────────────────────────────────────────────

/**
 * Envoie une notification d'annonce de session live.
 *
 * Stratégie de diffusion selon le type d'accès :
 *   - 'groupe'  → notification au groupe-classe ciblé (envoyerNotificationGroupe)
 *   - 'premium' → notification à tous les élèves premium (envoyerNotificationRole)
 *   - 'public'  → notification à tous les élèves (envoyerNotificationRole)
 */
export async function envoyerNotifSession(
  session: LiveSession,
  profId: string,
  profNom: string
): Promise<void> {
  // Formatage de la date pour le message
  const date = session.dateDebut.toDate();
  const dateFormatee = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    hour:    '2-digit',
    minute:  '2-digit',
  });

  const payload = {
    type:         'annonce' as const,
    titre:        `🔴 Cours en direct — ${session.titre}`,
    message:      `${profNom} organise une session live en ${session.matiere} (${session.classe}) le ${dateFormatee}. Durée prévue : ${session.dureeEstimee} min. Rejoignez-nous sur PedaClic !`,
    lienAction:   `/live/${session.id}`,
    labelAction:  '▶ Regarder le live',
    emetteurId:   profId,
    emetteurNom:  profNom,
    entiteId:     session.id,
    entiteType:   'autre' as const,
    canal:        'les_deux' as const,
  };

  if (session.acces === 'groupe' && session.groupeId) {
    // Notification ciblée au groupe-classe
    await envoyerNotificationGroupe(session.groupeId, payload);
  } else {
    // Notification à tous les élèves (public ou premium)
    await envoyerNotificationRole('eleve', payload);
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS — Calculs utilitaires
// ─────────────────────────────────────────────────────────────

/**
 * Calcule le temps restant avant le début d'une session planifiée.
 * Retourne null si la session est déjà commencée ou passée.
 */
export function tempsAvantDebut(session: LiveSession): string | null {
  if (session.statut !== 'planifie') return null;

  const maintenant = Date.now();
  const debut = session.dateDebut.toDate().getTime();
  const diff  = debut - maintenant;

  if (diff <= 0) return 'Imminent';

  const heures  = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const jours   = Math.floor(heures / 24);

  if (jours > 0)    return `Dans ${jours}j ${heures % 24}h`;
  if (heures > 0)   return `Dans ${heures}h ${minutes}min`;
  return `Dans ${minutes} min`;
}

/**
 * Vérifie si un utilisateur peut accéder à une session
 * en fonction du niveau d'accès et de son profil.
 */
export function peutAccederSession(
  session: LiveSession,
  userIsPremium: boolean,
  userGroupeIds: string[]
): boolean {
  if (session.acces === 'public')  return true;
  if (session.acces === 'premium') return userIsPremium;
  if (session.acces === 'groupe')  return session.groupeId
    ? userGroupeIds.includes(session.groupeId)
    : false;
  return false;
}
