/**
 * ============================================================
 * PedaClic - Phase 6 : Service Quiz (quizService.ts) - CORRIGÉ
 * ============================================================
 * Service Firestore pour le CRUD complet des quiz.
 * Collection Firestore : "quizzes"
 *
 * Placement : src/services/quizService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getGroupesEleve } from './profGroupeService';

/* ──────────────────────────────────────────────
   Types locaux (définis ici pour éviter
   les problèmes d'import depuis index.ts)
   ────────────────────────────────────────────── */
export interface Question {
  id: string;
  question: string;
  options: string[];
  reponseCorrecte: number;
  explication: string;
  difficulte: string;
  points: number;
}

export interface Quiz {
  id: string;
  disciplineId: string;
  titre: string;
  questions: Question[];
  duree: number;
  isPremium: boolean;
  noteMinimale: number;
  /** ID du professeur créateur (quiz de classe) — null = quiz plateforme */
  profId?: string | null;
  /** ID du groupe-classe cible — null = quiz global */
  groupeId?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

/* ──────────────────────────────────────────────
   Référence à la collection Firestore "quizzes"
   ────────────────────────────────────────────── */
const quizzesRef = collection(db, 'quizzes');

/* ──────────────────────────────────────────────
   Interface pour les filtres de recherche
   ────────────────────────────────────────────── */
export interface QuizFilters {
  disciplineId?: string;
  isPremium?: boolean;
  /** Si true, restreint la requête aux quiz gratuits (évite permission-denied pour élèves) */
  freeOnly?: boolean;
  difficulte?: string;
}

/* ══════════════════════════════════════════════
   FONCTIONS CRUD
   ══════════════════════════════════════════════ */

export const getQuizzes = async (filters?: QuizFilters): Promise<Quiz[]> => {
  try {
    const constraints: Parameters<typeof query>[1][] = [];

    if (filters?.disciplineId) {
      constraints.push(where('disciplineId', '==', filters.disciplineId));
    }
    if (filters?.freeOnly || filters?.isPremium === false) {
      constraints.push(where('isPremium', '==', false));
    }
    constraints.push(orderBy('titre', 'asc'));

    const q = query(quizzesRef, ...constraints);
    const snapshot = await getDocs(q);
    let quizzes: Quiz[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Quiz[];

    if (filters?.isPremium !== undefined) {
      quizzes = quizzes.filter((quiz) => quiz.isPremium === filters.isPremium);
    }

    if (filters?.difficulte) {
      quizzes = quizzes.filter((quiz) =>
        quiz.questions?.some((q) => q.difficulte === filters.difficulte)
      );
    }

    return quizzes;
  } catch (error) {
    console.error('Erreur lors de la récupération des quiz :', error);
    throw error;
  }
};

export const getQuizById = async (quizId: string): Promise<Quiz | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'quizzes', quizId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Quiz;
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération du quiz :', error);
    throw error;
  }
};

export const createQuiz = async (quizData: Omit<Quiz, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(quizzesRef, {
      ...quizData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du quiz :', error);
    throw error;
  }
};

export const updateQuiz = async (
  quizId: string,
  quizData: Partial<Omit<Quiz, 'id'>>
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'quizzes', quizId), {
      ...quizData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du quiz :', error);
    throw error;
  }
};

export const deleteQuiz = async (quizId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'quizzes', quizId));
  } catch (error) {
    console.error('Erreur lors de la suppression du quiz :', error);
    throw error;
  }
};

/* ══════════════════════════════════════════════
   FONCTIONS UTILITAIRES
   ══════════════════════════════════════════════ */

export const generateQuestionId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const createEmptyQuestion = (): Question => ({
  id: generateQuestionId(),
  question: '',
  options: ['', '', '', ''],
  reponseCorrecte: 0,
  explication: '',
  difficulte: 'moyen',
  points: 1,
});

export const getQuizStats = (quiz: Quiz) => {
  const questions = quiz.questions || [];
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
  const parDifficulte = {
    facile: questions.filter((q) => q.difficulte === 'facile').length,
    moyen: questions.filter((q) => q.difficulte === 'moyen').length,
    difficile: questions.filter((q) => q.difficulte === 'difficile').length,
  };

  return {
    nombreQuestions: questions.length,
    totalPoints,
    parDifficulte,
    duree: quiz.duree || 0,
  };
};

/* ══════════════════════════════════════════════
   QUIZ PAR PROF / ÉLÈVE (quiz de classe)
   ══════════════════════════════════════════════ */

/**
 * Récupère les quiz créés par un professeur (quiz de classe + éventuels globaux)
 */
export const getQuizzesByProf = async (profId: string): Promise<Quiz[]> => {
  try {
    const q = query(
      quizzesRef,
      where('profId', '==', profId),
      orderBy('titre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Quiz[];
  } catch (error) {
    console.error('Erreur getQuizzesByProf:', error);
    return [];
  }
};

/**
 * Récupère les quiz accessibles par un élève (globaux + ceux de ses groupes)
 */
export const getQuizzesForEleve = async (
  eleveId: string,
  isPremium: boolean
): Promise<Quiz[]> => {
  try {
    const [groupes, allQuizzes] = await Promise.all([
      getGroupesEleve(eleveId),
      getQuizzes({ freeOnly: !isPremium }),
    ]);
    const groupeIds = groupes.map((g) => g.id);
    return allQuizzes.filter(
      (q) =>
        !q.groupeId ||
        q.groupeId === null ||
        (groupeIds.length > 0 && groupeIds.includes(q.groupeId))
    );
  } catch (error) {
    console.error('Erreur getQuizzesForEleve:', error);
    return [];
  }
};
