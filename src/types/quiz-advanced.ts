/**
 * ============================================================
 * PEDACLIC — Phase 12 : Quiz Multi-Types Avancé
 * Interfaces TypeScript pour les 5 types de questions
 * ============================================================
 * Types : QCM Unique | QCM Multiple | Drag & Drop | 
 *         Mise en Relation | Essai
 * ============================================================
 */

// ==================== TYPES DE QUESTIONS ====================

/**
 * Enumération des types de questions disponibles
 */
export type TypeQuestion = 
  | 'qcm_unique'      // QCM à choix unique (radio buttons)
  | 'qcm_multiple'    // QCM à choix multiple (checkboxes)
  | 'drag_drop'       // Glisser-déposer (réordonner)
  | 'mise_en_relation' // Relier colonne A ↔ colonne B
  | 'essai';           // Réponse libre (texte long)

/**
 * Niveaux de difficulté
 */
export type DifficulteQuestion = 'facile' | 'moyen' | 'difficile';

// ==================== INTERFACES PAR TYPE ====================

/**
 * Option pour QCM (unique ou multiple)
 * Le texte peut contenir du HTML (éditeur riche)
 */
export interface QCMOption {
  id: string;          // Identifiant unique de l'option (ex: "opt_1")
  texte: string;       // Texte de l'option (HTML autorisé)
  isCorrect: boolean;  // Vrai si c'est une bonne réponse
}

/**
 * Données spécifiques : QCM Choix Unique
 * Une seule réponse correcte parmi les options
 */
export interface QCMUniqueData {
  options: QCMOption[];  // 2 à 6 options, exactement 1 correcte
}

/**
 * Données spécifiques : QCM Choix Multiple
 * Plusieurs réponses correctes possibles
 */
export interface QCMMultipleData {
  options: QCMOption[];        // 2 à 8 options, 1+ correctes
  scoringPartiel: boolean;     // Accorder des points partiels ?
}

/**
 * Élément à ordonner dans un Drag & Drop
 */
export interface DragDropItem {
  id: string;           // Identifiant unique (ex: "item_1")
  texte: string;        // Texte de l'élément (HTML autorisé)
  ordreCorrect: number; // Position correcte (1, 2, 3...)
}

/**
 * Données spécifiques : Drag & Drop (réordonner)
 * L'élève doit placer les éléments dans le bon ordre
 */
export interface DragDropData {
  items: DragDropItem[];     // Éléments à réordonner
  consigneOrdre: string;     // Ex: "Classez du plus ancien au plus récent"
}

/**
 * Paire pour la mise en relation
 */
export interface RelationPair {
  id: string;           // Identifiant unique (ex: "pair_1")
  gauche: string;       // Élément colonne gauche (HTML autorisé)
  droite: string;       // Élément colonne droite (HTML autorisé)
}

/**
 * Données spécifiques : Mise en Relation
 * L'élève relie les éléments de gauche à ceux de droite
 */
export interface MiseEnRelationData {
  paires: RelationPair[];  // Paires correctes (affichées mélangées)
}

/**
 * Mot-clé attendu dans une réponse essai (correction automatique)
 */
export interface MotCleEssai {
  mot: string;          // Le mot ou expression attendu
  poids: number;        // Importance (1-5) pour la correction auto
  obligatoire: boolean; // Mot-clé obligatoire pour valider ?
}

/**
 * Données spécifiques : Essai (réponse libre)
 * Correction manuelle par le prof ou semi-auto par mots-clés
 */
export interface EssaiData {
  nombreMotsMin?: number;       // Nombre minimum de mots
  nombreMotsMax?: number;       // Nombre maximum de mots
  motsCles: MotCleEssai[];      // Mots-clés pour correction semi-auto
  reponseModele?: string;       // Réponse modèle du professeur (HTML)
  correctionMode: 'manuelle' | 'semi_auto' | 'mots_cles';
}

// ==================== QUESTION UNIFIÉE ====================

/**
 * Interface unifiée pour une question (tous types confondus)
 * Le champ `typeData` contient les données spécifiques au type
 */
export interface QuestionAvancee {
  id: string;                         // ID unique (généré)
  type: TypeQuestion;                 // Type de la question
  enonce: string;                     // Énoncé de la question (HTML riche)
  explication?: string;               // Explication après correction (HTML)
  difficulte: DifficulteQuestion;     // Niveau de difficulté
  points: number;                     // Points pour cette question
  imageURL?: string;                  // Image jointe à la question (optionnel)
  ordre: number;                      // Ordre dans le quiz

  // Données spécifiques selon le type
  typeData: QCMUniqueData 
          | QCMMultipleData 
          | DragDropData 
          | MiseEnRelationData 
          | EssaiData;
}

// ==================== QUIZ AVANCÉ ====================

/** Statut de publication du quiz */
export type QuizStatus = 'draft' | 'published';

/**
 * Interface pour un quiz avancé complet
 */
export interface QuizAvance {
  id: string;                         // ID Firestore
  /** Brouillon (non visible aux élèves) ou publié */
  status?: QuizStatus;
  disciplineId: string;               // ID de la discipline
  titre: string;                      // Titre du quiz
  description?: string;               // Description (HTML autorisé)
  questions: QuestionAvancee[];       // Liste des questions (multi-types)
  duree: number;                      // Durée en minutes
  isPremium: boolean;                 // Contenu Premium
  noteMinimale: number;               // Note minimale pour réussir (/20)
  melangerQuestions: boolean;         // Mélanger l'ordre des questions ?
  melangerOptions: boolean;           // Mélanger l'ordre des options QCM ?
  afficherCorrection: boolean;        // Montrer la correction après soumission ?
  tentativesMax: number;              // Nombre max de tentatives (0 = illimité)
  auteurId: string;                   // ID du créateur (admin/prof)
  /** ID du groupe-classe cible — null = quiz global plateforme */
  groupeId?: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Données du formulaire de création de quiz
 */
export interface QuizAvanceFormData {
  /** Brouillon ou publié — défaut: published */
  status?: QuizStatus;
  disciplineId: string;
  titre: string;
  description?: string;
  questions: QuestionAvancee[];
  duree: number;
  isPremium: boolean;
  noteMinimale: number;
  melangerQuestions: boolean;
  melangerOptions: boolean;
  afficherCorrection: boolean;
  tentativesMax: number;
  /** ID du groupe-classe cible — null = quiz global */
  groupeId?: string | null;
}

// ==================== RÉPONSES ÉLÈVE ====================

/**
 * Réponse de l'élève à une question (tous types)
 */
export interface ReponseEleve {
  questionId: string;
  type: TypeQuestion;

  // QCM Unique : ID de l'option choisie
  selectedOptionId?: string;

  // QCM Multiple : IDs des options cochées
  selectedOptionIds?: string[];

  // Drag & Drop : Ordre proposé par l'élève (tableau d'IDs)
  ordrePropose?: string[];

  // Mise en Relation : Paires proposées { gaucheId: droiteId }
  relationsProposees?: { [gaucheId: string]: string };

  // Essai : Texte de la réponse (HTML)
  texteReponse?: string;
}

/**
 * Résultat détaillé d'un quiz avancé
 */
export interface QuizAvanceResult {
  id: string;                         // ID Firestore
  quizId: string;                     // ID du quiz
  userId: string;                     // ID de l'élève
  reponses: ReponseEleve[];           // Toutes les réponses
  score: number;                      // Score total obtenu
  scoreMax: number;                   // Score maximum possible
  note20: number;                     // Note sur 20
  tempsEcoule: number;                // Temps en secondes
  datePassage: Date;                  // Quand le quiz a été passé
  reussi: boolean;                    // Note >= noteMinimale
  correctionManuelle: boolean;        // Contient des essais non corrigés ?
  detailsParQuestion: DetailQuestionResult[];
}

/**
 * Détail du résultat pour chaque question
 */
export interface DetailQuestionResult {
  questionId: string;
  type: TypeQuestion;
  pointsObtenus: number;
  pointsMax: number;
  isCorrect: boolean;           // Totalement correct ?
  isPartiel?: boolean;          // Partiellement correct ? (QCM multiple)
  correctionManuelleRequise?: boolean; // Pour les essais
  commentaireProf?: string;     // Feedback du prof (essais)
}

// ==================== UTILITAIRES ====================

/**
 * Labels pour les types de questions (affichage UI)
 */
export const TYPE_QUESTION_LABELS: Record<TypeQuestion, string> = {
  qcm_unique: 'QCM — Choix unique',
  qcm_multiple: 'QCM — Choix multiple',
  drag_drop: 'Glisser-Déposer',
  mise_en_relation: 'Mise en relation',
  essai: 'Essai / Rédaction',
};

/**
 * Icônes pour chaque type de question
 */
export const TYPE_QUESTION_ICONS: Record<TypeQuestion, string> = {
  qcm_unique: '🔘',
  qcm_multiple: '☑️',
  drag_drop: '↕️',
  mise_en_relation: '🔗',
  essai: '✍️',
};

/**
 * Couleurs badge par type
 */
export const TYPE_QUESTION_COLORS: Record<TypeQuestion, string> = {
  qcm_unique: '#2563eb',
  qcm_multiple: '#7c3aed',
  drag_drop: '#059669',
  mise_en_relation: '#d97706',
  essai: '#dc2626',
};

/**
 * Génère un ID unique pour les éléments
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crée une question vide selon le type choisi
 */
export function creerQuestionVide(type: TypeQuestion, ordre: number): QuestionAvancee {
  const base = {
    id: generateId('q'),
    type,
    enonce: '',
    difficulte: 'moyen' as DifficulteQuestion,
    points: 2,
    ordre,
  };

  switch (type) {
    case 'qcm_unique':
      return {
        ...base,
        typeData: {
          options: [
            { id: generateId('opt'), texte: '', isCorrect: true },
            { id: generateId('opt'), texte: '', isCorrect: false },
            { id: generateId('opt'), texte: '', isCorrect: false },
            { id: generateId('opt'), texte: '', isCorrect: false },
          ],
        } as QCMUniqueData,
      };

    case 'qcm_multiple':
      return {
        ...base,
        typeData: {
          options: [
            { id: generateId('opt'), texte: '', isCorrect: true },
            { id: generateId('opt'), texte: '', isCorrect: true },
            { id: generateId('opt'), texte: '', isCorrect: false },
            { id: generateId('opt'), texte: '', isCorrect: false },
          ],
          scoringPartiel: true,
        } as QCMMultipleData,
      };

    case 'drag_drop':
      return {
        ...base,
        typeData: {
          items: [
            { id: generateId('item'), texte: '', ordreCorrect: 1 },
            { id: generateId('item'), texte: '', ordreCorrect: 2 },
            { id: generateId('item'), texte: '', ordreCorrect: 3 },
          ],
          consigneOrdre: 'Remettez les éléments dans le bon ordre',
        } as DragDropData,
      };

    case 'mise_en_relation':
      return {
        ...base,
        typeData: {
          paires: [
            { id: generateId('pair'), gauche: '', droite: '' },
            { id: generateId('pair'), gauche: '', droite: '' },
            { id: generateId('pair'), gauche: '', droite: '' },
          ],
        } as MiseEnRelationData,
      };

    case 'essai':
      return {
        ...base,
        points: 5,
        typeData: {
          nombreMotsMin: 50,
          nombreMotsMax: 500,
          motsCles: [],
          correctionMode: 'manuelle',
        } as EssaiData,
      };
  }
}
