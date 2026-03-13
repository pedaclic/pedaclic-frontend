// ============================================================
// PedaClic — Service Cahier de Textes
// Phase 21 (base intacte) + Phase 22 (groupes, vue élève)
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
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  CahierTextes,
  CahierFormData,
  EntreeCahier,
  GroupeProf,
  EbookApercu,
  TypeContenu,
  StatutSeance,
} from '../types/cahierTextes.types';

// ─────────────────────────────────────────────────────────────
// COLLECTIONS
// ─────────────────────────────────────────────────────────────
const COL_CAHIERS = 'cahiers_textes';
const COL_ENTREES = 'entrees_cahier';
const COL_GROUPES = 'groupes_prof';
const COL_EBOOKS  = 'ebooks';

// ─────────────────────────────────────────────────────────────
// STATS CAHIER (exporté depuis le service — utilisé par CahierStats)
// ─────────────────────────────────────────────────────────────
export interface StatsCahier {
  total: number;
  realise: number;
  planifie: number;
  annule: number;
  reporte: number;
  parType: Partial<Record<TypeContenu, number>>;
  tauxRealisation: number; // pourcentage
}

// ─────────────────────────────────────────────────────────────
// CAHIERS — lecture
// ─────────────────────────────────────────────────────────────

/**
 * Récupère les cahiers d'un prof avec filtre optionnel sur l'année.
 * Signature Phase 21 conservée : getCahiersByProf(uid, annee?)
 */
export async function getCahiersByProf(
  profId: string,
  anneeScolaire?: string
): Promise<CahierTextes[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where('profId', '==', profId),
    orderBy('updatedAt', 'desc'),
  ];
  if (anneeScolaire) {
    constraints.splice(1, 0, where('anneeScolaire', '==', anneeScolaire));
  }
  const q = query(collection(db, COL_CAHIERS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    // Valeurs par défaut Phase 22 pour cahiers existants
    groupeIds:  [],
    groupeNoms: [],
    isPartage:  false,
    isArchived: false,
    ...d.data(),
    id: d.id,
  } as CahierTextes));
}

/** Alias Phase 22 */
export const getCahiersProf = (profId: string) => getCahiersByProf(profId);

/**
 * Récupère tous les cahiers (admin uniquement, pour liaison cours ↔ cahier).
 */
export async function getAllCahiers(): Promise<CahierTextes[]> {
  const q = query(
    collection(db, COL_CAHIERS),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    groupeIds: [], groupeNoms: [], isPartage: false, isArchived: false,
    ...d.data(), id: d.id,
  } as CahierTextes));
}

/**
 * Abonnement temps réel aux cahiers d'un prof.
 * Contourne le cache IndexedDB de persistentLocalCache pour garantir
 * que la barre de progression reflète les dernières écritures.
 * Retourne la fonction de désabonnement.
 */
export function subscribeToCahiers(
  profId: string,
  anneeScolaire: string | undefined,
  onData: (cahiers: CahierTextes[]) => void,
  onError?: (err: Error) => void
): () => void {
  const constraints: Parameters<typeof query>[1][] = [
    where('profId', '==', profId),
    orderBy('updatedAt', 'desc'),
  ];
  if (anneeScolaire) {
    constraints.splice(1, 0, where('anneeScolaire', '==', anneeScolaire));
  }
  const q = query(collection(db, COL_CAHIERS), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map(d => ({
          groupeIds:  [],
          groupeNoms: [],
          isPartage:  false,
          isArchived: false,
          ...d.data(),
          id: d.id,
        } as CahierTextes))
      );
    },
    onError
  );
}

/**
 * Récupère un cahier par son ID (Phase 21 — CahierDetailPage)
 */
export async function getCahierById(cahierId: string): Promise<CahierTextes | null> {
  const snap = await getDoc(doc(db, COL_CAHIERS, cahierId));
  if (!snap.exists()) return null;
  return {
    groupeIds:  [],
    groupeNoms: [],
    isPartage:  false,
    isArchived: false,
    ...snap.data(),
    id: snap.id,
  } as CahierTextes;
}

/**
 * Alias de getEntreesCahier (Phase 21 — CahierDetailPage)
 */
export const getEntreesByCahier = (cahierId: string) => getEntreesCahier(cahierId);

/**
 * Récupère une entrée par son ID (Phase 21 — EntreeEditorPage)
 */
export async function getEntreeById(entreeId: string): Promise<EntreeCahier | null> {
  const snap = await getDoc(doc(db, COL_ENTREES, entreeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as EntreeCahier;
}

// ─────────────────────────────────────────────────────────────
// PIÈCES JOINTES — Phase 21 (EntreeEditorPage)
// ─────────────────────────────────────────────────────────────

import { ref as storageRef, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import type { PieceJointe } from '../types/cahierTextes.types';

/** Sanitise le nom de fichier pour éviter les erreurs (espaces, caractères spéciaux dans l'URL) */
function sanitizeFilename(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[#?&%]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '') || 'fichier';
}

/** Déduit le Content-Type à partir de l'extension si file.type est vide */
function inferContentType(file: File): string {
  if (file.type && file.type.length > 0) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] || 'application/octet-stream';
}

/** Seuil (1 Mo) en dessous duquel on utilise uploadBytes (plus fiable pour petits fichiers) */
const SEUIL_UPLOAD_SIMPLE = 1024 * 1024;

/**
 * Upload un fichier — Phase 21 : uploadPieceJointe(profId, cahierId, file)
 * Chemin : cahiers/{profId}/{cahierId}/{timestamp}_{filename}
 * - Sanitisation du nom (espaces → underscores) pour éviter ERR_FAILED
 * - Metadata explicite (contentType) pour compatibilité Storage
 * - uploadBytes pour fichiers < 1 Mo (plus stable que resumable)
 * - Retry automatique en cas d'erreur réseau transitoire
 */
export async function uploadPieceJointe(
  profId: string,
  cahierId: string,
  fichier: File,
  onProgress?: (pct: number) => void
): Promise<PieceJointe> {
  const nomSanitize = sanitizeFilename(fichier.name);
  const nom = `${Date.now()}_${nomSanitize}`;
  const chemin = `cahiers/${profId}/${cahierId}/${nom}`;
  const refStorage = storageRef(storage, chemin);
  const contentType = inferContentType(fichier);
  const metadata = {
    contentType,
    customMetadata: {
      originalName: fichier.name,
      uploadedAt: new Date().toISOString(),
    },
  };

  const doUpload = async (): Promise<PieceJointe> => {
    if (fichier.size < SEUIL_UPLOAD_SIMPLE) {
      // Fichiers < 1 Mo : uploadBytes plus fiable (évite QUIC/resumable)
      if (onProgress) onProgress(50);
      await uploadBytes(refStorage, fichier, metadata);
      if (onProgress) onProgress(100);
      const url = await getDownloadURL(refStorage);
      return {
        id: nom,
        nom: fichier.name,
        url,
        type: fichier.type,
        taille: fichier.size,
        mimeType: fichier.type,
        uploadedAt: new Date().toISOString(),
      };
    }

    const task = uploadBytesResumable(refStorage, fichier, metadata);
    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        snap => {
          if (onProgress) {
            onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            id: nom,
            nom: fichier.name,
            url,
            type: fichier.type,
            taille: fichier.size,
            mimeType: fichier.type,
            uploadedAt: new Date().toISOString(),
          });
        }
      );
    });
  };

  const maxRetries = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await doUpload();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        /ERR_FAILED|ERR_QUIC|network|timeout|quic/i.test(msg) && attempt < maxRetries;
      if (!isRetryable) throw err;
      await new Promise(r => setTimeout(r, 800 * attempt)); // Délai croissant
    }
  }
  throw lastErr;
}

/**
 * Ajoute des pièces jointes — Phase 21 : addPiecesJointes(entreeId, existing, newPieces)
 */
export async function addPiecesJointes(
  entreeId: string,
  _existing: PieceJointe[],   // Ignoré — on utilise arrayUnion Firestore
  newPieces: PieceJointe[]
): Promise<void> {
  await updateDoc(doc(db, COL_ENTREES, entreeId), {
    piecesJointes: arrayUnion(...newPieces),
    updatedAt:     Timestamp.now(),
  });
}

/**
 * Supprime une pièce jointe — Phase 21 : deletePieceJointe(entreeId, allPieces, url)
 */
export async function deletePieceJointe(
  entreeId: string,
  allPieces: PieceJointe[],
  url: string
): Promise<void> {
  const piece = allPieces.find(p => p.url === url);
  // Suppression Storage (silencieux si déjà absent)
  try {
    if (piece?.id) {
      await deleteObject(storageRef(storage, `cahiers/${piece.id}`));
    }
  } catch { /* ignoré */ }
  // Mise à jour Firestore
  if (piece) {
    await updateDoc(doc(db, COL_ENTREES, entreeId), {
      piecesJointes: arrayRemove(piece),
      updatedAt:     Timestamp.now(),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// CAHIERS — création
// ─────────────────────────────────────────────────────────────

/**
 * Crée un cahier — signature Phase 21 : createCahier(profId, form)
 */
export async function createCahier(
  profId: string,
  form: CahierFormData
): Promise<string> {
  const now = Timestamp.now();
  const titreAuto = form.titre?.trim() || `${form.matiere} ${form.classe} ${form.anneeScolaire}`;
  const ref = await addDoc(collection(db, COL_CAHIERS), {
    profId,
    titre:                titreAuto,
    matiere:              form.matiere,
    classe:               form.classe,
    anneeScolaire:        form.anneeScolaire,
    description:          form.description || '',
    couleur:              form.couleur,
    nombreSeancesPrevu:   form.nombreSeancesPrevu,
    nombreSeancesRealise: 0,
    isArchived:           false,
    // Phase 22
    groupeIds:            form.groupeIds  ?? [],
    groupeNoms:           form.groupeNoms ?? [],
    isPartage:            form.isPartage  ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// ─────────────────────────────────────────────────────────────
// CAHIERS — mise à jour
// ─────────────────────────────────────────────────────────────

/**
 * Met à jour un cahier — accepte CahierFormData ou champs partiels.
 */
export async function updateCahier(
  cahierId: string,
  data: CahierFormData | Partial<Omit<CahierTextes, 'id' | 'createdAt'>>
): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  // Recalcule le titre si CahierFormData avec titre vide
  if ('matiere' in data && 'classe' in data && !('id' in data)) {
    const f = data as CahierFormData;
    if (!f.titre?.trim()) {
      payload.titre = `${f.matiere} ${f.classe} ${f.anneeScolaire}`;
    }
  }
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    ...payload,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Supprime un cahier.
 */
export async function deleteCahier(cahierId: string): Promise<void> {
  await deleteDoc(doc(db, COL_CAHIERS, cahierId));
}

/**
 * Archive / désarchive un cahier (Phase 21).
 */
export async function toggleArchiveCahier(
  cahierId: string,
  isArchived: boolean
): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    isArchived,
    updatedAt: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// PHASE 22 — LIAISON GROUPES
// ─────────────────────────────────────────────────────────────

export async function lierCahierAuxGroupes(
  cahierId: string,
  groupeIds: string[],
  groupeNoms: string[]
): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    groupeIds:  arrayUnion(...groupeIds),
    groupeNoms: arrayUnion(...groupeNoms),
    updatedAt:  Timestamp.now(),
  });
}

export async function delierGroupeDuCahier(
  cahierId: string,
  groupeId: string,
  groupeNom: string
): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    groupeIds:  arrayRemove(groupeId),
    groupeNoms: arrayRemove(groupeNom),
    updatedAt:  Timestamp.now(),
  });
}

export async function setPartage(cahierId: string, isPartage: boolean): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    isPartage,
    updatedAt: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// PHASE 22 — VUE ÉLÈVE
// ─────────────────────────────────────────────────────────────

export async function getCahiersPartagesForEleve(
  groupeIds: string[]
): Promise<CahierTextes[]> {
  if (groupeIds.length === 0) return [];
  const q = query(
    collection(db, COL_CAHIERS),
    where('isPartage', '==', true),
    where('groupeIds', 'array-contains-any', groupeIds.slice(0, 10)),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CahierTextes));
}

export async function getCahierPartageById(
  cahierId: string
): Promise<CahierTextes | null> {
  const snap = await getDoc(doc(db, COL_CAHIERS, cahierId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<CahierTextes, 'id'>;
  if (!data.isPartage) return null;
  return { id: snap.id, ...data };
}

// ─────────────────────────────────────────────────────────────
// PHASE 22 — CAHIERS PAR GROUPE
// ─────────────────────────────────────────────────────────────

/**
 * Retourne tous les cahiers liés à un groupe classe.
 * La query combine profId + groupeIds pour que Firestore puisse garantir
 * que chaque document satisfait la règle resource.data.profId == request.auth.uid.
 * Index composite requis : profId ASC, groupeIds ARRAY, updatedAt DESC
 */
export async function getCahiersForGroupe(
  groupeId: string,
  profId: string
): Promise<CahierTextes[]> {
  const q = query(
    collection(db, COL_CAHIERS),
    where('profId', '==', profId),
    where('groupeIds', 'array-contains', groupeId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CahierTextes));
}

// ─────────────────────────────────────────────────────────────
// GROUPES DU PROF
// ─────────────────────────────────────────────────────────────

export async function getGroupesProf(profId: string): Promise<GroupeProf[]> {
  const q = query(
    collection(db, COL_GROUPES),
    where('profId', '==', profId),
    orderBy('nom', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupeProf));
}

// ─────────────────────────────────────────────────────────────
// EBOOKS
// ─────────────────────────────────────────────────────────────

export async function getEbooksApercu(): Promise<EbookApercu[]> {
  const snap = await getDocs(collection(db, COL_EBOOKS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EbookApercu));
}

// ─────────────────────────────────────────────────────────────
// ENTRÉES — CRUD
// ─────────────────────────────────────────────────────────────

export async function getEntreesCahier(cahierId: string): Promise<EntreeCahier[]> {
  const q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    orderBy('ordre', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
}

/**
 * Abonnement temps réel aux entrées d'un cahier.
 * Évite les incohérences de cache (IndexedDB) entre la liste des cahiers
 * et la page détail — garantit que les séances s'affichent correctement.
 */
export function subscribeToEntreesCahier(
  cahierId: string,
  onData: (entrees: EntreeCahier[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    orderBy('ordre', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier)));
    },
    onError
  );
}

/**
 * Entrées d'un mois donné — Phase 21 (CahierCalendar)
 */
export const getEntreesByMois = async (
  cahierId: string,
  annee: number,
  mois: number  // 0-indexed
): Promise<EntreeCahier[]> => {
  const debut = Timestamp.fromDate(new Date(annee, mois, 1));
  const fin   = Timestamp.fromDate(new Date(annee, mois + 1, 0, 23, 59, 59));
  const q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    where('date', '>=', debut),
    where('date', '<=', fin),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
};

/**
 * Entrées marquées évaluation — Phase 21 (SignetFilter)
 */
export const getEntreesMarqueesEvaluation = async (
  profId: string,
  cahierId?: string
): Promise<EntreeCahier[]> => {
  const constraints: Parameters<typeof query>[1][] = [
    where('profId', '==', profId),
    where('isMarqueEvaluation', '==', true),
    orderBy('date', 'desc'),
  ];
  if (cahierId) {
    constraints.unshift(where('cahierId', '==', cahierId));
  }
  const q = query(collection(db, COL_ENTREES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
};

/**
 * Abonnement temps réel aux entrées marquées évaluation.
 * Les signets se mettent à jour automatiquement (ajout/retrait/modification).
 */
export function subscribeToEntreesMarqueesEvaluation(
  profId: string,
  cahierId: string | undefined,
  onData: (entrees: EntreeCahier[]) => void,
  onError?: (err: Error) => void
): () => void {
  const constraints: Parameters<typeof query>[1][] = [
    where('profId', '==', profId),
    where('isMarqueEvaluation', '==', true),
    orderBy('date', 'desc'),
  ];
  if (cahierId) {
    constraints.unshift(where('cahierId', '==', cahierId));
  }
  const q = query(collection(db, COL_ENTREES), ...constraints);

  const unsub = onSnapshot(
    q,
    (snap) => {
      const entrees = snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
      onData(entrees);
    },
    (err) => {
      console.error('Erreur abonnement signets:', err);
      onError?.(err);
    }
  );

  return () => unsub();
}

/**
 * Statistiques d'un cahier — Phase 21 (CahierStats)
 */
export const getStatsCahier = async (cahierId: string): Promise<StatsCahier> => {
  const snap = await getDocs(
    query(collection(db, COL_ENTREES), where('cahierId', '==', cahierId))
  );
  const entrees = snap.docs.map(d => d.data() as EntreeCahier);
  const total = entrees.length;
  const parStatut = { realise: 0, planifie: 0, annule: 0, reporte: 0 };
  const parType: Partial<Record<TypeContenu, number>> = {};

  for (const e of entrees) {
    const s = e.statut as StatutSeance;
    if (s in parStatut) parStatut[s as keyof typeof parStatut]++;
    if (e.typeContenu) {
      parType[e.typeContenu] = (parType[e.typeContenu] ?? 0) + 1;
    }
  }

  return {
    total,
    ...parStatut,
    parType,
    tauxRealisation: total > 0 ? Math.round((parStatut.realise / total) * 100) : 0,
  };
};

/**
 * Entrées réalisées uniquement — Phase 22 (vue élève)
 */
export async function getEntreesRealisees(cahierId: string): Promise<EntreeCahier[]> {
  const q = query(
    collection(db, COL_ENTREES),
    where('cahierId', '==', cahierId),
    where('statut', '==', 'realise'),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntreeCahier));
}

export async function createEntree(
  cahierId: string,
  profId: string,
  form: import('../types/cahierTextes.types').EntreeFormData
): Promise<string>;
export async function createEntree(
  data: Omit<EntreeCahier, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string>;
export async function createEntree(
  cahierIdOrData: string | Omit<EntreeCahier, 'id' | 'createdAt' | 'updatedAt'>,
  profId?: string,
  form?: import('../types/cahierTextes.types').EntreeFormData
): Promise<string> {
  const now = Timestamp.now();
  let payload: Record<string, unknown>;

  if (typeof cahierIdOrData === 'string') {
    // Signature Phase 21 : createEntree(cahierId, profId, form)
    const f = form!;
    payload = {
      cahierId:             cahierIdOrData,
      profId:               profId!,
      date:                 Timestamp.fromDate(new Date(f.date)),
      heureDebut:           f.heureDebut || '',
      heureFin:             f.heureFin || '',
      chapitre:             f.chapitre,
      typeContenu:          f.typeContenu,
      contenu:              f.contenu,
      objectifs:            f.objectifs || '',
      competences:          f.competences || [],
      rubrique:             f.rubrique || '',
      statut:               f.statut,
      motifAnnulation:      f.motifAnnulation || '',
      dateReport:           f.dateReport ? Timestamp.fromDate(new Date(f.dateReport)) : null,
      notesPrivees:         f.notesPrivees || '',
      isMarqueEvaluation:   Boolean(f.isMarqueEvaluation),
      typeEvaluation:       f.typeEvaluation || null,
      dateEvaluationPrevue: f.dateEvaluationPrevue
        ? Timestamp.fromDate(new Date(f.dateEvaluationPrevue))
        : null,
      statutEvaluation:     f.statutEvaluation,
      ordre:                Date.now(),
      piecesJointes:        [],
      liens:                [],
      ebooksLies:           [],
      contenuIA:            [],
    };
  } else {
    // Signature Phase 22 : createEntree(data)
    payload = {
      liens:         [],
      ebooksLies:    [],
      piecesJointes: [],
      contenuIA:     [],
      ...cahierIdOrData,
    };
  }

  const ref = await addDoc(collection(db, COL_ENTREES), {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateEntree(
  entreeId: string,
  cahierIdOrData: string | Partial<Omit<EntreeCahier, 'id' | 'createdAt'>>,
  form?: import('../types/cahierTextes.types').EntreeFormData
): Promise<void> {
  let payload: Record<string, unknown>;

  if (typeof cahierIdOrData === 'string' && form) {
    // Signature Phase 21 : updateEntree(entreeId, cahierId, form)
    const f = form;
    payload = {
      date:                 Timestamp.fromDate(new Date(f.date)),
      heureDebut:           f.heureDebut || '',
      heureFin:             f.heureFin || '',
      chapitre:             f.chapitre,
      typeContenu:          f.typeContenu,
      contenu:              f.contenu,
      objectifs:            f.objectifs || '',
      competences:          f.competences || [],
      rubrique:             f.rubrique || '',
      statut:               f.statut,
      motifAnnulation:      f.motifAnnulation || '',
      dateReport:           f.dateReport ? Timestamp.fromDate(new Date(f.dateReport)) : null,
      notesPrivees:         f.notesPrivees || '',
      isMarqueEvaluation:   Boolean(f.isMarqueEvaluation),
      typeEvaluation:       f.typeEvaluation || null,
      dateEvaluationPrevue: f.dateEvaluationPrevue
        ? Timestamp.fromDate(new Date(f.dateEvaluationPrevue))
        : null,
      statutEvaluation:     f.statutEvaluation,
    };
  } else {
    // Signature Phase 22 : updateEntree(entreeId, data)
    payload = { ...cahierIdOrData as object };
  }

  await updateDoc(doc(db, COL_ENTREES, entreeId), {
    ...payload,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteEntree(entreeId: string): Promise<void> {
  await deleteDoc(doc(db, COL_ENTREES, entreeId));
}

export async function mettreAJourCompteurSeances(
  cahierId: string,
  nombreSeancesRealise: number
): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), {
    nombreSeancesRealise,
    updatedAt: Timestamp.now(),
  });
}
