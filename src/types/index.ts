/**
 * Interfaces TypeScript pour PedaClic
 * Ce fichier centralise toutes les définitions de types utilisées dans l'application
 */

// ==================== TYPES UTILISATEURS ====================

/**
 * Rôles possibles dans PedaClic
 */
export type UserRole = 'admin' | 'prof' | 'eleve' | 'parent';

/**
 * Interface pour un utilisateur PedaClic
 */
export interface User {
  uid: string;                    // ID Firebase unique
  email: string;                  // Email de l'utilisateur
  displayName?: string;           // Nom d'affichage (optionnel)
  role: UserRole;                 // Rôle de l'utilisateur
  isPremium: boolean;             // Statut Premium
  subscriptionEnd?: Date | null;  // Date de fin d'abonnement Premium
  photoURL?: string;              // URL de la photo de profil (optionnel)
  createdAt: Date;                // Date de création du compte
  lastLogin?: Date;               // Dernière connexion
}

/**
 * Données du formulaire d'inscription
 */
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role: UserRole;
}

/**
 * Données du formulaire de connexion
 */
export interface LoginFormData {
  email: string;
  password: string;
}

// ==================== TYPES DISCIPLINES ====================

/**
 * Niveaux scolaires dans le système éducatif sénégalais
 */
export type Niveau = 'college' | 'lycee';

/**
 * Classes disponibles par niveau
 */
export type Classe = 
  | '6eme' | '5eme' | '4eme' | '3eme'           // Collège
  | '2nde' | '1ere' | 'Terminale';              // Lycée

/**
 * Interface pour une discipline (matière)
 */
export interface Discipline {
  id: string;                     // ID unique Firestore
  nom: string;                    // Nom de la discipline (ex: "Français")
  niveau: Niveau;                 // Niveau (collège ou lycée)
  classe: Classe;                 // Classe spécifique
  ordre: number;                  // Ordre d'affichage
  coefficient?: number;           // Coefficient pour les examens (optionnel)
  couleur?: string;               // Couleur pour l'interface (optionnel)
  icone?: string;                 // Icône associée (optionnel)
  description?: string;           // Description courte (optionnel)
  createdAt: Date;                // Date de création
  updatedAt?: Date;               // Dernière mise à jour
}

/**
 * Données pour créer/modifier une discipline
 */
export interface DisciplineFormData {
  nom: string;
  niveau: Niveau;
  classe: Classe;
  ordre: number;
  coefficient?: number;
  couleur?: string;
  icone?: string;
  description?: string;
}

// ==================== TYPES RESSOURCES PÉDAGOGIQUES ====================

/**
 * Types de ressources disponibles
 */
export type TypeRessource = 'cours' | 'exercice' | 'video' | 'document' | 'quiz';

/**
 * Interface pour une ressource pédagogique
 */
export interface Resource {
  id: string;                     // ID unique Firestore
  disciplineId: string;           // ID de la discipline associée
  titre: string;                  // Titre de la ressource
  type: TypeRessource;            // Type de ressource
  contenu: string;                // Contenu (HTML ou texte)
  description?: string;           // Description courte (optionnel)
  isPremium: boolean;             // Contenu Premium ou gratuit
  ordre: number;                  // Ordre d'affichage dans le chapitre
  chapitre?: string;              // Numéro/nom du chapitre (optionnel)
  fichierURL?: string;            // URL du fichier attaché (optionnel)
  dureeEstimee?: number;          // Durée estimée en minutes (optionnel)
  tags?: string[];                // Tags pour filtrage (optionnel)
  auteurId: string;               // ID du professeur créateur
  createdAt: Date;                // Date de création
  updatedAt?: Date;               // Dernière mise à jour
}

/**
 * Données pour créer/modifier une ressource
 */
export interface ResourceFormData {
  disciplineId: string;
  titre: string;
  type: TypeRessource;
  contenu: string;
  description?: string;
  isPremium: boolean;
  ordre: number;
  chapitre?: string;
  fichierURL?: string;
  dureeEstimee?: number;
  tags?: string[];
}

// ==================== TYPES QUIZ ====================

/**
 * Niveaux de difficulté pour les questions
 */
export type DifficulteQuestion = 'facile' | 'moyen' | 'difficile';

/**
 * Interface pour une question de quiz
 */
export interface Question {
  id: string;                     // ID unique
  question: string;               // Texte de la question
  options: string[];              // Liste des réponses possibles (4 options)
  reponseCorrecte: number;        // Index de la bonne réponse (0-3)
  explication?: string;           // Explication de la réponse (optionnel)
  difficulte: DifficulteQuestion; // Niveau de difficulté
  points: number;                 // Points attribués pour cette question
}

/**
 * Interface pour un quiz complet
 */
export interface Quiz {
  id: string;                     // ID unique Firestore
  disciplineId: string;           // ID de la discipline
  titre: string;                  // Titre du quiz
  description?: string;           // Description (optionnel)
  questions: Question[];          // Liste des questions
  duree: number;                  // Durée en minutes
  isPremium: boolean;             // Quiz Premium uniquement
  noteMinimale: number;           // Note minimale pour réussir (/20)
  createdAt: Date;                // Date de création
  updatedAt?: Date;               // Dernière mise à jour
}

/**
 * Interface pour un résultat de quiz
 */
export interface QuizResult {
  id: string;                     // ID unique
  quizId: string;                 // ID du quiz passé
  userId: string;                 // ID de l'élève
  score: number;                  // Score obtenu (/20)
  reponses: number[];             // Indices des réponses données
  tempsEcoule: number;            // Temps écoulé en minutes
  datePassage: Date;              // Date et heure de passage
  reussi: boolean;                // Quiz réussi ou non
}

// ==================== TYPES PLANIFICATION ====================

/**
 * Interface pour une séance planifiée (Cahier de textes)
 */
export interface Seance {
  id: string;                     // ID unique Firestore
  disciplineId: string;           // ID de la discipline
  classe: Classe;                 // Classe concernée
  date: Date;                     // Date de la séance
  heureDebut: string;             // Heure de début (format "HH:mm")
  heureFin: string;               // Heure de fin (format "HH:mm")
  titre: string;                  // Titre de la séance
  contenu: string;                // Contenu de la séance
  devoirs?: string;               // Devoirs à faire (optionnel)
  ressourcesIds?: string[];       // IDs des ressources associées (optionnel)
  professeurId: string;           // ID du professeur
  createdAt: Date;                // Date de création
  updatedAt?: Date;               // Dernière mise à jour
}

// ==================== TYPES PAIEMENT ====================

/**
 * Statuts possibles d'une transaction PayTech
 */
export type StatutTransaction = 'pending' | 'success' | 'failed' | 'cancelled';

/**
 * Interface pour une transaction Premium
 */
export interface Transaction {
  id: string;                     // ID unique
  userId: string;                 // ID de l'utilisateur
  montant: number;                // Montant en FCFA
  devise: string;                 // Devise (XOF pour FCFA)
  statut: StatutTransaction;      // Statut de la transaction
  paytechTransactionId?: string;  // ID transaction PayTech (optionnel)
  methodePaiement?: string;       // Méthode (Wave, Orange Money, etc.)
  dateTransaction: Date;          // Date de la transaction
  dateExpiration?: Date;          // Date d'expiration de l'abonnement
}

// ==================== TYPES STATISTIQUES ====================

/**
 * Interface pour les statistiques d'un élève
 */
export interface StudentStats {
  userId: string;
  totalQuizPasses: number;
  moyenneGenerale: number;
  tempsTotal: number;              // En minutes
  meilleureMatiere?: string;
  progressionParDiscipline: {
    [disciplineId: string]: {
      nombreQuiz: number;
      moyenne: number;
    };
  };
}

/**
 * Interface pour les statistiques d'un professeur
 */
export interface ProfStats {
  userId: string;
  nombreRessources: number;
  nombreQuiz: number;
  disciplinesEnseigne: string[];
  vuesRessources: number;
}

// ==================== TYPES CONTEXTE & ÉTATS ====================

/**
 * Interface pour le contexte d'authentification
 */
export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

/**
 * Interface pour l'état de chargement générique
 */
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Type générique pour les résultats d'opération
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
