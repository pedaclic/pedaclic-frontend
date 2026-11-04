// ============================================================
// PedaClic — Phase 49 : Service « Cellules pédagogiques »
// ------------------------------------------------------------
// Toutes les requêtes sont prouvables par les règles Firestore :
//   • mes cellules : where('membreIds', 'array-contains', uid)
//   • sous-collections : l'appartenance est vérifiée sur la cellule
//     parente (chemin connu) → aucun index composite nécessaire.
// ============================================================

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Cellule,
  CelluleFormData,
  DemandeAdhesion,
  ProgressionCellule,
  RessourceCellule,
  AvancementMembre,
  // Phase 50 — lot 2
  EvenementCellule,
  EvenementFormData,
  CompteRenduCellule,
  CompteRenduFormData,
  CommentaireCR,
} from '../types/cellule.types';
import { TYPE_EVENEMENT_CONFIG, dateLongue } from '../types/cellule.types';
import { creerNotification } from './notificationService';
import { genererCodeCellule, normaliserCode } from '../types/cellule.types';
import type { CahierTextes, EntreeCahier, RubriqueCahier } from '../types/cahierTextes.types';
import {
  updateCahier,
  createEntree,
  getEntreesCahier,
  calculerProgression,
  normaliserLibelleRubrique,
  COULEURS_RUBRIQUES,
} from './cahierTextesService';

const COL_CELLULES = 'cellules';
const COL_CODES    = 'cellules_codes';

/** Utilisateur courant (nom affiché dans la cellule) */
export interface Auteur { uid: string; nom: string }

const sousCol = (celluleId: string, nom: string) => collection(db, COL_CELLULES, celluleId, nom);

function versCellule(id: string, data: Record<string, unknown>): Cellule {
  return {
    description: '', ief: '', etablissementNom: '', membres: {}, membreIds: [], codeInvitation: '',
    ...(data as Partial<Cellule>),
    id,
  } as Cellule;
}

// ─────────────────────────────────────────────────────────────
// CELLULES — lecture
// ─────────────────────────────────────────────────────────────

/** Cellules dont je suis membre (animateur compris) */
export function subscribeMesCellules(
  uid: string,
  onData: (cellules: Cellule[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, COL_CELLULES), where('membreIds', 'array-contains', uid));
  return onSnapshot(
    q,
    snap => onData(
      snap.docs.map(d => versCellule(d.id, d.data()))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    ),
    onError
  );
}

export function subscribeCellule(
  celluleId: string,
  onData: (cellule: Cellule | null) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, COL_CELLULES, celluleId),
    snap => onData(snap.exists() ? versCellule(snap.id, snap.data()) : null),
    onError
  );
}

// ─────────────────────────────────────────────────────────────
// CELLULES — création, code d'invitation
// ─────────────────────────────────────────────────────────────

/** Tire un code libre (vérifie qu'il n'est pas déjà attribué) */
async function codeLibre(): Promise<string> {
  for (let essai = 0; essai < 6; essai++) {
    const code = genererCodeCellule();
    const snap = await getDoc(doc(db, COL_CODES, code));
    if (!snap.exists()) return code;
  }
  throw new Error('Impossible de générer un code d\'invitation. Réessayez.');
}

/** Crée une cellule ; l'auteur en devient l'animateur */
export async function creerCellule(auteur: Auteur, form: CelluleFormData): Promise<string> {
  const now = Timestamp.now();
  const code = await codeLibre();
  const ref = await addDoc(collection(db, COL_CELLULES), {
    nom: form.nom.trim(),
    discipline: form.discipline,
    portee: form.portee,
    etablissementNom: form.etablissementNom.trim(),
    ief: form.ief.trim(),
    anneeScolaire: form.anneeScolaire,
    description: form.description.trim(),
    animateurId: auteur.uid,
    animateurNom: auteur.nom,
    membreIds: [auteur.uid],
    membres: { [auteur.uid]: { nom: auteur.nom, role: 'animateur', depuis: now } },
    codeInvitation: code,
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, COL_CODES, code), { celluleId: ref.id, animateurId: auteur.uid, createdAt: now });
  return ref.id;
}

export async function modifierCellule(celluleId: string, form: CelluleFormData): Promise<void> {
  await updateDoc(doc(db, COL_CELLULES, celluleId), {
    nom: form.nom.trim(),
    discipline: form.discipline,
    portee: form.portee,
    etablissementNom: form.etablissementNom.trim(),
    ief: form.ief.trim(),
    anneeScolaire: form.anneeScolaire,
    description: form.description.trim(),
    updatedAt: Timestamp.now(),
  });
}

/** Remplace le code d'invitation (l'ancien cesse de fonctionner) */
export async function regenererCode(cellule: Cellule): Promise<string> {
  const code = await codeLibre();
  await setDoc(doc(db, COL_CODES, code), {
    celluleId: cellule.id, animateurId: cellule.animateurId, createdAt: Timestamp.now(),
  });
  await updateDoc(doc(db, COL_CELLULES, cellule.id), { codeInvitation: code, updatedAt: Timestamp.now() });
  if (cellule.codeInvitation) {
    try { await deleteDoc(doc(db, COL_CODES, cellule.codeInvitation)); } catch { /* déjà supprimé */ }
  }
  return code;
}

// ─────────────────────────────────────────────────────────────
// ADHÉSION
// ─────────────────────────────────────────────────────────────

/**
 * Envoie une demande d'adhésion avec un code.
 * Retourne 'deja-membre' | 'envoyee'. Lève une erreur si le code est inconnu.
 */
export async function demanderAdhesion(saisie: string, auteur: Auteur): Promise<'deja-membre' | 'envoyee'> {
  const code = normaliserCode(saisie);
  if (code.length < 4) throw new Error('Code trop court.');
  const codeSnap = await getDoc(doc(db, COL_CODES, code));
  if (!codeSnap.exists()) throw new Error('Code inconnu ou expiré. Vérifiez-le auprès de l\'animateur.');
  const celluleId = String(codeSnap.data().celluleId);

  // Déjà membre ? (lecture autorisée seulement aux membres → échec = non membre)
  try {
    const c = await getDoc(doc(db, COL_CELLULES, celluleId));
    if (c.exists() && (c.data().membreIds ?? []).includes(auteur.uid)) return 'deja-membre';
  } catch { /* non membre : on continue */ }

  // Demande déjà envoyée ? (les règles interdisent de la réécrire)
  const refDemande = doc(db, COL_CELLULES, celluleId, 'demandes', auteur.uid);
  if ((await getDoc(refDemande)).exists()) return 'envoyee';

  await setDoc(refDemande, {
    nom: auteur.nom,
    code,
    createdAt: Timestamp.now(),
  });
  // Phase 50 — l'animateur est prévenu (son uid est dans le document du code)
  await notifier([String(codeSnap.data().animateurId ?? '')], auteur, {
    titre: '🙋 Nouvelle demande d\'adhésion',
    message: `${auteur.nom} souhaite rejoindre votre cellule.`,
    lien: `/prof/cellules/${celluleId}?onglet=membres`,
    celluleId,
  });
  return 'envoyee';
}

export function subscribeDemandes(
  celluleId: string,
  onData: (demandes: DemandeAdhesion[]) => void
): () => void {
  return onSnapshot(
    query(sousCol(celluleId, 'demandes'), orderBy('createdAt', 'asc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandeAdhesion))),
    () => onData([])
  );
}

/** L'animateur accepte : ajout aux membres puis suppression de la demande */
export async function accepterDemande(
  celluleId: string,
  demande: DemandeAdhesion,
  animateur?: Auteur,
  nomCellule = 'la cellule'
): Promise<void> {
  await updateDoc(doc(db, COL_CELLULES, celluleId), {
    membreIds: arrayUnion(demande.id),
    [`membres.${demande.id}`]: { nom: demande.nom, role: 'membre', depuis: Timestamp.now() },
    updatedAt: Timestamp.now(),
  });
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'demandes', demande.id));
  // Phase 50 — le nouveau membre est prévenu
  if (animateur) {
    await notifier([demande.id], animateur, {
      titre: '✅ Adhésion acceptée',
      message: `Vous êtes désormais membre de « ${nomCellule} ».`,
      lien: `/prof/cellules/${celluleId}`,
      celluleId,
    });
  }
}

export async function refuserDemande(celluleId: string, demandeId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'demandes', demandeId));
}

/** L'animateur retire un membre */
export async function retirerMembre(celluleId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, COL_CELLULES, celluleId), {
    membreIds: arrayRemove(uid),
    [`membres.${uid}`]: deleteField(),
    updatedAt: Timestamp.now(),
  });
}

/** Un membre quitte la cellule (son avancement publié est retiré) */
export async function quitterCellule(celluleId: string, uid: string): Promise<void> {
  try { await deleteDoc(doc(db, COL_CELLULES, celluleId, 'avancements', uid)); } catch { /* absent */ }
  await updateDoc(doc(db, COL_CELLULES, celluleId), {
    membreIds: arrayRemove(uid),
    updatedAt: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// PROGRESSIONS COMMUNES
// ─────────────────────────────────────────────────────────────
export function subscribeProgressions(
  celluleId: string,
  onData: (liste: ProgressionCellule[]) => void
): () => void {
  return onSnapshot(
    query(sousCol(celluleId, 'progressions'), orderBy('updatedAt', 'desc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProgressionCellule))),
    () => onData([])
  );
}

export async function enregistrerProgression(
  celluleId: string,
  auteur: Auteur,
  donnees: Pick<ProgressionCellule, 'titre' | 'classe' | 'rubriques'>,
  progressionId?: string
): Promise<void> {
  const now = Timestamp.now();
  const payload = {
    titre: donnees.titre.trim(),
    classe: donnees.classe,
    rubriques: donnees.rubriques,
    auteurId: auteur.uid,
    auteurNom: auteur.nom,
    updatedAt: now,
  };
  if (progressionId) {
    await updateDoc(doc(db, COL_CELLULES, celluleId, 'progressions', progressionId), payload);
  } else {
    await addDoc(sousCol(celluleId, 'progressions'), { ...payload, createdAt: now });
  }
}

export async function supprimerProgression(celluleId: string, progressionId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'progressions', progressionId));
}

/**
 * Importe une progression dans MON cahier : les rubriques absentes
 * (comparaison sans casse ni accents) sont AJOUTÉES à la fin.
 * Rien n'est remplacé : les séances déjà rattachées restent intactes.
 * Retourne le nombre de rubriques ajoutées.
 */
export async function importerProgressionDansCahier(
  cahier: CahierTextes,
  progression: ProgressionCellule
): Promise<number> {
  const existantes = cahier.rubriques ?? [];
  const nomsExistants = new Set(existantes.map(r => normaliserLibelleRubrique(r.nom)));
  const base = Date.now();
  const ajouts: RubriqueCahier[] = progression.rubriques
    .filter(r => !nomsExistants.has(normaliserLibelleRubrique(r.nom)))
    .map((r, i) => ({
      id: `${base}_${i}`,
      nom: r.nom,
      ordre: existantes.length + i,
      couleur: r.couleur ?? COULEURS_RUBRIQUES[(existantes.length + i) % COULEURS_RUBRIQUES.length],
      ...(r.nombreSeancesPrevu ? { nombreSeancesPrevu: r.nombreSeancesPrevu } : {}),
      ...(r.titres?.length
        ? { titres: r.titres.map((t, j) => ({ id: `${base}_${i}_${j}`, nom: t.nom, ordre: j, statut: 'non_commence' as const })) }
        : {}),
    }));
  if (ajouts.length) await updateCahier(cahier.id, { rubriques: [...existantes, ...ajouts] });
  return ajouts.length;
}

// ─────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE SÉANCES
// ─────────────────────────────────────────────────────────────
export function subscribeRessources(
  celluleId: string,
  onData: (liste: RessourceCellule[]) => void
): () => void {
  return onSnapshot(
    query(sousCol(celluleId, 'ressources'), orderBy('createdAt', 'desc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as RessourceCellule))),
    () => onData([])
  );
}

/** Partage une séance : copie SANS notes privées ni pièces jointes */
export async function partagerSeance(
  celluleId: string,
  auteur: Auteur,
  entree: EntreeCahier,
  cahier: CahierTextes
): Promise<void> {
  await addDoc(sousCol(celluleId, 'ressources'), {
    type: 'seance',
    titre: entree.chapitre || 'Séance sans titre',
    classe: cahier.classe,
    matiere: cahier.matiere,
    typeContenu: entree.typeContenu,
    contenu: entree.contenu ?? '',
    objectifs: entree.objectifs ?? '',
    competences: entree.competences ?? [],
    exerciceJour: entree.exerciceJour ?? '',
    exerciceDomicile: entree.exerciceDomicile ?? '',
    liens: entree.liens ?? [],
    auteurId: auteur.uid,
    auteurNom: auteur.nom,
    createdAt: Timestamp.now(),
  });
}

export async function supprimerRessource(celluleId: string, ressourceId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'ressources', ressourceId));
}

/** Copie une séance de la bibliothèque dans MON cahier (statut « planifié ») */
export async function dupliquerRessourceDansCahier(
  ressource: RessourceCellule,
  cahier: CahierTextes,
  uid: string
): Promise<string> {
  return createEntree({
    cahierId: cahier.id,
    profId: uid,
    date: Timestamp.now(),
    heureDebut: '',
    heureFin: '',
    chapitre: ressource.titre,
    typeContenu: ressource.typeContenu,
    contenu: ressource.contenu,
    objectifs: ressource.objectifs,
    competences: ressource.competences ?? [],
    rubrique: '',
    statut: 'planifie',
    isMarqueEvaluation: false,
    ordre: Date.now(),
    exerciceJour: ressource.exerciceJour ?? '',
    exerciceDomicile: ressource.exerciceDomicile ?? '',
    liens: ressource.liens ?? [],
  });
}

// ─────────────────────────────────────────────────────────────
// AVANCEMENT DES MEMBRES
// ─────────────────────────────────────────────────────────────
export function subscribeAvancements(
  celluleId: string,
  onData: (liste: AvancementMembre[]) => void
): () => void {
  return onSnapshot(
    sousCol(celluleId, 'avancements'),
    snap => onData(
      snap.docs.map(d => ({ id: d.id, ...d.data() } as AvancementMembre))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    ),
    () => onData([])
  );
}

/** Calcule et publie MON avancement pour un de mes cahiers */
export async function publierAvancement(celluleId: string, auteur: Auteur, cahier: CahierTextes): Promise<void> {
  const entrees = await getEntreesCahier(cahier.id, cahier.profId);
  const prog = calculerProgression(entrees, cahier.rubriques ?? []);
  // Même calcul que le widget de progression du cahier (cohérence d'affichage)
  const realiseGlobal = prog.global.realise;
  const prevuGlobal = prog.global.seancesPrevu ?? (prog.global.realise + prog.global.planifie);
  await setDoc(doc(db, COL_CELLULES, celluleId, 'avancements', auteur.uid), {
    nom: auteur.nom,
    cahierId: cahier.id,
    cahierTitre: cahier.titre,
    classe: cahier.classe,
    global: {
      realise: realiseGlobal,
      prevu: prevuGlobal,
      pourcentage: Math.round(prog.global.pourcentage),
    },
    parRubrique: prog.parRubrique
      .filter(r => r.rubriqueId !== null)          // ignore « Sans rubrique »
      .map(r => ({
        nom: r.rubriqueNom,
        couleur: r.couleur,
        realise: r.realise,
        prevu: r.seancesPrevu ?? (r.realise + r.planifie),
        pourcentage: Math.round(r.pourcentage),
      })),
    updatedAt: Timestamp.now(),
  });
}

export async function retirerAvancement(celluleId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'avancements', uid));
}

// ═════════════════════════════════════════════════════════════
// PHASE 50 — LOT 2
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS (cloche de l'en-tête)
//   Une notification par destinataire (modèle existant de
//   notificationService). Jamais bloquant : un échec d'envoi
//   n'empêche pas l'action principale.
// ─────────────────────────────────────────────────────────────
async function notifier(
  destinataires: string[],
  emetteur: Auteur,
  contenu: { titre: string; message: string; lien: string; celluleId: string }
): Promise<void> {
  const cibles = Array.from(new Set(destinataires)).filter(id => id && id !== emetteur.uid);
  await Promise.allSettled(cibles.map(id => creerNotification({
    destinataireId: id,
    destinataireRole: 'prof',
    type: 'annonce',
    titre: contenu.titre,
    message: contenu.message,
    lienAction: contenu.lien,
    labelAction: 'Ouvrir la cellule',
    emetteurId: emetteur.uid,
    emetteurNom: emetteur.nom,
    entiteId: contenu.celluleId,
    entiteType: 'autre',
    canal: 'in_app',
  })));
}

/** Prévient tous les membres de la cellule (sauf l'auteur de l'action) */
export async function notifierMembres(
  cellule: Pick<Cellule, 'id' | 'membreIds'>,
  emetteur: Auteur,
  contenu: { titre: string; message: string; onglet: string }
): Promise<void> {
  await notifier(cellule.membreIds, emetteur, {
    titre: contenu.titre,
    message: contenu.message,
    lien: `/prof/cellules/${cellule.id}?onglet=${contenu.onglet}`,
    celluleId: cellule.id,
  });
}

// ─────────────────────────────────────────────────────────────
// CALENDRIER DE CELLULE
//   Tri par date côté client (aucun index composite).
// ─────────────────────────────────────────────────────────────
export function subscribeEvenements(
  celluleId: string,
  onData: (liste: EvenementCellule[]) => void
): () => void {
  return onSnapshot(
    sousCol(celluleId, 'evenements'),
    snap => onData(
      snap.docs.map(d => ({ id: d.id, ...d.data() } as EvenementCellule))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.heure || '').localeCompare(b.heure || ''))
    ),
    () => onData([])
  );
}

export async function enregistrerEvenement(
  cellule: Pick<Cellule, 'id' | 'membreIds'>,
  auteur: Auteur,
  form: EvenementFormData,
  options: { evenementId?: string; prevenir: boolean }
): Promise<void> {
  const now = Timestamp.now();
  const payload = {
    type: form.type,
    titre: form.titre.trim(),
    date: form.date,
    heure: form.heure,
    duree: form.heure ? Math.max(0, Number(form.duree) || 0) : 0,
    lieu: form.lieu.trim(),
    classe: form.classe,
    description: form.description.trim(),
    auteurId: auteur.uid,
    auteurNom: auteur.nom,
    updatedAt: now,
  };
  if (options.evenementId) {
    await updateDoc(doc(db, COL_CELLULES, cellule.id, 'evenements', options.evenementId), payload);
  } else {
    await addDoc(sousCol(cellule.id, 'evenements'), { ...payload, createdAt: now });
  }
  if (options.prevenir) {
    const cfg = TYPE_EVENEMENT_CONFIG[form.type];
    await notifierMembres(cellule, auteur, {
      titre: `${cfg.emoji} ${options.evenementId ? 'Événement modifié' : cfg.label}`,
      message: `${form.titre.trim()} — ${dateLongue(form.date)}${form.heure ? ` à ${form.heure}` : ''}${form.classe ? ` (${form.classe})` : ''}`,
      onglet: 'calendrier',
    });
  }
}

export async function supprimerEvenement(celluleId: string, evenementId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'evenements', evenementId));
}

// ─────────────────────────────────────────────────────────────
// COMPTES RENDUS DE RÉUNION + COMMENTAIRES
// ─────────────────────────────────────────────────────────────
export function subscribeComptesRendus(
  celluleId: string,
  onData: (liste: CompteRenduCellule[]) => void
): () => void {
  return onSnapshot(
    sousCol(celluleId, 'comptesRendus'),
    snap => onData(
      snap.docs.map(d => ({ id: d.id, ...d.data() } as CompteRenduCellule))
        .sort((a, b) => b.dateReunion.localeCompare(a.dateReunion))
    ),
    () => onData([])
  );
}

export async function enregistrerCompteRendu(
  cellule: Pick<Cellule, 'id' | 'membreIds'>,
  auteur: Auteur,
  form: CompteRenduFormData,
  options: { compteRenduId?: string; prevenir: boolean }
): Promise<void> {
  const now = Timestamp.now();
  const payload = {
    titre: form.titre.trim(),
    dateReunion: form.dateReunion,
    lieu: form.lieu.trim(),
    presentsIds: form.presentsIds,
    presentsNoms: form.presentsNoms,
    ordreDuJour: form.ordreDuJour.trim(),
    deliberations: form.deliberations.trim(),
    decisions: form.decisions.trim(),
    prochaineReunion: form.prochaineReunion,
    auteurId: auteur.uid,
    auteurNom: auteur.nom,
    updatedAt: now,
  };
  if (options.compteRenduId) {
    await updateDoc(doc(db, COL_CELLULES, cellule.id, 'comptesRendus', options.compteRenduId), payload);
  } else {
    await addDoc(sousCol(cellule.id, 'comptesRendus'), { ...payload, createdAt: now });
  }
  if (options.prevenir) {
    await notifierMembres(cellule, auteur, {
      titre: options.compteRenduId ? '📝 Compte rendu mis à jour' : '📝 Nouveau compte rendu',
      message: `${form.titre.trim()} — réunion du ${dateLongue(form.dateReunion)}`,
      onglet: 'comptes-rendus',
    });
  }
}

export async function supprimerCompteRendu(celluleId: string, compteRenduId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'comptesRendus', compteRenduId));
}

export function subscribeCommentaires(
  celluleId: string,
  compteRenduId: string,
  onData: (liste: CommentaireCR[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, COL_CELLULES, celluleId, 'comptesRendus', compteRenduId, 'commentaires'), orderBy('createdAt', 'asc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentaireCR))),
    () => onData([])
  );
}

export async function ajouterCommentaire(
  celluleId: string,
  compteRenduId: string,
  auteur: Auteur,
  texte: string
): Promise<void> {
  await addDoc(collection(db, COL_CELLULES, celluleId, 'comptesRendus', compteRenduId, 'commentaires'), {
    texte: texte.trim().slice(0, 2000),
    auteurId: auteur.uid,
    auteurNom: auteur.nom,
    createdAt: Timestamp.now(),
  });
}

export async function supprimerCommentaire(celluleId: string, compteRenduId: string, commentaireId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'comptesRendus', compteRenduId, 'commentaires', commentaireId));
}
