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

/**
 * Type d'évaluation : distingue un devoir d'une composition.
 * Utilisé pour le calcul de la moyenne générale PedaClic :
 *   MoyenneGénérale = (MoyenneDevoirs + Composition) / 2
 *
 * Valeur par défaut : 'devoir' (compatibilité avec les feuilles existantes).
 */
export type TypeEvaluation = 'devoir' | 'composition';

export const TYPE_EVAL_LABELS: Record<TypeEvaluation, string> = {
  devoir: 'Devoir',
  composition: 'Composition',
};

/**
 * Statut d'absence d'un élève à un devoir / une composition.
 *
 *   - 'present'              : aucune absence (cas par défaut, état implicite
 *                              quand la valeur n'est pas définie pour l'élève).
 *   - 'absent_justifie'      : élève absent, absence justifiée → l'évaluation
 *                              est IGNORÉE dans le calcul de la moyenne
 *                              (comme si la note n'avait pas été saisie).
 *   - 'absent_non_justifie'  : élève absent, absence non justifiée → l'évaluation
 *                              compte 0 / 20 dans le calcul de la moyenne.
 *
 * Règle pédagogique retenue (réponse utilisateur, avril 2026) :
 *   « Justifiée = ignorer / Non justifiée = 0 ».
 */
export type StatutAbsenceDevoir = 'present' | 'absent_justifie' | 'absent_non_justifie';

/** Étiquettes lisibles utilisées dans toute l'UI (prof / parent / élève). */
export const STATUT_ABSENCE_LABELS: Record<StatutAbsenceDevoir, string> = {
  present: 'Présent',
  absent_justifie: 'Absent justifié',
  absent_non_justifie: 'Absent non justifié',
};

/**
 * Badges courts (cellule de note + exports). 'present' renvoie une chaîne
 * vide pour ne rien afficher (la note ou « — » prendra la place).
 */
export const STATUT_ABSENCE_BADGES: Record<StatutAbsenceDevoir, string> = {
  present: '',
  absent_justifie: 'AJ',
  absent_non_justifie: 'ANJ',
};

/** Couleurs (hex) des badges A/AJ/ANJ — alignées sur la charte PedaClic. */
export const STATUT_ABSENCE_COLORS: Record<StatutAbsenceDevoir, string> = {
  present: 'transparent',
  absent_justifie: '#f59e0b',     // orange — informatif, ne pénalise pas
  absent_non_justifie: '#ef4444', // rouge — pénalisant (compte 0/20)
};

/** Évaluation / contrôle dans une feuille */
export interface EvaluationNote {
  id: string;
  libelle: string;
  coefficient?: number;
  date?: string; // YYYY-MM-DD
  /**
   * Type d'évaluation : 'devoir' (par défaut) ou 'composition'.
   * Permet le calcul séparé : moyenne des devoirs, note de composition,
   * moyenne générale, puis rang de classe.
   */
  type?: TypeEvaluation;
  /** Compétences évaluées dans ce devoir (optionnel) */
  competences?: CompetenceDef[];
}

/** Notes d'un élève : evaluationId -> note (sur 20) */
export type NotesEleve = Record<string, number>;

/**
 * Absences d'un élève sur les évaluations d'une feuille :
 *   evaluationId -> StatutAbsenceDevoir.
 *
 * Une clé absente = élève présent (état par défaut). On NE persiste donc
 * jamais explicitement 'present' pour limiter la taille du document.
 */
export type AbsencesEleve = Record<string, StatutAbsenceDevoir>;

/** Notes de compétences d'un élève : evaluationId -> competenceId -> status */
export type CompetencesEleve = Record<string, Record<string, CompetenceStatus>>;

/** Feuille de notes complète pour un groupe */
export interface FeuilleDeNotes {
  id: string;
  /**
   * ✨ Titre libre de la feuille (saisi par le professeur).
   *
   *   Permet de distinguer plusieurs feuilles d'un même groupe portant
   *   sur la même discipline (ex. « Évaluation orthographe — 1er trim. »
   *   vs « Évaluation grammaire — 1er trim. »). Optionnel pour rester
   *   rétro-compatible avec les feuilles existantes (qui n'avaient pas
   *   ce champ) : à l'affichage on retombe sur le `periodeLabel`.
   */
  titre?: string;
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
  /**
   * Absences aux devoirs : eleveId -> evaluationId -> statut.
   *
   * Optionnel pour rétro-compatibilité (feuilles créées avant l'ajout
   * de la fonctionnalité). Toute clé absente = élève présent.
   */
  absences?: Record<string, AbsencesEleve>;
  /** Compétences gérées par le prof pour cette feuille */
  competencesDef?: CompetenceDef[];
  /** eleveId -> evaluationId -> competenceId -> status */
  competences?: Record<string, CompetencesEleve>;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

/**
 * Ligne de notes pour affichage (élève + notes + moyennes + rang).
 *
 * Champs supplémentaires (formule PedaClic) :
 *   - moyenneDevoirs   : moyenne pondérée des évaluations de type 'devoir'
 *   - noteComposition  : note (ou moyenne pondérée) des évaluations de type 'composition'
 *   - moyenneGenerale  : (MoyDevoirs + Composition) / 2 — valeur
 *                        qui sert aussi de base pour le rang et pour le
 *                        champ historique `moyenne` (conservé par compat.).
 *   - rang             : classement dans la feuille (1 = meilleur).
 */
export interface LigneNotes {
  eleveId: string;
  eleveNom: string;
  eleveEmail: string;
  notes: Record<string, number>;
  /**
   * Absences de l'élève sur les évaluations de cette feuille (mêmes IDs
   * qu'au niveau `feuille.evaluations`). Manquant = aucune absence.
   * Le rendu (cellules de note + exports) consomme directement ce champ.
   */
  absences?: AbsencesEleve;
  /** Moyenne générale (ou moyenne simple si pas de distinction type) — conservée pour compat. */
  moyenne: number;
  /** Moyenne pondérée des devoirs uniquement. 0 si aucun devoir noté. */
  moyenneDevoirs: number;
  /** Note de composition (moyenne si plusieurs). 0 si aucune composition notée. */
  noteComposition: number;
  /** Moyenne générale retenue pour le bulletin et le rang. */
  moyenneGenerale: number;
  /** Rang dans la classe (1 = meilleur). 0 si non calculable. */
  rang: number;
  /**
   * Compteurs d'absences pour cette feuille — utiles pour les statistiques
   * du tableau de bord prof et pour les exports.
   */
  nbAbsencesJustifiees: number;
  nbAbsencesNonJustifiees: number;
}

/** Options de période pour le sélecteur */
export const PERIODE_LABELS: Record<PeriodeType, string> = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
};
