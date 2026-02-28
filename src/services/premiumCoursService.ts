// ============================================================
// PedaClic — Service Choix des cours (formule à la carte)
// www.pedaclic.sn | Extension Cours à la carte
// ============================================================

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getCoursPublies } from './coursService';
import type { CoursEnLigne } from '../cours_types';
import {
  estFormuleALaCarte,
  getNombreCoursMax,
  aAccesIllimite,
  type FormulePremium,
} from '../types/premiumPlans';

/**
 * Met à jour les cours choisis par l'utilisateur (formule à la carte).
 */
export async function mettreAJourCoursChoisis(
  userId: string,
  coursIds: string[]
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    coursChoisis: coursIds,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Vérifie si l'utilisateur a accès à un cours donné.
 */
export function aAccesCours(
  coursId: string,
  isPremium: boolean,
  formule: FormulePremium | undefined,
  coursChoisis: string[]
): boolean {
  if (!isPremium) return false;
  if (aAccesIllimite(formule || 'mensuel')) return true;
  if (!estFormuleALaCarte(formule || 'mensuel')) return true; // fallback
  return coursChoisis.includes(coursId);
}

/**
 * Retourne le nombre de cours que l'utilisateur peut encore choisir.
 */
export function getCoursRestants(
  formule: FormulePremium | undefined,
  coursChoisis: string[]
): number | null {
  const max = getNombreCoursMax(formule || 'mensuel');
  if (max === null) return null; // illimité
  return Math.max(0, max - coursChoisis.length);
}
