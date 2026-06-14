// ============================================================
// PedaClic — Service Emploi du Temps
// Collection : emploi_du_temps (un document par classe + année)
// Identifiant déterministe → getDoc direct, aucun index composite.
// Édition partagée (prof/admin) ; lecture pour tout utilisateur.
// ============================================================

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Classe, AnneeScolaire } from '../types/cahierTextes.types';
import type { EmploiDuTemps, Creneau } from '../types/emploiDuTemps.types';
import { emploiDuTempsId } from '../types/emploiDuTemps.types';

// ─────────────────────────────────────────────────────────────
// COLLECTION
// ─────────────────────────────────────────────────────────────
const COL_EMPLOI = 'emploi_du_temps';

// ─────────────────────────────────────────────────────────────
// LECTURE
// ─────────────────────────────────────────────────────────────

/** Récupère l'emploi du temps d'une classe (ou null s'il n'existe pas). */
export async function getEmploiByClasse(
  classe: Classe,
  annee: AnneeScolaire
): Promise<EmploiDuTemps | null> {
  const ref = doc(db, COL_EMPLOI, emploiDuTempsId(classe, annee));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as EmploiDuTemps;
}

/**
 * Conditionnement (point 1) : un emploi du temps est considéré « présent »
 * s'il existe ET comporte au moins un créneau. Sert de garde à la création
 * d'un nouveau cahier de textes.
 */
export async function emploiExistePourClasse(
  classe: Classe,
  annee: AnneeScolaire
): Promise<boolean> {
  const emploi = await getEmploiByClasse(classe, annee);
  return !!emploi && Array.isArray(emploi.creneaux) && emploi.creneaux.length > 0;
}

/** Écoute en temps réel l'emploi du temps d'une classe. */
export function subscribeEmploi(
  classe: Classe,
  annee: AnneeScolaire,
  onData: (emploi: EmploiDuTemps | null) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = doc(db, COL_EMPLOI, emploiDuTempsId(classe, annee));
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as EmploiDuTemps) : null),
    onError
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRITURE
//   Un seul point d'entrée : on enregistre la liste complète des
//   créneaux (merge sur le document déterministe). Crée le document
//   au premier enregistrement, le met à jour ensuite.
// ─────────────────────────────────────────────────────────────
export async function creerOuMajEmploi(
  classe: Classe,
  annee: AnneeScolaire,
  creneaux: Creneau[],
  profId: string,
  profNom: string
): Promise<void> {
  const ref = doc(db, COL_EMPLOI, emploiDuTempsId(classe, annee));
  const now = Timestamp.now();
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Mise à jour : on ne touche pas à createdBy/createdAt
    await setDoc(
      ref,
      {
        creneaux,
        statut: 'publie',
        updatedBy: profId,
        updatedByNom: profNom,
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    // Première création
    await setDoc(ref, {
      classe,
      anneeScolaire: annee,
      creneaux,
      statut: 'publie',
      createdBy: profId,
      createdAt: now,
      updatedBy: profId,
      updatedByNom: profNom,
      updatedAt: now,
    });
  }
}
