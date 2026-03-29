/**
 * Types pour les feuilles de notes — PedaClic
 * Liées aux groupes-classes, avec moyennes périodiques
 * (mensuelle, trimestrielle, semestrielle)
 */

import type { Timestamp } from 'firebase/firestore';

/** Type de période pour la feuille de notes */
export type PeriodeType = 'mensuelle' | 'trimestrielle' | 'semestrielle';

/** Statut d'acquisition d'une compétence */
export type CompetenceStatus = 'non_acquis' | 'en_cours' | 'acquis';

export const COMPETENCE_STATUS_LABELS: Record<CompetenceStatus, string> = {
  non_acquis: 'Non acquis',
  en_cours: 'En cours d\u2019acquisition',
  acquis: 'Acquis',
};

export const COMPETENCE_STATUS_COLORS: Record<CompetenceStatus, string> = {
  non_acquis: '#ef4444',
  en_cours: '#f59e0b',
  acquis: '#22c55e',
};

/** Définition d'une compétence */
export interface CompetenceDef {
  id: string;
  libelle: string;
}

/** Compétences par défaut (personnalisables par le prof) */
export const COMPETENCES_PAR_DEFAUT: CompetenceDef[] = [
  { id: 'dire', libelle: 'Dire' },
  { id: 'lire_interpreter', libelle: 'Lire et Interpréter' },
  { id: 'ecrire', libelle: 'Écrire' },
  { id: 'etudier_langue', libelle: 'Étudier la langue' },
];

/** Évaluation / contrôle dans une feuille */
export interface EvaluationNote {
  id: string;
  libelle: string;
  coefficient?: number;
  date?: string; // YYYY-MM-DD
  /** Compétences évaluées dans ce devoir (optionnel) */
  competences?: CompetenceDef[];
}

/** Notes d'un élève : evaluationId -> note (sur 20) */
export type NotesEleve = Record<string, number>;

/** Notes de compétences d'un élève : evaluationId -> competenceId -> status */
export type CompetencesEleve = Record<string, Record<string, CompetenceStatus>>;

/** Feuille de notes complète pour un groupe */
export interface FeuilleDeNotes {
  id: string;
  groupeId: string;
  groupeNom: string;
  matiereId: string;
  matiereNom: string;
  profId: string;
  profNom: string;
  anneeScolaire: string;
  periodeType: PeriodeType;
  periodeLabel: string; // ex: "Octobre 2025", "1er trimestre"
  dateDebut: Date | Timestamp;
  dateFin: Date | Timestamp;
  evaluations: EvaluationNote[];
  /** eleveId -> evaluationId -> note */
  notes: Record<string, NotesEleve>;
  /** Compétences gérées par le prof pour cette feuille */
  competencesDef?: CompetenceDef[];
  /** eleveId -> evaluationId -> competenceId -> status */
  competences?: Record<string, CompetencesEleve>;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

/** Ligne de notes pour affichage (élève + notes + moyenne) */
export interface LigneNotes {
  eleveId: string;
  eleveNom: string;
  eleveEmail: string;
  notes: Record<string, number>;
  moyenne: number;
}

/** Options de période pour le sélecteur */
export const PERIODE_LABELS: Record<PeriodeType, string> = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
};
