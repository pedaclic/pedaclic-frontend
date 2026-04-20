// ============================================================
// PedaClic — Service Premium Pro (quota ressources IA)
// www.pedaclic.sn
// ============================================================
// Gère la limite MENSUELLE de ressources pour les formules Premium :
//   • Premium Pro (illimite_1an, a_la_carte_tous) → illimité
//   • Annuel legacy ("annuel")                    → 70 / mois
//   • Autres formules Premium                     → 50 / mois
//
// Les « ressources » couvrent : générations IA, téléchargements
// d'ebooks et créations de séquences pédagogiques.
//
// ÉVOLUTION (avril 2026) :
//   - Quota passé de 30 à 50/70 selon la formule
//   - Ajout d'un reset mensuel calendaire automatique
//     (champ `usageMois` + `moisUsage` au format "YYYY-MM")
//   - Le champ historique `usageRessourcesTotal` est conservé
//     comme cumul global (compat ascendante, aucune régression)
// ============================================================

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  estPremiumPro,
  getLimiteRessources,
  type FormulePremium,
} from '../types/premiumPlans';

// ==================== CHAMPS FIRESTORE ====================

/** Cumul historique (non réinitialisé) — conservé pour tableaux de bord/stats */
const CHAMP_USAGE_TOTAL = 'usageRessourcesTotal';
/** Compteur de l'usage pour le mois courant (réinitialisé au changement de mois) */
const CHAMP_USAGE_MOIS = 'usageMois';
/** Mois de référence du compteur, au format ISO "YYYY-MM" */
const CHAMP_MOIS_REF = 'moisUsage';

// ==================== HELPERS ====================

/**
 * Retourne la clé du mois courant au format "YYYY-MM" (UTC).
 * Utilisée pour déterminer si le compteur mensuel doit être réinitialisé.
 */
function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ==================== LECTURE DU QUOTA ====================

/**
 * Récupère le nombre de ressources consommées pendant le MOIS EN COURS.
 *
 * Si le champ `moisUsage` stocké diffère du mois courant (changement de mois
 * calendaire), le compteur est considéré comme remis à zéro — la remise à
 * zéro effective en base est faite lors du prochain `incrementerUsage`,
 * ce qui évite toute écriture inutile.
 */
export async function getUsageRessources(userId: string): Promise<number> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return 0;
    const data = userDoc.data();
    const moisActuel = getCurrentMonthKey();
    const moisRef = data[CHAMP_MOIS_REF] as string | undefined;

    // Mois identique → on retourne le compteur mensuel
    if (moisRef === moisActuel) {
      return (data[CHAMP_USAGE_MOIS] as number) ?? 0;
    }

    // Mois différent (ou jamais initialisé) → compteur considéré remis à 0
    return 0;
  } catch {
    return 0;
  }
}

// ==================== VÉRIFICATION DU QUOTA ====================

/**
 * Vérifie si l'utilisateur peut consommer une ressource supplémentaire.
 * Ne fait aucune requête réseau : reçoit directement l'usage actuel.
 */
export function peutConsommerRessource(
  formule: FormulePremium | string | undefined,
  usageActuel: number
): boolean {
  const limite = getLimiteRessources(formule);
  if (limite === null) return true; // Illimité (Premium Pro)
  return usageActuel < limite;
}

/**
 * Vérifie si l'utilisateur a le droit d'utiliser une ressource
 * (Premium Pro → toujours autorisé ; sinon → en fonction du quota mensuel).
 * Retourne aussi l'usage courant et la limite pour affichage.
 */
export async function verifierQuotaRessources(
  userId: string,
  formule: FormulePremium | string | undefined
): Promise<{ autorise: boolean; usage: number; limite: number | null }> {
  const usage = await getUsageRessources(userId);
  const limite = getLimiteRessources(formule);
  const autorise = limite === null || usage < limite;
  return { autorise, usage, limite };
}

// ==================== INCRÉMENTATION ====================

/**
 * Incrémente le compteur d'usage des ressources pour l'utilisateur.
 *
 * Logique de reset mensuel automatique :
 *  1. On lit `moisUsage` (mois de référence stocké).
 *  2. Si le mois courant est différent → on REINITIALISE `usageMois` à 1
 *     et on met à jour `moisUsage` au nouveau mois.
 *  3. Sinon → on incrémente simplement `usageMois`.
 *  4. `usageRessourcesTotal` (cumul historique global) est toujours incrémenté.
 *
 * De cette façon, aucune tâche planifiée n'est nécessaire : le reset
 * s'auto-déclenche à la première action de l'utilisateur dans le nouveau mois.
 */
export async function incrementerUsage(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const data = userDoc.data() ?? {};

  const moisActuel = getCurrentMonthKey();
  const moisRef = data[CHAMP_MOIS_REF] as string | undefined;
  const sameMonth = moisRef === moisActuel;

  const nouveauUsageMois = sameMonth
    ? ((data[CHAMP_USAGE_MOIS] as number) ?? 0) + 1
    : 1; // Premier usage du nouveau mois → reset à 1

  const nouveauUsageTotal = ((data[CHAMP_USAGE_TOTAL] as number) ?? 0) + 1;

  await updateDoc(userRef, {
    [CHAMP_USAGE_TOTAL]: nouveauUsageTotal, // cumul historique (jamais reset)
    [CHAMP_USAGE_MOIS]: nouveauUsageMois,   // compteur du mois courant
    [CHAMP_MOIS_REF]: moisActuel,           // mois de référence "YYYY-MM"
    updatedAt: serverTimestamp(),
  });
}

// ==================== RÉEXPORTS DE COMMODITÉ ====================

export { estPremiumPro, getLimiteRessources } from '../types/premiumPlans';
