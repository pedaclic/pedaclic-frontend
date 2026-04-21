/**
 * Types pour la gestion des absences et observations par groupe.
 * PedaClic — Groupes-classes (prof)
 */

/** Enregistrement d'absence pour une date donnée */
export interface AbsenceGroupe {
  id: string;
  groupeId: string;
  date: string; // YYYY-MM-DD
  eleveIdsAbsents: string[];
  /** ID de la séance (entrée cahier) liée à cet appel (optionnel) */
  entreeId?: string;
  /** Titre de la séance liée (dénormalisé pour affichage rapide) */
  entreeTitre?: string;
  profId: string;
  updatedAt: Date;
}

/** Observation sur un élève (dans un groupe) */
export interface ObservationEleve {
  eleveId: string;
  eleveNom: string;
  groupeId: string;
  texte: string;
  profId: string;
  updatedAt: Date;
}

/** Travail à faire — échéance visible élèves/parents */
export interface TravailAFaire {
  id: string;
  groupeId: string;
  groupeNom: string;
  titre: string;
  description?: string;
  dateEcheance: Date;
  /** Heure d'échéance (format HH:mm), optionnel — Phase 31 */
  heureEcheance?: string;
  matiere?: string;
  /** ID du cahier de textes lié (Phase 31) */
  cahierId?: string;
  /**
   * ID de la séance (EntreeCahier) qui a généré ce travail (Phase 35).
   * Présent uniquement pour les travaux créés automatiquement depuis
   * l'« Exercice à domicile » d'une séance. Sert de clé logique avec
   * `groupeId` pour upsert/delete lors de la mise à jour de la séance.
   */
  seanceId?: string;
  /** ID de la rubrique du cahier à laquelle ce travail est rattaché (Phase 31) */
  rubriqueId?: string;
  /** Nom de la rubrique (dénormalisé pour affichage rapide) */
  rubriqueNom?: string;
  /** Indique si l'exercice a été fait et corrigé */
  corrige?: boolean;
  profId: string;
  profNom?: string;
  createdAt: Date;
}
