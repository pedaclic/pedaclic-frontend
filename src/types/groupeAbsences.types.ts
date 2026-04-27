/**
 * Types pour la gestion des absences et observations par groupe.
 * PedaClic — Groupes-classes (prof)
 */

/**
 * Motif d'un retard.
 *  - 'justifie'    : le retard a été justifié (mot, certificat, etc.)
 *  - 'non_justifie': retard sans justification
 *  - undefined     : pas encore qualifié (rétrocompatible)
 */
export type MotifRetard = 'justifie' | 'non_justifie';

/**
 * Détail d'un retard pour un élève donné — enregistré dans le doc d'appel.
 *  - minutes : minutes de retard saisies par le prof (0 si non précisé)
 *  - motif   : justifié / non justifié (optionnel à la saisie initiale)
 *  - commentaire : texte libre optionnel (ex. "bus en retard")
 */
export interface DetailRetard {
  minutes: number;
  motif?: MotifRetard;
  commentaire?: string;
}

/** Enregistrement d'absence pour une date donnée */
export interface AbsenceGroupe {
  id: string;
  groupeId: string;
  date: string; // YYYY-MM-DD
  /** IDs des élèves marqués ABSENTS ce jour-là */
  eleveIdsAbsents: string[];
  /**
   * IDs des élèves marqués EN RETARD ce jour-là.
   * Complémentaire à eleveIdsAbsents (un élève ne peut pas être les deux).
   */
  eleveIdsRetards?: string[];
  /**
   * Détails des retards par élève (clé = eleveId).
   * Ne contient que les élèves marqués en retard.
   */
  retardsDetails?: Record<string, DetailRetard>;
  /**
   * ─── Compatibilité historique (un seul couple séance) ────────────
   * `entreeId` / `entreeTitre` restent supportés en lecture pour les
   * anciens documents. À l'écriture, on privilégie désormais les
   * tableaux ci-dessous.
   * ─────────────────────────────────────────────────────────────── */
  entreeId?: string;
  entreeTitre?: string;
  /**
   * Phase 38 — Liaison MULTI-séances :
   *   Un élève peut être absent à plusieurs séances dans la même journée
   *   (ex. matin maths + après-midi français → 2 séances manquées).
   *   On stocke donc la liste des séances liées à cet appel.
   *
   *   `entreeIds`    : tableau d'IDs de séances (entrées du cahier de textes)
   *   `entreeTitres` : titres dénormalisés correspondants (même longueur)
   *
   *   Lors de la lecture, fusionner avec `entreeId/entreeTitre` :
   *     ids    = entreeIds    ?? (entreeId    ? [entreeId]    : [])
   *     titres = entreeTitres ?? (entreeTitre ? [entreeTitre] : [])
   *   afin de couvrir les documents écrits avant Phase 38.
   */
  entreeIds?: string[];
  entreeTitres?: string[];
  profId: string;
  updatedAt: Date;
}

/**
 * Phase 38 — Helpers de lecture rétro-compatibles.
 *   Renvoient toujours une liste (jamais undefined) afin que les
 *   composants qui affichent les « séances manquées » n'aient pas à
 *   gérer eux-mêmes la double source (legacy `entreeId` vs nouveau
 *   `entreeIds[]`).
 */
export function getEntreeIds(a: Partial<AbsenceGroupe>): string[] {
  if (Array.isArray(a.entreeIds) && a.entreeIds.length > 0) return a.entreeIds;
  return a.entreeId ? [a.entreeId] : [];
}
export function getEntreeTitres(a: Partial<AbsenceGroupe>): string[] {
  if (Array.isArray(a.entreeTitres) && a.entreeTitres.length > 0) return a.entreeTitres;
  return a.entreeTitre ? [a.entreeTitre] : [];
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
  /**
   * Phase 36 — Date de correction au format `YYYY-MM-DD`.
   *   Rempli automatiquement (date du jour) quand le prof coche la
   *   case "Corrigé" ; peut ensuite être édité manuellement.
   *   Vide/absent = aucune date enregistrée (ou exercice non corrigé).
   */
  corrigeDate?: string;
  /**
   * Phase 36 — Heure de correction au format `HH:mm`.
   *   Pendant : même règle que corrigeDate (auto à la saisie, éditable).
   */
  corrigeHeure?: string;
  profId: string;
  profNom?: string;
  createdAt: Date;
}
