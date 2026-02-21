// ============================================================
// PedaClic — Phase 23 : Types — Générateur de Séquences Pédagogiques
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Ces types s'intègrent avec les types existants des Phases 21-22 :
//   - CahierTextes, EntreeCahier, GroupeProf (cahierTextes.types.ts)
// ============================================================

import { Timestamp } from 'firebase/firestore';

// ------------------------------------------------------------
// ÉNUMÉRATIONS — Types d'activités et d'évaluations
// Alignés sur les pratiques pédagogiques sénégalaises
// ------------------------------------------------------------

/** Type d'activité d'une séance */
export type TypeActivite =
  | 'cours'        // Cours magistral
  | 'td'           // Travaux Dirigés
  | 'tp'           // Travaux Pratiques
  | 'evaluation'   // Devoir / Contrôle
  | 'revision'     // Révision / Consolidation
  | 'projet'       // Travail de groupe / Projet
  | 'correction';  // Correction de devoir

/** Type d'évaluation (aligné sur le système sénégalais) */
export type TypeEvaluation =
  | 'formative'    // Évaluation formative (en cours d'apprentissage)
  | 'sommative'    // Évaluation sommative (bilan)
  | 'diagnostique' // Évaluation diagnostique (pré-requis)
  | 'devoir'       // Devoir sur table
  | 'composition'  // Composition trimestrielle (BFEM/BAC)
  | 'interrogation'; // Interrogation courte

/** Statut d'une séquence */
export type StatutSequence =
  | 'brouillon'  // En cours de création
  | 'active'     // En cours de réalisation
  | 'terminee'   // Séquence complétée
  | 'archivee';  // Archivée

/** Niveau scolaire sénégalais */
export type NiveauScolaire =
  | '6eme' | '5eme' | '4eme' | '3eme'           // Collège
  | '2nde' | '1ere' | 'terminale';               // Lycée

// ------------------------------------------------------------
// SÉANCE PÉDAGOGIQUE
// Représente une séance individuelle dans la séquence.
// Embarquée dans le document SequencePedagogique (pas de sous-collection).
// ------------------------------------------------------------

export interface SeancePedagogique {
  /** Identifiant unique local (généré côté client via crypto.randomUUID) */
  id: string;

  /** Numéro d'ordre dans la séquence (1, 2, 3...) */
  numero: number;

  /** Titre court de la séance (ex: "Introduction aux vecteurs") */
  titre: string;

  /** Durée estimée en minutes */
  dureeMinutes: number;

  /** Objectif spécifique de CETTE séance */
  objectifSpecifique: string;

  /** Contenu détaillé / déroulement pédagogique */
  contenu: string;

  /** Supports, matériel, ressources nécessaires */
  ressources: string[];

  /** Type d'activité de la séance */
  typeActivite: TypeActivite;

  /** Vrai si cette séance est une évaluation */
  estEvaluation: boolean;

  /** Type d'évaluation (si estEvaluation = true) */
  typeEvaluation?: TypeEvaluation;

  /** Note maximale (si estEvaluation = true) */
  noteMax?: number;

  /** Coefficient (si estEvaluation = true) */
  coefficient?: number;

  /**
   * Si true, cette séance sera incluse lors de l'export vers le Cahier de Textes.
   * Cochée par défaut, le prof peut décocher les séances à exclure.
   */
  exporterVersCahier: boolean;

  /**
   * IDs des entrées du Cahier de Textes créées lors de l'export.
   * Rempli automatiquement après exporterVersCahier().
   */
  entreesCahierIds?: string[];

  /** Date prévue pour cette séance (optionnel, utile pour le planning) */
  datePrevue?: Timestamp;
}

// ------------------------------------------------------------
// ÉVALUATION PRÉVUE (synthèse)
// Récapitulatif des évaluations de la séquence.
// Généré automatiquement à partir des séances estEvaluation=true.
// ------------------------------------------------------------

export interface EvaluationPrevue {
  /** ID unique de l'évaluation (même que la séance correspondante) */
  id: string;

  /** Titre de l'évaluation */
  titre: string;

  /** Type d'évaluation */
  type: TypeEvaluation;

  /** Numéro de la séance où elle a lieu */
  seanceNumero: number;

  /** Note maximale */
  noteMax: number;

  /** Coefficient */
  coefficient: number;

  /** Date prévue (optionnel) */
  datePrevue?: Timestamp;
}

// ------------------------------------------------------------
// SÉQUENCE PÉDAGOGIQUE — Document principal
// Collection Firestore : "sequences_pedagogiques"
// Une séquence = une progression sur un thème donné,
// découpée en séances et liée optionnellement à un groupe/cahier.
// ------------------------------------------------------------

export interface SequencePedagogique {
  /** ID Firestore (généré automatiquement) */
  id: string;

  /** UID du professeur propriétaire */
  profId: string;

  // ── Informations pédagogiques ──────────────────────────────

  /** Titre de la séquence (ex: "Les fonctions affines") */
  titre: string;

  /** Description courte (contexte, positionnement dans le programme) */
  description: string;

  /** Niveau scolaire (ex: "3eme", "terminale") */
  niveau: NiveauScolaire | string;

  /** Matière (ex: "Mathématiques", "SVT", "Philosophie") */
  matiere: string;

  /** Thème du programme officiel sénégalais */
  theme: string;

  /** Compétences visées par la séquence (tableau de chaînes) */
  competences: string[];

  /** Objectif général de la séquence */
  objectifGeneral: string;

  /** Prérequis nécessaires pour aborder cette séquence */
  prerequis: string;

  // ── Planning ───────────────────────────────────────────────

  /** Nombre total de séances prévu */
  nombreSeances: number;

  /** Durée standard d'une séance en minutes (ex: 55 pour lycée sénégalais) */
  dureeSeanceMinutes: number;

  /** Trimestre (1, 2 ou 3) */
  trimestre?: 1 | 2 | 3;

  /** Date de début prévue */
  dateDebut?: Timestamp;

  /** Date de fin prévue */
  dateFin?: Timestamp;

  // ── Contenu : séances et évaluations ──────────────────────

  /**
   * Tableau des séances (embarqué dans le document).
   * Taille max recommandée : 25 séances (~limite Firestore 1 Mo).
   */
  seances: SeancePedagogique[];

  /**
   * Synthèse des évaluations prévues.
   * Générée automatiquement à partir de seances.estEvaluation.
   */
  evaluationsPrevues: EvaluationPrevue[];

  // ── Liens optionnels ───────────────────────────────────────

  /** ID du groupe-classe lié (optionnel) */
  groupeClasseId?: string;

  /**
   * Nom du groupe-classe (dénormalisé pour éviter une lecture supplémentaire).
   * Ex: "3ème A", "Terminale S"
   */
  groupeClasseNom?: string;

  /** ID du Cahier de Textes lié (optionnel) */
  cahierDeTextesId?: string;

  /**
   * Titre du Cahier de Textes (dénormalisé).
   * Ex: "Mathématiques 3ème A - 2025-2026"
   */
  cahierDeTextesNom?: string;

  // ── Statut et génération ───────────────────────────────────

  /** Statut de la séquence */
  statut: StatutSequence;

  /** Vrai si la séquence a été générée (même partiellement) par l'IA */
  genereeParIA: boolean;

  /**
   * Prompt utilisé lors de la génération IA (stocké pour audit/ré-utilisation).
   * Absent si la séquence est 100% manuelle.
   */
  promptIA?: string;

  // ── Métadonnées ────────────────────────────────────────────

  /** Date de création */
  createdAt: Timestamp;

  /** Date de dernière modification */
  updatedAt: Timestamp;

  /**
   * Date du dernier export vers le Cahier de Textes.
   * Absent si jamais exporté.
   */
  exporteAt?: Timestamp;
}

// ------------------------------------------------------------
// FORMULAIRE — État du formulaire de création/édition
// Omet les champs auto-gérés (id, profId, createdAt, updatedAt)
// ------------------------------------------------------------

export type SequenceFormData = Omit<
  SequencePedagogique,
  'id' | 'profId' | 'createdAt' | 'updatedAt' | 'exporteAt'
>;

// ------------------------------------------------------------
// RÉPONSE IA — Structure retournée par le backend Railway/Claude
// Le backend valide et retourne ce JSON.
// Le client l'injecte dans le formulaire après validation.
// ------------------------------------------------------------

export interface SequenceIAResponse {
  /** Titre suggéré par l'IA */
  titre: string;

  /** Description suggérée */
  description: string;

  /** Objectif général suggéré */
  objectifGeneral: string;

  /** Prérequis suggérés */
  prerequis: string;

  /** Compétences visées suggérées */
  competences: string[];

  /** Séances suggérées (sans les champs de tracking : exporterVersCahier, entreesCahierIds, datePrevue) */
  seances: Array<{
    numero: number;
    titre: string;
    dureeMinutes: number;
    objectifSpecifique: string;
    contenu: string;
    ressources: string[];
    typeActivite: TypeActivite;
    estEvaluation: boolean;
    typeEvaluation?: TypeEvaluation;
    noteMax?: number;
    coefficient?: number;
  }>;
}

// ------------------------------------------------------------
// FILTRE — Pour la liste des séquences
// ------------------------------------------------------------

export interface SequenceFilters {
  matiere?: string;
  niveau?: string;
  statut?: StatutSequence | '';
  groupeClasseId?: string;
  recherche?: string;
}

// ------------------------------------------------------------
// CONSTANTES UTILES
// ------------------------------------------------------------

/** Labels d'affichage pour les types d'activités */
export const LABELS_TYPE_ACTIVITE: Record<TypeActivite, string> = {
  cours:       'Cours',
  td:          'TD',
  tp:          'TP',
  evaluation:  'Évaluation',
  revision:    'Révision',
  projet:      'Projet',
  correction:  'Correction',
};

/** Labels d'affichage pour les types d'évaluations */
export const LABELS_TYPE_EVALUATION: Record<TypeEvaluation, string> = {
  formative:     'Formative',
  sommative:     'Sommative',
  diagnostique:  'Diagnostique',
  devoir:        'Devoir sur table',
  composition:   'Composition (BFEM/BAC)',
  interrogation: 'Interrogation',
};

/** Labels et couleurs pour les statuts */
export const CONFIG_STATUT: Record<StatutSequence, { label: string; couleur: string }> = {
  brouillon: { label: 'Brouillon',    couleur: '#6b7280' }, // gris
  active:    { label: 'En cours',     couleur: '#2563eb' }, // bleu PedaClic
  terminee:  { label: 'Terminée',     couleur: '#16a34a' }, // vert
  archivee:  { label: 'Archivée',     couleur: '#9ca3af' }, // gris clair
};

/** Niveaux scolaires avec labels lisibles */
export const NIVEAUX_SCOLAIRES: Array<{ valeur: NiveauScolaire; label: string }> = [
  { valeur: '6eme',      label: '6ème' },
  { valeur: '5eme',      label: '5ème' },
  { valeur: '4eme',      label: '4ème' },
  { valeur: '3eme',      label: '3ème (BFEM)' },
  { valeur: '2nde',      label: '2nde' },
  { valeur: '1ere',      label: '1ère' },
  { valeur: 'terminale', label: 'Terminale (BAC)' },
];

/** Durées standard des séances au Sénégal */
export const DUREES_SEANCE = [30, 45, 55, 60, 90, 120] as const;

/** Matières principales du programme sénégalais */
export const MATIERES_SENEGAL = [
  'Mathématiques',
  'Français',
  'Sciences de la Vie et de la Terre (SVT)',
  'Histoire-Géographie',
  'Physique-Chimie',
  'Anglais',
  'Philosophie',
  'Sciences Économiques et Sociales',
  'Éducation Civique',
  'Arts Plastiques',
  'Éducation Physique et Sportive',
] as const;
