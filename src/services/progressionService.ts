/**
 * ============================================================
 * PedaClic - Phase 7 : Service Progression (progressionService.ts)
 * ============================================================
 * Service Firestore pour :
 *  - Sauvegarder les résultats de quiz (collection "quizResults")
 *  - Calculer les statistiques de progression élèves
 *  - Récupérer l'historique des quiz passés
 *
 * Placement : src/services/progressionService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/* ──────────────────────────────────────────────
   Types locaux
   ────────────────────────────────────────────── */

/** Résultat individuel d'un quiz passé */
export interface QuizResult {
  id: string;
  quizId: string;
  quizTitre: string;
  disciplineId: string;
  disciplineNom: string;
  userId: string;
  score: number;             // Points obtenus
  totalPoints: number;       // Points maximum
  pourcentage: number;       // Score en %
  reponses: number[];        // Index des réponses données
  tempsEcoule: number;       // Temps en secondes
  datePassage: any;          // Timestamp Firestore
  reussi: boolean;           // >= noteMinimale
  nombreQuestions: number;
  bonnesReponses: number;
}

/** Données à soumettre quand on termine un quiz */
export interface QuizSubmission {
  quizId: string;
  quizTitre: string;
  disciplineId: string;
  disciplineNom: string;
  userId: string;
  reponses: number[];
  tempsEcoule: number;
  score: number;
  totalPoints: number;
  pourcentage: number;
  reussi: boolean;
  nombreQuestions: number;
  bonnesReponses: number;
}

/** Stats globales de progression d'un élève */
export interface StudentProgress {
  totalQuizPasses: number;
  totalQuizReussis: number;
  moyenneGenerale: number;       // en %
  tempsTotal: number;            // en secondes
  meilleurScore: number;         // en %
  serieReussites: number;        // série actuelle de quiz réussis
  meilleureSerieReussites: number;
}

/** Stats de progression par discipline */
export interface DisciplineProgress {
  disciplineId: string;
  disciplineNom: string;
  nombreQuiz: number;
  moyenne: number;               // en %
  meilleurScore: number;         // en %
  dernierScore: number;          // en %
  quizReussis: number;
  tempsTotal: number;            // en secondes
  tendance: 'up' | 'down' | 'stable'; // progression
}

/** Évolution dans le temps pour les graphiques */
export interface ProgressionTemporelle {
  date: string;                  // format 'DD/MM'
  score: number;                 // en %
  discipline: string;
}

/** Badge de récompense */
export interface Badge {
  id: string;
  nom: string;
  description: string;
  icone: string;                 // emoji
  condition: string;
  obtenu: boolean;
  dateObtention?: string;
}

/* ──────────────────────────────────────────────
   Référence à la collection Firestore
   ────────────────────────────────────────────── */
const quizResultsRef = collection(db, 'quiz_results');

/* ══════════════════════════════════════════════
   1. SAUVEGARDER UN RÉSULTAT DE QUIZ
   ══════════════════════════════════════════════ */

/**
 * Sauvegarde le résultat d'un quiz passé par un élève.
 * Retourne l'ID du document créé.
 */
export const saveQuizResult = async (submission: QuizSubmission): Promise<string> => {
  try {
    const docRef = await addDoc(quizResultsRef, {
      ...submission,
      datePassage: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du résultat :', error);
    throw error;
  }
};

/* ══════════════════════════════════════════════
   2. HISTORIQUE DES QUIZ D'UN ÉLÈVE
   ══════════════════════════════════════════════ */

/**
 * Récupère l'historique complet des quiz passés par un élève.
 * Trié par date décroissante (plus récent en premier).
 */
export const getQuizHistory = async (
  userId: string,
  maxResults?: number
): Promise<QuizResult[]> => {
  try {
    let q = query(
      quizResultsRef,
      where('userId', '==', userId),
      orderBy('datePassage', 'desc')
    );

    if (maxResults) {
      q = query(q, limit(maxResults));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizResult[];
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique :', error);
    throw error;
  }
};

/**
 * Récupère l'historique des quiz pour une discipline spécifique.
 */
export const getQuizHistoryByDiscipline = async (
  userId: string,
  disciplineId: string
): Promise<QuizResult[]> => {
  try {
    const q = query(
      quizResultsRef,
      where('userId', '==', userId),
      where('disciplineId', '==', disciplineId),
      orderBy('datePassage', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizResult[];
  } catch (error) {
    console.error('Erreur lors de la récupération par discipline :', error);
    throw error;
  }
};

/* ══════════════════════════════════════════════
   3. STATISTIQUES GLOBALES DE PROGRESSION
   ══════════════════════════════════════════════ */

/**
 * Calcule les statistiques globales de progression d'un élève.
 */
export const getStudentProgress = async (userId: string): Promise<StudentProgress> => {
  try {
    const results = await getQuizHistory(userId);

    if (results.length === 0) {
      return {
        totalQuizPasses: 0,
        totalQuizReussis: 0,
        moyenneGenerale: 0,
        tempsTotal: 0,
        meilleurScore: 0,
        serieReussites: 0,
        meilleureSerieReussites: 0,
      };
    }

    /* Calcul de la moyenne générale */
    const totalPourcentage = results.reduce((sum, r) => sum + r.pourcentage, 0);
    const moyenneGenerale = Math.round(totalPourcentage / results.length);

    /* Meilleur score */
    const meilleurScore = Math.max(...results.map((r) => r.pourcentage));

    /* Temps total */
    const tempsTotal = results.reduce((sum, r) => sum + (r.tempsEcoule || 0), 0);

    /* Quiz réussis */
    const totalQuizReussis = results.filter((r) => r.reussi).length;

    /* Série de réussites actuelle et meilleure série */
    let serieActuelle = 0;
    let meilleureSerie = 0;
    /* Les résultats sont triés par date desc, on parcourt du plus récent */
    for (const result of results) {
      if (result.reussi) {
        serieActuelle++;
        meilleureSerie = Math.max(meilleureSerie, serieActuelle);
      } else {
        /* Pour la série actuelle, on arrête au premier échec */
        if (serieActuelle === meilleureSerie) {
          /* La série actuelle est aussi la meilleure, on continue pour la meilleure */
        }
        if (result === results.find((r) => !r.reussi)) {
          /* Premier échec rencontré = fin de la série actuelle */
        }
        meilleureSerie = Math.max(meilleureSerie, serieActuelle);
        serieActuelle = 0;
      }
    }
    /* Série actuelle = depuis le dernier résultat */
    let serieReussites = 0;
    for (const result of results) {
      if (result.reussi) serieReussites++;
      else break;
    }

    return {
      totalQuizPasses: results.length,
      totalQuizReussis,
      moyenneGenerale,
      tempsTotal,
      meilleurScore,
      serieReussites,
      meilleureSerieReussites: Math.max(meilleureSerie, serieReussites),
    };
  } catch (error) {
    console.error('Erreur lors du calcul des stats :', error);
    return {
      totalQuizPasses: 0,
      totalQuizReussis: 0,
      moyenneGenerale: 0,
      tempsTotal: 0,
      meilleurScore: 0,
      serieReussites: 0,
      meilleureSerieReussites: 0,
    };
  }
};

/* ══════════════════════════════════════════════
   4. PROGRESSION PAR DISCIPLINE
   ══════════════════════════════════════════════ */

/**
 * Calcule la progression par discipline pour un élève.
 * Retourne un tableau avec stats par matière.
 */
export const getDisciplineProgress = async (
  userId: string
): Promise<DisciplineProgress[]> => {
  try {
    const results = await getQuizHistory(userId);

    if (results.length === 0) return [];

    /* Grouper par discipline */
    const groupes: Record<string, QuizResult[]> = {};
    for (const result of results) {
      const key = result.disciplineId;
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(result);
    }

    /* Calculer les stats par discipline */
    return Object.entries(groupes).map(([disciplineId, discResults]) => {
      /* Trier par date (plus récent en premier — déjà fait) */
      const moyenne = Math.round(
        discResults.reduce((sum, r) => sum + r.pourcentage, 0) / discResults.length
      );
      const meilleurScore = Math.max(...discResults.map((r) => r.pourcentage));
      const dernierScore = discResults[0].pourcentage;
      const quizReussis = discResults.filter((r) => r.reussi).length;
      const tempsTotal = discResults.reduce((sum, r) => sum + (r.tempsEcoule || 0), 0);

      /* Calculer la tendance (3 derniers vs 3 précédents) */
      let tendance: 'up' | 'down' | 'stable' = 'stable';
      if (discResults.length >= 4) {
        const recents = discResults.slice(0, 3);
        const anciens = discResults.slice(3, 6);
        const moyRecents = recents.reduce((s, r) => s + r.pourcentage, 0) / recents.length;
        const moyAnciens = anciens.reduce((s, r) => s + r.pourcentage, 0) / anciens.length;
        if (moyRecents - moyAnciens > 5) tendance = 'up';
        else if (moyAnciens - moyRecents > 5) tendance = 'down';
      }

      return {
        disciplineId,
        disciplineNom: discResults[0].disciplineNom || disciplineId,
        nombreQuiz: discResults.length,
        moyenne,
        meilleurScore,
        dernierScore,
        quizReussis,
        tempsTotal,
        tendance,
      };
    });
  } catch (error) {
    console.error('Erreur lors du calcul de la progression par discipline :', error);
    return [];
  }
};

/* ══════════════════════════════════════════════
   5. DONNÉES POUR GRAPHIQUES (RECHARTS)
   ══════════════════════════════════════════════ */

/**
 * Retourne les données de progression temporelle pour recharts.
 * Chaque point = un quiz passé avec la date et le score.
 */
export const getProgressionTemporelle = async (
  userId: string,
  maxPoints?: number
): Promise<ProgressionTemporelle[]> => {
  try {
    const results = await getQuizHistory(userId, maxPoints || 20);

    /* Inverser pour avoir l'ordre chronologique (ancien → récent) */
    return results.reverse().map((r) => {
      const date = r.datePassage?.toDate
        ? r.datePassage.toDate()
        : new Date(r.datePassage);

      return {
        date: date.toLocaleDateString('fr-SN', { day: '2-digit', month: '2-digit' }),
        score: r.pourcentage,
        discipline: r.disciplineNom || r.disciplineId,
      };
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des données temporelles :', error);
    return [];
  }
};

/* ══════════════════════════════════════════════
   6. SYSTÈME DE BADGES
   ══════════════════════════════════════════════ */

/**
 * Calcule les badges obtenus par un élève
 * en fonction de ses statistiques de progression.
 */
export const calculateBadges = (
  progress: StudentProgress,
  disciplineProgress: DisciplineProgress[]
): Badge[] => {
  const badges: Badge[] = [
    /* ── Badges de passage ── */
    {
      id: 'premier_quiz',
      nom: 'Premier pas',
      description: 'Passer votre premier quiz',
      icone: '🎯',
      condition: '1 quiz passé',
      obtenu: progress.totalQuizPasses >= 1,
    },
    {
      id: 'dix_quiz',
      nom: 'Explorateur',
      description: 'Passer 10 quiz',
      icone: '🔍',
      condition: '10 quiz passés',
      obtenu: progress.totalQuizPasses >= 10,
    },
    {
      id: 'vingt_cinq_quiz',
      nom: 'Assidu',
      description: 'Passer 25 quiz',
      icone: '📚',
      condition: '25 quiz passés',
      obtenu: progress.totalQuizPasses >= 25,
    },
    {
      id: 'cinquante_quiz',
      nom: 'Champion',
      description: 'Passer 50 quiz',
      icone: '🏆',
      condition: '50 quiz passés',
      obtenu: progress.totalQuizPasses >= 50,
    },

    /* ── Badges de performance ── */
    {
      id: 'score_parfait',
      nom: 'Score parfait',
      description: 'Obtenir 100% à un quiz',
      icone: '⭐',
      condition: '100% à un quiz',
      obtenu: progress.meilleurScore >= 100,
    },
    {
      id: 'moyenne_80',
      nom: 'Excellent',
      description: 'Maintenir une moyenne de 80%+',
      icone: '🌟',
      condition: 'Moyenne ≥ 80%',
      obtenu: progress.moyenneGenerale >= 80 && progress.totalQuizPasses >= 5,
    },
    {
      id: 'moyenne_60',
      nom: 'Bon élève',
      description: 'Maintenir une moyenne de 60%+',
      icone: '👍',
      condition: 'Moyenne ≥ 60%',
      obtenu: progress.moyenneGenerale >= 60 && progress.totalQuizPasses >= 5,
    },

    /* ── Badges de série ── */
    {
      id: 'serie_3',
      nom: 'En forme',
      description: '3 quiz réussis d\'affilée',
      icone: '🔥',
      condition: 'Série de 3 réussites',
      obtenu: progress.meilleureSerieReussites >= 3,
    },
    {
      id: 'serie_5',
      nom: 'Imbattable',
      description: '5 quiz réussis d\'affilée',
      icone: '💪',
      condition: 'Série de 5 réussites',
      obtenu: progress.meilleureSerieReussites >= 5,
    },
    {
      id: 'serie_10',
      nom: 'Légende',
      description: '10 quiz réussis d\'affilée',
      icone: '👑',
      condition: 'Série de 10 réussites',
      obtenu: progress.meilleureSerieReussites >= 10,
    },

    /* ── Badges multi-disciplines ── */
    {
      id: 'multi_3',
      nom: 'Polyvalent',
      description: 'Passer des quiz dans 3 disciplines',
      icone: '🎨',
      condition: '3 disciplines différentes',
      obtenu: disciplineProgress.length >= 3,
    },
    {
      id: 'multi_5',
      nom: 'Touche-à-tout',
      description: 'Passer des quiz dans 5 disciplines',
      icone: '🌈',
      condition: '5 disciplines différentes',
      obtenu: disciplineProgress.length >= 5,
    },
  ];

  return badges;
};

/* ══════════════════════════════════════════════
   7. UTILITAIRES
   ══════════════════════════════════════════════ */

/**
 * Formate un temps en secondes en chaîne lisible.
 * Ex: 125 → "2 min 05 s"
 */
export const formatTemps = (secondes: number): string => {
  if (secondes < 60) return `${secondes} s`;
  const min = Math.floor(secondes / 60);
  const sec = secondes % 60;
  return sec > 0 ? `${min} min ${sec.toString().padStart(2, '0')} s` : `${min} min`;
};

/**
 * Retourne une couleur selon le score en pourcentage.
 */
export const getScoreColor = (pourcentage: number): string => {
  if (pourcentage >= 80) return '#10b981'; /* vert */
  if (pourcentage >= 60) return '#3b82f6'; /* bleu */
  if (pourcentage >= 40) return '#f59e0b'; /* orange */
  return '#ef4444';                         /* rouge */
};

/**
 * Retourne un label selon le score en pourcentage.
 */
export const getScoreLabel = (pourcentage: number): string => {
  if (pourcentage >= 80) return 'Excellent';
  if (pourcentage >= 60) return 'Bien';
  if (pourcentage >= 40) return 'Passable';
  return 'À améliorer';
};
