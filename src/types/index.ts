/**
 * ============================================================
 * TYPES CENTRALISÉS — PedaClic
 * ============================================================
 * Interfaces TypeScript pour toute l'application.
 * Ce fichier est le point d'entrée unique pour les types.
 * 
 * ⚠️ CORRIGÉ : Suppression des doublons Chapitre/ChapitreFormData
 * ✅ PHASE 13 : Ajout de Formation libre (formation_libre)
 *    - Nouveau niveau : 'formation_libre'
 *    - Nouvelles classes : 'debutant', 'intermediaire', 'avance'
 *    - Constantes et utilitaires pour le mapping niveau → classes
 * ============================================================
 */

// ==================== TYPES UTILISATEURS ====================

/**
 * Rôles possibles dans PedaClic
 */
export type UserRole = 'admin' | 'prof' | 'eleve' | 'parent';

/**
 * Interface pour un utilisateur PedaClic
 */
/** Formule d'abonnement Premium (illimité ou à la carte) */
export type FormulePremium =
  | 'illimite_3m'
  | 'illimite_6m'
  | 'illimite_1an'
  | 'a_la_carte_1'
  | 'a_la_carte_3'
  | 'a_la_carte_7'
  | 'a_la_carte_tous';

export interface User {
  uid: string;                    // ID Firebase unique
  email: string;                  // Email de l'utilisateur
  displayName?: string;           // Nom d'affichage (optionnel)
  role: UserRole;                 // Rôle de l'utilisateur
  isPremium: boolean;             // Statut Premium
  subscriptionEnd?: Date | null;  // Date de fin d'abonnement Premium
  /** Formule souscrite (mensuel, annuel, ou cours à la carte) */
  subscriptionPlan?: FormulePremium;
  /** IDs des cours choisis (formule à la carte uniquement) */
  coursChoisis?: string[];
  /** Compteur des ressources consommées (générations + téléchargements + séquences) — pour limite 30 */
  usageRessources?: number;
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
 * ✅ Phase 13 : ajout de 'formation_libre'
 */
export type Niveau = 'college' | 'lycee' | 'formation_libre';

/**
 * Classes disponibles par niveau
 * ✅ Phase 13 : ajout des niveaux de formation libre
 */
export type Classe = 
  | '6eme' | '5eme' | '4eme' | '3eme'           // Collège
  | '2nde' | '1ere' | 'Terminale'                // Lycée
  | 'debutant' | 'intermediaire' | 'avance';     // Formation libre

// ==================== CONSTANTES PHASE 13 ====================

/**
 * Labels lisibles des classes par niveau
 * Utilisés dans les formulaires et l'affichage
 */
export const CLASSES_COLLEGE: { value: Classe; label: string }[] = [
  { value: '6eme', label: '6ème' },
  { value: '5eme', label: '5ème' },
  { value: '4eme', label: '4ème' },
  { value: '3eme', label: '3ème' },
];

export const CLASSES_LYCEE: { value: Classe; label: string }[] = [
  { value: '2nde', label: '2nde' },
  { value: '1ere', label: '1ère' },
  { value: 'Terminale', label: 'Terminale' },
];

export const CLASSES_FORMATION_LIBRE: { value: Classe; label: string }[] = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avance', label: 'Avancé' },
];

/**
 * Labels des niveaux pour l'affichage UI
 */
export const NIVEAUX_LABELS: Record<Niveau, string> = {
  college: 'Collège',
  lycee: 'Lycée',
  formation_libre: 'Formation libre',
};

/**
 * Retourne les classes disponibles selon le niveau sélectionné
 * Utilisé dans DisciplineManager pour adapter le formulaire
 */
export function getClassesByNiveau(niveau: Niveau): { value: Classe; label: string }[] {
  switch (niveau) {
    case 'college':
      return CLASSES_COLLEGE;
    case 'lycee':
      return CLASSES_LYCEE;
    case 'formation_libre':
      return CLASSES_FORMATION_LIBRE;
    default:
      return [];
  }
}

/**
 * Retourne le label lisible d'une classe
 */
export function getClasseLabel(classe: Classe): string {
  const all = [...CLASSES_COLLEGE, ...CLASSES_LYCEE, ...CLASSES_FORMATION_LIBRE];
  return all.find((c) => c.value === classe)?.label || classe;
}

// ==================== INTERFACES DISCIPLINES ====================

/**
 * Interface pour une discipline (matière)
 * ✅ Phase 13 : le coefficient est optionnel (déjà le cas)
 */
export interface Discipline {
  id: string;                     // ID unique Firestore
  nom: string;                    // Nom de la discipline (ex: "Français")
  niveau: Niveau;                 // Niveau (collège, lycée ou formation_libre)
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

// ==================== TYPES CHAPITRES ====================

/**
 * Interface pour un chapitre
 */
export interface Chapitre {
  id: string;
  disciplineId: string;
  titre: string;
  ordre: number;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Données pour créer/modifier un chapitre
 */
export interface ChapitreFormData {
  disciplineId: string;
  titre: string;
  ordre: number;
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
  chapitreId?: string;            // ID du chapitre associé
  actif?: boolean;                // Ressource active ou non
  duree?: number;                 // Durée en minutes
  urlExterne?: string;            // URL externe (YouTube, etc.)
  fichierNom?: string;            // Nom du fichier attaché
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
  actif?: boolean;
  duree?: number;
  urlExterne?: string;
  fichierNom?: string;
  chapitreId?: string;
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
  loginWithGoogle: (role?: UserRole) => Promise<void>;
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
/**
 * ============================================================
 * PedaClic — Phase 14 : Types Progression & Badges
 * ============================================================
 * INSTRUCTIONS : Copiez ce bloc À LA FIN de src/types/index.ts
 *                Ne supprimez rien de l'existant.
 * ============================================================
 */

/* ──────────────────────────────────────────────
   Progression d'un élève par discipline
   Stockée dans la collection Firestore "progressions"
   Document ID = `${userId}_${disciplineId}`
   ────────────────────────────────────────────── */
export interface Progression {
  /** UID de l'élève (lié à users/{uid}) */
  userId: string;

  /** ID de la discipline (lié à disciplines/{id}) */
  disciplineId: string;

  /** Nom de la discipline (dénormalisé pour l'affichage) */
  disciplineNom: string;

  /** IDs des ressources consultées par l'élève dans cette discipline */
  ressourcesVues: string[];

  /** IDs des quiz réussis (score ≥ seuil) dans cette discipline */
  quizReussis: string[];

  /** Nombre total de ressources dans la discipline (snapshot) */
  totalRessources: number;

  /** Nombre total de quiz dans la discipline (snapshot) */
  totalQuiz: number;

  /** Pourcentage d'avancement calculé (0–100) */
  pourcentage: number;

  /** Horodatage du dernier accès à cette discipline */
  dernierAcces: any; // Timestamp Firestore

  /** Date de création de la progression */
  createdAt: any;    // Timestamp Firestore

  /** Date de dernière mise à jour */
  updatedAt: any;    // Timestamp Firestore
}

/* ──────────────────────────────────────────────
   Badge de récompense
   Stocké dans la sous-collection "users/{uid}/badges/{badgeId}"
   ────────────────────────────────────────────── */
export interface BadgeDefinition {
  /** Identifiant unique du badge (ex: "premier_pas") */
  id: string;

  /** Nom affiché (ex: "Premier pas") */
  nom: string;

  /** Description courte */
  description: string;

  /** Emoji ou icône (ex: "🌱") */
  icone: string;

  /** Texte de la condition à remplir */
  condition: string;

  /** Catégorie : ressources, quiz, discipline, streak */
  categorie: 'ressources' | 'quiz' | 'discipline' | 'streak' | 'performance';

  /** Le badge a-t-il été obtenu ? (calculé côté client) */
  obtenu: boolean;

  /** Date d'obtention (ISO string ou null) */
  dateObtenue?: string | null;
}

/* ──────────────────────────────────────────────
   Streak de connexion (série de jours consécutifs)
   Stocké dans "users/{uid}" comme champs additionnels
   ────────────────────────────────────────────── */
export interface StreakData {
  /** Nombre actuel de jours consécutifs de connexion */
  streakActuel: number;

  /** Meilleure série de connexion jamais atteinte */
  meilleurStreak: number;

  /** Date du dernier accès (format ISO YYYY-MM-DD) */
  dernierJourAcces: string;
}

/* ──────────────────────────────────────────────
   Résumé global de progression (agrégation)
   Utilisé dans le Dashboard élève
   ────────────────────────────────────────────── */
export interface ProgressionGlobale {
  /** Nombre total de ressources consultées (toutes disciplines) */
  totalRessourcesVues: number;

  /** Nombre total de quiz réussis (toutes disciplines) */
  totalQuizReussis: number;

  /** Pourcentage moyen d'avancement (toutes disciplines) */
  pourcentageMoyen: number;

  /** Nombre de disciplines commencées */
  disciplinesCommencees: number;

  /** Nombre de disciplines complétées à 100% */
  disciplinesCompletees: number;

  /** Streak de connexion actuel */
  streakActuel: number;

  /** Meilleur streak de connexion */
  meilleurStreak: number;

  /** Liste des progressions par discipline */
  parDiscipline: Progression[];
}
