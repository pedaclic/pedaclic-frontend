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
} from '../types/cellule.types';
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

  await setDoc(doc(db, COL_CELLULES, celluleId, 'demandes', auteur.uid), {
    nom: auteur.nom,
    code,
    createdAt: Timestamp.now(),
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
export async function accepterDemande(celluleId: string, demande: DemandeAdhesion): Promise<void> {
  await updateDoc(doc(db, COL_CELLULES, celluleId), {
    membreIds: arrayUnion(demande.id),
    [`membres.${demande.id}`]: { nom: demande.nom, role: 'membre', depuis: Timestamp.now() },
    updatedAt: Timestamp.now(),
  });
  await deleteDoc(doc(db, COL_CELLULES, celluleId, 'demandes', demande.id));
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
