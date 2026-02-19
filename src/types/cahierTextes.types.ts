// ============================================================
// PHASE 21 — CAHIER DE TEXTES NUMÉRIQUE
// Types & Interfaces TypeScript
// PedaClic — www.pedaclic.sn
// ============================================================

import { Timestamp } from 'firebase/firestore';

// ─── Niveaux de classe ───────────────────────────────────────
export type Classe =
  | '6ème' | '5ème' | '4ème' | '3ème'
  | '2nde' | '1ère' | 'Terminale';

export const CLASSES: Classe[] = [
  '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'
];

// ─── Matières ───────────────────────────────────────────────
export const MATIERES = [
  'Mathématiques', 'Français', 'Physique-Chimie', 'SVT',
  'Histoire-Géographie', 'Anglais', 'Philosophie', 'Économie',
  'Comptabilité', 'Arabe', 'Espagnol', 'Informatique',
  'Éducation civique', 'Littérature', 'Arts plastiques', 'EPS'
] as const;
export type Matiere = typeof MATIERES[number];

// ─── Années scolaires ────────────────────────────────────────
export const ANNEES_SCOLAIRES = [
  '2023-2024', '2024-2025', '2025-2026', '2026-2027'
] as const;
export type AnneeScolaire = typeof ANNEES_SCOLAIRES[number];

// ─── Types de contenu ────────────────────────────────────────
export type TypeContenu =
  | 'cours' | 'exercices' | 'correction'
  | 'devoir_surveille' | 'devoir_maison'
  | 'travaux_pratiques' | 'evaluation' | 'revision';

export const TYPE_CONTENU_CONFIG: Record<TypeContenu, { label: string; emoji: string; color: string }> = {
  cours:             { label: 'Cours',              emoji: '📘', color: '#3b82f6' },
  exercices:         { label: 'Exercices',           emoji: '📝', color: '#8b5cf6' },
  correction:        { label: 'Correction',          emoji: '✅', color: '#10b981' },
  devoir_surveille:  { label: 'Devoir surveillé',   emoji: '📋', color: '#f59e0b' },
  devoir_maison:     { label: 'Devoir à la maison', emoji: '📖', color: '#6366f1' },
  travaux_pratiques: { label: 'Travaux pratiques',  emoji: '🔬', color: '#14b8a6' },
  evaluation:        { label: 'Évaluation',          emoji: '📊', color: '#ef4444' },
  revision:          { label: 'Révision',            emoji: '🔄', color: '#f97316' },
};

// ─── Statut de séance ───────────────────────────────────────
export type StatutSeance = 'realise' | 'planifie' | 'annule' | 'reporte';

export const STATUT_CONFIG: Record<StatutSeance, { label: string; color: string; bg: string }> = {
  realise:  { label: 'Réalisé',  color: '#059669', bg: '#d1fae5' },
  planifie: { label: 'Planifié', color: '#d97706', bg: '#fef3c7' },
  annule:   { label: 'Annulé',   color: '#dc2626', bg: '#fee2e2' },
  reporte:  { label: 'Reporté',  color: '#2563eb', bg: '#dbeafe' },
};

// ─── Évaluation (signets) ────────────────────────────────────
export type TypeEvaluation = 'interro' | 'ds' | 'examen' | 'oral' | 'autre';
export type StatutEvaluation = 'a_evaluer' | 'evaluation_creee' | 'evaluation_terminee';

export const TYPE_EVAL_LABELS: Record<TypeEvaluation, string> = {
  interro: 'Interrogation', ds: 'Devoir Surveillé',
  examen: 'Examen', oral: 'Oral', autre: 'Autre',
};

// ─── Rappels ─────────────────────────────────────────────────
export type TypeRappel = 'devoir' | 'evaluation' | 'notes' | 'cours' | 'personnalise';
export type Recurrence = 'unique' | 'quotidien' | 'hebdomadaire';
export type Priorite = 'normale' | 'urgente';

// ─── Pièce jointe ────────────────────────────────────────────
export interface PieceJointe {
  nom: string;        // Nom du fichier
  url: string;        // URL Firebase Storage
  type: string;       // MIME type (application/pdf, image/jpeg, etc.)
  taille: number;     // Taille en octets
  uploadedAt: string; // ISO date
}

// ─── CAHIER DE TEXTES ────────────────────────────────────────
export interface CahierTextes {
  id: string;
  profId: string;
  classe: Classe;
  matiere: Matiere;
  anneeScolaire: AnneeScolaire;
  titre: string;
  description?: string;
  couleur: string;                // Hex ex: '#2563eb'
  nombreSeancesPrevu: number;
  nombreSeancesRealise: number;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CahierFormData {
  classe: Classe;
  matiere: Matiere;
  anneeScolaire: AnneeScolaire;
  titre: string;
  description: string;
  couleur: string;
  nombreSeancesPrevu: number;
}

// ─── ENTRÉE DU CAHIER (Séance) ───────────────────────────────
export interface EntreeCahier {
  id: string;
  cahierId: string;
  profId: string;
  date: Timestamp;
  heureDebut?: string;
  heureFin?: string;
  chapitre: string;
  typeContenu: TypeContenu;
  contenu: string;           // HTML (éditeur riche)
  objectifs?: string;
  competences?: string[];
  statut: StatutSeance;
  motifAnnulation?: string;
  dateReport?: Timestamp;
  piecesJointes?: PieceJointe[];
  notesPrivees?: string;

  // Signets d'évaluation
  isMarqueEvaluation: boolean;
  typeEvaluation?: TypeEvaluation;
  dateEvaluationPrevue?: Timestamp;
  statutEvaluation?: StatutEvaluation;

  ordre: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EntreeFormData {
  date: string;                // ISO YYYY-MM-DD
  heureDebut: string;
  heureFin: string;
  chapitre: string;
  typeContenu: TypeContenu;
  contenu: string;
  objectifs: string;
  competences: string[];
  statut: StatutSeance;
  motifAnnulation: string;
  dateReport: string;
  notesPrivees: string;
  isMarqueEvaluation: boolean;
  typeEvaluation: TypeEvaluation | '';
  dateEvaluationPrevue: string;
  statutEvaluation: StatutEvaluation;
}

// ─── RAPPEL ──────────────────────────────────────────────────
export interface RappelProf {
  id: string;
  profId: string;
  cahierId?: string;
  entreeCahierId?: string;
  titre: string;
  description?: string;
  typeRappel: TypeRappel;
  dateRappel: Timestamp;
  recurrence: Recurrence;
  priorite: Priorite;
  isLu: boolean;
  isDone: boolean;
  createdAt: Timestamp;
}

export interface RappelFormData {
  titre: string;
  description: string;
  typeRappel: TypeRappel;
  dateRappel: string;        // ISO datetime-local
  recurrence: Recurrence;
  priorite: Priorite;
  cahierId?: string;
}

// ─── COULEURS DISPONIBLES ─────────────────────────────────────
export const COULEURS_CAHIER = [
  '#2563eb', // Bleu PedaClic
  '#7c3aed', // Violet
  '#059669', // Vert
  '#d97706', // Ambre
  '#dc2626', // Rouge
  '#0891b2', // Cyan
  '#db2777', // Rose
  '#65a30d', // Lime
];

// ─── COMPÉTENCES PRÉDÉFINIES ──────────────────────────────────
export const COMPETENCES_PREDEFINIES = [
  'Comprendre', 'Analyser', 'Synthétiser', 'Appliquer',
  'Évaluer', 'Créer', 'Mémoriser', 'Raisonner',
  'Communiquer', 'Résoudre', 'Expérimenter', 'Modéliser',
];

// ─── TYPE RAPPEL CONFIG ───────────────────────────────────────
export const TYPE_RAPPEL_CONFIG: Record<TypeRappel, { label: string; emoji: string }> = {
  devoir:      { label: 'Devoir à corriger',     emoji: '📋' },
  evaluation:  { label: 'Évaluation à préparer', emoji: '📊' },
  notes:       { label: 'Notes à saisir',         emoji: '📝' },
  cours:       { label: 'Cours à préparer',       emoji: '📖' },
  personnalise:{ label: 'Rappel personnalisé',    emoji: '🔔' },
};
