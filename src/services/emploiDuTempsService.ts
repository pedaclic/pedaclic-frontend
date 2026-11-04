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
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Classe, AnneeScolaire } from '../types/cahierTextes.types';
import type { EmploiDuTemps, Creneau, EmploiDuTempsProf } from '../types/emploiDuTemps.types';
import { emploiDuTempsId, emploiProfId } from '../types/emploiDuTemps.types';

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

/**
 * Récupère TOUS les emplois du temps d'une année scolaire.
 * Sert aux vues agrégées (filtre « jour » et filtre « semaine » sur
 * l'ensemble des classes). Lecture seule : aucune écriture n'est faite ici.
 *
 * Filtre à champ unique (`anneeScolaire`) → indexé automatiquement par
 * Firestore, donc AUCUN index composite n'est requis.
 */
export async function getTousEmplois(
  annee: AnneeScolaire
): Promise<EmploiDuTemps[]> {
  const q = query(
    collection(db, COL_EMPLOI),
    where('anneeScolaire', '==', annee)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmploiDuTemps));
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

// ═════════════════════════════════════════════════════════════
// PHASE 48 — EMPLOI DU TEMPS PERSONNEL
// ─────────────────────────────────────────────────────────────
// Collection `emplois_du_temps_prof` : un document par
// (professeur, établissement, classe, année). Lecture et écriture
// réservées au propriétaire (règles Firestore).
// Les fonctions ci-dessus (emploi commun par classe) restent pour
// la REPRISE des anciens créneaux, en lecture seule.
// ═════════════════════════════════════════════════════════════
const COL_EMPLOI_PROF = 'emplois_du_temps_prof';

function versEmploiProf(id: string, data: Record<string, unknown>): EmploiDuTempsProf {
  return {
    etablissementId: null,
    etablissementNom: '',
    creneaux: [],
    ...(data as Partial<EmploiDuTempsProf>),
    id,
  } as EmploiDuTempsProf;
}

/** Écoute l'emploi du temps personnel d'une classe dans un établissement */
export function subscribeEmploiProf(
  profId: string,
  etablissementId: string | null,
  classe: Classe,
  annee: AnneeScolaire,
  onData: (emploi: EmploiDuTempsProf | null) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = doc(db, COL_EMPLOI_PROF, emploiProfId(profId, etablissementId, classe, annee));
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? versEmploiProf(snap.id, snap.data()) : null),
    onError
  );
}

/**
 * Écoute TOUS les emplois du temps personnels d'une année
 * (vues « Ma semaine », « Mon jour », bandeau « Aujourd'hui »).
 * 2 égalités → aucun index composite.
 */
export function subscribeEmploisProfAnnee(
  profId: string,
  annee: AnneeScolaire,
  onData: (emplois: EmploiDuTempsProf[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COL_EMPLOI_PROF),
    where('profId', '==', profId),
    where('anneeScolaire', '==', annee)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(d => versEmploiProf(d.id, d.data()))),
    onError
  );
}

/** Enregistre la liste complète des créneaux (crée le document si besoin) */
export async function enregistrerEmploiProf(
  profId: string,
  etablissement: { id: string; nom: string } | null,
  classe: Classe,
  annee: AnneeScolaire,
  creneaux: Creneau[]
): Promise<void> {
  const ref = doc(db, COL_EMPLOI_PROF, emploiProfId(profId, etablissement?.id ?? null, classe, annee));
  const now = Timestamp.now();
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await setDoc(ref, { creneaux, updatedAt: now }, { merge: true });
  } else {
    await setDoc(ref, {
      profId,
      etablissementId: etablissement?.id ?? null,
      etablissementNom: etablissement?.nom ?? '',
      classe,
      anneeScolaire: annee,
      creneaux,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * REPRISE — créneaux que CE professeur avait saisis dans l'ancien
 * emploi du temps commun de la classe (créneaux portant son profId).
 */
export async function creneauxHeritesDuProf(
  profId: string,
  classe: Classe,
  annee: AnneeScolaire
): Promise<Creneau[]> {
  try {
    const ancien = await getEmploiByClasse(classe, annee);
    return (ancien?.creneaux ?? []).filter(c => c.profId === profId);
  } catch {
    return [];
  }
}

/**
 * Pré-requis à la création d'un cahier (remplace emploiExistePourClasse) :
 * vrai si l'emploi du temps PERSONNEL de la classe a au moins un
 * créneau, OU si le professeur avait des créneaux dans l'ancien
 * emploi du temps commun (aucun professeur n'est bloqué par la Phase 48).
 */
export async function emploiPersonnelExiste(
  profId: string,
  etablissementId: string | null,
  classe: Classe,
  annee: AnneeScolaire
): Promise<boolean> {
  const snap = await getDoc(doc(db, COL_EMPLOI_PROF, emploiProfId(profId, etablissementId, classe, annee)));
  if (snap.exists() && (snap.data().creneaux ?? []).length > 0) return true;
  return (await creneauxHeritesDuProf(profId, classe, annee)).length > 0;
}
