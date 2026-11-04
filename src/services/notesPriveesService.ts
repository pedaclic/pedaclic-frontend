// ============================================================
// PedaClic — Phase 47 : Notes privées des séances
// ------------------------------------------------------------
// Les « notes privées » du professeur quittent le document de la
// séance (lisible par les élèves quand le cahier est partagé) pour
// une collection DÉDIÉE, lisible par le seul propriétaire :
//
//   entrees_cahier_privees/{entreeId}   (même ID que la séance)
//     { profId, cahierId, notesPrivees, updatedAt }
//
// Le reste de l'application ne change pas : les services fusionnent
// ces notes dans `EntreeCahier.notesPrivees` côté professeur.
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EntreeCahier } from '../types/cahierTextes.types';

export const COL_NOTES_PRIVEES = 'entrees_cahier_privees';

/** Contexte nécessaire pour créer le document privé */
export interface ContexteNotePrivee {
  profId: string;    // propriétaire de la séance (règles Firestore)
  cahierId: string;  // permet de charger toutes les notes d'un cahier
}

/** Crée ou remplace la note privée d'une séance */
export async function enregistrerNotePrivee(
  entreeId: string,
  ctx: ContexteNotePrivee,
  notes: string
): Promise<void> {
  await setDoc(
    doc(db, COL_NOTES_PRIVEES, entreeId),
    {
      profId: ctx.profId,
      cahierId: ctx.cahierId,
      notesPrivees: notes,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

/** Lit la note privée d'une séance (null si absente ou illisible) */
export async function lireNotePrivee(entreeId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, COL_NOTES_PRIVEES, entreeId));
    return snap.exists() ? String(snap.data().notesPrivees ?? '') : null;
  } catch (err) {
    console.warn('[PedaClic] Note privée illisible :', err);
    return null;
  }
}

/** Supprime la note privée d'une séance (silencieux si absente) */
export async function supprimerNotePrivee(entreeId: string): Promise<void> {
  try { await deleteDoc(doc(db, COL_NOTES_PRIVEES, entreeId)); }
  catch (err) { console.warn('[PedaClic] Suppression note privée :', err); }
}

/** Requête des notes d'un cahier (2 égalités → aucun index composite) */
function requeteNotesCahier(cahierId: string, profId: string) {
  return query(
    collection(db, COL_NOTES_PRIVEES),
    where('cahierId', '==', cahierId),
    where('profId', '==', profId)
  );
}

function versMap(docs: Array<{ id: string; data: () => Record<string, unknown> }>): Map<string, string> {
  return new Map(docs.map(d => [d.id, String(d.data().notesPrivees ?? '')]));
}

/** Toutes les notes privées d'un cahier (Map entreeId → notes) */
export async function lireNotesPriveesCahier(cahierId: string, profId: string): Promise<Map<string, string>> {
  try {
    const snap = await getDocs(requeteNotesCahier(cahierId, profId));
    return versMap(snap.docs);
  } catch (err) {
    console.warn('[PedaClic] Notes privées du cahier illisibles :', err);
    return new Map();
  }
}

/** Abonnement temps réel aux notes privées d'un cahier */
export function subscribeNotesPriveesCahier(
  cahierId: string,
  profId: string,
  onData: (notes: Map<string, string>) => void
): () => void {
  return onSnapshot(
    requeteNotesCahier(cahierId, profId),
    (snap) => onData(versMap(snap.docs)),
    (err) => {
      // Non bloquant : les séances restent affichées sans les notes
      console.warn('[PedaClic] Abonnement notes privées :', err);
      onData(new Map());
    }
  );
}

/**
 * Fusionne les notes privées dans les séances.
 * Priorité au document privé ; à défaut, l'ancien champ (séances
 * pas encore migrées) reste affiché.
 */
export function fusionnerNotesPrivees(entrees: EntreeCahier[], notes: Map<string, string>): EntreeCahier[] {
  if (notes.size === 0) return entrees;
  return entrees.map(e => (notes.has(e.id) ? { ...e, notesPrivees: notes.get(e.id) } : e));
}
