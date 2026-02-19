// ============================================================
// PHASE 21 — SERVICE CAHIER DE TEXTES
// CRUD Firestore pour cahiers et entrées
// PedaClic — www.pedaclic.sn
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  Timestamp, startAfter, DocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import type {
  CahierTextes, CahierFormData,
  EntreeCahier, EntreeFormData,
  PieceJointe,
} from '../types/cahierTextes.types';

// ─── CONSTANTES ──────────────────────────────────────────────
const COL_CAHIERS = 'cahiers_textes';
const COL_ENTREES = 'entrees_cahier';
const PAGE_SIZE = 20;

// ============================================================
// CAHIERS
// ============================================================

/**
 * Crée un nouveau cahier de textes pour un enseignant.
 */
export const createCahier = async (
  profId: string,
  data: CahierFormData
): Promise<string> => {
  const titre = data.titre.trim() || `${data.matiere} - ${data.classe} ${data.anneeScolaire}`;
  const ref = await addDoc(collection(db, COL_CAHIERS), {
    profId,
    classe: data.classe,
    matiere: data.matiere,
    anneeScolaire: data.anneeScolaire,
    titre,
    description: data.description || '',
    couleur: data.couleur || '#2563eb',
    nombreSeancesPrevu: data.nombreSeancesPrevu || 0,
    nombreSeancesRealise: 0,
    isArchived: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
};

/**
 * Met à jour un cahier existant.
 */
export const updateCahier = async (
  cahierId: string,
  data: Partial<CahierFormData>
): Promise<void> => {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Archive/désarchive un cahier.
 */
export const toggleArchiveCahier = async (
  cahierId: string,
  isArchived: boolean
): Promise<void> => {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), { isArchived, updatedAt: Timestamp.now() });
};

/**
 * Supprime un cahier et toutes ses entrées.
 */
export const deleteCahier = async (cahierId: string): Promise<void> => {
  // Supprimer les entrées liées
  const entreesSnap = await getDocs(
    query(collection(db, COL_ENTREES), where('cahierId', '==', cahierId))
  );
  await Promise.all(entreesSnap.docs.map(d => deleteDoc(d.ref)));

  // Supprimer le cahier
  await deleteDoc(doc(db, COL_CAHIERS, cahierId));
};

/**
 * Récupère tous les cahiers d'un professeur pour une année scolaire.
 */
export const getCahiersByProf = async (
  profId: string,
  anneeScolaire?: string
): Promise<CahierTextes[]> => {
  let q = query(
    collection(db, COL_CAHIERS),
    where('profId', '==', profId),
    where('isArchived', '==', false),
    orderBy('updatedAt', 'desc')
  );
  if (anneeScolaire) {
    q = query(
      collection(db, COL_CAHIERS),
      where('profId', '==', profId),
      where('anneeScolaire', '==', anneeScolaire),
      where('isArchived', '==', false),
      orderBy('updatedAt', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CahierTextes));
};

/**
 * Récupère un cahier par son ID.
 */
export const getCahierById = async (cahierId: string): Promise<CahierTextes | null> => {
  const snap = await getDoc(doc(db, COL_CAHIERS, cahierId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CahierTextes;
};

/**
 * Met à jour le compteur de séances réalisées d'un cahier.
 */
export const updateNombreSeancesRealise = async (cahierId: string): Promise<void> => {
  const snap = await getDocs(
    query(
      collection(db, COL_ENTREES),
      where('cahierId', '==', cahierId),
      where('statut', '==', 'realise')
    )
  );
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    nombreSeancesRealise: snap.size,
    updatedAt: Timestamp.now(),
  });
};

// ============================================================
// ENTRÉES DU CAHIER
// ============================================================

/**
 * Crée une nouvelle entrée (séance) dans un cahier.
 */
export const createEntree = async (
  cahierId: string,
  profId: string,
  data: EntreeFormData
): Promise<string> => {
  const dateTs = Timestamp.fromDate(new Date(data.date));
  const payload: Omit<EntreeCahier, 'id'> = {
    cahierId,
    profId,
    date: dateTs,
    heureDebut: data.heureDebut || undefined,
    heureFin: data.heureFin || undefined,
    chapitre: data.chapitre,
    typeContenu: data.typeContenu,
    contenu: data.contenu,
    objectifs: data.objectifs || undefined,
    competences: data.competences.length ? data.competences : undefined,
    statut: data.statut,
    motifAnnulation: data.motifAnnulation || undefined,
    dateReport: data.dateReport ? Timestamp.fromDate(new Date(data.dateReport)) : undefined,
    notesPrivees: data.notesPrivees || undefined,
    isMarqueEvaluation: data.isMarqueEvaluation,
    typeEvaluation: data.typeEvaluation || undefined,
    dateEvaluationPrevue: data.dateEvaluationPrevue
      ? Timestamp.fromDate(new Date(data.dateEvaluationPrevue))
      : undefined,
    statutEvaluation: data.isMarqueEvaluation ? (data.statutEvaluation || 'a_evaluer') : undefined,
    piecesJointes: [],
    ordre: Date.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, COL_ENTREES), payload);

  // Mettre à jour le compteur si réalisé
  if (data.statut === 'realise') {
    await updateNombreSeancesRealise(cahierId);
  }

  return ref.id;
};

/**
 * Met à jour une entrée existante.
 */
export const updateEntree = async (
  entreeId: string,
  cahierId: string,
  data: Partial<EntreeFormData>
): Promise<void> => {
  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };

  if (data.date) updates['date'] = Timestamp.fromDate(new Date(data.date));
  if (data.heureDebut !== undefined) updates['heureDebut'] = data.heureDebut;
  if (data.heureFin !== undefined) updates['heureFin'] = data.heureFin;
  if (data.chapitre !== undefined) updates['chapitre'] = data.chapitre;
  if (data.typeContenu !== undefined) updates['typeContenu'] = data.typeContenu;
  if (data.contenu !== undefined) updates['contenu'] = data.contenu;
  if (data.objectifs !== undefined) updates['objectifs'] = data.objectifs;
  if (data.competences !== undefined) updates['competences'] = data.competences;
  if (data.statut !== undefined) updates['statut'] = data.statut;
  if (data.motifAnnulation !== undefined) updates['motifAnnulation'] = data.motifAnnulation;
  if (data.notesPrivees !== undefined) updates['notesPrivees'] = data.notesPrivees;
  if (data.isMarqueEvaluation !== undefined) updates['isMarqueEvaluation'] = data.isMarqueEvaluation;
  if (data.typeEvaluation !== undefined) updates['typeEvaluation'] = data.typeEvaluation;
  if (data.statutEvaluation !== undefined) updates['statutEvaluation'] = data.statutEvaluation;
  if (data.dateEvaluationPrevue) {
    updates['dateEvaluationPrevue'] = Timestamp.fromDate(new Date(data.dateEvaluationPrevue));
  }
  if (data.dateReport) {
    updates['dateReport'] = Timestamp.fromDate(new Date(data.dateReport));
  }

  await updateDoc(doc(db, COL_ENTREES, entreeId), updates);
  await updateNombreSeancesRealise(cahierId);
};

/**
 * Supprime une entrée du cahier.
 */
export const deleteEntree = async (entreeId: string, cahierId: string): Promise<void> => {
  await deleteDoc(doc(db, COL_ENTREES, entreeId));
  await updateNombreSeancesRealise(cahierId);
};

/**
 * Récupère les entrées d'un cahier (paginées, 20 par page).
 */
export const getEntreesByCahier = async (
  cahierId: string,
  lastDoc?: DocumentSnapshot
): Promise<{ entrees: EntreeCahier[]; lastDoc: DocumentSnapshot | null }> => {
  let q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    orderBy('date', 'desc'),
    limit(PAGE_SIZE)
  );
  if (lastDoc) {
    q = query(
      collection(db, COL_ENTREES),
      where('cahierId', '==', cahierId),
      orderBy('date', 'desc'),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );
  }
  const snap = await getDocs(q);
  const entrees = snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
  const newLastDoc = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { entrees, lastDoc: newLastDoc };
};

/**
 * Récupère toutes les entrées marquées pour évaluation d'un cahier.
 */
export const getEntreesMarqueesEvaluation = async (
  profId: string,
  cahierId?: string
): Promise<EntreeCahier[]> => {
  let q = query(
    collection(db, COL_ENTREES),
    where('profId', '==', profId),
    where('isMarqueEvaluation', '==', true),
    orderBy('date', 'desc')
  );
  if (cahierId) {
    q = query(
      collection(db, COL_ENTREES),
      where('cahierId', '==', cahierId),
      where('isMarqueEvaluation', '==', true),
      orderBy('date', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
};

/**
 * Récupère une entrée par ID.
 */
export const getEntreeById = async (entreeId: string): Promise<EntreeCahier | null> => {
  const snap = await getDoc(doc(db, COL_ENTREES, entreeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as EntreeCahier;
};

/**
 * Récupère les entrées d'un cahier pour un mois donné (vue calendrier).
 */
export const getEntreesByMois = async (
  cahierId: string,
  annee: number,
  mois: number // 0-indexed
): Promise<EntreeCahier[]> => {
  const debut = new Date(annee, mois, 1);
  const fin = new Date(annee, mois + 1, 0, 23, 59, 59);
  const q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    where('date', '>=', Timestamp.fromDate(debut)),
    where('date', '<=', Timestamp.fromDate(fin)),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
};

// ============================================================
// PIÈCES JOINTES — UPLOAD FIREBASE STORAGE
// ============================================================

/**
 * Upload une pièce jointe vers Firebase Storage.
 */
export const uploadPieceJointe = async (
  profId: string,
  cahierId: string,
  file: File
): Promise<PieceJointe> => {
  const cheminStorage = `cahiers_textes/${profId}/${cahierId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, cheminStorage);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return {
    nom: file.name,
    url,
    type: file.type,
    taille: file.size,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * Ajoute des pièces jointes à une entrée existante.
 */
export const addPiecesJointes = async (
  entreeId: string,
  piecesExistantes: PieceJointe[],
  nouvellesPieces: PieceJointe[]
): Promise<void> => {
  await updateDoc(doc(db, COL_ENTREES, entreeId), {
    piecesJointes: [...piecesExistantes, ...nouvellesPieces],
    updatedAt: Timestamp.now(),
  });
};

/**
 * Supprime une pièce jointe d'une entrée.
 */
export const deletePieceJointe = async (
  entreeId: string,
  piecesJointes: PieceJointe[],
  url: string
): Promise<void> => {
  // Supprimer du Storage
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // Ignorer si déjà supprimé
  }
  // Mettre à jour Firestore
  await updateDoc(doc(db, COL_ENTREES, entreeId), {
    piecesJointes: piecesJointes.filter(p => p.url !== url),
    updatedAt: Timestamp.now(),
  });
};

// ============================================================
// STATISTIQUES DU CAHIER
// ============================================================

export interface StatsCahier {
  total: number;
  realises: number;
  planifies: number;
  annules: number;
  reportes: number;
  parType: Record<string, number>;
  heuresTotal: number;
}

/**
 * Calcule les statistiques d'un cahier.
 */
export const getStatsCahier = async (cahierId: string): Promise<StatsCahier> => {
  const snap = await getDocs(
    query(collection(db, COL_ENTREES), where('cahierId', '==', cahierId))
  );
  const entrees = snap.docs.map(d => d.data() as EntreeCahier);

  const stats: StatsCahier = {
    total: entrees.length,
    realises: 0, planifies: 0, annules: 0, reportes: 0,
    parType: {}, heuresTotal: 0,
  };

  for (const e of entrees) {
    stats[`${e.statut}s` as keyof StatsCahier] = ((stats[`${e.statut}s` as keyof StatsCahier] as number) || 0) + 1;
    stats.parType[e.typeContenu] = (stats.parType[e.typeContenu] || 0) + 1;

    // Calcul heures
    if (e.heureDebut && e.heureFin) {
      const [h1, m1] = e.heureDebut.split(':').map(Number);
      const [h2, m2] = e.heureFin.split(':').map(Number);
      stats.heuresTotal += ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    }
  }

  return stats;
};
