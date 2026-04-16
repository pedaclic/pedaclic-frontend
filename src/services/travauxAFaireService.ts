/**
 * Service : Travaux à faire (avec échéance).
 * Visible côté élèves et parents pour le suivi.
 * PedaClic — Groupes-classes (prof)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TravailAFaire } from '../types/groupeAbsences.types';

const COL_TRAVAUX = 'travaux_a_faire';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as any).seconds, (val as any).nanoseconds || 0).toDate();
  }
  return new Date(val as string);
}

/**
 * Crée un travail à faire.
 */
export async function creerTravailAFaire(
  data: Omit<TravailAFaire, 'id' | 'createdAt'>
): Promise<TravailAFaire> {
  // Construire le payload en excluant les champs undefined
  // (Firestore rejette les valeurs undefined — ex. rubriqueId, rubriqueNom)
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  // Convertir la date d'échéance en Timestamp Firestore
  if (payload.dateEcheance instanceof Date) {
    payload.dateEcheance = Timestamp.fromDate(payload.dateEcheance as Date);
  }
  payload.createdAt = Timestamp.now();

  const ref = await addDoc(collection(db, COL_TRAVAUX), payload);
  const snap = await getDoc(ref);
  return {
    id: ref.id,
    ...snap.data(),
    dateEcheance: toDate(snap.data()!.dateEcheance),
    createdAt: toDate(snap.data()!.createdAt),
  } as TravailAFaire;
}

/**
 * Met à jour un travail à faire.
 */
export async function modifierTravailAFaire(
  id: string,
  updates: Partial<Pick<TravailAFaire, 'titre' | 'description' | 'dateEcheance' | 'matiere' | 'heureEcheance' | 'cahierId' | 'rubriqueId' | 'rubriqueNom' | 'corrige'>>
): Promise<void> {
  const ref = doc(db, COL_TRAVAUX, id);
  // Exclure les champs undefined pour éviter le rejet Firestore
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }
  if (data.dateEcheance instanceof Date) {
    data.dateEcheance = Timestamp.fromDate(data.dateEcheance as Date);
  }
  await updateDoc(ref, data);
}

/**
 * Bascule le statut corrigé d'un travail.
 */
export async function toggleCorrigeTravail(id: string, corrige: boolean): Promise<void> {
  const ref = doc(db, COL_TRAVAUX, id);
  await updateDoc(ref, { corrige });
}

/**
 * Supprime un travail à faire.
 */
export async function supprimerTravailAFaire(id: string): Promise<void> {
  await deleteDoc(doc(db, COL_TRAVAUX, id));
}

/**
 * Récupère les travaux à faire d'un groupe (pour le prof).
 */
export async function getTravauxByGroupe(groupeId: string): Promise<TravailAFaire[]> {
  const q = query(
    collection(db, COL_TRAVAUX),
    where('groupeId', '==', groupeId),
    orderBy('dateEcheance', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dateEcheance: toDate(d.data().dateEcheance),
    createdAt: toDate(d.data().createdAt),
  })) as TravailAFaire[];
}

/**
 * Récupère les travaux à faire pour un élève (tous ses groupes).
 * Ne retourne que les travaux dont l'échéance est aujourd'hui ou ultérieure.
 */
export async function getTravauxForEleve(groupeIds: string[]): Promise<TravailAFaire[]> {
  if (groupeIds.length === 0) return [];
  const all: TravailAFaire[] = [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  for (const gid of groupeIds.slice(0, 10)) {
    const q2 = query(
      collection(db, COL_TRAVAUX),
      where('groupeId', '==', gid),
      orderBy('dateEcheance', 'asc'),
      limit(50)
    );
    const snap = await getDocs(q2);
    snap.docs.forEach((d) => {
      const t = {
        id: d.id,
        ...d.data(),
        dateEcheance: toDate(d.data().dateEcheance),
        createdAt: toDate(d.data().createdAt),
      } as TravailAFaire;
      if (t.dateEcheance >= todayStart) all.push(t);
    });
  }
  all.sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
  return all;
}

/**
 * Récupère les travaux à faire liés à un cahier de textes.
 */
export async function getTravauxByCahier(cahierId: string): Promise<TravailAFaire[]> {
  const q = query(
    collection(db, COL_TRAVAUX),
    where('cahierId', '==', cahierId),
    orderBy('dateEcheance', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dateEcheance: toDate(d.data().dateEcheance),
    createdAt: toDate(d.data().createdAt),
  })) as TravailAFaire[];
}

/**
 * Récupère les travaux à faire pour un parent (groupes de ses enfants).
 */
export async function getTravauxForParent(groupeIdsEnfants: string[]): Promise<TravailAFaire[]> {
  return getTravauxForEleve(groupeIdsEnfants);
}
