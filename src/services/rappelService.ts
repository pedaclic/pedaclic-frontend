// ============================================================
// PHASE 21 — SERVICE RAPPELS
// CRUD Firestore pour les rappels des professeurs
// PedaClic — www.pedaclic.sn
// ============================================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { RappelProf, RappelFormData } from '../types/cahierTextes.types';

const COL_RAPPELS = 'rappels_prof';

// ─── Créer un rappel ─────────────────────────────────────────
export const createRappel = async (
  profId: string,
  data: RappelFormData
): Promise<string> => {
  const ref = await addDoc(collection(db, COL_RAPPELS), {
    profId,
    titre: data.titre,
    description: data.description || '',
    typeRappel: data.typeRappel,
    dateRappel: Timestamp.fromDate(new Date(data.dateRappel)),
    recurrence: data.recurrence,
    priorite: data.priorite,
    cahierId: data.cahierId || null,
    isLu: false,
    isDone: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
};

// ─── Récupérer les rappels actifs d'un prof ──────────────────
export const getRappelsActifs = async (profId: string): Promise<RappelProf[]> => {
  const q = query(
    collection(db, COL_RAPPELS),
    where('profId', '==', profId),
    where('isDone', '==', false),
    orderBy('dateRappel', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RappelProf));
};

// ─── Récupérer TOUS les rappels d'un prof ────────────────────
export const getTousRappels = async (profId: string): Promise<RappelProf[]> => {
  const q = query(
    collection(db, COL_RAPPELS),
    where('profId', '==', profId),
    orderBy('dateRappel', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RappelProf));
};

// ─── Marquer comme lu ────────────────────────────────────────
export const marquerRappelLu = async (rappelId: string): Promise<void> => {
  await updateDoc(doc(db, COL_RAPPELS, rappelId), { isLu: true });
};

// ─── Marquer comme terminé ───────────────────────────────────
export const marquerRappelDone = async (rappelId: string, isDone: boolean): Promise<void> => {
  await updateDoc(doc(db, COL_RAPPELS, rappelId), { isDone, isLu: isDone || undefined });
};

// ─── Supprimer un rappel ─────────────────────────────────────
export const deleteRappel = async (rappelId: string): Promise<void> => {
  await deleteDoc(doc(db, COL_RAPPELS, rappelId));
};

// ─── Rappels urgents non lus (pour badge notification) ───────
export const getRappelsNonLus = async (profId: string): Promise<number> => {
  const maintenant = Timestamp.now();
  const q = query(
    collection(db, COL_RAPPELS),
    where('profId', '==', profId),
    where('isLu', '==', false),
    where('isDone', '==', false),
    where('dateRappel', '<=', maintenant)
  );
  const snap = await getDocs(q);
  return snap.size;
};
