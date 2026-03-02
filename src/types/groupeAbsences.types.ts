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
  matiere?: string;
  profId: string;
  profNom?: string;
  createdAt: Date;
}
