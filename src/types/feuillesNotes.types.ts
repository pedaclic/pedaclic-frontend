/**
 * Types pour les feuilles de notes — PedaClic
 * Liées aux groupes-classes, avec moyennes périodiques
 * (mensuelle, trimestrielle, semestrielle)
 */

import type { Timestamp } from 'firebase/firestore';

/** Type de période pour la feuille de notes */
export type PeriodeType = 'mensuelle' | 'trimestrielle' | 'semestrielle';

/** Évaluation / contrôle dans une feuille */
export interface EvaluationNote {
  id: string;
  libelle: string;
  coefficient?: number;
  date?: string; // YYYY-MM-DD
}

/** Notes d'un élève : evaluationId -> note (sur 20) */
export type NotesEleve = Record<string, number>;

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
