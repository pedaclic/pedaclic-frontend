/**
 * Service : Absences et observations par groupe.
 * PedaClic — Gestion des présences et notes par élève.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AbsenceGroupe, ObservationEleve } from '../types/groupeAbsences.types';

const COL_ABSENCES = 'absences_groupe';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as any).seconds, (val as any).nanoseconds || 0).toDate();
  }
  return new Date(val as string);
}

/** Document ID pour une date dans un groupe */
function docId(groupeId: string, date: string) {
  return `${groupeId}_${date}`;
}

/**
 * Marque les absences pour une date (remplace l'appel du jour).
 */
export async function marquerAbsences(
  groupeId: string,
  date: string,
  eleveIdsAbsents: string[],
  profId: string
): Promise<void> {
  const ref = doc(db, COL_ABSENCES, docId(groupeId, date));
  await setDoc(ref, {
    groupeId,
    date,
    eleveIdsAbsents,
    profId,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Récupère les absences pour une date.
 */
export async function getAbsencesByDate(
  groupeId: string,
  date: string
): Promise<string[]> {
  const ref = doc(db, COL_ABSENCES, docId(groupeId, date));
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data().eleveIdsAbsents || []) as string[];
}

/**
 * Récupère toutes les absences d'un groupe sur une période.
 */
export async function getAbsencesByPeriod(
  groupeId: string,
  dateDebut: string,
  dateFin: string
): Promise<AbsenceGroupe[]> {
  const q = query(
    collection(db, COL_ABSENCES),
    where('groupeId', '==', groupeId),
    where('date', '>=', dateDebut),
    where('date', '<=', dateFin),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    updatedAt: toDate(d.data().updatedAt),
  })) as AbsenceGroupe[];
}

/**
 * Compte les absences d'un élève sur une période.
 */
export async function countAbsencesEleve(
  groupeId: string,
  eleveId: string,
  dateDebut: string,
  dateFin: string
): Promise<number> {
  const absences = await getAbsencesByPeriod(groupeId, dateDebut, dateFin);
  return absences.filter((a) => a.eleveIdsAbsents.includes(eleveId)).length;
}

/**
 * Sauvegarde une observation sur un élève.
 */
export async function sauvegarderObservation(
  groupeId: string,
  eleveId: string,
  eleveNom: string,
  texte: string,
  profId: string
): Promise<void> {
  const ref = doc(db, 'groupes_prof', groupeId, 'observations', eleveId);
  await setDoc(ref, {
    eleveId,
    eleveNom,
    groupeId,
    texte,
    profId,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Récupère les observations de tous les élèves d'un groupe.
 */
export async function getObservationsGroupe(
  groupeId: string
): Promise<ObservationEleve[]> {
  const ref = collection(db, 'groupes_prof', groupeId, 'observations');
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({
    ...d.data(),
    updatedAt: toDate(d.data().updatedAt),
  })) as ObservationEleve[];
}

/**
 * Récupère l'observation d'un élève dans un groupe.
 */
export async function getObservationEleve(
  groupeId: string,
  eleveId: string
): Promise<string> {
  const ref = doc(db, 'groupes_prof', groupeId, 'observations', eleveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return '';
  return (snap.data().texte || '') as string;
}
