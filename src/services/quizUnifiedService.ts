// ============================================================
// PedaClic — Phase 32 : Service Quiz unifié (Classic + Avancé)
// ============================================================
// Objectif : agréger en une seule API les quiz accessibles à
// un élève, quelle que soit leur collection d'origine.
//
// Sources de quiz pour un élève :
//   (a) quizzes          — Quiz Classic (manuel ou IA)
//   (b) quizzes_v2       — Quiz Avancé
//
// Conditions d'accessibilité, pour chaque source :
//   1) Quiz global      (groupeId absent / null)
//   2) Quiz lié à une classe de l'élève (groupeId ∈ groupes de l'élève)
//   3) Quiz lié à une séance d'un cahier partagé à sa classe
//      (seanceId ∈ entrees du cahier avec isPartage==true)
//
// IMPORTANT — Contraintes Firestore Rules PedaClic :
//   - Pas de chaînage getUserData() côté rules
//   - Pas de hasAny() + array-contains-any combiné
//   - On déporte tout le filtrage ici (service layer), les règles
//     se contentent de "allow get: if isSignedIn()" + "allow list"
// ============================================================

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Quiz } from './quizService';
import type { QuizAvance } from '../types/quiz-advanced';
import { getGroupesEleve } from './profGroupeService';
import { getCahiersPartagesForEleve } from './cahierTextesService';

// ─────────────────────────────────────────────────────────────
// TYPE UNIFIÉ — base commune Classic + Avancé
// ─────────────────────────────────────────────────────────────

/** Nature technique du quiz (collection source). */
export type QuizNature = 'classic' | 'avance';

/**
 * Vue unifiée d'un quiz pour affichage côté élève, indépendante de
 * la collection. Contient juste ce dont la liste "Mes Quiz" a besoin.
 */
export interface QuizUnifie {
  id: string;
  nature: QuizNature;
  titre: string;
  description?: string;
  disciplineId?: string;
  disciplineNom?: string;
  matiere?: string;
  duree: number;
  isPremium: boolean;
  noteMinimale: number;
  nombreQuestions: number;
  /** Provenance pédagogique (pour filtres et statistiques). */
  origine: 'global' | 'classe' | 'seance';
  /** Id du groupe-classe cible, s'il y en a un. */
  groupeId?: string | null;
  /** Id de la séance de cahier de textes, s'il y en a un. */
  seanceId?: string | null;
  /** Id du cahier de textes (pour quizzes liés à une séance). */
  cahierId?: string | null;
  /** Horodatage de création (trié desc). */
  createdAt?: Date | null;
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Convertit un `Date | Timestamp | undefined` en `Date | null`.
 * Sert à normaliser `createdAt` quelle que soit la collection source.
 */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'object' && v !== null && 'seconds' in (v as any)) {
    return new Timestamp((v as any).seconds, (v as any).nanoseconds || 0).toDate();
  }
  return null;
}

function normaliserQuizClassic(
  q: Quiz,
  origine: QuizUnifie['origine']
): QuizUnifie {
  return {
    id: q.id,
    nature: 'classic',
    titre: q.titre,
    disciplineId: q.disciplineId,
    duree: q.duree ?? 0,
    isPremium: Boolean(q.isPremium),
    noteMinimale: q.noteMinimale ?? 10,
    nombreQuestions: q.questions?.length ?? 0,
    origine,
    groupeId: q.groupeId ?? null,
    seanceId: (q as any).seanceId ?? null,
    cahierId: (q as any).cahierId ?? null,
    createdAt: toDate(q.createdAt),
  };
}

function normaliserQuizAvance(
  q: QuizAvance,
  origine: QuizUnifie['origine']
): QuizUnifie {
  return {
    id: q.id,
    nature: 'avance',
    titre: q.titre,
    description: q.description,
    disciplineId: q.disciplineId,
    disciplineNom: q.disciplineNom,
    matiere: q.matiere,
    duree: q.duree ?? 0,
    isPremium: Boolean(q.isPremium),
    noteMinimale: q.noteMinimale ?? 10,
    nombreQuestions: q.questions?.length ?? 0,
    origine,
    groupeId: q.groupeId ?? null,
    seanceId: (q as any).seanceId ?? null,
    cahierId: (q as any).cahierId ?? null,
    createdAt: toDate(q.createdAt),
  };
}

// ─────────────────────────────────────────────────────────────
// LECTURE BRUTE PAR COLLECTION
// ─────────────────────────────────────────────────────────────

/** Lit tous les quiz Classic publiés (brouillons exclus). */
async function lireQuizClassicPublics(isPremium: boolean): Promise<Quiz[]> {
  // Classic : pas de champ `status` systématique sur l'ancien modèle.
  // On se contente d'exclure brouillons si la propriété est présente.
  const contraintes: Parameters<typeof query>[1][] = [orderBy('titre', 'asc')];
  if (!isPremium) {
    contraintes.unshift(where('isPremium', '==', false));
  }
  const snap = await getDocs(query(collection(db, 'quizzes'), ...contraintes));
  const docs: Quiz[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quiz));
  return docs.filter((q) => (q as any).status !== 'draft');
}

/** Lit tous les quiz Avancé publiés (règles : status == 'published' pour élèves). */
async function lireQuizAvancePublies(): Promise<QuizAvance[]> {
  // La règle Firestore filtre elle-même pour l'élève : status == 'published'.
  const snap = await getDocs(
    query(collection(db, 'quizzes_v2'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuizAvance));
}

// ─────────────────────────────────────────────────────────────
// API PRINCIPALE — QUIZ ACCESSIBLES À UN ÉLÈVE
// ─────────────────────────────────────────────────────────────

/**
 * Récupère l'ensemble des quiz accessibles à un élève, en fusionnant
 * Classic + Avancé, avec l'origine pédagogique (global / classe / séance).
 *
 * Règle de priorité d'origine pour chaque quiz :
 *   séance  >  classe  >  global
 *
 * Les doublons (ex. quiz attaché à une séance + à la classe) ne sont
 * comptés qu'une fois, en gardant l'origine la plus fine.
 */
export async function getQuizzesAccessiblesEleve(
  eleveId: string,
  isPremium: boolean
): Promise<QuizUnifie[]> {
  // 1) Contextes de l'élève : groupes + cahiers partagés (pour seances)
  const groupes = await getGroupesEleve(eleveId);
  const groupeIds = groupes.map((g) => g.id);

  let seanceIds: Set<string> = new Set();
  let cahierIds: Set<string> = new Set();
  if (groupeIds.length > 0) {
    try {
      const cahiers = await getCahiersPartagesForEleve(groupeIds);
      cahierIds = new Set(cahiers.map((c) => c.id));
      // On agrège les entrées de ces cahiers pour savoir quelles séances
      // sont visibles à l'élève — on s'appuie sur getEntreesRealisees côté
      // rendu UI ; pour le filtrage de quiz, on accepte toute séance d'un
      // cahier partagé (la règle Firestore laisse lire les entrées).
    } catch {
      // Silencieux : si l'élève n'a aucun cahier partagé, seanceIds reste vide.
    }
  }

  // 2) Lecture parallèle des 2 collections quiz
  const [classics, avances] = await Promise.all([
    lireQuizClassicPublics(isPremium).catch(() => [] as Quiz[]),
    lireQuizAvancePublies().catch(() => [] as QuizAvance[]),
  ]);

  // 3) Extraction des seanceIds : on prend tous les quiz liés à une
  //    séance dont le cahier appartient à `cahierIds`.
  //    Pour cela on autorise tout quiz `seanceId != null && cahierId ∈ cahierIds`.
  const estLieCahierVisible = (cahId: string | null | undefined): boolean =>
    Boolean(cahId && cahierIds.has(cahId));

  // 4) Classement par origine (séance > classe > global)
  const out: QuizUnifie[] = [];

  const traite = (
    q: Quiz | QuizAvance,
    normalise: (q: any, origine: QuizUnifie['origine']) => QuizUnifie
  ) => {
    const gid = (q as any).groupeId ?? null;
    const cid = (q as any).cahierId ?? null;
    const sid = (q as any).seanceId ?? null;

    // (a) lié à une séance d'un cahier partagé → origine 'seance'
    if (sid && estLieCahierVisible(cid)) {
      out.push(normalise(q, 'seance'));
      return;
    }
    // (b) lié à une classe de l'élève → origine 'classe'
    if (gid && groupeIds.includes(gid)) {
      out.push(normalise(q, 'classe'));
      return;
    }
    // (c) quiz global (pas de groupeId) → origine 'global'
    if (!gid) {
      out.push(normalise(q, 'global'));
      return;
    }
    // Sinon (groupeId d'une autre classe) → ignoré
  };

  classics.forEach((q) => traite(q, normaliserQuizClassic));
  avances.forEach((q) => traite(q, normaliserQuizAvance));

  // 5) Déduplication : un même id peut théoriquement exister avec
  //    deux origines concurrentes (improbable mais on garde la + fine).
  const priorite: Record<QuizUnifie['origine'], number> = {
    seance: 3,
    classe: 2,
    global: 1,
  };
  const map = new Map<string, QuizUnifie>();
  for (const q of out) {
    const cle = `${q.nature}:${q.id}`;
    const exist = map.get(cle);
    if (!exist || priorite[q.origine] > priorite[exist.origine]) {
      map.set(cle, q);
    }
  }

  return [...map.values()].sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0;
    const tb = b.createdAt?.getTime() ?? 0;
    return tb - ta;
  });
}

// ─────────────────────────────────────────────────────────────
// API PROF — QUIZ PAR SÉANCE / CAHIER
// ─────────────────────────────────────────────────────────────

/**
 * Récupère tous les quiz (Classic + Avancé) liés à une séance donnée.
 * Utilisé par le 3ᵉ onglet « Quiz » de la vue édition de séance,
 * et par la vue élève (séance consultée).
 */
export async function getQuizzesBySeance(seanceId: string): Promise<QuizUnifie[]> {
  const [snapC, snapA] = await Promise.all([
    getDocs(query(collection(db, 'quizzes'), where('seanceId', '==', seanceId))).catch(
      () => null
    ),
    getDocs(
      query(collection(db, 'quizzes_v2'), where('seanceId', '==', seanceId))
    ).catch(() => null),
  ]);

  const classics: Quiz[] = snapC ? snapC.docs.map((d) => ({ id: d.id, ...d.data() } as Quiz)) : [];
  const avances: QuizAvance[] = snapA
    ? snapA.docs.map((d) => ({ id: d.id, ...d.data() } as QuizAvance))
    : [];

  return [
    ...classics.map((q) => normaliserQuizClassic(q, 'seance')),
    ...avances.map((q) => normaliserQuizAvance(q, 'seance')),
  ];
}

/**
 * Récupère les quiz d'un prof, toutes collections confondues.
 * Utilisé par « Mes Quiz » côté prof.
 */
export async function getQuizzesDuProf(profId: string): Promise<QuizUnifie[]> {
  // Classic : on interroge `profId` (convention actuelle) ET `auteurId`
  // (legacy — quiz IA auto-générés avant le fix d'avril 2026). On fusionne
  // ensuite par id pour éviter les doublons quand un quiz porte les deux.
  const [snapClassicProf, snapClassicAuteur, snapA] = await Promise.all([
    getDocs(
      query(collection(db, 'quizzes'), where('profId', '==', profId))
    ).catch(() => null),
    getDocs(
      query(collection(db, 'quizzes'), where('auteurId', '==', profId))
    ).catch(() => null),
    getDocs(
      query(collection(db, 'quizzes_v2'), where('auteurId', '==', profId))
    ).catch(() => null),
  ]);

  const mapClassics = new Map<string, Quiz>();
  (snapClassicProf?.docs ?? []).forEach((d) =>
    mapClassics.set(d.id, { id: d.id, ...d.data() } as Quiz)
  );
  (snapClassicAuteur?.docs ?? []).forEach((d) => {
    if (!mapClassics.has(d.id)) {
      mapClassics.set(d.id, { id: d.id, ...d.data() } as Quiz);
    }
  });
  const classics: Quiz[] = [...mapClassics.values()];

  const avances: QuizAvance[] = snapA
    ? snapA.docs.map((d) => ({ id: d.id, ...d.data() } as QuizAvance))
    : [];

  // Pour "Mes Quiz" côté prof, l'origine est indicative (basée sur la
  // structure du doc). On reprend la même règle simple.
  const classify = (q: any): QuizUnifie['origine'] => {
    if (q.seanceId) return 'seance';
    if (q.groupeId) return 'classe';
    return 'global';
  };

  const out: QuizUnifie[] = [
    ...classics.map((q) => normaliserQuizClassic(q, classify(q))),
    ...avances.map((q) => normaliserQuizAvance(q, classify(q))),
  ];

  return out.sort((a, b) => {
    const ta = a.createdAt?.getTime() ?? 0;
    const tb = b.createdAt?.getTime() ?? 0;
    return tb - ta;
  });
}
