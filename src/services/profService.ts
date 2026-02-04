/**
 * ============================================================
 * SERVICE PROFESSEUR — PedaClic Phase 8
 * ============================================================
 * 
 * Ce service fournit toutes les fonctions nécessaires au
 * Dashboard Professeurs : récupération des résultats quiz,
 * calcul de statistiques par élève / par discipline / globales,
 * détection des élèves en difficulté, et analyse par quiz.
 * 
 * Collections Firestore utilisées :
 *   - quiz_results  → résultats individuels des quiz
 *   - users         → infos élèves (displayName, email)
 *   - quizzes       → titres et métadonnées des quiz
 *   - matieres      → noms des disciplines
 * 
 * Dépendances : firebase.ts (db), index.ts (types)
 * ============================================================
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== INTERFACES SPÉCIFIQUES PROF ====================

/**
 * Résultat de quiz brut depuis Firestore (quiz_results)
 */
export interface QuizResultDoc {
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
  datePassage: Date;
  reussi: boolean;
  nombreQuestions: number;
  bonnesReponses: number;
}

/**
 * Statistiques globales de la plateforme (vue d'ensemble)
 */
export interface StatsGlobales {
  totalEleves: number;           // Nombre d'élèves inscrits
  totalQuizPasses: number;       // Total de quiz passés
  moyenneGenerale: number;       // Moyenne globale (%)
  tauxReussite: number;          // % de quiz réussis
  elevesEnDifficulte: number;    // Élèves avec moyenne < 40%
  quizAujourdHui: number;        // Quiz passés aujourd'hui
  tendanceMoyenne: 'hausse' | 'baisse' | 'stable'; // Tendance
}

/**
 * Informations sur un élève avec ses stats agrégées
 */
export interface EleveStats {
  userId: string;
  displayName: string;
  email: string;
  totalQuiz: number;
  moyenne: number;               // Moyenne en pourcentage
  tauxReussite: number;          // % de quiz réussis
  dernierQuiz: Date | null;      // Date du dernier quiz
  enDifficulte: boolean;         // moyenne < 40%
  progression: 'hausse' | 'baisse' | 'stable'; // Tendance récente
  disciplinesActives: string[];  // Disciplines où l'élève a des résultats
}

/**
 * Statistiques par discipline (onglet Performance par classe)
 */
export interface DisciplineStats {
  disciplineId: string;
  disciplineNom: string;
  totalQuiz: number;
  nombreEleves: number;
  moyenne: number;
  tauxReussite: number;
  meilleureNote: number;
  pireNote: number;
}

/**
 * Analyse détaillée d'un quiz spécifique
 */
export interface QuizAnalyse {
  quizId: string;
  quizTitre: string;
  disciplineNom: string;
  totalPassages: number;
  moyenneScore: number;
  tauxReussite: number;
  tempsEcouleMoyen: number;       // En secondes
  meilleureNote: number;
  pireNote: number;
  dernierPassage: Date | null;
}

/**
 * Progression temporelle (pour graphique recharts)
 */
export interface PointProgression {
  date: string;                   // Format 'JJ/MM' pour l'axe X
  moyenne: number;                // Moyenne du jour
  nombreQuiz: number;             // Nombre de quiz ce jour
}

/**
 * Alerte élève en difficulté
 */
export interface AlerteEleve {
  userId: string;
  displayName: string;
  email: string;
  moyenne: number;
  totalQuiz: number;
  disciplinesFaibles: string[];   // Disciplines < 40%
  dernierQuiz: Date | null;
}


// ==================== FONCTIONS HELPER ====================

/**
 * Convertit un Timestamp Firestore ou toute valeur en Date JS
 */
function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val?.seconds) return new Timestamp(val.seconds, val.nanoseconds || 0).toDate();
  return new Date(val);
}

/**
 * Formate un pourcentage avec 1 décimale
 */
export function formatPourcentage(val: number): string {
  return val.toFixed(1) + '%';
}

/**
 * Formate une durée en secondes vers "Xmin Ys"
 */
export function formatDuree(secondes: number): string {
  const min = Math.floor(secondes / 60);
  const sec = Math.round(secondes % 60);
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
}

/**
 * Retourne la couleur selon le pourcentage (cohérent avec progressionService)
 */
export function getScoreColor(pourcentage: number): string {
  if (pourcentage >= 80) return '#10b981'; // Vert — Excellent
  if (pourcentage >= 60) return '#3b82f6'; // Bleu — Bien
  if (pourcentage >= 40) return '#f59e0b'; // Orange — Passable
  return '#ef4444';                        // Rouge — En difficulté
}

/**
 * Retourne le label selon le pourcentage
 */
export function getScoreLabel(pourcentage: number): string {
  if (pourcentage >= 80) return 'Excellent';
  if (pourcentage >= 60) return 'Bien';
  if (pourcentage >= 40) return 'Passable';
  return 'En difficulté';
}

/**
 * Calcule la tendance en comparant les 5 derniers et 5 précédents résultats
 */
function calculerTendance(resultats: QuizResultDoc[]): 'hausse' | 'baisse' | 'stable' {
  if (resultats.length < 4) return 'stable';
  
  // Trier par date (plus récent d'abord)
  const tries = [...resultats].sort(
    (a, b) => toDate(b.datePassage).getTime() - toDate(a.datePassage).getTime()
  );
  
  const moitie = Math.floor(tries.length / 2);
  const recents = tries.slice(0, moitie);
  const anciens = tries.slice(moitie);
  
  const moyRecents = recents.reduce((s, r) => s + r.pourcentage, 0) / recents.length;
  const moyAnciens = anciens.reduce((s, r) => s + r.pourcentage, 0) / anciens.length;
  
  const diff = moyRecents - moyAnciens;
  if (diff > 5) return 'hausse';
  if (diff < -5) return 'baisse';
  return 'stable';
}


// ==================== RÉCUPÉRATION DES DONNÉES ====================

/**
 * Récupère TOUS les résultats de quiz (collection quiz_results)
 * Utilisé pour les calculs globaux du dashboard prof
 */
export async function getAllQuizResults(): Promise<QuizResultDoc[]> {
  try {
    const ref = collection(db, 'quiz_results');
    const q = query(ref, orderBy('datePassage', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        quizId: data.quizId || '',
        quizTitre: data.quizTitre || 'Quiz sans titre',
        disciplineId: data.disciplineId || '',
        disciplineNom: data.disciplineNom || 'Non définie',
        userId: data.userId || '',
        score: data.score || 0,
        totalPoints: data.totalPoints || 0,
        pourcentage: data.pourcentage || 0,
        reponses: data.reponses || [],
        tempsEcoule: data.tempsEcoule || 0,
        datePassage: toDate(data.datePassage),
        reussi: data.reussi || false,
        nombreQuestions: data.nombreQuestions || 0,
        bonnesReponses: data.bonnesReponses || 0,
      } as QuizResultDoc;
    });
  } catch (error) {
    console.error('Erreur récupération quiz_results:', error);
    return [];
  }
}

/**
 * Récupère tous les élèves (users avec role === 'eleve')
 */
export async function getAllEleves(): Promise<{ uid: string; displayName: string; email: string }[]> {
  try {
    const ref = collection(db, 'users');
    const q = query(ref, where('role', '==', 'eleve'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data.displayName || 'Élève sans nom',
        email: data.email || '',
      };
    });
  } catch (error) {
    console.error('Erreur récupération élèves:', error);
    return [];
  }
}

/**
 * Récupère toutes les disciplines (matieres)
 */
export async function getAllDisciplines(): Promise<{ id: string; nom: string }[]> {
  try {
    const ref = collection(db, 'matieres');
    const snapshot = await getDocs(ref);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      nom: doc.data().nom || 'Sans nom',
    }));
  } catch (error) {
    console.error('Erreur récupération disciplines:', error);
    return [];
  }
}


// ==================== CALCULS STATISTIQUES ====================

/**
 * Calcule les statistiques globales (vue d'ensemble)
 */
export function calculerStatsGlobales(
  resultats: QuizResultDoc[],
  totalEleves: number
): StatsGlobales {
  // Aucun résultat → valeurs par défaut
  if (resultats.length === 0) {
    return {
      totalEleves,
      totalQuizPasses: 0,
      moyenneGenerale: 0,
      tauxReussite: 0,
      elevesEnDifficulte: 0,
      quizAujourdHui: 0,
      tendanceMoyenne: 'stable',
    };
  }

  // Moyenne globale
  const somme = resultats.reduce((s, r) => s + r.pourcentage, 0);
  const moyenneGenerale = somme / resultats.length;

  // Taux de réussite
  const reussis = resultats.filter(r => r.reussi).length;
  const tauxReussite = (reussis / resultats.length) * 100;

  // Élèves en difficulté (moyenne < 40%)
  const parEleve = new Map<string, number[]>();
  resultats.forEach(r => {
    const arr = parEleve.get(r.userId) || [];
    arr.push(r.pourcentage);
    parEleve.set(r.userId, arr);
  });
  let elevesEnDifficulte = 0;
  parEleve.forEach(notes => {
    const moy = notes.reduce((a, b) => a + b, 0) / notes.length;
    if (moy < 40) elevesEnDifficulte++;
  });

  // Quiz passés aujourd'hui
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const quizAujourdHui = resultats.filter(
    r => toDate(r.datePassage).getTime() >= debutJour.getTime()
  ).length;

  // Tendance (basée sur les 30 derniers jours vs les 30 jours précédents)
  const tendanceMoyenne = calculerTendance(resultats);

  return {
    totalEleves,
    totalQuizPasses: resultats.length,
    moyenneGenerale,
    tauxReussite,
    elevesEnDifficulte,
    quizAujourdHui,
    tendanceMoyenne,
  };
}

/**
 * Calcule les statistiques de chaque élève
 */
export function calculerStatsEleves(
  resultats: QuizResultDoc[],
  eleves: { uid: string; displayName: string; email: string }[]
): EleveStats[] {
  // Grouper les résultats par userId
  const parEleve = new Map<string, QuizResultDoc[]>();
  resultats.forEach(r => {
    const arr = parEleve.get(r.userId) || [];
    arr.push(r);
    parEleve.set(r.userId, arr);
  });

  return eleves.map(eleve => {
    const resEleve = parEleve.get(eleve.uid) || [];
    
    if (resEleve.length === 0) {
      return {
        userId: eleve.uid,
        displayName: eleve.displayName,
        email: eleve.email,
        totalQuiz: 0,
        moyenne: 0,
        tauxReussite: 0,
        dernierQuiz: null,
        enDifficulte: false,
        progression: 'stable' as const,
        disciplinesActives: [],
      };
    }

    const moyenne = resEleve.reduce((s, r) => s + r.pourcentage, 0) / resEleve.length;
    const reussis = resEleve.filter(r => r.reussi).length;
    const tauxReussite = (reussis / resEleve.length) * 100;
    
    // Dernier quiz (plus récent)
    const dernierQuiz = resEleve.reduce((max, r) => {
      const d = toDate(r.datePassage);
      return d > max ? d : max;
    }, new Date(0));

    // Disciplines actives
    const discs = new Set(resEleve.map(r => r.disciplineNom));

    return {
      userId: eleve.uid,
      displayName: eleve.displayName,
      email: eleve.email,
      totalQuiz: resEleve.length,
      moyenne,
      tauxReussite,
      dernierQuiz: dernierQuiz.getTime() > 0 ? dernierQuiz : null,
      enDifficulte: moyenne < 40 && resEleve.length >= 2,
      progression: calculerTendance(resEleve),
      disciplinesActives: Array.from(discs),
    };
  });
}

/**
 * Calcule les statistiques par discipline
 */
export function calculerStatsDisciplines(
  resultats: QuizResultDoc[]
): DisciplineStats[] {
  // Grouper par disciplineId
  const parDisc = new Map<string, QuizResultDoc[]>();
  resultats.forEach(r => {
    const arr = parDisc.get(r.disciplineId) || [];
    arr.push(r);
    parDisc.set(r.disciplineId, arr);
  });

  const stats: DisciplineStats[] = [];

  parDisc.forEach((resDisc, discId) => {
    const elevesUniques = new Set(resDisc.map(r => r.userId));
    const moyenne = resDisc.reduce((s, r) => s + r.pourcentage, 0) / resDisc.length;
    const reussis = resDisc.filter(r => r.reussi).length;
    const pourcentages = resDisc.map(r => r.pourcentage);

    stats.push({
      disciplineId: discId,
      disciplineNom: resDisc[0]?.disciplineNom || 'Non définie',
      totalQuiz: resDisc.length,
      nombreEleves: elevesUniques.size,
      moyenne,
      tauxReussite: (reussis / resDisc.length) * 100,
      meilleureNote: Math.max(...pourcentages),
      pireNote: Math.min(...pourcentages),
    });
  });

  // Trier par nombre de quiz passés (plus actif d'abord)
  return stats.sort((a, b) => b.totalQuiz - a.totalQuiz);
}

/**
 * Analyse les quiz individuels (onglet Analyse par quiz)
 */
export function analyserQuiz(resultats: QuizResultDoc[]): QuizAnalyse[] {
  // Grouper par quizId
  const parQuiz = new Map<string, QuizResultDoc[]>();
  resultats.forEach(r => {
    const arr = parQuiz.get(r.quizId) || [];
    arr.push(r);
    parQuiz.set(r.quizId, arr);
  });

  const analyses: QuizAnalyse[] = [];

  parQuiz.forEach((resQuiz, quizId) => {
    const moyenneScore = resQuiz.reduce((s, r) => s + r.pourcentage, 0) / resQuiz.length;
    const reussis = resQuiz.filter(r => r.reussi).length;
    const pourcentages = resQuiz.map(r => r.pourcentage);
    const tempsMoyen = resQuiz.reduce((s, r) => s + r.tempsEcoule, 0) / resQuiz.length;
    
    const dates = resQuiz.map(r => toDate(r.datePassage));
    const dernierPassage = dates.length > 0 
      ? dates.reduce((a, b) => a > b ? a : b) 
      : null;

    analyses.push({
      quizId,
      quizTitre: resQuiz[0]?.quizTitre || 'Quiz sans titre',
      disciplineNom: resQuiz[0]?.disciplineNom || 'Non définie',
      totalPassages: resQuiz.length,
      moyenneScore,
      tauxReussite: (reussis / resQuiz.length) * 100,
      tempsEcouleMoyen: tempsMoyen,
      meilleureNote: Math.max(...pourcentages),
      pireNote: Math.min(...pourcentages),
      dernierPassage,
    });
  });

  // Trier par nombre de passages
  return analyses.sort((a, b) => b.totalPassages - a.totalPassages);
}

/**
 * Détecte les élèves en difficulté (moyenne < 40%, au moins 2 quiz)
 */
export function detecterAlertesEleves(
  resultats: QuizResultDoc[],
  eleves: { uid: string; displayName: string; email: string }[]
): AlerteEleve[] {
  const statsEleves = calculerStatsEleves(resultats, eleves);
  
  return statsEleves
    .filter(e => e.enDifficulte)
    .map(e => {
      // Trouver les disciplines faibles pour cet élève
      const resEleve = resultats.filter(r => r.userId === e.userId);
      const parDisc = new Map<string, number[]>();
      resEleve.forEach(r => {
        const arr = parDisc.get(r.disciplineNom) || [];
        arr.push(r.pourcentage);
        parDisc.set(r.disciplineNom, arr);
      });

      const disciplinesFaibles: string[] = [];
      parDisc.forEach((notes, disc) => {
        const moy = notes.reduce((a, b) => a + b, 0) / notes.length;
        if (moy < 40) disciplinesFaibles.push(disc);
      });

      return {
        userId: e.userId,
        displayName: e.displayName,
        email: e.email,
        moyenne: e.moyenne,
        totalQuiz: e.totalQuiz,
        disciplinesFaibles,
        dernierQuiz: e.dernierQuiz,
      };
    })
    .sort((a, b) => a.moyenne - b.moyenne); // Plus faibles d'abord
}

/**
 * Génère les points de progression temporelle (30 derniers jours)
 * Format pour recharts AreaChart / LineChart
 */
export function genererProgressionTemporelle(
  resultats: QuizResultDoc[],
  joursMax: number = 30
): PointProgression[] {
  const maintenant = new Date();
  const points: PointProgression[] = [];

  for (let i = joursMax - 1; i >= 0; i--) {
    const jour = new Date(maintenant);
    jour.setDate(maintenant.getDate() - i);
    jour.setHours(0, 0, 0, 0);
    
    const finJour = new Date(jour);
    finJour.setHours(23, 59, 59, 999);

    // Filtrer les résultats de ce jour
    const duJour = resultats.filter(r => {
      const d = toDate(r.datePassage);
      return d >= jour && d <= finJour;
    });

    const moyenne = duJour.length > 0
      ? duJour.reduce((s, r) => s + r.pourcentage, 0) / duJour.length
      : 0;

    // Format date : "JJ/MM"
    const dateStr = `${String(jour.getDate()).padStart(2, '0')}/${String(jour.getMonth() + 1).padStart(2, '0')}`;

    points.push({
      date: dateStr,
      moyenne: Math.round(moyenne * 10) / 10,
      nombreQuiz: duJour.length,
    });
  }

  return points;
}

/**
 * Récupère les résultats d'un élève spécifique (pour vue détaillée)
 */
export function getResultatsEleve(
  resultats: QuizResultDoc[],
  userId: string
): QuizResultDoc[] {
  return resultats
    .filter(r => r.userId === userId)
    .sort((a, b) => toDate(b.datePassage).getTime() - toDate(a.datePassage).getTime());
}

/**
 * Statistiques d'un élève par discipline (pour graphique radar)
 */
export function getStatsEleveParDiscipline(
  resultats: QuizResultDoc[],
  userId: string
): { discipline: string; moyenne: number; nombreQuiz: number }[] {
  const resEleve = resultats.filter(r => r.userId === userId);
  
  const parDisc = new Map<string, number[]>();
  resEleve.forEach(r => {
    const arr = parDisc.get(r.disciplineNom) || [];
    arr.push(r.pourcentage);
    parDisc.set(r.disciplineNom, arr);
  });

  const stats: { discipline: string; moyenne: number; nombreQuiz: number }[] = [];
  parDisc.forEach((notes, disc) => {
    stats.push({
      discipline: disc,
      moyenne: Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10,
      nombreQuiz: notes.length,
    });
  });

  return stats.sort((a, b) => b.moyenne - a.moyenne);
}
