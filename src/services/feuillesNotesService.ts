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
  // 🆕 Sentinel pour suppressions atomiques de champs imbriqués.
  //    Évite les races read-modify-write quand plusieurs handlers
  //    écrivent en parallèle sur `notes` et `absences`.
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getElevesGroupe } from './profGroupeService';
import type {
  FeuilleDeNotes,
  EvaluationNote,
  NotesEleve,
  AbsencesEleve,
  StatutAbsenceDevoir,
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
  // Map des absences initialisée vide pour chaque élève. Le statut implicite
  // est « present » : on n'écrit jamais 'present' explicitement, ce qui évite
  // de gonfler le document Firestore avec des entrées par défaut.
  const absences: Record<string, AbsencesEleve> = {};
  const eleveIds: string[] = [];
  inscriptions.forEach((i) => {
    notes[i.eleveId] = {};
    absences[i.eleveId] = {};
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
    absences,
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

/**
 * Met à jour des notes en bulk de façon ATOMIQUE par champ imbriqué.
 *
 * 🐛 Correctif (avril 2026) — même problématique que `updateAbsenceBulk` :
 *   l'ancien read-modify-write écrasait les écritures concurrentes sur
 *   `absences`. On n'écrit plus que les chemins `notes.<eleveId>.<evalId>`
 *   qui changent. Les autres notes (et toutes les absences) sont
 *   préservées, quelle que soit la concurrence.
 */
export async function updateNoteBulk(
  feuilleId: string,
  updates: { eleveId: string; evaluationId: string; note: number | null }[]
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const payload: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  for (const u of updates) {
    const cheminNote = `notes.${u.eleveId}.${u.evaluationId}`;
    if (u.note === null || u.note === undefined || Number.isNaN(u.note)) {
      payload[cheminNote] = deleteField();
    } else {
      // Clamp [0..20] côté serveur — défense en profondeur côté UI.
      payload[cheminNote] = Math.max(0, Math.min(20, Number(u.note)));
    }
  }
  await updateDoc(ref, payload);
}

/**
 * 🆕 Met à jour le STATUT D'ABSENCE d'un élève à une évaluation.
 *
 *   - statut === 'present' (ou null) → on supprime l'entrée (état implicite,
 *     évite de stocker des valeurs par défaut).
 *   - statut === 'absent_justifie'   → l'évaluation sera ignorée dans le calcul.
 *   - statut === 'absent_non_justifie' → l'évaluation comptera 0/20.
 *
 * 💡 Lorsque le prof passe un élève en absence, on supprime AUSSI la note
 *    saisie pour cette évaluation : la note n'a plus de sens (élève absent),
 *    elle pourrait au contraire troubler la lecture de la feuille.
 *
 *    Le calcul de la moyenne (`buildLignesNotes`) ré-injecte 0/20 quand
 *    nécessaire pour les absences non justifiées : on n'a donc pas besoin
 *    de stocker un 0 explicite côté `notes`.
 */
export async function updateAbsenceBulk(
  feuilleId: string,
  updates: { eleveId: string; evaluationId: string; statut: StatutAbsenceDevoir | null }[]
): Promise<void> {
  const ref = doc(db, COL, feuilleId);

  // 🐛 Correctif (avril 2026) — Bug « ANJ efface les notes saisies » :
  //
  //   AVANT, on faisait un read-modify-write : lecture du document
  //   complet, clonage profond de `notes` et `absences`, modification
  //   en mémoire, puis ré-écriture des MAPS COMPLÈTES via updateDoc.
  //   Problème : si un appel concurrent à `updateNoteBulk` (saisie
  //   d'une note pendant que le prof clique sur le badge ANJ d'une
  //   autre cellule) terminait son `setDoc` entre notre lecture et
  //   notre écriture, on écrasait sa nouvelle note avec la version
  //   antérieure que nous avions clonée. Résultat : « les notes qui
  //   précèdent reviennent, les notes qui suivent disparaissent ».
  //
  //   FIX : on n'écrit plus que les CHAMPS IMBRIQUÉS qui changent
  //   (chemins en notation pointée acceptés par Firestore). Les
  //   autres clés de `notes` / `absences` ne sont JAMAIS touchées
  //   par cette transaction, donc plus aucun effet de bord sur les
  //   saisies parallèles.
  //
  //   • Statut → present  : `absences.<eleveId>.<evalId> = deleteField()`
  //   • Statut → AJ / ANJ : `absences.<eleveId>.<evalId> = '<statut>'`
  //                         + `notes.<eleveId>.<evalId> = deleteField()`
  //                         (cohérence pédagogique : un élève absent
  //                         ne pouvait pas composer)

  // Construction du payload partiel à appliquer.
  // On utilise `Record<string, unknown>` pour pouvoir mêler valeurs
  // primitives (`'absent_justifie'`) et sentinelles `deleteField()`.
  const payload: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  for (const u of updates) {
    const cheminAbsence = `absences.${u.eleveId}.${u.evaluationId}`;
    const cheminNote = `notes.${u.eleveId}.${u.evaluationId}`;

    if (u.statut === null || u.statut === 'present' || u.statut === undefined) {
      // Retour « présent » → on supprime juste la clé d'absence ;
      // la note (si elle existait) reste intacte.
      payload[cheminAbsence] = deleteField();
    } else {
      payload[cheminAbsence] = u.statut;
      // Effacement atomique de la note correspondante uniquement.
      payload[cheminNote] = deleteField();
    }
  }

  await updateDoc(ref, payload);
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
  // Map des absences (rétro-compat : feuilles antérieures n'ont pas le champ).
  const absences = feuille.absences || {};
  const evals = feuille.evaluations || [];

  // ── Partitionnement strict par type ──
  //   On garde le défaut historique « 'devoir' si type absent » pour ne
  //   PAS casser les feuilles d'avant l'introduction du champ `type`.
  const evalsDevoirs = evals.filter((e) => (e.type ?? 'devoir') === 'devoir');
  const evalsCompo = evals.filter((e) => e.type === 'composition');

  // 🆕 Helper d'inclusion : exclueDeMoyenne === true → on n'agrège PAS
  //    cette évaluation dans la moyenne (devoirs / compo), mais on la
  //    laisse visible dans le tableau et les exports.
  //
  //    Cas par défaut (champ absent ou false) → évaluation incluse.
  const estIncluseDansMoyenne = (e: EvaluationNote): boolean => e.exclueDeMoyenne !== true;

  // ── Sets d'IDs autorisés (référence absolue : la feuille courante) ──
  //   Toute clé de `notes[eleveId]` ABSENTE de ces sets sera ignorée :
  //   c'est le verrou anti-contamination demandé par l'utilisateur.
  //   On NE filtre PAS sur `exclueDeMoyenne` ici : les notes des
  //   évaluations exclues doivent rester accessibles à l'affichage.
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
    const absencesEleveBrutes = absences[i.eleveId] || {};

    // 🔒 Filtre défensif : on ne conserve que les notes dont l'evaluationId
    //    appartient encore à `feuille.evaluations`. Les autres sont écartées.
    const notesEleve: Record<string, number> = {};
    for (const [evalId, raw] of Object.entries(notesEleveBrutes)) {
      if (!idsValides.has(evalId)) continue; // note orpheline → ignorée
      const n = lireNote(raw);
      if (n !== null) notesEleve[evalId] = n;
    }

    // 🔒 Même filtrage pour les statuts d'absence : on ne garde que ceux
    //    qui correspondent à une évaluation existante de la feuille.
    const absencesEleve: AbsencesEleve = {};
    let nbAbsencesJustifiees = 0;
    let nbAbsencesNonJustifiees = 0;
    for (const [evalId, statut] of Object.entries(absencesEleveBrutes)) {
      if (!idsValides.has(evalId)) continue;
      if (statut === 'absent_justifie') {
        absencesEleve[evalId] = 'absent_justifie';
        nbAbsencesJustifiees++;
      } else if (statut === 'absent_non_justifie') {
        absencesEleve[evalId] = 'absent_non_justifie';
        nbAbsencesNonJustifiees++;
      }
      // 'present' / valeur inconnue → on ignore (état implicite).
    }

    // Agrégateurs : moyennes pondérées sur chaque sous-ensemble
    let totalCoefD = 0, totalPointsD = 0;
    let totalCoefC = 0, totalPointsC = 0;
    let totalCoefAll = 0, totalPointsAll = 0;

    /**
     * Helper interne : injecte la note d'une évaluation dans les agrégateurs
     * en appliquant la règle d'absence retenue par PedaClic :
     *
     *   - 'absent_justifie'      → on IGNORE l'évaluation (return immédiat).
     *   - 'absent_non_justifie'  → on injecte 0 / 20 (pondéré par coef).
     *   - 'present' (ou absent)  → on prend la note saisie si elle existe.
     *
     * `bucket` indique dans quels accumulateurs sommer ('devoir' ou 'compo').
     */
    const consommerEval = (e: EvaluationNote, bucket: 'devoir' | 'compo') => {
      // 🆕 Court-circuit : évaluation exclue du calcul de moyenne ne contribue
      //    NI aux totaux devoirs/compo, NI à la moyenne générale, NI au rang.
      //    Les notes restent toutefois consultables dans la grille et exportées.
      if (!estIncluseDansMoyenne(e)) return;

      const statut = absencesEleve[e.id]; // déjà filtré
      if (statut === 'absent_justifie') return; // ignorée

      const coef = e.coefficient && e.coefficient > 0 ? e.coefficient : 1;
      let valeur: number | null = null;
      if (statut === 'absent_non_justifie') {
        valeur = 0; // pénalité explicite : compte 0/20 dans la moyenne
      } else {
        const n = notesEleve[e.id];
        if (n === undefined) return; // pas de note ni d'absence → on ignore
        valeur = n;
      }

      if (bucket === 'devoir') {
        totalPointsD += valeur * coef;
        totalCoefD += coef;
      } else {
        totalPointsC += valeur * coef;
        totalCoefC += coef;
      }
      totalPointsAll += valeur * coef;
      totalCoefAll += coef;
    };

    // ── Boucle DEVOIRS : strictement les évaluations type='devoir' de cette feuille ──
    for (const e of evalsDevoirs) consommerEval(e, 'devoir');
    // ── Boucle COMPOSITIONS : strictement les évaluations type='composition' ──
    for (const e of evalsCompo) consommerEval(e, 'compo');

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
      // ⚠️ Idem pour les absences : on expose la map filtrée pour que
      //    l'éditeur, la vue lecture seule et les exports utilisent la
      //    même source de vérité que le calcul.
      absences: absencesEleve,
      // `moyenne` conservée = moyenne générale (rétro-compat vues lecture)
      moyenne: moyenneGenerale,
      moyenneDevoirs,
      noteComposition,
      moyenneGenerale,
      rang: 0, // calculé ci-dessous
      nbAbsencesJustifiees,
      nbAbsencesNonJustifiees,
    });
  }

  // ── Calcul du rang (égalité = même rang type "dense ranking") ──
  //   Un élève est « classable » dès qu'il a au moins :
  //     • une note saisie sur la feuille,
  //     • OU une absence non justifiée (qui compte 0/20 et doit donc être
  //       reflétée dans le classement),
  //     • OU une absence justifiée (présence avérée à la session, statut connu).
  //   Les élèves sans aucune trace (ni note, ni absence) restent à rang 0
  //   pour ne pas polluer le classement.
  const lignesClassables = lignesBrutes
    .map((l, idx) => ({
      idx,
      mg: l.moyenneGenerale,
      aTrace:
        Object.keys(l.notes).length > 0 ||
        l.nbAbsencesJustifiees > 0 ||
        l.nbAbsencesNonJustifiees > 0,
    }))
    .filter((l) => l.aTrace)
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

/**
 * 🆕 (mai 2026) — Définit les compétences ÉVALUÉES pour une évaluation
 *   spécifique (devoir ou composition).
 *
 *   - Persiste `evaluations[i].competences` directement dans Firestore.
 *   - Si la liste est vide, on supprime le champ pour rester rétro-
 *     compatible avec les feuilles existantes (où ce champ n'existait pas).
 *   - N'altère AUCUN autre champ de l'évaluation (libellé, coef, type,
 *     exclusion, etc.) afin de préserver les fonctionnalités existantes.
 *
 *   Pourquoi ce service séparé ?
 *     Une mise à jour ciblée évite de surécrire l'ensemble du tableau
 *     `evaluations[]` (qui pourrait être modifié en parallèle dans
 *     une autre session — drag-and-drop ou renommage). On utilise
 *     une lecture-modification-écriture courte protégée par
 *     Firestore (taux de concurrence faible côté un seul prof).
 */
export async function updateCompetencesEvaluation(
  feuilleId: string,
  evaluationId: string,
  competences: CompetenceDef[]
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const evals: EvaluationNote[] = (data.evaluations || []).map((e: EvaluationNote) => {
    if (e.id !== evaluationId) return e;
    // Liste vide → on retire complètement le champ pour rester compact
    // côté document Firestore et pour que l'UI retombe proprement sur
    // les compétences globales de la feuille (`competencesDef`).
    if (competences.length === 0) {
      const { competences: _omit, ...rest } = e;
      return rest as EvaluationNote;
    }
    return { ...e, competences };
  });
  await updateDoc(ref, { evaluations: evals, updatedAt: Timestamp.now() });
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
