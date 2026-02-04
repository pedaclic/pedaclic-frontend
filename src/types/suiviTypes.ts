/**
 * ==================== TYPES SUIVI RENFORCÉ (Phase 9) ====================
 * Types pour le système de détection des lacunes, recommandations,
 * streaks et objectifs hebdomadaires des élèves PedaClic.
 * 
 * À AJOUTER à la fin de src/types/index.ts (avant les exports groupés)
 */

// ==================== TYPES DÉTECTION LACUNES ====================

/**
 * Niveau d'urgence d'une lacune détectée
 * - critique : moyenne < 8/20 sur 2+ quiz → fond rouge
 * - important : moyenne entre 8-12/20 → fond orange
 * - modere : moyenne entre 12-14/20 → fond jaune
 */
export type NiveauUrgence = 'critique' | 'important' | 'modere';

/**
 * Lacune détectée par l'algorithme d'analyse
 * Représente un point faible identifié dans une discipline/chapitre
 */
export interface LacuneDetectee {
  id: string;                        // ID unique (disciplineId + chapitre hash)
  disciplineId: string;              // ID de la discipline concernée
  disciplineNom: string;             // Nom de la discipline (ex: "Mathématiques")
  chapitre?: string;                 // Chapitre spécifique si identifié
  moyenne: number;                   // Moyenne obtenue sur les quiz liés (/20)
  nombreQuiz: number;                // Nombre de quiz analysés
  tendance: 'hausse' | 'baisse' | 'stable'; // Évolution récente
  niveauUrgence: NiveauUrgence;      // Niveau d'urgence calculé
  dernierQuizDate: Date;             // Date du dernier quiz passé
  scoreDetails: {                    // Détails des scores récents
    dernierScore: number;            // Score le plus récent
    meilleurScore: number;           // Meilleur score obtenu
    pireScore: number;               // Pire score obtenu
  };
}

// ==================== TYPES RECOMMANDATIONS ====================

/**
 * Type de recommandation proposée à l'élève
 */
export type TypeRecommandation = 'revoir_cours' | 'refaire_quiz' | 'exercice_cible' | 'video_explicative';

/**
 * Recommandation personnalisée pour un élève
 */
export interface Recommandation {
  id: string;                        // ID unique
  lacuneId: string;                  // ID de la lacune associée
  type: TypeRecommandation;          // Type de recommandation
  titre: string;                     // Titre affiché (ex: "Revoir le chapitre 3")
  description: string;               // Description détaillée
  disciplineNom: string;             // Discipline concernée
  ressourceId?: string;              // ID de la ressource suggérée (optionnel)
  quizId?: string;                   // ID du quiz à refaire (optionnel)
  priorite: number;                  // Priorité (1 = plus urgent, 5 = moins urgent)
  completee: boolean;                // Si l'élève a suivi la recommandation
  dateCreation: Date;                // Date de création
}

// ==================== TYPES STREAKS ====================

/**
 * Données de streak (série de jours consécutifs d'activité)
 */
export interface StreakData {
  userId: string;                    // ID de l'élève
  streakActuel: number;              // Nombre de jours consécutifs actuels
  meilleurStreak: number;            // Record personnel de jours consécutifs
  dernierJourActif: Date | null;     // Dernier jour où l'élève a été actif
  totalJoursActifs: number;          // Total de jours d'activité depuis l'inscription
  semaineCourante: boolean[];        // Lun-Dim : true si actif ce jour (7 éléments)
  historiqueHebdo: {                 // Historique des 4 dernières semaines
    semaine: string;                 // Label (ex: "Sem. 5")
    joursActifs: number;             // Nombre de jours actifs cette semaine
  }[];
}

// ==================== TYPES OBJECTIFS ====================

/**
 * Statut d'un objectif hebdomadaire
 */
export type StatutObjectif = 'en_cours' | 'atteint' | 'echoue' | 'non_commence';

/**
 * Objectif hebdomadaire personnalisé
 */
export interface ObjectifHebdo {
  id: string;                        // ID unique
  userId: string;                    // ID de l'élève
  titre: string;                     // Titre (ex: "Passer 3 quiz en Maths")
  description: string;               // Description détaillée
  type: 'quiz_count' | 'score_min' | 'temps_etude' | 'streak'; // Type d'objectif
  cible: number;                     // Valeur cible (ex: 3 quiz, 14/20 min)
  progression: number;               // Progression actuelle
  statut: StatutObjectif;            // Statut de l'objectif
  disciplineId?: string;             // Discipline ciblée (optionnel)
  disciplineNom?: string;            // Nom de la discipline (optionnel)
  dateDebut: Date;                   // Début de la semaine
  dateFin: Date;                     // Fin de la semaine
  recompense?: string;               // Badge ou récompense à gagner
}

// ==================== TYPES SUIVI GLOBAL ====================

/**
 * Vue d'ensemble du suivi d'un élève
 * Agrège lacunes, recommandations, streaks et objectifs
 */
export interface SuiviEleve {
  userId: string;                    // ID de l'élève
  lacunes: LacuneDetectee[];         // Lacunes détectées triées par urgence
  recommandations: Recommandation[]; // Recommandations personnalisées
  streak: StreakData;                 // Données de streak
  objectifs: ObjectifHebdo[];        // Objectifs de la semaine en cours
  scoreGlobal: number;               // Score de santé global (0-100)
  derniereMiseAJour: Date;           // Dernière analyse
}

/**
 * Alerte pour notification (prof ou élève)
 */
export interface AlerteSuivi {
  id: string;                        // ID unique
  userId: string;                    // ID de l'élève concerné
  userNom: string;                   // Nom de l'élève
  type: 'lacune_critique' | 'streak_perdu' | 'objectif_atteint' | 'progression' | 'inactivite';
  message: string;                   // Message de l'alerte
  niveauUrgence: NiveauUrgence | 'info'; // Urgence (info pour les positives)
  dateCreation: Date;                // Date de création
  lue: boolean;                      // Si l'alerte a été lue
}
