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
  DetailExclusion,
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
  /** Phase 40 — Élèves EXCLUS (mutuellement exclusif avec absents/retards) */
  eleveIdsExclus?: string[];
  /** Phase 40 — Détails durée/motif/décideur par élève exclu */
  exclusionsDetails?: Record<string, DetailExclusion>;
  /** @deprecated — utilisez `entreeIds` (Phase 38) */
  entreeId?: string;
  /** @deprecated — utilisez `entreeTitres` (Phase 38) */
  entreeTitre?: string;
  /** Phase 38 — séances liées à cet appel (multi-séances par jour) */
  entreeIds?: string[];
  entreeTitres?: string[];
  /** Phase 39 — par-séance par-élève (cf. type AbsenceGroupe) */
  seancesAbsentsPar?: Record<string, string[]>;
  seancesRetardsPar?: Record<string, string[]>;
  /** Phase 40 — par-séance par-élève pour les exclusions */
  seancesExclusPar?: Record<string, string[]>;
}

/**
 * Enregistre l'appel du jour (absences + retards) pour un groupe.
 *
 * Phase 38 — Multi-séances :
 *   Le 5e paramètre peut désormais être :
 *     • soit un `string` (legacy : 1 seule séance)
 *     • soit un `string[]` (nouvelle API : N séances dans la journée)
 *   Idem pour le 6e paramètre (titre / tableau de titres).
 *   À l'écriture, on stocke TOUJOURS les nouveaux champs `entreeIds[]`
 *   et `entreeTitres[]`, et on conserve aussi les legacy `entreeId/Titre`
 *   (premier élément du tableau) pour compatibilité ascendante avec
 *   les composants qui ne lisent que ces champs.
 *
 * - Utilise `setDoc({ merge: true })` : conserve les champs existants
 *   non fournis dans le payload.
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
  entreeIdOuIds?: string | string[],
  entreeTitreOuTitres?: string | string[],
  eleveIdsRetards?: string[],
  retardsDetails?: Record<string, DetailRetard>,
  /**
   * Phase 39 — Détail par-séance par-élève.
   *   Si fournis, `seancesAbsentsPar[entreeId] = [eleveIds...]` indique
   *   précisément quels élèves étaient absents pour CETTE séance.
   *   Idem pour `seancesRetardsPar`.
   *   - `eleveIdsAbsents` reste l'union (ce qui sert aux compteurs).
   *   - Si non fournis, on garde l'ancien comportement : tous les
   *     `eleveIdsAbsents` sont absents pour TOUTES les séances liées.
   */
  seancesAbsentsPar?: Record<string, string[]>,
  seancesRetardsPar?: Record<string, string[]>,
  /**
   * Phase 40 — Exclusions (renvoi de cours / mise à pied).
   *   Mutuellement exclusif avec absents/retards. Voir `DetailExclusion`
   *   pour la durée, le motif et le décideur. `seancesExclusPar`
   *   suit la même logique que `seancesAbsentsPar` côté multi-séance.
   */
  eleveIdsExclus?: string[],
  exclusionsDetails?: Record<string, DetailExclusion>,
  seancesExclusPar?: Record<string, string[]>,
): Promise<void> {
  if (!profId) {
    throw new Error(
      "Impossible d'enregistrer l'appel : utilisateur non authentifié.",
    );
  }

  const ref = doc(db, COL_ABSENCES, docId(groupeId, date));

  // On sépare absences / retards / exclusions : un même élève ne peut
  // figurer que dans UNE seule liste. Ordre de priorité (du plus
  // contraignant au moins contraignant) :
  //    absent  >  exclu  >  retard
  // En cas de doublon accidentel, on tronque les listes inférieures.
  const exclusNets = (eleveIdsExclus || []).filter(
    (id) => !eleveIdsAbsents.includes(id),
  );
  const retardsNets = (eleveIdsRetards || []).filter(
    (id) => !eleveIdsAbsents.includes(id) && !exclusNets.includes(id),
  );

  // ── Normalisation des paramètres séance(s) ─────────────────────
  // On accepte les deux formes (string ou string[]) pour rester
  // compatible avec les anciens appels du code.
  const entreeIds: string[] = Array.isArray(entreeIdOuIds)
    ? entreeIdOuIds.filter((s) => !!s)
    : entreeIdOuIds
    ? [entreeIdOuIds]
    : [];
  const entreeTitres: string[] = Array.isArray(entreeTitreOuTitres)
    ? entreeTitreOuTitres.filter((s) => !!s)
    : entreeTitreOuTitres
    ? [entreeTitreOuTitres]
    : [];

  // Pour rétro-compatibilité : on dénormalise aussi le 1er élément
  // dans les anciens champs entreeId/entreeTitre (lus par le code legacy).
  const legacyId = entreeIds[0];
  const legacyTitre = entreeTitres[0];

  // Phase 39 — Nettoyage seancesAbsentsPar / seancesRetardsPar :
  //   On ne garde que les entrées qui correspondent à des séances
  //   effectivement liées à l'appel, et on retire les listes vides.
  const cleanSeancePar = (
    src: Record<string, string[]> | undefined,
  ): Record<string, string[]> | undefined => {
    if (!src) return undefined;
    const out: Record<string, string[]> = {};
    let hasAny = false;
    for (const [k, v] of Object.entries(src)) {
      if (entreeIds.length > 0 && !entreeIds.includes(k)) continue;
      const list = (v || []).filter(Boolean);
      if (list.length > 0) {
        out[k] = list;
        hasAny = true;
      }
    }
    return hasAny ? out : undefined;
  };

  // Phase 40 — On ne conserve les détails d'exclusion que pour les
  // élèves effectivement exclus, en filtrant les `undefined` que
  // Firestore refuserait à l'écriture.
  const exclusionsNetes: Record<string, DetailExclusion> = {};
  for (const id of exclusNets) {
    const d = exclusionsDetails?.[id];
    exclusionsNetes[id] = {
      dureeJours:
        typeof d?.dureeJours === 'number' && d.dureeJours > 0 ? d.dureeJours : 1,
      ...(d?.motif ? { motif: d.motif } : {}),
      ...(d?.decideePar ? { decideePar: d.decideePar } : {}),
      ...(d?.dateRetour ? { dateRetour: d.dateRetour } : {}),
      ...(d?.commentaire ? { commentaire: d.commentaire } : {}),
    };
  }

  const payload = stripUndefined({
    groupeId,
    date,
    eleveIdsAbsents,
    eleveIdsRetards: retardsNets,
    retardsDetails: retardsDetails || {},
    // Phase 40 — Exclusions (statut disciplinaire distinct)
    eleveIdsExclus: exclusNets,
    exclusionsDetails: exclusionsNetes,
    profId,
    // Multi-séances (nouvelle API)
    entreeIds: entreeIds.length > 0 ? entreeIds : undefined,
    entreeTitres: entreeTitres.length > 0 ? entreeTitres : undefined,
    // Phase 39 — répartition par séance / par élève
    seancesAbsentsPar: cleanSeancePar(seancesAbsentsPar),
    seancesRetardsPar: cleanSeancePar(seancesRetardsPar),
    // Phase 40 — répartition par séance pour les exclusions
    seancesExclusPar: cleanSeancePar(seancesExclusPar),
    // Legacy (1ère séance, pour compat) — undefined si aucune séance
    entreeId: legacyId,
    entreeTitre: legacyId ? legacyTitre : undefined,
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
    // Phase 40 — Exclusions
    eleveIdsExclus: data.eleveIdsExclus || [],
    exclusionsDetails: data.exclusionsDetails || {},
    // Phase 38 — Multi-séances : on relit les deux variantes
    entreeId: data.entreeId,
    entreeTitre: data.entreeTitre,
    entreeIds: Array.isArray(data.entreeIds) ? data.entreeIds : undefined,
    entreeTitres: Array.isArray(data.entreeTitres) ? data.entreeTitres : undefined,
    // Phase 39 — par-séance par-élève
    seancesAbsentsPar: data.seancesAbsentsPar && typeof data.seancesAbsentsPar === 'object'
      ? data.seancesAbsentsPar
      : undefined,
    seancesRetardsPar: data.seancesRetardsPar && typeof data.seancesRetardsPar === 'object'
      ? data.seancesRetardsPar
      : undefined,
    seancesExclusPar: data.seancesExclusPar && typeof data.seancesExclusPar === 'object'
      ? data.seancesExclusPar
      : undefined,
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
      // Phase 40 — Exclusions
      eleveIdsExclus: data.eleveIdsExclus || [],
      exclusionsDetails: data.exclusionsDetails || {},
      // Legacy
      entreeId: data.entreeId,
      entreeTitre: data.entreeTitre,
      // Phase 38 — Multi-séances
      entreeIds: Array.isArray(data.entreeIds) ? data.entreeIds : undefined,
      entreeTitres: Array.isArray(data.entreeTitres) ? data.entreeTitres : undefined,
      // Phase 39 — par-séance par-élève
      seancesAbsentsPar: data.seancesAbsentsPar && typeof data.seancesAbsentsPar === 'object'
        ? data.seancesAbsentsPar
        : undefined,
      seancesRetardsPar: data.seancesRetardsPar && typeof data.seancesRetardsPar === 'object'
        ? data.seancesRetardsPar
        : undefined,
      seancesExclusPar: data.seancesExclusPar && typeof data.seancesExclusPar === 'object'
        ? data.seancesExclusPar
        : undefined,
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

/**
 * Phase 40 — Compte les exclusions d'un élève sur une période.
 *   Comptabilise CHAQUE journée où l'élève apparaît dans
 *   `eleveIdsExclus`. La durée saisie (`dureeJours`) reste consultable
 *   via `exclusionsDetails` pour les bulletins disciplinaires.
 */
export async function countExclusionsEleve(
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
  return appels.filter((a) => (a.eleveIdsExclus || []).includes(eleveId)).length;
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
