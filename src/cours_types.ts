// ============================================================
// PedaClic — Phase 24 : Types — Cours en Ligne
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Compatible avec les types des Phases 21-23 :
//   - CahierTextes, EntreeCahier, GroupeProf  (cahierTextes.types.ts)
//   - SequencePedagogique                     (sequencePedagogique_types.ts)
// ============================================================

import { Timestamp } from 'firebase/firestore';
import { CLASSES, Classe } from './types/cahierTextes.types';

// ------------------------------------------------------------
// TYPES DE BLOCS DE CONTENU
// Chaque section d'un cours est composée de blocs modulaires.
// Le prof les crée/réordonne via drag-and-drop dans l'éditeur.
// ------------------------------------------------------------

/** Types de blocs disponibles dans l'éditeur */
export type TypeBloc =
  | 'texte'     // Paragraphe texte riche (gras, italique, listes)
  | 'image'     // Image avec légende (Firebase Storage)
  | 'video'     // Vidéo YouTube (embed iframe)
  | 'encadre'   // Boîte colorée (définition, remarque, attention, astuce)
  | 'quiz'      // Mini-quiz de validation (QCM)
  | 'exercice'; // Exercice avec correction cachée

/** Variantes d'encadrés pédagogiques */
export type TypeEncadre =
  | 'definition'  // Fond bleu clair — définition d'un concept
  | 'remarque'    // Fond jaune — point d'attention
  | 'attention'   // Fond rouge clair — erreur fréquente à éviter
  | 'astuce'      // Fond vert clair — conseil ou raccourci
  | 'exemple';    // Fond gris — exemple concret

// ------------------------------------------------------------
// INTERFACES DES BLOCS
// Chaque type de bloc a sa propre interface.
// Tous partagent les champs communs via BlocBase.
// ------------------------------------------------------------

/** Champs communs à tous les blocs */
interface BlocBase {
  /** Identifiant unique généré côté client (crypto.randomUUID) */
  id: string;
  /** Type du bloc — détermine le rendu */
  type: TypeBloc;
  /** Ordre d'affichage dans la section (commence à 0) */
  ordre: number;
  /** Vrai si ce bloc est réservé aux abonnés Premium */
  isPremium: boolean;
}

/** Bloc texte — paragraphes formatés */
export interface BlocTexte extends BlocBase {
  type: 'texte';
  /** Contenu en Markdown simplifié : **gras**, *italique*, - liste */
  contenu: string;
}

/** Bloc image — illustration pédagogique */
export interface BlocImage extends BlocBase {
  type: 'image';
  /** URL Firebase Storage de l'image */
  url: string;
  /** Texte alternatif pour l'accessibilité */
  alt: string;
  /** Légende affichée sous l'image */
  legende?: string;
}

/** Bloc vidéo — YouTube uniquement */
export interface BlocVideo extends BlocBase {
  type: 'video';
  /** URL YouTube complète (ex : https://www.youtube.com/watch?v=...) */
  urlYoutube: string;
  /** Titre de la vidéo (affiché au-dessus) */
  titre: string;
  /** Description courte optionnelle */
  description?: string;
}

/** Bloc encadré — mise en valeur pédagogique */
export interface BlocEncadre extends BlocBase {
  type: 'encadre';
  /** Variante visuelle de l'encadré */
  variante: TypeEncadre;
  /** Titre de l'encadré (ex: "Définition", "Attention !") */
  titre: string;
  /** Contenu texte de l'encadré */
  contenu: string;
}

/** Une option de réponse dans le mini-quiz */
export interface OptionQuiz {
  id: string;
  texte: string;
  estCorrecte: boolean;
}

/** Bloc quiz — question à choix multiple */
export interface BlocQuiz extends BlocBase {
  type: 'quiz';
  /** Intitulé de la question */
  question: string;
  /** Options de réponse (2 à 4) */
  options: OptionQuiz[];
  /** Explication affichée après la réponse */
  explication?: string;
}

/** Bloc exercice — problème avec correction masquée */
export interface BlocExercice extends BlocBase {
  type: 'exercice';
  /** Énoncé de l'exercice */
  enonce: string;
  /** Correction (masquée jusqu'au clic de l'élève) */
  correction: string;
  /** Niveau de difficulté */
  difficulte: 'facile' | 'moyen' | 'difficile';
  /** Points attribués à cet exercice (optionnel) */
  points?: number;
}

/** Union de tous les types de blocs */
export type BlocContenu =
  | BlocTexte
  | BlocImage
  | BlocVideo
  | BlocEncadre
  | BlocQuiz
  | BlocExercice;

// ------------------------------------------------------------
// SECTION DE COURS
// Un cours est divisé en sections.
// Collection Firestore : "cours_sections" (sous-collection ou indépendante)
// Chaque section contient un tableau de blocs.
// ------------------------------------------------------------

export interface SectionCours {
  /** ID Firestore */
  id: string;
  /** ID du cours parent */
  coursId: string;
  /** Titre de la section (ex: "I. Introduction", "II. Théorème de Thalès") */
  titre: string;
  /** Ordre d'affichage dans le cours (commence à 1) */
  ordre: number;
  /** Tableau de blocs de contenu (ordonné par bloc.ordre) */
  blocs: BlocContenu[];
  /** Durée estimée de lecture/travail en minutes */
  dureeEstimee: number;
  /** La 1ère section est toujours gratuite — les suivantes respectent isPremium du cours */
  estGratuite: boolean;
  /** Date de création */
  createdAt: Timestamp;
  /** Date de dernière modification */
  updatedAt: Timestamp;
}

// ------------------------------------------------------------
// COURS EN LIGNE — Document principal
// Collection Firestore : "cours_en_ligne"
// ------------------------------------------------------------

/** Statut de publication d'un cours */
export type StatutCours =
  | 'brouillon'   // En cours de création (visible prof seul)
  | 'publie'      // Visible dans le catalogue public
  | 'archive';    // Retiré du catalogue (conservé pour historique)

/**
 * Niveau scolaire sénégalais.
 * Source unique : type Classe de cahierTextes.types.ts.
 * Garantit la cohérence entre Cours en ligne et Cahier de textes.
 */
export type NiveauCours = Classe;

export interface CoursEnLigne {
  /** ID Firestore (généré automatiquement) */
  id: string;

  // ── Informations pédagogiques ──────────────────────────────

  /** Titre du cours (ex: "Les fonctions affines — Terminale") */
  titre: string;
  /** Description courte pour le catalogue */
  description: string;
  /** Matière (ex: "Mathématiques") */
  matiere: string;
  /** Niveau scolaire */
  niveau: NiveauCours | string;
  /** Classe optionnelle (ex: "TS", "3ème A") */
  classe?: string;

  // ── Auteur ─────────────────────────────────────────────────

  /** UID du professeur créateur */
  profId: string;
  /** Nom affiché du professeur (dénormalisé) */
  profNom: string;

  // ── Accès et monétisation ──────────────────────────────────

  /**
   * Si true : les sections (hors 1ère) nécessitent un abonnement Premium.
   * Dépend de la matière — aligné avec la logique existante `isPremium` de la plateforme.
   */
  isPremium: boolean;
  /** Statut de publication */
  statut: StatutCours;

  // ── Médias ─────────────────────────────────────────────────

  /** URL de l'image de couverture (Firebase Storage ou URL externe) */
  couvertureUrl?: string;

  // ── Statistiques ───────────────────────────────────────────

  /** Durée totale estimée en minutes (somme des sections) */
  dureeEstimee: number;
  /** Nombre de sections */
  nombreSections: number;
  /** Nombre d'élèves ayant commencé ce cours */
  nombreInscrits: number;

  // ── Objectifs pédagogiques ─────────────────────────────────

  /** Objectifs d'apprentissage (affiché en haut de page cours) */
  objectifs: string[];
  /** Prérequis conseillés */
  prerequis?: string;
  /** Tags pour la recherche (ex: ["BFEM", "géométrie", "vecteurs"]) */
  tags: string[];

  // ── Métadonnées ────────────────────────────────────────────

  /** Date de création */
  createdAt: Timestamp;
  /** Date de dernière modification */
  updatedAt: Timestamp;
  /** Date de publication (null si brouillon) */
  publieAt?: Timestamp;
}

// ------------------------------------------------------------
// PROGRESSION ÉLÈVE
// Collection Firestore : "progression_cours"
// Clé : "{userId}_{coursId}" pour unicité et requêtes efficaces
// ------------------------------------------------------------

/** Réponse d'un élève à un bloc quiz */
export interface ReponseQuiz {
  /** ID du bloc quiz */
  blocId: string;
  /** ID de l'option choisie */
  optionChoisieId: string;
  /** True si la réponse est correcte */
  estCorrecte: boolean;
  /** Timestamp de la réponse */
  reponduAt: Timestamp;
}

export interface ProgressionCours {
  /** ID Firestore (généré automatiquement) */
  id: string;
  /** UID de l'élève */
  userId: string;
  /** ID du cours */
  coursId: string;
  /** IDs des sections complètement lues */
  sectionsLues: string[];
  /** Réponses aux quiz */
  reponsesQuiz: ReponseQuiz[];
  /** Pourcentage de complétion (0 à 100) */
  pourcentageProgression: number;
  /** Score total aux quiz (sur 100) */
  scoreQuiz: number;
  /** Nombre de tentatives quiz */
  tentativesQuiz: number;
  /** Date de début du cours */
  debutLe: Timestamp;
  /** Date du dernier accès */
  dernierAcces: Timestamp;
  /** True si le cours est terminé (toutes sections lues) */
  estTermine: boolean;
}

// ------------------------------------------------------------
// FORMULAIRE — État du formulaire de création/édition cours
// Omet les champs auto-gérés côté serveur
// ------------------------------------------------------------

export type CoursFormData = Omit<
  CoursEnLigne,
  'id' | 'profId' | 'profNom' | 'createdAt' | 'updatedAt' | 'publieAt'
    | 'nombreInscrits' | 'nombreSections'
>;

export type SectionFormData = Omit<
  SectionCours,
  'id' | 'coursId' | 'createdAt' | 'updatedAt'
>;

// ------------------------------------------------------------
// FILTRES — Pour le catalogue et la liste prof
// ------------------------------------------------------------

export interface FiltresCours {
  matiere?: string;
  niveau?: string;
  statut?: StatutCours | '';
  isPremium?: boolean | '';
  recherche?: string;
}

// ------------------------------------------------------------
// CONSTANTES — Labels et couleurs
// ------------------------------------------------------------

/** Labels des types de blocs pour l'éditeur */
export const LABELS_TYPE_BLOC: Record<TypeBloc, { label: string; emoji: string; description: string }> = {
  texte:    { label: 'Texte',     emoji: '📝', description: 'Paragraphe formaté' },
  image:    { label: 'Image',     emoji: '🖼️', description: 'Image avec légende' },
  video:    { label: 'Vidéo',     emoji: '▶️', description: 'Vidéo YouTube' },
  encadre:  { label: 'Encadré',   emoji: '📌', description: 'Définition, remarque, astuce...' },
  quiz:     { label: 'Quiz',      emoji: '❓', description: 'Question à choix multiple' },
  exercice: { label: 'Exercice',  emoji: '✏️', description: 'Problème avec correction' },
};

/** Couleurs et icônes des variantes d'encadrés */
export const CONFIG_ENCADRE: Record<TypeEncadre, { label: string; emoji: string; bg: string; border: string; color: string }> = {
  definition: { label: 'Définition', emoji: '📖', bg: '#eff6ff', border: '#2563eb', color: '#1d4ed8' },
  remarque:   { label: 'Remarque',   emoji: '💡', bg: '#fefce8', border: '#ca8a04', color: '#854d0e' },
  attention:  { label: 'Attention',  emoji: '⚠️', bg: '#fef2f2', border: '#dc2626', color: '#991b1b' },
  astuce:     { label: 'Astuce',     emoji: '✨', bg: '#f0fdf4', border: '#16a34a', color: '#15803d' },
  exemple:    { label: 'Exemple',    emoji: '📐', bg: '#f8fafc', border: '#64748b', color: '#475569' },
};

/**
 * Niveaux scolaires pour les Cours en ligne.
 * Dérivés de CLASSES (cahierTextes.types.ts) — source unique partagée.
 * Les labels enrichis (BFEM, BAC) sont ajoutés ici pour le contexte cours.
 */
export const NIVEAUX_COURS: Array<{ valeur: Classe; label: string }> = CLASSES.map(c => ({
  valeur: c,
  label:
    c === '3ème'      ? '3ème (BFEM)'      :
    c === 'Terminale' ? 'Terminale (BAC)'  :
    c,
}));

/** Matières du programme sénégalais */
export const MATIERES_COURS = [
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
  'Informatique',
  'Arabe',
] as const;

/** Config des couleurs des statuts */
export const CONFIG_STATUT_COURS: Record<StatutCours, { label: string; couleur: string; bg: string }> = {
  brouillon: { label: 'Brouillon', couleur: '#6b7280', bg: '#f3f4f6' },
  publie:    { label: 'Publié',    couleur: '#16a34a', bg: '#f0fdf4' },
  archive:   { label: 'Archivé',   couleur: '#9ca3af', bg: '#f9fafb' },
};
