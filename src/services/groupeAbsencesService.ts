/**
 * ============================================================
 * SERVICE : Absences, Retards et Observations par groupe
 * ============================================================
 *
 * Évolutions :
 *  - Prise en charge des RETARDS (minutes + motif + commentaire)
 *  - Filtre `profId` explicite sur les LIST queries afin de satisfaire
 *    strictement les règles Firestore (`resource.data.profId == auth.uid`)
 *    et d'éviter les erreurs "Missing or insufficient permissions".
 *  - `setDoc` avec `{ merge: true }` pour ne jamais écraser les champs
 *    que le document contient déjà (ex. entreeId saisi lors d'un autre
 *    enregistrement de la journée).
 *
 * Fichier : src/services/groupeAbsencesService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AbsenceGroupe,
  DetailRetard,
  ObservationEleve,
} from '../types/groupeAbsences.types';

const COL_ABSENCES = 'absences_groupe';

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

/** Convertit un Timestamp/Date/objet Firestore en Date JS. */
function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as any).seconds, (val as any).nanoseconds || 0).toDate();
  }
  return new Date(val as string);
}

/** Document ID stable : un seul doc par couple (groupe, date). */
function docId(groupeId: string, date: string) {
  return `${groupeId}_${date}`;
}

/**
 * Firestore rejette les champs `undefined`. On nettoie le payload
 * avant écriture pour éviter les rejets silencieux.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

// -------------------------------------------------------------
// ABSENCES / RETARDS — Écriture
// -------------------------------------------------------------

/** Payload accepté par `marquerAbsences`. */
export interface MarquerAppelPayload {
  groupeId: string;
  date: string;
  profId: string;
  eleveIdsAbsents: string[];
  /** Élèves marqués en retard (mutuellement exclusif avec absents) */
  eleveIdsRetards?: string[];
  /** Détails minutes/motif/commentaire par élève en retard */
  retardsDetails?: Record<string, DetailRetard>;
  entreeId?: string;
  entreeTitre?: string;
}

/**
 * Enregistre l'appel du jour (absences + retards) pour un groupe.
 *
 * - Utilise `setDoc({ merge: true })` : conserve les champs existants
 *   non fournis dans le payload (ex. entreeId).
 * - Assainit les `undefined` qui feraient échouer l'écriture Firestore.
 *
 * @throws rejette si l'écriture Firestore est refusée (permissions) —
 * l'appelant doit afficher le message à l'utilisateur.
 */
export async function marquerAbsences(
  groupeId: string,
  date: string,
  eleveIdsAbsents: string[],
  profId: string,
  entreeId?: string,
  entreeTitre?: string,
  eleveIdsRetards?: string[],
  retardsDetails?: Record<string, DetailRetard>,
): Promise<void> {
  if (!profId) {
    throw new Error(
      "Impossible d'enregistrer l'appel : utilisateur non authentifié.",
    );
  }

  const ref = doc(db, COL_ABSENCES, docId(groupeId, date));

  // On sépare absences / retards : un même élève ne peut pas être dans
  // les deux listes. En cas de conflit accidentel, l'absence prévaut.
  const retardsNets = (eleveIdsRetards || []).filter(
    (id) => !eleveIdsAbsents.includes(id),
  );

  const payload = stripUndefined({
    groupeId,
    date,
    eleveIdsAbsents,
    eleveIdsRetards: retardsNets,
    retardsDetails: retardsDetails || {},
    profId,
    entreeId,
    entreeTitre: entreeId ? entreeTitre : undefined,
    updatedAt: Timestamp.now(),
  });

  // merge:true = on ne détruit pas un champ déjà présent en base
  //              (notamment retardsDetails d'une saisie antérieure).
  await setDoc(ref, payload, { merge: true });
}

// -------------------------------------------------------------
// ABSENCES / RETARDS — Lecture
// -------------------------------------------------------------

/**
 * Récupère l'appel complet (absents + retards) pour une date.
 * Retourne `null` si aucune saisie n'a été faite pour ce jour.
 */
export async function getAppelByDate(
  groupeId: string,
  date: string,
): Promise<AbsenceGroupe | null> {
  const ref = doc(db, COL_ABSENCES, docId(groupeId, date));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    groupeId: data.groupeId,
    date: data.date,
    eleveIdsAbsents: data.eleveIdsAbsents || [],
    eleveIdsRetards: data.eleveIdsRetards || [],
    retardsDetails: data.retardsDetails || {},
    entreeId: data.entreeId,
    entreeTitre: data.entreeTitre,
    profId: data.profId,
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * API conservée pour rétro-compatibilité : retourne uniquement
 * les IDs des élèves absents pour une date.
 */
export async function getAbsencesByDate(
  groupeId: string,
  date: string,
): Promise<string[]> {
  const appel = await getAppelByDate(groupeId, date);
  return appel?.eleveIdsAbsents || [];
}

/**
 * Récupère tous les appels d'un groupe sur une période.
 *
 * ⚠️ Ajout du filtre `where('profId', '==', profId)` pour se conformer
 * strictement à la règle Firestore :
 *   `resource.data.profId == request.auth.uid`
 * Sans ce filtre, la query peut être refusée (erreur PERMISSION_DENIED).
 */
export async function getAbsencesByPeriod(
  groupeId: string,
  dateDebut: string,
  dateFin: string,
  profId?: string,
): Promise<AbsenceGroupe[]> {
  const contraintes: any[] = [
    where('groupeId', '==', groupeId),
    where('date', '>=', dateDebut),
    where('date', '<=', dateFin),
  ];
  if (profId) {
    contraintes.push(where('profId', '==', profId));
  }
  contraintes.push(orderBy('date', 'asc'));

  const q = query(collection(db, COL_ABSENCES), ...contraintes);
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      groupeId: data.groupeId,
      date: data.date,
      eleveIdsAbsents: data.eleveIdsAbsents || [],
      eleveIdsRetards: data.eleveIdsRetards || [],
      retardsDetails: data.retardsDetails || {},
      entreeId: data.entreeId,
      entreeTitre: data.entreeTitre,
      profId: data.profId,
      updatedAt: toDate(data.updatedAt),
    } as AbsenceGroupe;
  });
}

/**
 * Compte les absences d'un élève sur une période.
 */
export async function countAbsencesEleve(
  groupeId: string,
  eleveId: string,
  dateDebut: string,
  dateFin: string,
  profId?: string,
): Promise<number> {
  const absences = await getAbsencesByPeriod(
    groupeId,
    dateDebut,
    dateFin,
    profId,
  );
  return absences.filter((a) => a.eleveIdsAbsents.includes(eleveId)).length;
}

/**
 * Compte les retards d'un élève sur une période.
 */
export async function countRetardsEleve(
  groupeId: string,
  eleveId: string,
  dateDebut: string,
  dateFin: string,
  profId?: string,
): Promise<number> {
  const appels = await getAbsencesByPeriod(
    groupeId,
    dateDebut,
    dateFin,
    profId,
  );
  return appels.filter((a) => (a.eleveIdsRetards || []).includes(eleveId))
    .length;
}

// -------------------------------------------------------------
// OBSERVATIONS (inchangé)
// -------------------------------------------------------------

export async function sauvegarderObservation(
  groupeId: string,
  eleveId: string,
  eleveNom: string,
  texte: string,
  profId: string,
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

export async function getObservationsGroupe(
  groupeId: string,
): Promise<ObservationEleve[]> {
  const ref = collection(db, 'groupes_prof', groupeId, 'observations');
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({
    ...d.data(),
    updatedAt: toDate(d.data().updatedAt),
  })) as ObservationEleve[];
}

export async function getObservationEleve(
  groupeId: string,
  eleveId: string,
): Promise<string> {
  const ref = doc(db, 'groupes_prof', groupeId, 'observations', eleveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return '';
  return (snap.data().texte || '') as string;
}
