/**
 * ==================== TYPES ESPACE PARENTS (Phase 10) ====================
 * 
 * Interfaces TypeScript pour le module Espace Parents de PedaClic.
 * Gère la liaison parent ↔ enfant(s), les alertes parentales,
 * et les résumés hebdomadaires de progression.
 * 
 * Fichier : src/types/parent.ts
 * Dépendances : ../types/index.ts (UserRole, Classe, Niveau)
 */

// ==================== RÔLE PARENT ====================

/**
 * Extension du type UserRole pour inclure le rôle "parent"
 * Note : Mettre à jour UserRole dans src/types/index.ts :
 *   export type UserRole = 'admin' | 'prof' | 'eleve' | 'parent';
 */

// ==================== DONNÉES PARENT ====================

/**
 * Profil complet d'un parent dans Firestore
 * Collection : users (avec role = 'parent')
 */
export interface ParentData {
  uid: string;                     // ID Firebase unique
  email: string;                   // Email du parent
  displayName: string;             // Nom complet (ex: "Mamadou Diallo")
  telephone?: string;              // Numéro de téléphone (format sénégalais)
  role: 'parent';                  // Rôle fixé à "parent"
  isPremium: boolean;              // Statut Premium (hérité ou propre)
  createdAt: Date;                 // Date de création du compte
  lastLogin?: Date;                // Dernière connexion
}

// ==================== LIAISON PARENT ↔ ENFANT ====================

/**
 * Document de liaison entre un parent et un enfant
 * Collection Firestore : liens_parent_enfant
 * 
 * Workflow de liaison :
 * 1. Le parent saisit le code unique de l'enfant
 * 2. Le système vérifie le code dans la collection users
 * 3. Si valide, un document LienParentEnfant est créé
 * 4. Le parent peut alors consulter le suivi de l'enfant
 */
export interface LienParentEnfant {
  id: string;                      // ID unique du lien
  parentId: string;                // UID du parent
  enfantId: string;                // UID de l'enfant (élève)
  enfantNom: string;               // Nom de l'enfant (dénormalisé pour affichage rapide)
  enfantEmail: string;             // Email de l'enfant
  enfantClasse?: string;           // Classe de l'enfant (ex: "3eme", "Terminale")
  codeInvitation: string;          // Code unique utilisé pour la liaison
  statut: 'actif' | 'suspendu' | 'revoque';  // Statut du lien
  dateCreation: Date;              // Date de création du lien
  dateDerniereConsultation?: Date; // Dernière fois que le parent a consulté le suivi
}

/**
 * Code d'invitation généré pour chaque élève
 * Stocké dans la collection users de l'élève (champ codeParent)
 * Format : PEDA-XXXX-XXXX (ex: PEDA-M7K2-9FH3)
 */
export interface CodeInvitation {
  code: string;                    // Code unique au format PEDA-XXXX-XXXX
  eleveId: string;                 // UID de l'élève propriétaire
  utilise: boolean;                // Si le code a déjà été utilisé
  dateGeneration: Date;            // Date de génération du code
}

// ==================== ALERTES PARENT ====================

/**
 * Types d'alertes envoyées aux parents
 */
export type TypeAlerteParent =
  | 'lacune_critique'              // Moyenne < 8/20 dans une matière
  | 'inactivite'                   // Pas d'activité depuis 7+ jours
  | 'streak_perdu'                 // Streak de 3+ jours cassé
  | 'objectif_atteint'             // Un objectif hebdomadaire a été atteint
  | 'progression'                  // Tendance à la hausse détectée
  | 'score_bas'                    // Score global < 40
  | 'nouveau_quiz';                // L'enfant a passé un nouveau quiz

/**
 * Niveaux de priorité des alertes
 */
export type NiveauAlerteParent = 'critique' | 'important' | 'modere' | 'info';

/**
 * Alerte destinée au parent concernant un enfant
 * Collection Firestore : alertes_parent
 */
export interface AlerteParent {
  id: string;                      // ID unique de l'alerte
  parentId: string;                // UID du parent destinataire
  enfantId: string;                // UID de l'enfant concerné
  enfantNom: string;               // Nom de l'enfant (pour affichage)
  type: TypeAlerteParent;          // Type d'alerte
  niveau: NiveauAlerteParent;      // Niveau de priorité
  titre: string;                   // Titre court de l'alerte
  message: string;                 // Message détaillé
  lue: boolean;                    // Si l'alerte a été lue
  dateCreation: Date;              // Date de création
  dateLecture?: Date;              // Date de lecture (si lue)
  actionUrl?: string;              // Lien vers la section concernée
}

// ==================== RÉSUMÉ HEBDOMADAIRE ====================

/**
 * Résultat de quiz simplifié pour le résumé parent
 */
export interface QuizResultResume {
  quizTitre: string;               // Titre du quiz
  disciplineNom: string;           // Nom de la discipline
  pourcentage: number;             // Score en pourcentage
  noteSur20: number;               // Note convertie sur 20
  reussi: boolean;                 // Quiz réussi ou non
  datePassage: Date;               // Date de passage
}

/**
 * Évolution hebdomadaire d'une discipline
 */
export interface EvolutionDiscipline {
  disciplineNom: string;           // Nom de la discipline
  disciplineId: string;            // ID Firestore de la discipline
  moyenneSemainePrecedente: number;// Moyenne semaine N-1
  moyenneSemaineCourante: number;  // Moyenne semaine N
  evolution: 'hausse' | 'baisse' | 'stable'; // Tendance
  ecart: number;                   // Différence entre les deux semaines
}

/**
 * Résumé hebdomadaire complet pour le parent
 */
export interface ResumeHebdomadaire {
  enfantId: string;                // UID de l'enfant
  enfantNom: string;               // Nom de l'enfant
  semaine: string;                 // Libellé (ex: "27 Jan - 02 Fév 2026")
  dateDebut: Date;                 // Lundi de la semaine
  dateFin: Date;                   // Dimanche de la semaine

  // === Indicateurs globaux ===
  scoreGlobal: number;             // Score de santé (0-100)
  scoreGlobalPrecedent: number;    // Score semaine précédente
  evolutionScore: 'hausse' | 'baisse' | 'stable';

  // === Activité ===
  nombreQuizSemaine: number;       // Nombre de quiz passés cette semaine
  tempsEstimeMinutes: number;      // Temps total estimé d'étude
  joursActifsSemaine: number;      // Nombre de jours avec activité
  streakActuel: number;            // Streak en cours

  // === Résultats détaillés ===
  derniersQuiz: QuizResultResume[];       // 5 derniers quiz de la semaine
  evolutionDisciplines: EvolutionDiscipline[];  // Évolution par matière

  // === Lacunes ===
  lacunesCritiques: number;        // Nombre de lacunes critiques
  lacunesImportantes: number;      // Nombre de lacunes importantes
  disciplinesEnDifficulte: string[]; // Noms des disciplines en difficulté

  // === Objectifs ===
  objectifsAtteints: number;       // Nombre d'objectifs atteints
  objectifsTotal: number;          // Nombre total d'objectifs
}

// ==================== ÉTAT DU DASHBOARD PARENT ====================

/**
 * Données complètes du dashboard parent pour un enfant
 */
export interface DashboardParentData {
  enfant: {
    id: string;
    nom: string;
    email: string;
    classe?: string;
    derniereConnexion?: Date;
  };
  scoreGlobal: number;
  streak: {
    actuel: number;
    meilleur: number;
    semaineCourante: boolean[];
  };
  lacunes: {
    disciplineNom: string;
    moyenne: number;
    niveauUrgence: 'critique' | 'important' | 'modere';
    tendance: 'hausse' | 'baisse' | 'stable';
  }[];
  objectifs: {
    titre: string;
    progression: number;
    cible: number;
    statut: 'en_cours' | 'atteint' | 'echoue' | 'non_commence';
  }[];
  derniersQuiz: QuizResultResume[];
  resume: ResumeHebdomadaire | null;
  alertes: AlerteParent[];
}

// ==================== FORMULAIRES ====================

/**
 * Données du formulaire de liaison parent ↔ enfant
 */
export interface LierEnfantFormData {
  codeInvitation: string;          // Code saisi par le parent
}

/**
 * Données du formulaire d'inscription parent
 */
export interface RegisterParentFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  telephone?: string;
}
