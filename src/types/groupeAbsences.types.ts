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
 * Phase 40 — Détail d'une EXCLUSION (renvoi de cours / mise à pied).
 *  - dureeJours   : nombre de jours d'exclusion (1 = ce jour ; 2-15 = sanction).
 *                   Sert de base aux compteurs (ex. « X j d'exclusion ce mois »).
 *  - motif        : raison brève saisie par l'enseignant (texte libre).
 *  - decideePar   : qui a prononcé la mesure (prof, CPE, direction).
 *  - dateRetour   : date prévue de retour en cours au format ISO (YYYY-MM-DD).
 *                   Permet de rappeler à la direction quand l'élève revient.
 *  - commentaire  : observation supplémentaire (transmis aux parents).
 */
export interface DetailExclusion {
  dureeJours: number;
  motif?: string;
  decideePar?: 'prof' | 'cpe' | 'direction';
  dateRetour?: string;
  commentaire?: string;
}

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
   * PHASE 40 — IDs des élèves EXCLUS (renvoi de cours / mise à pied).
   *   Mutuellement exclusif avec `eleveIdsAbsents` et `eleveIdsRetards` :
   *   un élève exclu n'est ni absent ni en retard, c'est un statut
   *   distinct qui doit être tracé séparément pour les bulletins
   *   disciplinaires et la communication aux familles.
   */
  eleveIdsExclus?: string[];
  /**
   * PHASE 40 — Détails des exclusions par élève (clé = eleveId).
   *   Ne contient que les élèves marqués exclus le jour de l'appel.
   */
  exclusionsDetails?: Record<string, DetailExclusion>;
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
  /**
   * Phase 39 — Absence/retard par élève ET par séance.
   *   Un élève peut être ABSENT à la 1ère heure et PRÉSENT à la 2de
   *   (ou inversement). On indexe donc par séance puis par élève :
   *
   *     seancesAbsentsPar = {
   *       "<entreeId-1>": ["eleveA", "eleveB"],   // absent à séance 1
   *       "<entreeId-2>": ["eleveB"],             // absent à séance 2 seulement
   *     }
   *
   *   Règles de fallback (rétro-compat) :
   *     - Si un élève apparaît dans `eleveIdsAbsents` mais PAS dans
   *       `seancesAbsentsPar`, on considère qu'il était absent à
   *       TOUTES les séances liées à cet appel.
   *     - Si `seancesAbsentsPar` est défini pour un élève, il a la
   *       priorité (présence implicite aux séances non listées).
   *
   *   `eleveIdsAbsents` reste l'UNION des élèves absents à au moins
   *   une séance (utilisé par les compteurs « jour/semaine/mois »).
   */
  seancesAbsentsPar?: Record<string /*entreeId*/, string[] /*eleveIds*/>;
  seancesRetardsPar?: Record<string /*entreeId*/, string[] /*eleveIds*/>;
  /**
   * PHASE 40 — Élèves EXCLUS répartis par séance (même logique que
   * `seancesAbsentsPar`/`seancesRetardsPar`). Permet d'exclure un
   * élève d'une séance précise sans toucher aux autres.
   */
  seancesExclusPar?: Record<string /*entreeId*/, string[] /*eleveIds*/>;
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

/**
 * 🆕 (mai 2026) — Tonalité (positive / négative / neutre) d'une
 *   observation pédagogique consignée dans la feuille de suivi élève.
 *
 *     - 'positive' : encouragement, progrès, comportement exemplaire.
 *     - 'negative' : remarque pour rappel ou alerte parents.
 *     - 'neutre'   : simple note d'information non orientée.
 *
 *   Utilisée pour colorer la cellule et déterminer la TONALITÉ de la
 *   notification temps réel envoyée au parent / tuteur.
 */
export type TonaliteObservation = 'positive' | 'negative' | 'neutre';

export const TONALITE_OBSERVATION_LABELS: Record<TonaliteObservation, string> = {
  positive: 'Observation positive',
  negative: 'Observation négative',
  neutre: 'Observation neutre',
};

export const TONALITE_OBSERVATION_COULEURS: Record<TonaliteObservation, string> = {
  positive: '#16a34a', // Vert — encourageant
  negative: '#dc2626', // Rouge — alerte
  neutre: '#6b7280',   // Gris — neutre
};

/**
 * 🆕 (mai 2026) — Entrée de la FEUILLE DE SUIVI ÉLÈVE par séance.
 *
 *   Un document `suivi_seance` est créé pour CHAQUE couple
 *   (groupeId, date, profId, eleveId). Il consigne, pour la séance
 *   du jour :
 *     • absenceSeancePrecedente — `true` si l'élève était absent à
 *       la séance précédente (calculé automatiquement à l'ouverture
 *       de l'appel, modifiable manuellement par le prof).
 *     • observation               — texte libre + tonalité.
 *     • materielNonAmene          — booléen + précision facultative.
 *     • travailNonFait            — booléen + précision facultative.
 *
 *   Toutes ces données sont LIÉES au compte parent / tuteur via le
 *   service `notificationService.envoyerNotification` au moment de la
 *   sauvegarde (canal in-app + email selon préférences du parent).
 *
 *   Stockage : collection Firestore `suivi_seance` (id stable :
 *   `${groupeId}_${date}_${eleveId}`). Compatible avec les règles
 *   Firestore existantes qui filtrent par `profId == auth.uid`.
 *
 *   IMPORTANT : ce type est ADDITIF — il ne modifie aucun document
 *   existant (`absences_groupe`, `observations_eleve`, etc.) et
 *   préserve toutes les fonctionnalités déjà en place.
 */
export interface SuiviSeanceEleve {
  /** ID Firestore stable : `${groupeId}_${date}_${eleveId}`. */
  id: string;
  groupeId: string;
  /** Date au format YYYY-MM-DD — clé de la séance/journée. */
  date: string;
  /** Référence aux séances liées (cf. Cahier de textes, Phase 38+). */
  entreeIds?: string[];
  eleveId: string;
  eleveNom: string;
  profId: string;
  /**
   * `true` si l'élève figurait dans `eleveIdsAbsents` (ou granulaire)
   *   du jour de séance immédiatement précédent. Auto-rempli au
   *   chargement de la feuille, surchargeable manuellement.
   */
  absenceSeancePrecedente?: boolean;
  /** Texte libre de l'observation du jour (peut être vide). */
  observation?: string;
  /** Tonalité de l'observation (positive / négative / neutre). */
  tonaliteObservation?: TonaliteObservation;
  /** `true` si l'élève n'a pas amené son matériel à cette séance. */
  materielNonAmene?: boolean;
  /** Détail facultatif (ex. « cahier d'exercices manquant »). */
  materielNonAmeneDetail?: string;
  /** `true` si le travail demandé n'a pas été fait. */
  travailNonFait?: boolean;
  /** Détail facultatif (ex. « exercice 5 page 42 »). */
  travailNonFaitDetail?: string;
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
