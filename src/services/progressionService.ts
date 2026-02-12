/**
 * ============================================================
 * PedaClic — Phase 14 : progressionService.ts (COMPLET)
 * ============================================================
 * Service Firestore unifié pour :
 *  1. Sauvegarder / lire les résultats de quiz (existant Phase 7)
 *  2. Marquer les ressources comme consultées (NOUVEAU Phase 14)
 *  3. Calculer le % d'avancement par discipline (NOUVEAU)
 *  4. Gérer le streak de connexion (NOUVEAU)
 *  5. Débloquer automatiquement les badges (ENRICHI)
 *
 * Collection Firestore "progressions" :
 *   Document ID = `${userId}_${disciplineId}`
 *
 * Collection Firestore "quiz_results" : (inchangée)
 *
 * Placement : src/services/progressionService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';

/* ── Import des types Phase 14 ── */
import type {
  Progression,
  BadgeDefinition,
  StreakData,
  ProgressionGlobale,
} from '../types';

/* ══════════════════════════════════════════════════════════════
   TYPES EXISTANTS (Phase 7) — conservés tels quels
   ══════════════════════════════════════════════════════════════ */

/** Résultat individuel d'un quiz passé */
export interface QuizResult {
  id: string;
  quizId: string;
  quizTitre: string;
  disciplineId: string;
  disciplineNom: string;
  userId: string;
  score: number;
  totalPoints: number;
  pourcentage: number;
  reponses: number[];
  tempsEcoule: number;
  datePassage: any;
  reussi: boolean;
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

/** Stats globales de progression d'un élève (Phase 7) */
export interface StudentProgress {
  totalQuizPasses: number;
  totalQuizReussis: number;
  moyenneGenerale: number;
  tempsTotal: number;
  meilleurScore: number;
  serieReussites: number;
  meilleureSerieReussites: number;
}

/** Stats de progression par discipline (Phase 7) */
export interface DisciplineProgress {
  disciplineId: string;
  disciplineNom: string;
  nombreQuiz: number;
  moyenne: number;
  meilleurScore: number;
  dernierScore: number;
  quizReussis: number;
  tempsTotal: number;
  tendance: 'up' | 'down' | 'stable';
}

/** Évolution dans le temps pour les graphiques */
export interface ProgressionTemporelle {
  date: string;
  score: number;
  discipline: string;
}

/** Badge (Phase 7 — conservé pour compatibilité) */
export interface Badge {
  id: string;
  nom: string;
  description: string;
  icone: string;
  condition: string;
  obtenu: boolean;
  dateObtention?: string;
}

/* ══════════════════════════════════════════════════════════════
   RÉFÉRENCES FIRESTORE
   ══════════════════════════════════════════════════════════════ */

/** Collection des résultats de quiz (Phase 7) */
const quizResultsRef = collection(db, 'quiz_results');

/** Collection des progressions par discipline (Phase 14) */
const progressionsRef = collection(db, 'progressions');

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — RÉSULTATS DE QUIZ (Phase 7 — inchangé)
   ══════════════════════════════════════════════════════════════ */

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

    /* ── Phase 14 : Mettre à jour la progression de la discipline ── */
    if (submission.reussi) {
      await enregistrerQuizReussi(
        submission.userId,
        submission.disciplineId,
        submission.disciplineNom,
        submission.quizId
      );
    }

    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du résultat :', error);
    throw error;
  }
};

/**
 * Récupère l'historique des quiz passés par un élève.
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
    if (maxResults) q = query(q, limit(maxResults));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizResult[];
  } catch (error) {
    console.error("Erreur récupération historique :", error);
    throw error;
  }
};

/**
 * Historique par discipline.
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
    console.error('Erreur récupération par discipline :', error);
    throw error;
  }
};

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — STATS GLOBALES (Phase 7 — inchangé)
   ══════════════════════════════════════════════════════════════ */

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

    const totalPourcentage = results.reduce((sum, r) => sum + r.pourcentage, 0);
    const moyenneGenerale = Math.round(totalPourcentage / results.length);
    const meilleurScore = Math.max(...results.map((r) => r.pourcentage));
    const tempsTotal = results.reduce((sum, r) => sum + (r.tempsEcoule || 0), 0);
    const totalQuizReussis = results.filter((r) => r.reussi).length;

    let serieActuelle = 0;
    let meilleureSerie = 0;
    for (const result of results) {
      if (result.reussi) {
        serieActuelle++;
        meilleureSerie = Math.max(meilleureSerie, serieActuelle);
      } else {
        serieActuelle = 0;
      }
    }
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
    console.error('Erreur calcul stats :', error);
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

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — PROGRESSION PAR DISCIPLINE (Phase 7 — inchangé)
   ══════════════════════════════════════════════════════════════ */

export const getDisciplineProgress = async (
  userId: string
): Promise<DisciplineProgress[]> => {
  try {
    const results = await getQuizHistory(userId);
    if (results.length === 0) return [];

    const groupes: Record<string, QuizResult[]> = {};
    for (const result of results) {
      const key = result.disciplineId;
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(result);
    }

    return Object.entries(groupes).map(([disciplineId, discResults]) => {
      const moyenne = Math.round(
        discResults.reduce((sum, r) => sum + r.pourcentage, 0) / discResults.length
      );
      const meilleurScore = Math.max(...discResults.map((r) => r.pourcentage));
      const dernierScore = discResults[0].pourcentage;
      const quizReussis = discResults.filter((r) => r.reussi).length;
      const tempsTotal = discResults.reduce((sum, r) => sum + (r.tempsEcoule || 0), 0);

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
    console.error('Erreur progression par discipline :', error);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — DONNÉES GRAPHIQUES (Phase 7 — inchangé)
   ══════════════════════════════════════════════════════════════ */

export const getProgressionTemporelle = async (
  userId: string,
  maxPoints?: number
): Promise<ProgressionTemporelle[]> => {
  try {
    const results = await getQuizHistory(userId, maxPoints || 20);
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
    console.error('Erreur données temporelles :', error);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════
   ┌──────────────────────────────────────────────────────────┐
   │         SECTION 5 — NOUVEAU Phase 14                     │
   │         SUIVI DES RESSOURCES CONSULTÉES                  │
   └──────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/**
 * Récupère ou crée le document de progression
 * pour un couple (userId, disciplineId).
 *
 * ID du document = `${userId}_${disciplineId}`
 */
const getOrCreateProgression = async (
  userId: string,
  disciplineId: string,
  disciplineNom: string
): Promise<Progression> => {
  const docId = `${userId}_${disciplineId}`;
  const docRef = doc(progressionsRef, docId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    return { ...snap.data() } as Progression;
  }

  /* ── Compter les ressources et quiz disponibles dans la discipline ── */
  const [ressCount, quizCount] = await Promise.all([
    countDocumentsInDiscipline('ressources', disciplineId),
    countDocumentsInDiscipline('quizzes', disciplineId),
  ]);

  const newProg: Progression = {
    userId,
    disciplineId,
    disciplineNom,
    ressourcesVues: [],
    quizReussis: [],
    totalRessources: ressCount,
    totalQuiz: quizCount,
    pourcentage: 0,
    dernierAcces: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(docRef, newProg);
  return newProg;
};

/**
 * Compte le nombre de documents dans une collection
 * filtrés par disciplineId.
 */
const countDocumentsInDiscipline = async (
  collectionName: string,
  disciplineId: string
): Promise<number> => {
  try {
    const q = query(
      collection(db, collectionName),
      where('disciplineId', '==', disciplineId)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch {
    return 0;
  }
};

/**
 * Calcule le pourcentage de progression.
 * Formule : (ressourcesVues + quizReussis) / (totalRessources + totalQuiz) × 100
 * Pondération : ressources = 40%, quiz = 60% du total
 */
const calculerPourcentage = (prog: Progression): number => {
  const totalItems = prog.totalRessources + prog.totalQuiz;
  if (totalItems === 0) return 0;

  /* Pondération : ressources 40%, quiz 60% */
  const poidRessources = prog.totalRessources > 0
    ? (prog.ressourcesVues.length / prog.totalRessources) * 40
    : 0;
  const poidQuiz = prog.totalQuiz > 0
    ? (prog.quizReussis.length / prog.totalQuiz) * 60
    : 0;

  /* Si une seule catégorie existe, elle vaut 100% */
  if (prog.totalRessources === 0) {
    return Math.min(100, Math.round((prog.quizReussis.length / prog.totalQuiz) * 100));
  }
  if (prog.totalQuiz === 0) {
    return Math.min(100, Math.round((prog.ressourcesVues.length / prog.totalRessources) * 100));
  }

  return Math.min(100, Math.round(poidRessources + poidQuiz));
};

/**
 * ★ Marquer une ressource comme consultée par l'élève.
 * Met à jour le document de progression et recalcule le %.
 */
export const marquerRessourceVue = async (
  userId: string,
  disciplineId: string,
  disciplineNom: string,
  ressourceId: string
): Promise<Progression> => {
  try {
    const docId = `${userId}_${disciplineId}`;
    const docRef = doc(progressionsRef, docId);

    /* Récupérer ou créer la progression */
    const prog = await getOrCreateProgression(userId, disciplineId, disciplineNom);

    /* Éviter les doublons */
    if (prog.ressourcesVues.includes(ressourceId)) {
      /* Déjà consultée — on met juste à jour la date d'accès */
      await updateDoc(docRef, { dernierAcces: Timestamp.now() });
      return prog;
    }

    /* Ajouter la ressource et recalculer */
    const updatedRessources = [...prog.ressourcesVues, ressourceId];
    const updatedProg: Progression = {
      ...prog,
      ressourcesVues: updatedRessources,
      dernierAcces: Timestamp.now(),
      updatedAt: Timestamp.now(),
      pourcentage: 0, // sera recalculé
    };
    updatedProg.pourcentage = calculerPourcentage(updatedProg);

    await setDoc(docRef, updatedProg);

    /* Mettre à jour le streak */
    await mettreAJourStreak(userId);

    return updatedProg;
  } catch (error) {
    console.error('Erreur marquer ressource vue :', error);
    throw error;
  }
};

/**
 * ★ Enregistrer la réussite d'un quiz dans la progression.
 * Appelée automatiquement depuis saveQuizResult si reussi=true.
 */
export const enregistrerQuizReussi = async (
  userId: string,
  disciplineId: string,
  disciplineNom: string,
  quizId: string
): Promise<Progression> => {
  try {
    const docId = `${userId}_${disciplineId}`;
    const docRef = doc(progressionsRef, docId);

    const prog = await getOrCreateProgression(userId, disciplineId, disciplineNom);

    /* Éviter les doublons */
    if (prog.quizReussis.includes(quizId)) {
      await updateDoc(docRef, { dernierAcces: Timestamp.now() });
      return prog;
    }

    const updatedQuiz = [...prog.quizReussis, quizId];
    const updatedProg: Progression = {
      ...prog,
      quizReussis: updatedQuiz,
      dernierAcces: Timestamp.now(),
      updatedAt: Timestamp.now(),
      pourcentage: 0,
    };
    updatedProg.pourcentage = calculerPourcentage(updatedProg);

    await setDoc(docRef, updatedProg);
    return updatedProg;
  } catch (error) {
    console.error('Erreur enregistrement quiz réussi :', error);
    throw error;
  }
};

/**
 * ★ Récupère toutes les progressions d'un élève (toutes disciplines).
 */
export const getProgressionEleve = async (
  userId: string
): Promise<Progression[]> => {
  try {
    const q = query(progressionsRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Progression);
  } catch (error) {
    console.error('Erreur récupération progressions :', error);
    return [];
  }
};

/**
 * ★ Résumé global de progression (agrégation multi-disciplines).
 */
export const getProgressionGlobale = async (
  userId: string
): Promise<ProgressionGlobale> => {
  try {
    const progressions = await getProgressionEleve(userId);
    const streak = await getStreak(userId);

    const totalRessourcesVues = progressions.reduce(
      (sum, p) => sum + p.ressourcesVues.length, 0
    );
    const totalQuizReussis = progressions.reduce(
      (sum, p) => sum + p.quizReussis.length, 0
    );
    const pourcentageMoyen = progressions.length > 0
      ? Math.round(progressions.reduce((sum, p) => sum + p.pourcentage, 0) / progressions.length)
      : 0;
    const disciplinesCompletees = progressions.filter((p) => p.pourcentage >= 100).length;

    return {
      totalRessourcesVues,
      totalQuizReussis,
      pourcentageMoyen,
      disciplinesCommencees: progressions.length,
      disciplinesCompletees,
      streakActuel: streak.streakActuel,
      meilleurStreak: streak.meilleurStreak,
      parDiscipline: progressions,
    };
  } catch (error) {
    console.error('Erreur progression globale :', error);
    return {
      totalRessourcesVues: 0,
      totalQuizReussis: 0,
      pourcentageMoyen: 0,
      disciplinesCommencees: 0,
      disciplinesCompletees: 0,
      streakActuel: 0,
      meilleurStreak: 0,
      parDiscipline: [],
    };
  }
};

/* ══════════════════════════════════════════════════════════════
   ┌──────────────────────────────────────────────────────────┐
   │         SECTION 6 — NOUVEAU Phase 14                     │
   │         STREAK DE CONNEXION                              │
   └──────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/**
 * Obtient la date du jour au format YYYY-MM-DD
 * (fuseau horaire Dakar = UTC+0)
 */
const getAujourdhui = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * Obtient la date d'hier au format YYYY-MM-DD
 */
const getHier = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

/**
 * ★ Récupère les données de streak d'un élève.
 */
export const getStreak = async (userId: string): Promise<StreakData> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      return { streakActuel: 0, meilleurStreak: 0, dernierJourAcces: '' };
    }

    const data = snap.data();
    return {
      streakActuel: data.streakActuel || 0,
      meilleurStreak: data.meilleurStreak || 0,
      dernierJourAcces: data.dernierJourAcces || '',
    };
  } catch (error) {
    console.error('Erreur récupération streak :', error);
    return { streakActuel: 0, meilleurStreak: 0, dernierJourAcces: '' };
  }
};

/**
 * ★ Met à jour le streak de connexion de l'élève.
 * Appelée automatiquement à chaque interaction (ressource vue, quiz passé).
 *
 * Logique :
 *   - Si dernierJourAcces === aujourd'hui → rien à faire
 *   - Si dernierJourAcces === hier → streak +1
 *   - Sinon → streak remis à 1
 */
export const mettreAJourStreak = async (userId: string): Promise<StreakData> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const streak = await getStreak(userId);
    const aujourdhui = getAujourdhui();

    /* Déjà connecté aujourd'hui — rien à faire */
    if (streak.dernierJourAcces === aujourdhui) {
      return streak;
    }

    const hier = getHier();
    let nouveauStreak: number;

    if (streak.dernierJourAcces === hier) {
      /* Connexion consécutive — incrémenter */
      nouveauStreak = streak.streakActuel + 1;
    } else {
      /* Connexion non consécutive — réinitialiser */
      nouveauStreak = 1;
    }

    const meilleurStreak = Math.max(streak.meilleurStreak, nouveauStreak);

    await updateDoc(userDocRef, {
      streakActuel: nouveauStreak,
      meilleurStreak,
      dernierJourAcces: aujourdhui,
    });

    return {
      streakActuel: nouveauStreak,
      meilleurStreak,
      dernierJourAcces: aujourdhui,
    };
  } catch (error) {
    console.error('Erreur mise à jour streak :', error);
    return { streakActuel: 0, meilleurStreak: 0, dernierJourAcces: '' };
  }
};

/* ══════════════════════════════════════════════════════════════
   ┌──────────────────────────────────────────────────────────┐
   │         SECTION 7 — NOUVEAU Phase 14                     │
   │         BADGES CONTEXTUALISÉS (Sénégal)                  │
   └──────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/**
 * ★ Calcule tous les badges (existants Phase 7 + nouveaux Phase 14).
 *
 * Badges Phase 14 ajoutés :
 *   🌱 Premier pas — 1ère ressource consultée
 *   📖 Lecteur assidu — 10 ressources consultées
 *   🧩 Challenger — 5 quiz réussis
 *   🏆 Maître — 100% d'une discipline
 *   🔥 En feu — 7 jours de connexion consécutifs
 *   🌍 Explorateur Teranga — 3 disciplines commencées
 *   💎 Diamant — 50 ressources + 20 quiz réussis
 */
export const calculateBadges = (
  progress: StudentProgress,
  disciplineProgress: DisciplineProgress[],
  progressionGlobale?: ProgressionGlobale | null
): BadgeDefinition[] => {
  /* Valeurs Phase 14 (avec fallback si pas encore chargé) */
  const totalRessources = progressionGlobale?.totalRessourcesVues || 0;
  const totalQuizReussisP14 = progressionGlobale?.totalQuizReussis || 0;
  const disciplinesCompletees = progressionGlobale?.disciplinesCompletees || 0;
  const streakActuel = progressionGlobale?.streakActuel || 0;
  const meilleurStreak = progressionGlobale?.meilleurStreak || 0;
  const disciplinesCommencees = progressionGlobale?.disciplinesCommencees || 0;

  const badges: BadgeDefinition[] = [
    /* ──────────────────────────────────────
       Badges Ressources (Phase 14 NOUVEAU)
       ────────────────────────────────────── */
    {
      id: 'premier_pas',
      nom: 'Premier pas 🌱',
      description: 'Consulter votre première ressource',
      icone: '🌱',
      condition: '1 ressource consultée',
      categorie: 'ressources',
      obtenu: totalRessources >= 1,
    },
    {
      id: 'lecteur_assidu',
      nom: 'Lecteur assidu 📖',
      description: 'Consulter 10 ressources',
      icone: '📖',
      condition: '10 ressources consultées',
      categorie: 'ressources',
      obtenu: totalRessources >= 10,
    },
    {
      id: 'bibliophile',
      nom: 'Bibliophile 📚',
      description: 'Consulter 25 ressources',
      icone: '📚',
      condition: '25 ressources consultées',
      categorie: 'ressources',
      obtenu: totalRessources >= 25,
    },
    {
      id: 'savant',
      nom: 'Savant 🎓',
      description: 'Consulter 50 ressources',
      icone: '🎓',
      condition: '50 ressources consultées',
      categorie: 'ressources',
      obtenu: totalRessources >= 50,
    },

    /* ──────────────────────────────────────
       Badges Quiz (Phase 7 enrichis)
       ────────────────────────────────────── */
    {
      id: 'premier_quiz',
      nom: 'Apprenti 🎯',
      description: 'Passer votre premier quiz',
      icone: '🎯',
      condition: '1 quiz passé',
      categorie: 'quiz',
      obtenu: progress.totalQuizPasses >= 1,
    },
    {
      id: 'challenger',
      nom: 'Challenger 🧩',
      description: 'Réussir 5 quiz',
      icone: '🧩',
      condition: '5 quiz réussis',
      categorie: 'quiz',
      obtenu: progress.totalQuizReussis >= 5,
    },
    {
      id: 'dix_quiz',
      nom: 'Décathlon 🏅',
      description: 'Passer 10 quiz',
      icone: '🏅',
      condition: '10 quiz passés',
      categorie: 'quiz',
      obtenu: progress.totalQuizPasses >= 10,
    },
    {
      id: 'cinquante_quiz',
      nom: 'Marathonien 🏃',
      description: 'Passer 50 quiz',
      icone: '🏃',
      condition: '50 quiz passés',
      categorie: 'quiz',
      obtenu: progress.totalQuizPasses >= 50,
    },

    /* ──────────────────────────────────────
       Badges Performance
       ────────────────────────────────────── */
    {
      id: 'score_parfait',
      nom: 'Score parfait ⭐',
      description: 'Obtenir 100% à un quiz',
      icone: '⭐',
      condition: '100% à un quiz',
      categorie: 'performance',
      obtenu: progress.meilleurScore >= 100,
    },
    {
      id: 'moyenne_80',
      nom: 'Excellent 🌟',
      description: 'Moyenne générale de 80%+',
      icone: '🌟',
      condition: 'Moyenne ≥ 80% (min. 5 quiz)',
      categorie: 'performance',
      obtenu: progress.moyenneGenerale >= 80 && progress.totalQuizPasses >= 5,
    },
    {
      id: 'serie_5',
      nom: 'Imbattable 💪',
      description: '5 quiz réussis d\'affilée',
      icone: '💪',
      condition: 'Série de 5 réussites',
      categorie: 'performance',
      obtenu: progress.meilleureSerieReussites >= 5,
    },
    {
      id: 'serie_10',
      nom: 'Légende 👑',
      description: '10 quiz réussis d\'affilée',
      icone: '👑',
      condition: 'Série de 10 réussites',
      categorie: 'performance',
      obtenu: progress.meilleureSerieReussites >= 10,
    },

    /* ──────────────────────────────────────
       Badges Discipline (Phase 14 NOUVEAU)
       ────────────────────────────────────── */
    {
      id: 'maitre',
      nom: 'Maître 🏆',
      description: 'Compléter 100% d\'une discipline',
      icone: '🏆',
      condition: '1 discipline à 100%',
      categorie: 'discipline',
      obtenu: disciplinesCompletees >= 1,
    },
    {
      id: 'explorateur_teranga',
      nom: 'Explorateur Teranga 🌍',
      description: 'Commencer 3 disciplines différentes',
      icone: '🌍',
      condition: '3 disciplines commencées',
      categorie: 'discipline',
      obtenu: disciplinesCommencees >= 3 || disciplineProgress.length >= 3,
    },
    {
      id: 'touche_a_tout',
      nom: 'Touche-à-tout 🎨',
      description: 'Commencer 5 disciplines différentes',
      icone: '🎨',
      condition: '5 disciplines commencées',
      categorie: 'discipline',
      obtenu: disciplinesCommencees >= 5 || disciplineProgress.length >= 5,
    },

    /* ──────────────────────────────────────
       Badges Streak (Phase 14 NOUVEAU)
       ────────────────────────────────────── */
    {
      id: 'en_feu_3',
      nom: 'Régulier 🔥',
      description: '3 jours de connexion consécutifs',
      icone: '🔥',
      condition: '3 jours consécutifs',
      categorie: 'streak',
      obtenu: meilleurStreak >= 3,
    },
    {
      id: 'en_feu_7',
      nom: 'En feu 🔥🔥',
      description: '7 jours de connexion consécutifs',
      icone: '🔥',
      condition: '7 jours consécutifs',
      categorie: 'streak',
      obtenu: meilleurStreak >= 7,
    },
    {
      id: 'en_feu_30',
      nom: 'Infatigable ⚡',
      description: '30 jours de connexion consécutifs',
      icone: '⚡',
      condition: '30 jours consécutifs',
      categorie: 'streak',
      obtenu: meilleurStreak >= 30,
    },

    /* ──────────────────────────────────────
       Badge ultime
       ────────────────────────────────────── */
    {
      id: 'diamant',
      nom: 'Diamant 💎',
      description: '50 ressources + 20 quiz réussis',
      icone: '💎',
      condition: '50 ressources + 20 quiz',
      categorie: 'performance',
      obtenu: totalRessources >= 50 && progress.totalQuizReussis >= 20,
    },
  ];

  return badges;
};

/* ══════════════════════════════════════════════════════════════
   SECTION 8 — UTILITAIRES (Phase 7 — inchangé)
   ══════════════════════════════════════════════════════════════ */

/** Formate un temps en secondes → "2 min 05 s" */
export const formatTemps = (secondes: number): string => {
  if (secondes < 60) return `${secondes} s`;
  const min = Math.floor(secondes / 60);
  const sec = secondes % 60;
  return sec > 0 ? `${min} min ${sec.toString().padStart(2, '0')} s` : `${min} min`;
};

/** Couleur selon le score (%) */
export const getScoreColor = (pourcentage: number): string => {
  if (pourcentage >= 80) return '#10b981';
  if (pourcentage >= 60) return '#3b82f6';
  if (pourcentage >= 40) return '#f59e0b';
  return '#ef4444';
};

/** Label selon le score (%) */
export const getScoreLabel = (pourcentage: number): string => {
  if (pourcentage >= 80) return 'Excellent';
  if (pourcentage >= 60) return 'Bien';
  if (pourcentage >= 40) return 'Passable';
  return 'À améliorer';
};
