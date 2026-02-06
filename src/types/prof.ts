/**
 * ============================================================
 * TYPES PROFESSEUR — PedaClic Phase 11
 * ============================================================
 * 
 * Interfaces TypeScript pour le Dashboard Analytics Professeurs.
 * Couvre : groupes-classes, codes d'invitation, inscriptions,
 * statistiques par groupe et par élève.
 * 
 * Fichier : src/types/prof.ts
 * Dépendances : ../types/index.ts (Classe, Niveau)
 * ============================================================
 */

// ==================== GROUPES-CLASSES ====================

/**
 * Statut d'un groupe-classe
 * - actif   : le groupe est en cours, les élèves peuvent s'inscrire
 * - archive : le groupe est terminé (fin d'année, etc.)
 * - suspendu: le groupe est temporairement désactivé
 */
export type StatutGroupe = 'actif' | 'archive' | 'suspendu';

/**
 * Interface pour un groupe-classe créé par un professeur.
 * Collection Firestore : groupes_prof
 * 
 * Exemple : "3ème A - Maths 2025", "Terminale S - Physique"
 */
export interface GroupeProf {
  id: string;                       // ID unique Firestore (auto-généré)
  profId: string;                   // UID du professeur créateur
  profNom: string;                  // Nom du prof (pour affichage rapide)
  nom: string;                      // Nom du groupe (ex: "3ème A - Maths 2025")
  description?: string;             // Description optionnelle du groupe
  matiereId: string;                // ID de la discipline associée
  matiereNom: string;               // Nom de la matière (pour affichage rapide)
  classeNiveau: string;             // Niveau/classe (ex: "3eme", "Terminale")
  codeInvitation: string;           // Code unique (format: PROF-XXXX-XXXX)
  nombreInscrits: number;           // Compteur d'élèves inscrits (dénormalisé)
  statut: StatutGroupe;             // Statut actuel du groupe
  anneeScolaire: string;            // Année scolaire (ex: "2024-2025")
  dateCreation: Date;               // Date de création
  dateMiseAJour?: Date;             // Dernière modification
}

/**
 * Données du formulaire pour créer/modifier un groupe-classe
 */
export interface GroupeFormData {
  nom: string;                      // Nom du groupe
  description?: string;             // Description optionnelle
  matiereId: string;                // ID de la matière
  matiereNom: string;               // Nom de la matière
  classeNiveau: string;             // Niveau de classe
  anneeScolaire: string;            // Année scolaire
}

// ==================== INSCRIPTIONS GROUPES ====================

/**
 * Statut d'une inscription d'élève à un groupe
 * - actif  : l'élève est inscrit et actif
 * - retire : l'élève a été retiré du groupe
 */
export type StatutInscription = 'actif' | 'retire';

/**
 * Interface pour l'inscription d'un élève à un groupe-classe.
 * Collection Firestore : inscriptions_groupe
 */
export interface InscriptionGroupe {
  id: string;                       // ID unique Firestore
  groupeId: string;                 // ID du groupe
  eleveId: string;                  // UID de l'élève inscrit
  eleveNom: string;                 // Nom de l'élève (pour affichage rapide)
  eleveEmail: string;               // Email de l'élève
  statut: StatutInscription;        // Statut de l'inscription
  dateInscription: Date;            // Date d'inscription au groupe
  dateRetrait?: Date;               // Date de retrait (si retiré)
}

// ==================== STATISTIQUES PAR GROUPE ====================

/**
 * Statistiques globales d'un groupe-classe.
 * Calculées à partir des quiz_results des élèves inscrits.
 */
export interface StatsGroupe {
  groupeId: string;                 // ID du groupe
  nombreEleves: number;             // Nombre d'élèves actifs
  moyenneClasse: number;            // Moyenne de la classe (sur 20)
  tauxReussite: number;             // % d'élèves ayant > 10/20
  tauxParticipation: number;        // % d'élèves ayant passé au moins 1 quiz
  totalQuizPasses: number;          // Nombre total de quiz passés
  elevesEnDifficulte: number;       // Nombre d'élèves < 8/20
  meilleureNote: number;            // Meilleure note du groupe
  pireNote: number;                 // Moins bonne note du groupe
  derniereMiseAJour: Date;          // Date du dernier calcul
}

/**
 * Statistiques d'un élève au sein d'un groupe.
 * Vue détaillée pour le prof : moyenne, lacunes, streak.
 */
export interface EleveGroupeStats {
  eleveId: string;                  // UID de l'élève
  eleveNom: string;                 // Nom de l'élève
  eleveEmail: string;               // Email de l'élève
  moyenne: number;                  // Moyenne de l'élève (sur 20)
  totalQuiz: number;                // Nombre de quiz passés
  tauxReussite: number;             // % de quiz réussis
  scoreGlobal: number;              // Score global (0-100) depuis suiviService
  streak: {                         // Données de streak
    actuel: number;                 // Streak actuel (jours consécutifs)
    meilleur: number;               // Meilleur streak
  };
  lacunes: LacuneEleve[];           // Lacunes détectées
  dernierQuiz?: Date;               // Date du dernier quiz
  tendance: 'hausse' | 'baisse' | 'stable';  // Tendance récente
}

/**
 * Lacune d'un élève (simplifiée pour la vue prof)
 */
export interface LacuneEleve {
  disciplineNom: string;            // Nom de la matière
  chapitre?: string;                // Chapitre concerné
  moyenne: number;                  // Moyenne sur ce point
  niveauUrgence: 'critique' | 'important' | 'modere';
}

// ==================== ANALYSE PAR QUIZ ====================

/**
 * Statistiques détaillées d'un quiz spécifique au sein d'un groupe.
 * Permet au prof de voir les questions les plus ratées.
 */
export interface StatsQuizGroupe {
  quizId: string;                   // ID du quiz
  quizTitre: string;                // Titre du quiz
  disciplineNom: string;            // Matière du quiz
  totalPassages: number;            // Nombre d'élèves ayant passé le quiz
  moyenneScore: number;             // Score moyen (sur 20)
  tauxReussite: number;             // % de réussite
  tempsEcouleMoyen: number;         // Temps moyen en secondes
  questionsRatees: QuestionRatee[]; // Questions les plus ratées
}

/**
 * Question la plus ratée dans un quiz
 */
export interface QuestionRatee {
  questionIndex: number;            // Index de la question (0-based)
  questionTexte: string;            // Texte de la question
  tauxEchec: number;                // % d'élèves ayant raté cette question
  reponseCorrecte: string;          // La bonne réponse
  reponsesFrequentes: {             // Réponses les plus choisies
    reponse: string;
    nombre: number;
  }[];
}

// ==================== EXPORT CSV ====================

/**
 * Ligne de données pour l'export CSV des résultats
 */
export interface LigneExportCSV {
  eleveNom: string;
  eleveEmail: string;
  moyenne: number;
  totalQuiz: number;
  tauxReussite: number;
  streak: number;
  lacunesPrincipales: string;       // Lacunes séparées par des virgules
  tendance: string;
}

// ==================== DASHBOARD PROF ====================

/**
 * Données complètes du Dashboard Professeur.
 * Agrège toutes les informations pour la vue d'ensemble.
 */
export interface DashboardProfData {
  groupes: GroupeProf[];                // Liste des groupes du prof
  statsParGroupe: Map<string, StatsGroupe>;  // Stats par groupeId
  totalEleves: number;                  // Total d'élèves tous groupes
  totalGroupes: number;                 // Nombre de groupes actifs
  moyenneGenerale: number;              // Moyenne de tous les groupes
  alertes: AlerteProf[];                // Alertes à afficher
}

/**
 * Alerte pour le professeur (élève en difficulté, inactivité, etc.)
 */
export interface AlerteProf {
  id: string;                          // ID unique
  type: 'difficulte' | 'inactivite' | 'baisse' | 'felicitation';
  eleveNom: string;                    // Nom de l'élève concerné
  eleveId: string;                     // UID de l'élève
  groupeNom: string;                   // Nom du groupe
  message: string;                     // Message descriptif
  niveauUrgence: 'critique' | 'important' | 'info';
  dateCreation: Date;                  // Date de l'alerte
}

// ==================== FORMULAIRE REJOINDRE GROUPE ====================

/**
 * Données du formulaire pour qu'un élève rejoigne un groupe-classe
 */
export interface RejoindreGroupeFormData {
  codeInvitation: string;              // Code saisi par l'élève (PROF-XXXX-XXXX)
}
