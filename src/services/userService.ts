/**
 * ============================================================
 * PedaClic - Phase 6 : Service Utilisateurs (userService.ts) - CORRIGÉ
 * ============================================================
 * Service Firestore pour la gestion des utilisateurs.
 * Collection Firestore : "users"
 *
 * Placement : src/services/userService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
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
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'prof' | 'eleve';
  isPremium: boolean;
  subscriptionEnd?: any;
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuizResult {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  reponses: any[];
  tempsEcoule: number;
  datePassage: any;
  reussi: boolean;
}

/* ──────────────────────────────────────────────
   Références aux collections Firestore
   ────────────────────────────────────────────── */
const usersRef = collection(db, 'users');
const quizResultsRef = collection(db, 'quizResults');

/* ──────────────────────────────────────────────
   Interface pour les filtres de recherche
   ────────────────────────────────────────────── */
export interface UserFilters {
  role?: 'admin' | 'prof' | 'eleve';
  isPremium?: boolean;
  search?: string;
  isActive?: boolean;
}

/* ──────────────────────────────────────────────
   Interface pour les statistiques utilisateur
   ────────────────────────────────────────────── */
export interface UserStats {
  totalQuizPasses: number;
  scoresMoyens: number;
  quizReussis: number;
  dernierQuiz: Date | null;
}

/* ══════════════════════════════════════════════
   FONCTIONS CRUD UTILISATEURS
   ══════════════════════════════════════════════ */

export const getUsers = async (filters?: UserFilters): Promise<User[]> => {
  try {
    let q = query(usersRef, orderBy('displayName', 'asc'));

    if (filters?.role) {
      q = query(usersRef, where('role', '==', filters.role), orderBy('displayName', 'asc'));
    }

    const snapshot = await getDocs(q);
    let users: User[] = snapshot.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...docSnap.data(),
    })) as User[];

    if (filters?.isPremium !== undefined) {
      users = users.filter((user) => user.isPremium === filters.isPremium);
    }

    if (filters?.isActive !== undefined) {
      users = users.filter((user) => {
        const isActive = user.isActive !== false;
        return isActive === filters.isActive;
      });
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      users = users.filter(
        (user) =>
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
      );
    }

    return users;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error);
    throw error;
  }
};

export const getUserById = async (uid: string): Promise<User | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur :', error);
    throw error;
  }
};

export const updateUserRole = async (
  uid: string,
  role: 'admin' | 'prof' | 'eleve'
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du rôle :', error);
    throw error;
  }
};

export const updatePremiumStatus = async (
  uid: string,
  isPremium: boolean
): Promise<void> => {
  try {
    const updateData: any = {
      isPremium,
      updatedAt: Timestamp.now(),
    };

    if (isPremium) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      updateData.subscriptionEnd = Timestamp.fromDate(expirationDate);
    } else {
      updateData.subscriptionEnd = null;
    }

    await updateDoc(doc(db, 'users', uid), updateData);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut Premium :', error);
    throw error;
  }
};

export const toggleUserActive = async (
  uid: string,
  isActive: boolean
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Erreur lors du changement de statut du compte :', error);
    throw error;
  }
};

/* ══════════════════════════════════════════════
   STATISTIQUES UTILISATEURS
   ══════════════════════════════════════════════ */

export const getUserStats = async (uid: string): Promise<UserStats> => {
  try {
    const q = query(quizResultsRef, where('userId', '==', uid));
    const snapshot = await getDocs(q);

    const results: QuizResult[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizResult[];

    const totalQuizPasses = results.length;
    const quizReussis = results.filter((r) => r.reussi).length;

    const scoresMoyens =
      totalQuizPasses > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalQuizPasses)
        : 0;

    const dernierQuiz =
      results.length > 0
        ? new Date(
            Math.max(...results.map((r) => {
              const date = r.datePassage as any;
              return date?.toDate ? date.toDate().getTime() : new Date(date).getTime();
            }))
          )
        : null;

    return { totalQuizPasses, scoresMoyens, quizReussis, dernierQuiz };
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques :', error);
    return { totalQuizPasses: 0, scoresMoyens: 0, quizReussis: 0, dernierQuiz: null };
  }
};

/* ══════════════════════════════════════════════
   STATISTIQUES GLOBALES (pour le dashboard)
   ══════════════════════════════════════════════ */

export const getGlobalUserStats = async () => {
  try {
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs.map((d) => d.data());

    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      profs: users.filter((u) => u.role === 'prof').length,
      eleves: users.filter((u) => u.role === 'eleve').length,
      premium: users.filter((u) => u.isPremium).length,
      actifs: users.filter((u) => u.isActive !== false).length,
    };
  } catch (error) {
    console.error('Erreur lors du calcul des stats globales :', error);
    throw error;
  }
};
