/**
 * ==================== SERVICE SUIVI RENFORCÉ (Phase 9) ====================
 * 
 * Service intelligent de détection des lacunes et suivi des élèves.
 * Analyse les résultats de quiz pour identifier les points faibles,
 * génère des recommandations ciblées, gère les streaks et objectifs.
 * 
 * Fichier : src/services/suiviService.ts
 * Dépendances : firebase.ts, progressionService.ts (Phase 7)
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== INTERFACES INTERNES ====================

/**
 * Document quiz_results tel que stocké dans Firestore
 */
interface QuizResultDoc {
  id: string;
  quizId: string;
  quizTitre: string;
  disciplineId: string;
  disciplineNom: string;
  userId: string;
  score: number;
  totalPoints: number;
  pourcentage: number;
  reponses: {
    questionId: string;
    reponseChoisie: number;
    reponseCorrecte: number;
    correct: boolean;
    points: number;
  }[];
  tempsEcoule: number;
  datePassage: Timestamp | Date;
  reussi: boolean;
  nombreQuestions: number;
  bonnesReponses: number;
}

/**
 * Lacune détectée par l'algorithme d'analyse
 */
interface LacuneDetectee {
  id: string;
  disciplineId: string;
  disciplineNom: string;
  chapitre?: string;
  moyenne: number;
  nombreQuiz: number;
  tendance: 'hausse' | 'baisse' | 'stable';
  niveauUrgence: 'critique' | 'important' | 'modere';
  dernierQuizDate: Date;
  scoreDetails: {
    dernierScore: number;
    meilleurScore: number;
    pireScore: number;
  };
}

/**
 * Recommandation personnalisée
 */
interface Recommandation {
  id: string;
  lacuneId: string;
  type: 'revoir_cours' | 'refaire_quiz' | 'exercice_cible' | 'video_explicative';
  titre: string;
  description: string;
  disciplineNom: string;
  ressourceId?: string;
  quizId?: string;
  priorite: number;
  completee: boolean;
  dateCreation: Date;
}

/**
 * Données de streak
 */
interface StreakData {
  userId: string;
  streakActuel: number;
  meilleurStreak: number;
  dernierJourActif: Date | null;
  totalJoursActifs: number;
  semaineCourante: boolean[];
  historiqueHebdo: {
    semaine: string;
    joursActifs: number;
  }[];
}

/**
 * Objectif hebdomadaire
 */
interface ObjectifHebdo {
  id: string;
  userId: string;
  titre: string;
  description: string;
  type: 'quiz_count' | 'score_min' | 'temps_etude' | 'streak';
  cible: number;
  progression: number;
  statut: 'en_cours' | 'atteint' | 'echoue' | 'non_commence';
  disciplineId?: string;
  disciplineNom?: string;
  dateDebut: Date;
  dateFin: Date;
  recompense?: string;
}

/**
 * Alerte de suivi
 */
interface AlerteSuivi {
  id: string;
  userId: string;
  userNom: string;
  type: 'lacune_critique' | 'streak_perdu' | 'objectif_atteint' | 'progression' | 'inactivite';
  message: string;
  niveauUrgence: 'critique' | 'important' | 'modere' | 'info';
  dateCreation: Date;
  lue: boolean;
}

// ==================== CONSTANTES DE SEUILS ====================

/** Seuil critique : moyenne < 8/20 */
const SEUIL_CRITIQUE = 8;

/** Seuil important : moyenne < 12/20 */
const SEUIL_IMPORTANT = 12;

/** Seuil modéré : moyenne < 14/20 */
const SEUIL_MODERE = 14;

/** Nombre minimum de quiz pour détecter une lacune */
const MIN_QUIZ_POUR_LACUNE = 1;

/** Nombre de jours d'inactivité avant alerte */
const JOURS_INACTIVITE_ALERTE = 7;

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Convertit un Timestamp Firestore ou Date en objet Date JavaScript
 * @param timestamp - Timestamp Firestore ou Date
 * @returns Date JavaScript
 */
function toDate(timestamp: Timestamp | Date | any): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Vérifie si deux dates correspondent au même jour calendaire
 * @param d1 - Première date
 * @param d2 - Deuxième date
 * @returns true si même jour
 */
function memeJour(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Retourne le lundi de la semaine courante (début de semaine)
 * @returns Date du lundi
 */
function getLundiSemaine(): Date {
  const maintenant = new Date();
  const jour = maintenant.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
  const diff = jour === 0 ? -6 : 1 - jour; // Ajustement pour lundi
  const lundi = new Date(maintenant);
  lundi.setDate(maintenant.getDate() + diff);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

/**
 * Retourne le dimanche de la semaine courante (fin de semaine)
 * @returns Date du dimanche
 */
function getDimancheSemaine(): Date {
  const lundi = getLundiSemaine();
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  return dimanche;
}

/**
 * Calcule la différence en jours entre deux dates
 * @param d1 - Date de début
 * @param d2 - Date de fin
 * @returns Nombre de jours (entier)
 */
function diffJours(d1: Date, d2: Date): number {
  const msParJour = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / msParJour);
}

// ==================== DÉTECTION DES LACUNES ====================

/**
 * Récupère tous les résultats de quiz d'un élève depuis Firestore
 * @param userId - ID de l'élève
 * @returns Liste des résultats triés par date décroissante
 */
export async function getResultatsEleve(userId: string): Promise<QuizResultDoc[]> {
  try {
    const q = query(
      collection(db, 'quiz_results'),
      where('userId', '==', userId),
      orderBy('datePassage', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QuizResultDoc[];
  } catch (error) {
    console.error('Erreur récupération résultats élève:', error);
    return [];
  }
}

/**
 * Détecte les lacunes d'un élève en analysant ses résultats de quiz.
 * 
 * Algorithme :
 * 1. Regroupe les résultats par discipline
 * 2. Calcule la moyenne, tendance et score détaillé par discipline
 * 3. Identifie les disciplines sous les seuils (critique/important/modéré)
 * 4. Trie par niveau d'urgence décroissant
 * 
 * @param userId - ID de l'élève
 * @returns Liste des lacunes détectées triées par urgence
 */
export async function detecterLacunes(userId: string): Promise<LacuneDetectee[]> {
  try {
    // ===== Récupération des résultats =====
    const resultats = await getResultatsEleve(userId);

    if (resultats.length === 0) {
      return [];
    }

    // ===== Regroupement par discipline =====
    const parDiscipline = new Map<string, QuizResultDoc[]>();

    resultats.forEach(r => {
      const key = r.disciplineId;
      if (!parDiscipline.has(key)) {
        parDiscipline.set(key, []);
      }
      parDiscipline.get(key)!.push(r);
    });

    // ===== Analyse par discipline =====
    const lacunes: LacuneDetectee[] = [];

    parDiscipline.forEach((quizResults, disciplineId) => {
      // Ignorer si pas assez de quiz
      if (quizResults.length < MIN_QUIZ_POUR_LACUNE) return;

      // Calcul de la moyenne (sur 20)
      const scores = quizResults.map(r => {
        // Convertir pourcentage en note sur 20
        return (r.pourcentage / 100) * 20;
      });
      const moyenne = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Seulement si sous le seuil modéré
      if (moyenne >= SEUIL_MODERE) return;

      // Calcul de la tendance (compare les 2 derniers quiz aux 2 précédents)
      let tendance: 'hausse' | 'baisse' | 'stable' = 'stable';
      if (scores.length >= 3) {
        const recents = scores.slice(0, 2);
        const anciens = scores.slice(2, 4);
        const moyRecente = recents.reduce((a, b) => a + b, 0) / recents.length;
        const moyAncienne = anciens.reduce((a, b) => a + b, 0) / anciens.length;
        const diff = moyRecente - moyAncienne;

        if (diff > 1.5) tendance = 'hausse';
        else if (diff < -1.5) tendance = 'baisse';
      }

      // Niveau d'urgence
      let niveauUrgence: 'critique' | 'important' | 'modere' = 'modere';
      if (moyenne < SEUIL_CRITIQUE) niveauUrgence = 'critique';
      else if (moyenne < SEUIL_IMPORTANT) niveauUrgence = 'important';

      // Score détaillé
      const dernierScore = scores[0];
      const meilleurScore = Math.max(...scores);
      const pireScore = Math.min(...scores);

      // Date du dernier quiz
      const dernierQuizDate = toDate(quizResults[0].datePassage);

      // Nom de la discipline
      const disciplineNom = quizResults[0].disciplineNom || 'Discipline inconnue';

      lacunes.push({
        id: `lacune_${disciplineId}`,
        disciplineId,
        disciplineNom,
        moyenne: Math.round(moyenne * 10) / 10, // Arrondi à 1 décimale
        nombreQuiz: quizResults.length,
        tendance,
        niveauUrgence,
        dernierQuizDate,
        scoreDetails: {
          dernierScore: Math.round(dernierScore * 10) / 10,
          meilleurScore: Math.round(meilleurScore * 10) / 10,
          pireScore: Math.round(pireScore * 10) / 10,
        },
      });
    });

    // ===== Tri par urgence (critique > important > modéré) puis par moyenne croissante =====
    const ordreUrgence = { critique: 0, important: 1, modere: 2 };
    lacunes.sort((a, b) => {
      const diff = ordreUrgence[a.niveauUrgence] - ordreUrgence[b.niveauUrgence];
      if (diff !== 0) return diff;
      return a.moyenne - b.moyenne; // Plus faible en premier
    });

    return lacunes;
  } catch (error) {
    console.error('Erreur détection lacunes:', error);
    return [];
  }
}

// ==================== RECOMMANDATIONS ====================

/**
 * Génère des recommandations personnalisées basées sur les lacunes détectées.
 * 
 * Stratégie :
 * - Lacune critique → "Revoir le cours" + "Refaire les quiz"
 * - Lacune importante → "Exercices ciblés" + "Revoir le cours"
 * - Lacune modérée → "Refaire un quiz" pour consolider
 * 
 * @param lacunes - Lacunes détectées
 * @returns Liste des recommandations ordonnées par priorité
 */
export function genererRecommandations(lacunes: LacuneDetectee[]): Recommandation[] {
  const recommandations: Recommandation[] = [];
  let prioriteCompteur = 1;

  lacunes.forEach(lacune => {
    const { id, disciplineNom, niveauUrgence, moyenne, tendance } = lacune;

    switch (niveauUrgence) {
      // ===== Lacune CRITIQUE : actions urgentes =====
      case 'critique':
        recommandations.push({
          id: `reco_cours_${id}`,
          lacuneId: id,
          type: 'revoir_cours',
          titre: `📚 Revoir les cours de ${disciplineNom}`,
          description: `Ta moyenne est de ${moyenne}/20 en ${disciplineNom}. Il est important de reprendre les bases. Consulte les cours disponibles et prends des notes.`,
          disciplineNom,
          priorite: prioriteCompteur++,
          completee: false,
          dateCreation: new Date(),
        });
        recommandations.push({
          id: `reco_quiz_${id}`,
          lacuneId: id,
          type: 'refaire_quiz',
          titre: `🔄 Refaire les quiz de ${disciplineNom}`,
          description: `Après avoir révisé, refais les quiz pour vérifier ta compréhension. Vise au moins 12/20 !`,
          disciplineNom,
          priorite: prioriteCompteur++,
          completee: false,
          dateCreation: new Date(),
        });
        break;

      // ===== Lacune IMPORTANTE : renforcement =====
      case 'important':
        recommandations.push({
          id: `reco_exercice_${id}`,
          lacuneId: id,
          type: 'exercice_cible',
          titre: `✏️ Exercices ciblés en ${disciplineNom}`,
          description: `Avec ${moyenne}/20 de moyenne, concentre-toi sur les exercices pratiques. ${tendance === 'hausse' ? 'Tu progresses, continue !' : 'Un effort supplémentaire est nécessaire.'}`,
          disciplineNom,
          priorite: prioriteCompteur++,
          completee: false,
          dateCreation: new Date(),
        });
        recommandations.push({
          id: `reco_cours2_${id}`,
          lacuneId: id,
          type: 'revoir_cours',
          titre: `📖 Réviser les points clés en ${disciplineNom}`,
          description: `Identifie les concepts qui te posent problème et revois-les attentivement.`,
          disciplineNom,
          priorite: prioriteCompteur++,
          completee: false,
          dateCreation: new Date(),
        });
        break;

      // ===== Lacune MODÉRÉE : consolidation =====
      case 'modere':
        recommandations.push({
          id: `reco_consolider_${id}`,
          lacuneId: id,
          type: 'refaire_quiz',
          titre: `🎯 Consolider tes acquis en ${disciplineNom}`,
          description: `Tu es proche du niveau attendu (${moyenne}/20). Un quiz supplémentaire devrait suffire pour atteindre 14/20 !`,
          disciplineNom,
          priorite: prioriteCompteur++,
          completee: false,
          dateCreation: new Date(),
        });
        break;
    }
  });

  return recommandations;
}

// ==================== STREAKS ====================

/**
 * Calcule les données de streak d'un élève à partir de ses résultats de quiz.
 * 
 * Un streak = nombre de jours consécutifs où l'élève a passé au moins 1 quiz.
 * 
 * @param userId - ID de l'élève
 * @returns Données de streak complètes
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  try {
    // ===== Récupération des résultats triés par date =====
    const resultats = await getResultatsEleve(userId);

    if (resultats.length === 0) {
      return {
        userId,
        streakActuel: 0,
        meilleurStreak: 0,
        dernierJourActif: null,
        totalJoursActifs: 0,
        semaineCourante: [false, false, false, false, false, false, false],
        historiqueHebdo: [],
      };
    }

    // ===== Extraction des jours uniques d'activité =====
    const joursActifsSet = new Set<string>();
    resultats.forEach(r => {
      const date = toDate(r.datePassage);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      joursActifsSet.add(key);
    });

    // Conversion en dates triées (plus récent en premier)
    const joursActifs = Array.from(joursActifsSet)
      .map(key => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m, d);
      })
      .sort((a, b) => b.getTime() - a.getTime());

    const totalJoursActifs = joursActifs.length;
    const dernierJourActif = joursActifs[0];

    // ===== Calcul du streak actuel =====
    let streakActuel = 0;
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);

    // Vérifier si l'élève est actif aujourd'hui ou hier (tolérance d'1 jour)
    const premierJour = joursActifs[0];
    const diffAvecAujourdHui = diffJours(premierJour, aujourdHui);

    if (diffAvecAujourdHui <= 1) {
      // L'élève est actif récemment, compter le streak
      streakActuel = 1;
      for (let i = 1; i < joursActifs.length; i++) {
        const diff = diffJours(joursActifs[i], joursActifs[i - 1]);
        if (diff === 1) {
          streakActuel++;
        } else {
          break; // Fin du streak
        }
      }
    }

    // ===== Calcul du meilleur streak historique =====
    let meilleurStreak = 0;
    let streakTemp = 1;
    for (let i = 1; i < joursActifs.length; i++) {
      const diff = diffJours(joursActifs[i], joursActifs[i - 1]);
      if (diff === 1) {
        streakTemp++;
      } else {
        meilleurStreak = Math.max(meilleurStreak, streakTemp);
        streakTemp = 1;
      }
    }
    meilleurStreak = Math.max(meilleurStreak, streakTemp, streakActuel);

    // ===== Semaine courante (Lun-Dim) =====
    const lundi = getLundiSemaine();
    const semaineCourante: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const jour = new Date(lundi);
      jour.setDate(lundi.getDate() + i);
      const estActif = joursActifs.some(j => memeJour(j, jour));
      semaineCourante.push(estActif);
    }

    // ===== Historique des 4 dernières semaines =====
    const historiqueHebdo: { semaine: string; joursActifs: number }[] = [];
    for (let s = 0; s < 4; s++) {
      const debutSemaine = new Date(lundi);
      debutSemaine.setDate(lundi.getDate() - (s * 7));
      let joursActifsSemaine = 0;
      for (let j = 0; j < 7; j++) {
        const jour = new Date(debutSemaine);
        jour.setDate(debutSemaine.getDate() + j);
        if (joursActifs.some(d => memeJour(d, jour))) {
          joursActifsSemaine++;
        }
      }
      const numSemaine = Math.ceil(
        (debutSemaine.getDate() + new Date(debutSemaine.getFullYear(), debutSemaine.getMonth(), 1).getDay()) / 7
      );
      historiqueHebdo.push({
        semaine: s === 0 ? 'Cette sem.' : `Sem. -${s}`,
        joursActifs: joursActifsSemaine,
      });
    }

    return {
      userId,
      streakActuel,
      meilleurStreak,
      dernierJourActif,
      totalJoursActifs,
      semaineCourante,
      historiqueHebdo: historiqueHebdo.reverse(), // Chronologique
    };
  } catch (error) {
    console.error('Erreur calcul streak:', error);
    return {
      userId,
      streakActuel: 0,
      meilleurStreak: 0,
      dernierJourActif: null,
      totalJoursActifs: 0,
      semaineCourante: [false, false, false, false, false, false, false],
      historiqueHebdo: [],
    };
  }
}

// ==================== OBJECTIFS HEBDOMADAIRES ====================

/**
 * Génère automatiquement les objectifs hebdomadaires d'un élève
 * en fonction de ses lacunes et son historique.
 * 
 * Objectifs générés :
 * 1. Nombre de quiz à passer (adapté au niveau)
 * 2. Score minimum à atteindre dans la pire discipline
 * 3. Streak à maintenir
 * 
 * @param userId - ID de l'élève
 * @param lacunes - Lacunes détectées
 * @param streak - Données de streak actuelles
 * @returns Liste des objectifs de la semaine
 */
export function genererObjectifsHebdo(
  userId: string,
  lacunes: LacuneDetectee[],
  streak: StreakData
): ObjectifHebdo[] {
  const objectifs: ObjectifHebdo[] = [];
  const dateDebut = getLundiSemaine();
  const dateFin = getDimancheSemaine();

  // ===== Objectif 1 : Nombre de quiz à passer cette semaine =====
  const cibleQuiz = lacunes.length > 2 ? 5 : 3; // Plus de lacunes = plus de quiz
  objectifs.push({
    id: `obj_quiz_${userId}_${dateDebut.getTime()}`,
    userId,
    titre: `Passer ${cibleQuiz} quiz cette semaine`,
    description: `Entraîne-toi en passant au moins ${cibleQuiz} quiz pour progresser dans tes matières.`,
    type: 'quiz_count',
    cible: cibleQuiz,
    progression: 0, // Sera mis à jour dynamiquement
    statut: 'en_cours',
    dateDebut,
    dateFin,
    recompense: '🏆 Badge "Travailleur"',
  });

  // ===== Objectif 2 : Score minimum dans la pire discipline =====
  if (lacunes.length > 0) {
    const pireLacune = lacunes[0]; // Déjà triée par urgence
    const cibleScore = Math.min(pireLacune.moyenne + 3, 14); // +3 points ou max 14
    objectifs.push({
      id: `obj_score_${userId}_${dateDebut.getTime()}`,
      userId,
      titre: `Atteindre ${Math.round(cibleScore)}/20 en ${pireLacune.disciplineNom}`,
      description: `Ta moyenne actuelle est de ${pireLacune.moyenne}/20. Vise ${Math.round(cibleScore)}/20 lors de ton prochain quiz !`,
      type: 'score_min',
      cible: Math.round(cibleScore),
      progression: Math.round(pireLacune.moyenne),
      statut: 'en_cours',
      disciplineId: pireLacune.disciplineId,
      disciplineNom: pireLacune.disciplineNom,
      dateDebut,
      dateFin,
      recompense: '⭐ Badge "En progrès"',
    });
  }

  // ===== Objectif 3 : Streak de jours consécutifs =====
  const cibleStreak = streak.streakActuel >= 5 ? 7 : streak.streakActuel + 2;
  objectifs.push({
    id: `obj_streak_${userId}_${dateDebut.getTime()}`,
    userId,
    titre: `Maintenir un streak de ${cibleStreak} jours`,
    description: `Tu es actuellement à ${streak.streakActuel} jour(s) consécutif(s). Continue !`,
    type: 'streak',
    cible: cibleStreak,
    progression: streak.streakActuel,
    statut: streak.streakActuel >= cibleStreak ? 'atteint' : 'en_cours',
    dateDebut,
    dateFin,
    recompense: '🔥 Badge "Flamme"',
  });

  return objectifs;
}

// ==================== CALCUL DU SCORE GLOBAL ====================

/**
 * Calcule un score de santé global pour l'élève (0-100).
 * 
 * Critères pondérés :
 * - 40% : Moyenne générale des quiz
 * - 25% : Absence de lacunes critiques
 * - 20% : Régularité (streak)
 * - 15% : Progression des objectifs
 * 
 * @param lacunes - Lacunes détectées
 * @param streak - Données de streak
 * @param objectifs - Objectifs hebdomadaires
 * @param resultats - Résultats de quiz
 * @returns Score de 0 à 100
 */
export function calculerScoreGlobal(
  lacunes: LacuneDetectee[],
  streak: StreakData,
  objectifs: ObjectifHebdo[],
  resultats: QuizResultDoc[]
): number {
  // ===== Score moyenne (40%) =====
  let scoreMoyenne = 0;
  if (resultats.length > 0) {
    const moyenneGenerale =
      resultats.reduce((acc, r) => acc + (r.pourcentage / 100) * 20, 0) / resultats.length;
    scoreMoyenne = Math.min((moyenneGenerale / 20) * 100, 100); // Normaliser sur 100
  }

  // ===== Score lacunes (25%) =====
  let scoreLacunes = 100;
  const critiques = lacunes.filter(l => l.niveauUrgence === 'critique').length;
  const importants = lacunes.filter(l => l.niveauUrgence === 'important').length;
  scoreLacunes -= critiques * 25; // -25 par lacune critique
  scoreLacunes -= importants * 15; // -15 par lacune importante
  scoreLacunes = Math.max(scoreLacunes, 0);

  // ===== Score streak (20%) =====
  // Streak de 7+ = 100%, proportionnel sinon
  const scoreStreak = Math.min((streak.streakActuel / 7) * 100, 100);

  // ===== Score objectifs (15%) =====
  let scoreObjectifs = 0;
  if (objectifs.length > 0) {
    const atteints = objectifs.filter(o => o.statut === 'atteint').length;
    scoreObjectifs = (atteints / objectifs.length) * 100;
  }

  // ===== Score global pondéré =====
  const scoreGlobal =
    scoreMoyenne * 0.4 +
    scoreLacunes * 0.25 +
    scoreStreak * 0.2 +
    scoreObjectifs * 0.15;

  return Math.round(Math.min(Math.max(scoreGlobal, 0), 100));
}

// ==================== ALERTES ====================

/**
 * Génère des alertes basées sur l'analyse du suivi d'un élève.
 * 
 * Types d'alertes :
 * - lacune_critique : quand une discipline passe sous le seuil critique
 * - streak_perdu : quand le streak est cassé après 3+ jours
 * - inactivite : quand l'élève n'a pas été actif depuis 7+ jours
 * - objectif_atteint : félicitations quand un objectif est complété
 * - progression : quand l'élève montre une tendance à la hausse
 * 
 * @param userId - ID de l'élève
 * @param userNom - Nom de l'élève
 * @param lacunes - Lacunes détectées
 * @param streak - Données de streak
 * @returns Liste des alertes générées
 */
export function genererAlertes(
  userId: string,
  userNom: string,
  lacunes: LacuneDetectee[],
  streak: StreakData
): AlerteSuivi[] {
  const alertes: AlerteSuivi[] = [];
  const maintenant = new Date();

  // ===== Alertes lacunes critiques =====
  lacunes
    .filter(l => l.niveauUrgence === 'critique')
    .forEach(lacune => {
      alertes.push({
        id: `alerte_lacune_${lacune.id}`,
        userId,
        userNom,
        type: 'lacune_critique',
        message: `${userNom} a une moyenne critique de ${lacune.moyenne}/20 en ${lacune.disciplineNom}. Intervention recommandée.`,
        niveauUrgence: 'critique',
        dateCreation: maintenant,
        lue: false,
      });
    });

  // ===== Alerte inactivité =====
  if (streak.dernierJourActif) {
    const joursInactif = diffJours(streak.dernierJourActif, maintenant);
    if (joursInactif >= JOURS_INACTIVITE_ALERTE) {
      alertes.push({
        id: `alerte_inactif_${userId}`,
        userId,
        userNom,
        type: 'inactivite',
        message: `${userNom} n'a pas été actif depuis ${joursInactif} jours. Un encouragement serait bienvenu !`,
        niveauUrgence: 'important',
        dateCreation: maintenant,
        lue: false,
      });
    }
  }

  // ===== Alertes progression positive =====
  lacunes
    .filter(l => l.tendance === 'hausse')
    .forEach(lacune => {
      alertes.push({
        id: `alerte_progression_${lacune.id}`,
        userId,
        userNom,
        type: 'progression',
        message: `Bonne nouvelle ! ${userNom} progresse en ${lacune.disciplineNom} (tendance à la hausse).`,
        niveauUrgence: 'info',
        dateCreation: maintenant,
        lue: false,
      });
    });

  return alertes;
}

// ==================== MISE À JOUR PROGRESSION OBJECTIFS ====================

/**
 * Met à jour la progression des objectifs en fonction des résultats récents.
 * 
 * @param objectifs - Objectifs à mettre à jour
 * @param resultats - Résultats de quiz de la semaine
 * @param streak - Données de streak actuelles
 * @returns Objectifs avec progression mise à jour
 */
export function mettreAJourProgressionObjectifs(
  objectifs: ObjectifHebdo[],
  resultats: QuizResultDoc[],
  streak: StreakData
): ObjectifHebdo[] {
  const lundi = getLundiSemaine();

  // Filtrer les résultats de la semaine courante
  const resultatsSemaine = resultats.filter(r => {
    const date = toDate(r.datePassage);
    return date >= lundi;
  });

  return objectifs.map(obj => {
    const updated = { ...obj };

    switch (obj.type) {
      case 'quiz_count':
        // Compter les quiz passés cette semaine
        updated.progression = resultatsSemaine.length;
        break;

      case 'score_min':
        // Meilleur score de la semaine dans la discipline ciblée
        if (obj.disciplineId) {
          const quizDiscipline = resultatsSemaine.filter(
            r => r.disciplineId === obj.disciplineId
          );
          if (quizDiscipline.length > 0) {
            const meilleurPourcentage = Math.max(...quizDiscipline.map(r => r.pourcentage));
            updated.progression = Math.round((meilleurPourcentage / 100) * 20);
          }
        }
        break;

      case 'streak':
        // Streak actuel
        updated.progression = streak.streakActuel;
        break;
    }

    // Mettre à jour le statut
    if (updated.progression >= updated.cible) {
      updated.statut = 'atteint';
    }

    return updated;
  });
}

// ==================== FONCTION PRINCIPALE ====================

/**
 * Récupère le suivi complet d'un élève.
 * Orchestration principale qui combine toutes les analyses.
 * 
 * @param userId - ID de l'élève
 * @returns Objet SuiviEleve complet
 */
export async function getSuiviComplet(userId: string): Promise<{
  lacunes: LacuneDetectee[];
  recommandations: Recommandation[];
  streak: StreakData;
  objectifs: ObjectifHebdo[];
  scoreGlobal: number;
}> {
  try {
    // ===== 1. Détection des lacunes =====
    const lacunes = await detecterLacunes(userId);

    // ===== 2. Génération des recommandations =====
    const recommandations = genererRecommandations(lacunes);

    // ===== 3. Calcul du streak =====
    const streak = await getStreakData(userId);

    // ===== 4. Génération des objectifs =====
    let objectifs = genererObjectifsHebdo(userId, lacunes, streak);

    // ===== 5. Mise à jour de la progression des objectifs =====
    const resultats = await getResultatsEleve(userId);
    objectifs = mettreAJourProgressionObjectifs(objectifs, resultats, streak);

    // ===== 6. Calcul du score global =====
    const scoreGlobal = calculerScoreGlobal(lacunes, streak, objectifs, resultats);

    return {
      lacunes,
      recommandations,
      streak,
      objectifs,
      scoreGlobal,
    };
  } catch (error) {
    console.error('Erreur suivi complet:', error);
    return {
      lacunes: [],
      recommandations: [],
      streak: {
        userId,
        streakActuel: 0,
        meilleurStreak: 0,
        dernierJourActif: null,
        totalJoursActifs: 0,
        semaineCourante: [false, false, false, false, false, false, false],
        historiqueHebdo: [],
      },
      objectifs: [],
      scoreGlobal: 0,
    };
  }
}

// ==================== UTILITAIRES D'AFFICHAGE ====================

/**
 * Retourne la couleur CSS associée à un niveau d'urgence
 */
export function getCouleurUrgence(niveau: string): string {
  switch (niveau) {
    case 'critique': return '#ef4444'; // Rouge
    case 'important': return '#f59e0b'; // Orange
    case 'modere': return '#eab308'; // Jaune
    case 'info': return '#10b981'; // Vert
    default: return '#6b7280'; // Gris
  }
}

/**
 * Retourne le label français d'un niveau d'urgence
 */
export function getLabelUrgence(niveau: string): string {
  switch (niveau) {
    case 'critique': return 'Critique';
    case 'important': return 'Important';
    case 'modere': return 'Modéré';
    case 'info': return 'Info';
    default: return 'Inconnu';
  }
}

/**
 * Retourne l'emoji de tendance
 */
export function getEmojiFendance(tendance: string): string {
  switch (tendance) {
    case 'hausse': return '📈';
    case 'baisse': return '📉';
    case 'stable': return '➡️';
    default: return '❓';
  }
}

/**
 * Retourne le message de motivation basé sur le score global
 */
export function getMessageMotivation(scoreGlobal: number): string {
  if (scoreGlobal >= 80) return 'Excellent travail ! Continue comme ça, tu es sur la bonne voie ! 🌟';
  if (scoreGlobal >= 60) return 'Bon travail ! Quelques efforts supplémentaires et tu seras au top ! 💪';
  if (scoreGlobal >= 40) return 'Tu peux faire mieux ! Suis les recommandations pour progresser. 📚';
  if (scoreGlobal >= 20) return 'Courage ! Chaque effort compte. Commence par les recommandations prioritaires. 🎯';
  return 'C\'est le moment de se lancer ! Passe ton premier quiz pour commencer. 🚀';
}

/**
 * Calcule le pourcentage de progression d'un objectif
 */
export function getProgressionPourcent(objectif: ObjectifHebdo): number {
  if (objectif.cible === 0) return 0;
  return Math.min(Math.round((objectif.progression / objectif.cible) * 100), 100);
}
