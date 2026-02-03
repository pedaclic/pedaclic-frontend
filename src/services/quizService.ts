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
  difficulte?: string;
}

/* ══════════════════════════════════════════════
   FONCTIONS CRUD
   ══════════════════════════════════════════════ */

export const getQuizzes = async (filters?: QuizFilters): Promise<Quiz[]> => {
  try {
    let q = query(quizzesRef, orderBy('titre', 'asc'));

    if (filters?.disciplineId) {
      q = query(quizzesRef, where('disciplineId', '==', filters.disciplineId), orderBy('titre', 'asc'));
    }

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
