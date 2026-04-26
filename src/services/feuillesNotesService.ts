/**
 * Service feuilles de notes — PedaClic
 * Gestion des notes par groupe, avec moyennes périodiques
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getElevesGroupe } from './profGroupeService';
import type {
  FeuilleDeNotes,
  EvaluationNote,
  NotesEleve,
  LigneNotes,
  PeriodeType,
  CompetenceDef,
  CompetenceStatus,
  TypeEvaluation,
} from '../types/feuillesNotes.types';

const COL = 'feuilles_notes';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as { seconds: number }).seconds, (val as { nanoseconds?: number }).nanoseconds ?? 0).toDate();
  }
  return new Date(String(val));
}

/**
 * Crée une feuille de notes pour un groupe.
 *
 *  ✨ `titre` est optionnel : il s'agit du titre libre de la feuille
 *     (ex. « Évaluation orthographe — 1er trim. »). Quand il est vide
 *     l'UI retombe sur le `periodeLabel` pour rester rétro-compatible.
 */
export async function creerFeuilleDeNotes(
  groupeId: string,
  groupeNom: string,
  matiereId: string,
  matiereNom: string,
  profId: string,
  profNom: string,
  anneeScolaire: string,
  periodeType: PeriodeType,
  periodeLabel: string,
  dateDebut: Date,
  dateFin: Date,
  evaluations: EvaluationNote[] = [],
  titre: string = ''
): Promise<FeuilleDeNotes> {
  const now = Timestamp.now();
  const inscriptions = await getElevesGroupe(groupeId);
  const notes: Record<string, NotesEleve> = {};
  const eleveIds: string[] = [];
  inscriptions.forEach((i) => {
    notes[i.eleveId] = {};
    eleveIds.push(i.eleveId);
  });

  const ref = await addDoc(collection(db, COL), {
    eleveIds,
    // Titre stocké uniquement s'il est non vide (évite de polluer les
    // documents Firestore avec des champs vides côté requêtes).
    ...(titre.trim() ? { titre: titre.trim() } : {}),
    groupeId,
    groupeNom,
    matiereId,
    matiereNom,
    profId,
    profNom,
    anneeScolaire,
    periodeType,
    periodeLabel,
    dateDebut: Timestamp.fromDate(dateDebut),
    dateFin: Timestamp.fromDate(dateFin),
    // Par défaut, toute nouvelle évaluation créée hors sélection explicite
    // est considérée comme un « devoir » (type pondéré 1 dans la moyenne
    // générale sénégalaise). Le prof pourra la basculer en « composition ».
    evaluations: evaluations.length
      ? evaluations.map((e) => ({ ...e, type: e.type ?? 'devoir' as TypeEvaluation }))
      : [{ id: 'e1', libelle: 'Devoir 1', coefficient: 1, type: 'devoir' as TypeEvaluation }],
    notes,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await getDoc(ref);
  const data = snap.data()!;
  return {
    id: ref.id,
    ...data,
    dateDebut: toDate(data.dateDebut),
    dateFin: toDate(data.dateFin),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as FeuilleDeNotes;
}

/** Récupère les feuilles d'un groupe */
export async function getFeuillesByGroupe(groupeId: string): Promise<FeuilleDeNotes[]> {
  const q = query(
    collection(db, COL),
    where('groupeId', '==', groupeId),
    orderBy('dateDebut', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      dateDebut: toDate(data.dateDebut),
      dateFin: toDate(data.dateFin),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as FeuilleDeNotes;
  });
}

/** Récupère une feuille par ID */
export async function getFeuilleById(feuilleId: string): Promise<FeuilleDeNotes | null> {
  const snap = await getDoc(doc(db, COL, feuilleId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    dateDebut: toDate(data.dateDebut),
    dateFin: toDate(data.dateFin),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as FeuilleDeNotes;
}

/** Met à jour les notes d'une feuille */
export async function updateNotesFeuille(
  feuilleId: string,
  eleveId: string,
  evaluationId: string,
  note: number | null
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const notes = { ...(data.notes || {}) };
  notes[eleveId] = { ...(notes[eleveId] || {}) };
  if (note === null || note === undefined || Number.isNaN(note)) {
    delete notes[eleveId][evaluationId];
  } else {
    notes[eleveId][evaluationId] = Math.max(0, Math.min(20, Number(note)));
  }
  await updateDoc(ref, { notes, updatedAt: Timestamp.now() });
}

/** Met à jour une note en une seule opération (optimisation) */
export async function updateNoteBulk(
  feuilleId: string,
  updates: { eleveId: string; evaluationId: string; note: number | null }[]
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const notes = JSON.parse(JSON.stringify(data.notes || {}));
  for (const u of updates) {
    if (!notes[u.eleveId]) notes[u.eleveId] = {};
    if (u.note === null || u.note === undefined || Number.isNaN(u.note)) {
      delete notes[u.eleveId][u.evaluationId];
    } else {
      notes[u.eleveId][u.evaluationId] = Math.max(0, Math.min(20, Number(u.note)));
    }
  }
  await updateDoc(ref, { notes, updatedAt: Timestamp.now() });
}

/** Met à jour les évaluations d'une feuille */
export async function updateEvaluationsFeuille(
  feuilleId: string,
  evaluations: EvaluationNote[]
): Promise<void> {
  await updateDoc(doc(db, COL, feuilleId), {
    evaluations,
    updatedAt: Timestamp.now(),
  });
}

/** Supprime une feuille */
export async function supprimerFeuille(feuilleId: string): Promise<void> {
  await deleteDoc(doc(db, COL, feuilleId));
}

/**
 * ✨ Met à jour le titre d'une feuille existante.
 *
 *  Passer une chaîne vide (ou faite uniquement d'espaces) supprime le
 *  titre — l'UI retombera alors sur le `periodeLabel`. Cette opération
 *  est idempotente et ne touche ni aux notes, ni aux évaluations.
 */
export async function updateTitreFeuille(
  feuilleId: string,
  titre: string,
): Promise<void> {
  const trimmed = (titre || '').trim();
  await updateDoc(doc(db, COL, feuilleId), {
    // On stocke `null` (et non `undefined`) lorsque l'utilisateur efface
    // le titre : Firestore tolère mieux ce type côté requêtes futures.
    titre: trimmed.length > 0 ? trimmed : null,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Construit les lignes de notes (élèves + moyennes + rang).
 *
 * Règle de calcul (formule retenue par PedaClic) :
 *   - MoyenneDevoirs  = Σ(note × coef) / Σ(coef) sur les évaluations de type 'devoir'
 *                      DE LA FEUILLE COURANTE UNIQUEMENT.
 *   - NoteComposition = Σ(note × coef) / Σ(coef) sur les évaluations de type 'composition'
 *                      DE LA FEUILLE COURANTE UNIQUEMENT.
 *   - MoyenneGénérale =
 *       • Si devoirs + composition présents : (MoyDevoirs + Composition) / 2
 *       • Sinon : la seule des deux qui existe (fallback gracieux)
 *       • Sinon : moyenne pondérée classique sur toutes les évaluations
 *   - Rang  : classement décroissant sur MoyenneGénérale (égalité → même rang).
 *
 * 🛡️ Garde-fou strict : on ne consomme QUE les notes dont l'evaluationId
 *    est encore présent dans `feuille.evaluations`. Cela élimine toute
 *    contamination possible :
 *      • notes orphelines laissées en base après suppression / renommage
 *        d'une évaluation,
 *      • notes héritées d'une autre feuille (ex. import / duplication),
 *      • notes saisies pour un id qui aurait migré entre catégories.
 *
 *    Concrètement : la colonne « Moy. Devoirs » ne récupère QUE les notes
 *    de devoirs de la feuille courante — pas plus, pas moins.
 *
 * Rétro-compat : le champ `moyenne` est renseigné avec la MoyenneGénérale,
 * ce qui préserve les vues lecture seule (élève, parent) sans les casser.
 */
export function buildLignesNotes(
  feuille: FeuilleDeNotes,
  inscriptions: { eleveId: string; eleveNom: string; eleveEmail: string }[],
): LigneNotes[] {
  const lignesBrutes: LigneNotes[] = [];
  const notes = feuille.notes || {};
  const evals = feuille.evaluations || [];

  // ── Partitionnement strict par type ──
  //   On garde le défaut historique « 'devoir' si type absent » pour ne
  //   PAS casser les feuilles d'avant l'introduction du champ `type`.
  const evalsDevoirs = evals.filter((e) => (e.type ?? 'devoir') === 'devoir');
  const evalsCompo = evals.filter((e) => e.type === 'composition');

  // ── Sets d'IDs autorisés (référence absolue : la feuille courante) ──
  //   Toute clé de `notes[eleveId]` ABSENTE de ces sets sera ignorée :
  //   c'est le verrou anti-contamination demandé par l'utilisateur.
  const idsDevoirs = new Set(evalsDevoirs.map((e) => e.id));
  const idsCompo = new Set(evalsCompo.map((e) => e.id));
  const idsValides = new Set<string>([...idsDevoirs, ...idsCompo]);

  // Helper : renvoie une note numérique exploitable, ou null sinon.
  const lireNote = (raw: unknown): number | null => {
    if (raw === undefined || raw === null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || Number.isNaN(n)) return null;
    return n;
  };

  for (const i of inscriptions) {
    // Brut Firestore : peut contenir des entrées orphelines (legacy / import).
    const notesEleveBrutes = notes[i.eleveId] || {};

    // 🔒 Filtre défensif : on ne conserve que les notes dont l'evaluationId
    //    appartient encore à `feuille.evaluations`. Les autres sont écartées.
    const notesEleve: Record<string, number> = {};
    for (const [evalId, raw] of Object.entries(notesEleveBrutes)) {
      if (!idsValides.has(evalId)) continue; // note orpheline → ignorée
      const n = lireNote(raw);
      if (n !== null) notesEleve[evalId] = n;
    }

    // Agrégateurs : moyennes pondérées sur chaque sous-ensemble
    let totalCoefD = 0, totalPointsD = 0;
    let totalCoefC = 0, totalPointsC = 0;
    let totalCoefAll = 0, totalPointsAll = 0;

    // ── Boucle DEVOIRS : strictement les évaluations type='devoir' de cette feuille ──
    for (const e of evalsDevoirs) {
      const n = notesEleve[e.id]; // déjà filtré et numérique
      if (n === undefined) continue;
      const coef = e.coefficient && e.coefficient > 0 ? e.coefficient : 1;
      totalPointsD += n * coef;
      totalCoefD += coef;
      totalPointsAll += n * coef;
      totalCoefAll += coef;
    }
    // ── Boucle COMPOSITIONS : strictement les évaluations type='composition' ──
    for (const e of evalsCompo) {
      const n = notesEleve[e.id];
      if (n === undefined) continue;
      const coef = e.coefficient && e.coefficient > 0 ? e.coefficient : 1;
      totalPointsC += n * coef;
      totalCoefC += coef;
      totalPointsAll += n * coef;
      totalCoefAll += coef;
    }

    const round2 = (v: number) => Math.round(v * 100) / 100;
    const moyenneDevoirs = totalCoefD > 0 ? round2(totalPointsD / totalCoefD) : 0;
    const noteComposition = totalCoefC > 0 ? round2(totalPointsC / totalCoefC) : 0;

    // Choix de la moyenne générale (gère les 3 configurations possibles)
    let moyenneGenerale: number;
    if (totalCoefD > 0 && totalCoefC > 0) {
      // Cas nominal : moyenne PedaClic = (Moyenne devoirs + Composition) / 2
      moyenneGenerale = round2((moyenneDevoirs + noteComposition) / 2);
    } else if (totalCoefD > 0) {
      moyenneGenerale = moyenneDevoirs;
    } else if (totalCoefC > 0) {
      moyenneGenerale = noteComposition;
    } else if (totalCoefAll > 0) {
      // Filet de sécurité : calcul classique sur toutes les évaluations
      moyenneGenerale = round2(totalPointsAll / totalCoefAll);
    } else {
      moyenneGenerale = 0;
    }

    lignesBrutes.push({
      eleveId: i.eleveId,
      eleveNom: i.eleveNom,
      eleveEmail: i.eleveEmail,
      // ⚠️ On expose `notesEleve` FILTRÉES (pas les brutes) : le rendu
      //    voit donc exactement les mêmes notes que celles utilisées
      //    pour le calcul, sans clés orphelines.
      notes: notesEleve,
      // `moyenne` conservée = moyenne générale (rétro-compat vues lecture)
      moyenne: moyenneGenerale,
      moyenneDevoirs,
      noteComposition,
      moyenneGenerale,
      rang: 0, // calculé ci-dessous
    });
  }

  // ── Calcul du rang (égalité = même rang type "dense ranking") ──
  //   Les élèves sans aucune note évaluée (moyenneGenerale = 0 et aucune
  //   évaluation saisie) restent à rang 0 pour ne pas polluer le classement.
  const lignesClassables = lignesBrutes
    .map((l, idx) => ({ idx, mg: l.moyenneGenerale, aNote: Object.keys(l.notes).length > 0 }))
    .filter((l) => l.aNote)
    .sort((a, b) => b.mg - a.mg);

  let rangCourant = 0;
  let moyennePrecedente = Number.POSITIVE_INFINITY;
  lignesClassables.forEach((item, position) => {
    // Rang compétition : position suivante prend en compte le saut (1, 1, 3...)
    if (item.mg !== moyennePrecedente) {
      rangCourant = position + 1;
      moyennePrecedente = item.mg;
    }
    lignesBrutes[item.idx].rang = rangCourant;
  });

  return lignesBrutes;
}

/** Met à jour les compétences définies pour une feuille */
export async function updateCompetencesDefFeuille(
  feuilleId: string,
  competencesDef: CompetenceDef[]
): Promise<void> {
  await updateDoc(doc(db, COL, feuilleId), {
    competencesDef,
    updatedAt: Timestamp.now(),
  });
}

/** Met à jour le statut d'une compétence pour un élève */
export async function updateCompetenceEleve(
  feuilleId: string,
  eleveId: string,
  evaluationId: string,
  competenceId: string,
  status: CompetenceStatus
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const competences = JSON.parse(JSON.stringify(data.competences || {}));
  if (!competences[eleveId]) competences[eleveId] = {};
  if (!competences[eleveId][evaluationId]) competences[eleveId][evaluationId] = {};
  competences[eleveId][evaluationId][competenceId] = status;
  await updateDoc(ref, { competences, updatedAt: Timestamp.now() });
}

/** Feuilles pour un élève (tous ses groupes) */
export async function getFeuillesForEleve(eleveId: string): Promise<FeuilleDeNotes[]> {
  const { getGroupesEleve } = await import('./profGroupeService');
  const groupes = await getGroupesEleve(eleveId);
  const all: FeuilleDeNotes[] = [];
  for (const g of groupes) {
    const feuilles = await getFeuillesByGroupe(g.id);
    all.push(...feuilles);
  }
  all.sort((a, b) => {
    const da = toDate(a.dateDebut);
    const db = toDate(b.dateDebut);
    return db.getTime() - da.getTime();
  });
  return all;
}

/** Feuilles pour un parent (groupes de ses enfants) */
export async function getFeuillesForParent(enfantIds: string[]): Promise<FeuilleDeNotes[]> {
  const all: FeuilleDeNotes[] = [];
  const seen = new Set<string>();
  for (const eleveId of enfantIds) {
    const feuilles = await getFeuillesForEleve(eleveId);
    for (const f of feuilles) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        all.push(f);
      }
    }
  }
  all.sort((a, b) => {
    const da = toDate(a.dateDebut);
    const db = toDate(b.dateDebut);
    return db.getTime() - da.getTime();
  });
  return all;
}
