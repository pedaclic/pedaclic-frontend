// ============================================================
// PedaClic — Phase 45 : Service — Années scolaires
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ------------------------------------------------------------
// Document : settings/annees_scolaires
//   • lecture publique / écriture admin (règle `settings/{docId}`
//     déjà en place → AUCUNE modification de firestore.rules) ;
//   • aucune donnée sensible n'y est stockée.
// Aucune requête composite → aucun index à créer.
// ============================================================

import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  normaliserConfig,
  type AnneesScolairesConfig,
} from '../types/anneesScolaires.types';

/** Référence du document de configuration */
const REF_CONFIG = () => doc(db, 'settings', 'annees_scolaires');

/** Lecture ponctuelle (valeurs par défaut si absent ou hors-ligne) */
export async function getAnneesScolairesConfig(): Promise<AnneesScolairesConfig> {
  try {
    const snap = await getDoc(REF_CONFIG());
    return normaliserConfig(snap.exists() ? (snap.data() as Partial<AnneesScolairesConfig>) : undefined);
  } catch (err) {
    // On n'empêche jamais l'affichage d'une page pour un paramètre
    console.warn('[anneesScolairesService] Configuration par défaut utilisée :', err);
    return normaliserConfig(undefined);
  }
}

/**
 * Abonnement temps réel : une modification faite par l'admin est
 * répercutée immédiatement chez les enseignants connectés.
 * @returns fonction de désabonnement
 */
export function subscribeAnneesScolairesConfig(
  onData: (config: AnneesScolairesConfig) => void,
): () => void {
  return onSnapshot(
    REF_CONFIG(),
    (snap) => onData(normaliserConfig(snap.exists() ? (snap.data() as Partial<AnneesScolairesConfig>) : undefined)),
    (err) => {
      console.warn('[anneesScolairesService] Abonnement impossible, valeurs par défaut :', err);
      onData(normaliserConfig(undefined));
    },
  );
}

/** Enregistre la configuration (admin uniquement) */
export async function saveAnneesScolairesConfig(
  config: AnneesScolairesConfig,
  adminUid?: string,
): Promise<void> {
  const propre = normaliserConfig(config); // jamais de donnée invalide en base
  await setDoc(REF_CONFIG(), {
    ...propre,
    updatedAt: serverTimestamp(),
    ...(adminUid ? { updatedBy: adminUid } : {}),
  });
}
