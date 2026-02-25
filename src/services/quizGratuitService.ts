// ============================================================
// SERVICE : quizGratuitService
// Charge les quiz gratuits depuis quizzes + quizzes_v2
// PedaClic — www.pedaclic.sn
// ============================================================

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

// ─── Interfaces ──────────────────────────────────────────────

/**
 * Quiz gratuit unifié (compatible quizzes ET quizzes_v2)
 */
export interface QuizGratuit {
  id: string;
  titre: string;
  description?: string;
  matiere: string;
  niveau?: string;
  classe?: string;
  nombreQuestions: number;
  duree?: number;           // en minutes
  difficulte?: 'facile' | 'moyen' | 'difficile';
  source: 'quizzes' | 'quizzes_v2';
  isPremium: false;
  createdAt?: Timestamp;
}

// ─── Constantes ──────────────────────────────────────────────
const COL_QUIZZES    = 'quizzes';
const COL_QUIZZES_V2 = 'quizzes_v2';
const MAX_PAR_COL    = 50;

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Normalise un document quizzes (ancienne collection)
 */
function normaliserQuizAncien(d: QueryDocumentSnapshot): QuizGratuit {
  const data = d.data();
  return {
    id:              d.id,
    titre:           data.titre       || 'Quiz sans titre',
    description:     data.description || '',
    matiere:         data.matiere     || data.disciplineId || '',
    niveau:          data.niveau      || '',
    classe:          data.classe      || '',
    nombreQuestions: Array.isArray(data.questions) ? data.questions.length : 0,
    duree:           data.duree       || undefined,
    difficulte:      data.difficulte  || 'moyen',
    source:          'quizzes',
    isPremium:       false,
    createdAt:       data.createdAt   || undefined,
  };
}

/**
 * Normalise un document quizzes_v2 (collection avancée)
 */
function normaliserQuizV2(d: QueryDocumentSnapshot): QuizGratuit {
  const data = d.data();
  return {
    id:              d.id,
    titre:           data.titre       || 'Quiz sans titre',
    description:     data.description || '',
    matiere:         data.matiere     || '',
    niveau:          data.niveau      || '',
    classe:          data.classe      || '',
    nombreQuestions: Array.isArray(data.questions) ? data.questions.length : 0,
    duree:           data.dureeEstimee || undefined,
    difficulte:      data.difficulte   || 'moyen',
    source:          'quizzes_v2',
    isPremium:       false,
    createdAt:       data.createdAt    || undefined,
  };
}

// ─── Fonctions exportées ──────────────────────────────────────

/**
 * Récupère tous les quiz gratuits des deux collections.
 * Retourne les quiz triés par date de création décroissante.
 */
export async function getQuizGratuits(): Promise<QuizGratuit[]> {
  const [snapOld, snapV2] = await Promise.all([
    // Collection quizzes (ancienne)
    getDocs(
      query(
        collection(db, COL_QUIZZES),
        where('isPremium', '==', false),
        orderBy('createdAt', 'desc'),
        limit(MAX_PAR_COL)
      )
    ),
    // Collection quizzes_v2 (avancée)
    getDocs(
      query(
        collection(db, COL_QUIZZES_V2),
        where('isPremium', '==', false),
        orderBy('createdAt', 'desc'),
        limit(MAX_PAR_COL)
      )
    ),
  ]);

  const quizzesOld = snapOld.docs.map(normaliserQuizAncien);
  const quizzesV2  = snapV2.docs.map(normaliserQuizV2);

  // Fusion + tri global par date décroissante
  return [...quizzesOld, ...quizzesV2].sort((a, b) => {
    const dateA = a.createdAt?.toMillis() ?? 0;
    const dateB = b.createdAt?.toMillis() ?? 0;
    return dateB - dateA;
  });
}

/**
 * Récupère les quiz gratuits filtrés par matière
 */
export async function getQuizGratuitsByMatiere(matiere: string): Promise<QuizGratuit[]> {
  const tous = await getQuizGratuits();
  return tous.filter(q =>
    q.matiere.toLowerCase().includes(matiere.toLowerCase())
  );
}

/**
 * Aperçu limité pour les visiteurs non connectés (3 quiz max)
 */
export async function getQuizGratuitsApercu(): Promise<QuizGratuit[]> {
  const tous = await getQuizGratuits();
  return tous.slice(0, 3);
}
