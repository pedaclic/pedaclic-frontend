// ============================================================
// PedaClic — Service Premium Pro
// www.pedaclic.sn
// ============================================================
// Gère la limite de 30 ressources pour les formules non-Pro
// (générations IA, téléchargements ebooks, séquences pédagogiques)
// Premium Pro (illimite_1an, a_la_carte_tous) = accès illimité
// ============================================================

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  estPremiumPro,
  getLimiteRessources,
  type FormulePremium,
} from '../types/premiumPlans';

const CHAMP_USAGE = 'usageRessourcesTotal';

/**
 * Récupère le nombre total de ressources consommées par l'utilisateur
 * (générations + téléchargements + séquences créées)
 */
export async function getUsageRessources(userId: string): Promise<number> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return 0;
    const data = userDoc.data();
    return (data[CHAMP_USAGE] as number) ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Vérifie si l'utilisateur peut consommer une ressource supplémentaire
 */
export function peutConsommerRessource(
  formule: FormulePremium | string | undefined,
  usageActuel: number
): boolean {
  const limite = getLimiteRessources(formule);
  if (limite === null) return true; // Illimité
  return usageActuel < limite;
}

/**
 * Incrémente le compteur d'usage des ressources pour l'utilisateur
 */
export async function incrementerUsage(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const usageActuel = (userDoc.data()?.[CHAMP_USAGE] as number) ?? 0;
  await updateDoc(userRef, {
    [CHAMP_USAGE]: usageActuel + 1,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Vérifie si l'utilisateur a le droit d'utiliser une ressource (Premium Pro ou sous limite)
 * Utile pour afficher un message avant génération/téléchargement
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

// Réexport pour commodité
export { estPremiumPro, getLimiteRessources } from '../types/premiumPlans';
