// ============================================================
// PedaClic — Cahier de Textes : Types complets
// Phase 21 (base intacte) + Phase 22 (groupes, médias enrichis)
// ============================================================

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────────────────────
export type Classe =
  | 'PS' | 'MS' | 'GS'
  | 'CI' | 'CP' | 'CE1' | 'CE2' | 'CM1' | 'CM2'
  | '6ème' | '5ème' | '4ème' | '3ème'
  | '2nde' | '1ère' | 'Terminale';

export const CLASSES: Classe[] = [
  'PS', 'MS', 'GS',
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6ème', '5ème', '4ème', '3ème',
  '2nde', '1ère', 'Terminale',
];

export const CLASSES_MATERNELLE: Classe[] = ['PS', 'MS', 'GS'];
export const CLASSES_ELEMENTAIRE: Classe[] = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

/**
 * Options pour sélecteurs (valeur + label) — source unique Cahier, Médiathèque, Premium, Cours.
 * Labels simples : 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Terminale (sans BFEM/BAC).
 */
export const CLASSES_OPTIONS: Array<{ valeur: Classe; label: string }> = CLASSES.map((c) => ({
  valeur: c,
  label: c,
}));

/**
 * Normalise une valeur classe pour comparaison (rétrocompat avec ancien format sans accents).
 * Utilisé pour filtrage Ebooks, Disciplines, etc.
 */
export function normaliserClassePourComparaison(classe: string | undefined): string {
  if (!classe) return '';
  const m: Record<string, string> = {
    '6eme': '6ème', '5eme': '5ème', '4eme': '4ème', '3eme': '3ème',
    '1ere': '1ère',
  };
  return m[classe] || classe;
}

/** Groupes par cycle */
export const CLASSES_MATERNELLE_OPTIONS = CLASSES_OPTIONS.filter((c) =>
  ['PS', 'MS', 'GS'].includes(c.valeur)
);
export const CLASSES_ELEMENTAIRE_OPTIONS = CLASSES_OPTIONS.filter((c) =>
  ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].includes(c.valeur)
);
export const CLASSES_COLLEGE_OPTIONS = CLASSES_OPTIONS.filter((c) =>
  ['6ème', '5ème', '4ème', '3ème'].includes(c.valeur)
);
export const CLASSES_LYCEE_OPTIONS = CLASSES_OPTIONS.filter((c) =>
  ['2nde', '1ère', 'Terminale'].includes(c.valeur)
);

/** Mapping NiveauScolaire → classes correspondantes (pour sélecteurs en cascade) */
export type NiveauScolaire = 'maternelle' | 'elementaire' | 'college' | 'lycee';

export const CLASSES_PAR_NIVEAU: Record<NiveauScolaire, Array<{ valeur: Classe; label: string }>> = {
  maternelle: CLASSES_MATERNELLE_OPTIONS,
  elementaire: CLASSES_ELEMENTAIRE_OPTIONS,
  college: CLASSES_COLLEGE_OPTIONS,
  lycee: CLASSES_LYCEE_OPTIONS,
};

export const NIVEAUX_SCOLAIRES: Array<{ valeur: NiveauScolaire; label: string; emoji: string }> = [
  { valeur: 'maternelle', label: 'Maternelle', emoji: '🧒' },
  { valeur: 'elementaire', label: 'Élémentaire', emoji: '📖' },
  { valeur: 'college', label: 'Collège', emoji: '🏫' },
  { valeur: 'lycee', label: 'Lycée', emoji: '🎓' },
];

// ─────────────────────────────────────────────────────────────
// MATIÈRES
// ─────────────────────────────────────────────────────────────
export const MATIERES = [
  'Mathématiques', 'Français', 'Physique-Chimie', 'SVT',
  'Histoire-Géographie', 'Anglais', 'Philosophie', 'Économie',
  'Comptabilité', 'Arabe', 'Espagnol', 'Informatique',
  'Éducation civique', 'Littérature', 'Arts plastiques', 'EPS',
] as const;
export type Matiere = typeof MATIERES[number];

// ─────────────────────────────────────────────────────────────
// ANNÉES SCOLAIRES
// ─────────────────────────────────────────────────────────────
export const ANNEES_SCOLAIRES = [
  '2023-2024', '2024-2025', '2025-2026', '2026-2027',
] as const;
export type AnneeScolaire = typeof ANNEES_SCOLAIRES[number];

// ─────────────────────────────────────────────────────────────
// COULEURS DU CAHIER (Phase 21 — palette complète)
// ─────────────────────────────────────────────────────────────
export const COULEURS_CAHIER = [
  '#2563eb', // Bleu PedaClic
  '#7c3aed', // Violet
  '#059669', // Vert
  '#d97706', // Ambre
  '#dc2626', // Rouge
  '#0891b2', // Cyan
  '#db2777', // Rose
  '#65a30d', // Lime
] as const;

// ─────────────────────────────────────────────────────────────
// TYPES DE CONTENU (Phase 21)
// ─────────────────────────────────────────────────────────────
export type TypeContenu =
  | 'cours' | 'exercices' | 'correction'
  | 'devoir_surveille' | 'devoir_maison'
  | 'travaux_pratiques' | 'evaluation' | 'revision'
  | 'compte_rendu' | 'expose' | 'debats_discussions';

export const TYPE_CONTENU_CONFIG: Record<TypeContenu, { label: string; emoji: string; color: string }> = {
  cours:             { label: 'Cours',              emoji: '📘', color: '#3b82f6' },
  exercices:         { label: 'Exercices',           emoji: '📝', color: '#8b5cf6' },
  correction:        { label: 'Correction',          emoji: '✅', color: '#10b981' },
  devoir_surveille:  { label: 'Devoir surveillé',   emoji: '📋', color: '#f59e0b' },
  devoir_maison:     { label: 'Devoir à la maison', emoji: '📖', color: '#6366f1' },
  travaux_pratiques: { label: 'Travaux pratiques',  emoji: '🔬', color: '#14b8a6' },
  evaluation:        { label: 'Évaluation',          emoji: '📊', color: '#ef4444' },
  revision:          { label: 'Révision',            emoji: '🔄', color: '#f97316' },
  compte_rendu:     { label: 'Compte rendu',        emoji: '📝', color: '#0ea5e9' },
  expose:            { label: 'Exposé',              emoji: '🎤', color: '#a855f7' },
  debats_discussions:{ label: 'Débats/Discussions', emoji: '💬', color: '#ec4899' },
};

// ─────────────────────────────────────────────────────────────
// STATUT DE SÉANCE (Phase 21)
// ─────────────────────────────────────────────────────────────
export type StatutSeance = 'realise' | 'planifie' | 'annule' | 'reporte';
// Alias Phase 22 (sous-ensemble compatible)
export type StatutEntree = 'planifie' | 'realise' | 'annule';

export const STATUT_CONFIG: Record<StatutSeance, { label: string; color: string; bg: string }> = {
  realise:  { label: 'Réalisé',  color: '#059669', bg: '#d1fae5' },
  planifie: { label: 'Planifié', color: '#d97706', bg: '#fef3c7' },
  annule:   { label: 'Annulé',   color: '#dc2626', bg: '#fee2e2' },
  reporte:  { label: 'Reporté',  color: '#2563eb', bg: '#dbeafe' },
};

// ─────────────────────────────────────────────────────────────
// ÉVALUATION / SIGNETS (Phase 21)
// ─────────────────────────────────────────────────────────────
export type TypeEvaluation = 'interro' | 'ds' | 'examen' | 'oral' | 'autre';
export type StatutEvaluation = 'a_evaluer' | 'evaluation_creee' | 'evaluation_terminee';

export const TYPE_EVAL_LABELS: Record<TypeEvaluation, string> = {
  interro: 'Interrogation',
  ds:      'Devoir Surveillé',
  examen:  'Examen',
  oral:    'Oral',
  autre:   'Autre',
};

// ─────────────────────────────────────────────────────────────
// RAPPELS (Phase 21)
// ─────────────────────────────────────────────────────────────
export type TypeRappel = 'devoir' | 'evaluation' | 'notes' | 'cours' | 'personnalise';
export type Recurrence = 'unique' | 'quotidien' | 'hebdomadaire';
export type Priorite   = 'normale' | 'urgente';

export const TYPE_RAPPEL_CONFIG: Record<TypeRappel, { label: string; emoji: string }> = {
  devoir:       { label: 'Devoir à corriger',    emoji: '📋' },
  evaluation:   { label: 'Évaluation à préparer', emoji: '📊' },
  notes:        { label: 'Notes à saisir',        emoji: '📝' },
  cours:        { label: 'Cours à préparer',      emoji: '📖' },
  personnalise: { label: 'Rappel personnalisé',   emoji: '🔔' },
};

// ─────────────────────────────────────────────────────────────
// PIÈCE JOINTE — fusionnée Phase 21 + Phase 22
// ─────────────────────────────────────────────────────────────
export type MediaType = 'pdf' | 'image' | 'audio' | 'video' | 'autre';

export interface PieceJointe {
  id?: string;         // Phase 22
  nom: string;         // Nom du fichier
  url: string;         // URL Firebase Storage
  type: string;        // MIME type (Phase 21) ou MediaType (Phase 22)
  taille?: number;     // Taille en octets
  mimeType?: string;   // Phase 22
  uploadedAt?: string; // Phase 21 — ISO date
}

// ─────────────────────────────────────────────────────────────
// PHASE 22 — LIEN EXTERNE
// ─────────────────────────────────────────────────────────────
export type LienType = 'video' | 'article' | 'exercice' | 'autre';

export interface LienExterne {
  id: string;
  titre: string;
  url: string;
  type: LienType;
  description?: string;
}

// ─────────────────────────────────────────────────────────────
// PHASE 22 — LIEN EBOOK
// ─────────────────────────────────────────────────────────────
export interface LienEbook {
  ebookId: string;
  titre: string;
  categorie: string;
  auteur?: string;
}

// ─────────────────────────────────────────────────────────────
// LIEN CONTENU IA (Phase 23 — Générateur IA)
// ─────────────────────────────────────────────────────────────
export interface LienContenuIA {
  contenuId: string;      // ID du document generated_content
  type: string;           // GenerationType (cours, exercices, quiz…)
  discipline: string;
  classe: string;
  chapitre: string;
  createdAt?: string;     // ISO string pour l'affichage
}

// ─────────────────────────────────────────────────────────────
// PHASE 29 — RUBRIQUE CAHIER (chapitre, unité thématique…)
// ─────────────────────────────────────────────────────────────

/** Statut d'avancement d'un titre (leçon) au sein d'une rubrique */
export type StatutTitre = 'non_commence' | 'en_cours' | 'acheve';

export const STATUT_TITRE_CONFIG: Record<StatutTitre, { label: string; emoji: string; color: string; bg: string }> = {
  non_commence: { label: 'Non commencé', emoji: '⬜', color: '#6b7280', bg: '#f3f4f6' },
  en_cours:     { label: 'En cours',     emoji: '🟡', color: '#d97706', bg: '#fef3c7' },
  acheve:       { label: 'Achevé',       emoji: '✅', color: '#059669', bg: '#d1fae5' },
};

/** Titre (leçon) à traiter au sein d'une rubrique */
export interface TitreRubrique {
  id: string;
  nom: string;
  ordre: number;
  statut: StatutTitre;
}

export interface RubriqueCahier {
  id: string;
  nom: string;
  ordre: number;
  couleur?: string;
  /** Nombre de séances prévues pour ce module (optionnel, rétrocompatible) */
  nombreSeancesPrevu?: number;
  /** Alias pour compatibilité avec données Firestore existantes */
  seancesPrevues?: number;
  /** Phase 33 — Titres (leçons) organisés dans cette rubrique */
  titres?: TitreRubrique[];
}

// ─────────────────────────────────────────────────────────────
// CAHIER DE TEXTES — Phase 21 + Phase 22 + Phase 29
// ─────────────────────────────────────────────────────────────
export interface CahierTextes {
  id: string;
  profId: string;
  classe: Classe;
  matiere: Matiere;
  anneeScolaire: AnneeScolaire;
  titre: string;
  description?: string;
  couleur: string;
  nombreSeancesPrevu: number;
  nombreSeancesRealise: number;
  isArchived: boolean;     // Phase 21 — avec 'd'
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Phase 22
  groupeIds: string[];
  groupeNoms: string[];
  isPartage: boolean;
  // Phase 29 — rubriques définies par le prof
  rubriques?: RubriqueCahier[];
  // Phase 31 — nombre de séances par jour (défaut 1)
  seancesParJour?: number;
}

export interface CahierFormData {
  classe: Classe;
  matiere: Matiere;
  anneeScolaire: AnneeScolaire;
  titre: string;
  description: string;
  couleur: string;
  nombreSeancesPrevu: number;
  // Phase 22
  groupeIds?: string[];
  groupeNoms?: string[];
  isPartage?: boolean;
  // Phase 31 — nombre de séances par jour (défaut 1)
  seancesParJour?: number;
}

// ─────────────────────────────────────────────────────────────
// ENTRÉE DU CAHIER (Séance) — Phase 21 + Phase 22
// ─────────────────────────────────────────────────────────────
export interface EntreeCahier {
  id: string;
  cahierId: string;
  profId: string;
  date: Timestamp;
  heureDebut?: string;
  heureFin?: string;
  chapitre: string;
  typeContenu: TypeContenu;
  contenu: string;
  objectifs?: string;
  competences?: string[];
  /** Sous-rubrique (liste configurable par l’admin, distincte du module du cahier) */
  rubrique?: string;
  statut: StatutSeance;
  motifAnnulation?: string;
  dateReport?: Timestamp;
  piecesJointes?: PieceJointe[];
  notesPrivees?: string;
  // Signets évaluation (Phase 21)
  isMarqueEvaluation: boolean;
  typeEvaluation?: TypeEvaluation;
  dateEvaluationPrevue?: Timestamp;
  statutEvaluation?: StatutEvaluation;
  ordre: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Phase 22
  liens?: LienExterne[];
  ebooksLies?: LienEbook[];
  // Phase 23
  contenuIA?: LienContenuIA[];
  // Phase 29 — ID de la rubrique (RubriqueCahier) à laquelle appartient cette entrée
  rubriqueId?: string | null;
  // ────────────────────────────────────────────────────────────
  // Phase 34 — Exercices liés à la leçon
  //   Chaque entrée peut porter deux blocs d'exercices distincts :
  //   exerciceJour     = Exercice d'application travaillé en classe
  //   exerciceDomicile = Exercice à faire à la maison
  //   Le contenu HTML riche est produit par le RichTextEditor.
  //   Champs optionnels pour rester rétrocompatibles avec les séances existantes.
  // ────────────────────────────────────────────────────────────
  exerciceJour?: string;
  exerciceDomicile?: string;
  /**
   * Phase 35 — Échéance optionnelle pour l'exercice à domicile.
   *   - `date` : YYYY-MM-DD
   *   - `heure` : HH:mm (24h)
   * Si défini et exerciceDomicile non vide, un TravailAFaire est créé
   * automatiquement pour chaque groupe du cahier (cf. upsertTravailDepuisExerciceDomicile).
   */
  echeanceDomicile?: { date: string; heure: string } | null;
  // ────────────────────────────────────────────────────────────
  // Phase 32 — Quiz rattachés à la séance
  //   Tableau de clés "<nature>:<id>" (ex: "classic:abc", "avance:xyz")
  //   maintenu par attacherQuizASeance / detacherQuizDeSeance.
  // ────────────────────────────────────────────────────────────
  quizIds?: string[];
}

export interface EntreeFormData {
  date: string;
  heureDebut: string;
  heureFin: string;
  chapitre: string;
  typeContenu: TypeContenu;
  contenu: string;
  objectifs: string;
  competences: string[];
  /** Sous-rubrique (liste admin), distincte du module du cahier */
  rubrique: string;
  statut: StatutSeance;
  motifAnnulation: string;
  dateReport: string;
  notesPrivees: string;
  isMarqueEvaluation: boolean;
  typeEvaluation: TypeEvaluation | '';
  dateEvaluationPrevue: string;
  statutEvaluation: StatutEvaluation;
  /** Phase 34 — Exercice d'application (travaillé en classe) */
  exerciceJour?: string;
  /** Phase 34 — Exercice à faire à la maison */
  exerciceDomicile?: string;
  /** Phase 35 — Échéance (date + heure) pour l'exercice à domicile (null = pas d'échéance) */
  echeanceDomicile?: { date: string; heure: string } | null;
}

// ─────────────────────────────────────────────────────────────
// RAPPEL PROF — Phase 21
// ─────────────────────────────────────────────────────────────
export interface RappelProf {
  id: string;
  profId: string;
  cahierId?: string;
  titre: string;
  description: string;
  typeRappel: TypeRappel;
  dateRappel: Timestamp;
  recurrence: Recurrence;
  priorite: Priorite;
  isLu: boolean;
  createdAt: Timestamp;
}

export interface RappelFormData {
  titre: string;
  description: string;
  typeRappel: TypeRappel;
  dateRappel: string;    // ISO datetime-local
  recurrence: Recurrence;
  priorite: Priorite;
  cahierId?: string;
}

// ─────────────────────────────────────────────────────────────
// COMPÉTENCES PRÉDÉFINIES (Phase 21 — EntreeEditorPage)
// ─────────────────────────────────────────────────────────────
export const COMPETENCES_PREDEFINIES = [
  'Communiquer à l\'écrit',
  'Communiquer à l\'oral',
  'Raisonner et résoudre des problèmes',
  'Chercher et s\'informer',
  'Modéliser',
  'Représenter',
  'Calculer et algorithmiser',
  'Analyser et interpréter',
  'Expérimenter et observer',
  'Coopérer et mutualiser',
] as const;

// ─────────────────────────────────────────────────────────────
// GROUPE PROF (Phase 11 — pour Phase 22)
// ─────────────────────────────────────────────────────────────
export interface GroupeProf {
  id: string;
  profId: string;
  nom: string;
  classe: string;
  codeInvitation: string;
  nombreInscrits: number;
  anneeScolaire: string;
  /** Statut du groupe — "actif" | "archive" (optionnel, rétrocompatible) */
  statut?: 'actif' | 'archive' | string;
}

// ─────────────────────────────────────────────────────────────
// EBOOK APERÇU (Phase 22)
// ─────────────────────────────────────────────────────────────
export interface EbookApercu {
  id: string;
  titre: string;
  auteur: string;
  categorie: string;
  couvertureUrl?: string;
}
