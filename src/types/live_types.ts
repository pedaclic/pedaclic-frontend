// ============================================================
// PedaClic — live_types.ts
// Phase 28 : Types TypeScript — Sessions YouTube Live
//
// Système de cours en direct via YouTube Live embedé sur pedaclic.sn.
// Aucune dépendance externe payante : YouTube Live est gratuit.
// Le lien replay est le même après la session (YouTube archive auto).
//
// Collections Firestore :
//   • live_sessions  — sessions créées par les profs
// ============================================================

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// TYPES DE BASE
// ─────────────────────────────────────────────────────────────

/**
 * Statuts d'une session live tout au long de son cycle de vie.
 * planifie → en_direct → termine  (flux normal)
 * planifie → annule               (flux annulation)
 */
export type StatutLive =
  | 'planifie'   // Session créée, pas encore commencée
  | 'en_direct'  // Session en cours (live actif)
  | 'termine'    // Session terminée, replay disponible
  | 'annule';    // Session annulée

/**
 * Niveau de restriction d'accès à la session.
 */
export type AccesLive =
  | 'public'    // Visible par tous les utilisateurs connectés
  | 'premium'   // Réservé aux élèves avec abonnement Premium
  | 'groupe';   // Réservé aux élèves d'un groupe-classe spécifique

// ─────────────────────────────────────────────────────────────
// INTERFACE PRINCIPALE — Document Firestore
// ─────────────────────────────────────────────────────────────

/**
 * Document `live_sessions/{sessionId}` dans Firestore.
 * Créé par le prof, affiché aux élèves sur /live.
 */
export interface LiveSession {
  /** ID Firestore auto-généré */
  id: string;

  // ── Auteur ─────────────────────────────────────────────────
  /** UID Firebase du professeur créateur */
  profId: string;
  /** Nom affiché du professeur (dénormalisé pour l'affichage) */
  profNom: string;

  // ── Contenu pédagogique ───────────────────────────────────
  /** Titre de la session (ex: "Révision BFEM — Mathématiques") */
  titre: string;
  /** Description courte affichée dans la carte */
  description: string;
  /** Matière concernée (aligné avec les disciplines Firestore) */
  matiere: string;
  /** Niveau scolaire ciblé */
  niveau: string;
  /** Classe ciblée (ex: "3ème", "Terminale S") */
  classe: string;

  // ── YouTube ────────────────────────────────────────────────
  /**
   * URL YouTube Live COMPLÈTE saisie par le prof.
   * Exemples valides :
   *   https://www.youtube.com/watch?v=XXXX (live en cours)
   *   https://youtu.be/XXXX
   *   https://www.youtube.com/live/XXXX
   * Le service extrait l'ID automatiquement.
   */
  urlYoutube: string;
  /**
   * ID YouTube extrait de l'URL (calculé une seule fois à la création).
   * Utilisé pour générer l'embed : https://www.youtube.com/embed/{youtubeId}
   */
  youtubeId: string;

  // ── Planification ─────────────────────────────────────────
  /** Date et heure prévues de début de la session */
  dateDebut: Timestamp;
  /** Durée estimée en minutes (ex: 60, 90, 120) */
  dureeEstimee: number;

  // ── Accès & restrictions ──────────────────────────────────
  /** Niveau de restriction d'accès */
  acces: AccesLive;
  /**
   * ID du groupe-classe restreint (uniquement si acces === 'groupe').
   * Correspond à un document de la collection `groupes_prof`.
   */
  groupeId?: string;
  /** Nom du groupe (dénormalisé) */
  groupeNom?: string;

  // ── Statut ─────────────────────────────────────────────────
  /** Statut actuel de la session */
  statut: StatutLive;
  /**
   * Indique si le replay est disponible après la fin.
   * La même URL YouTube sert de replay (YouTube archive automatiquement).
   */
  replayDisponible: boolean;
  /**
   * Message optionnel affiché si la session est annulée.
   */
  messageAnnulation?: string;

  // ── Notifications ─────────────────────────────────────────
  /**
   * Indique si la notification d'annonce a déjà été envoyée.
   * Évite les doublons si le prof modifie la session.
   */
  notificationEnvoyee: boolean;

  // ── Statistiques ──────────────────────────────────────────
  /** Nombre d'élèves ayant ouvert la page de la session */
  nombreVues: number;

  // ── Métadonnées ───────────────────────────────────────────
  /** Date de création du document */
  createdAt: Timestamp;
  /** Date de dernière modification */
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// FORMULAIRE — Données de création/édition
// ─────────────────────────────────────────────────────────────

/**
 * Données du formulaire de création/modification d'une session.
 * Ne contient pas les champs calculés (youtubeId, statut, etc.).
 */
export interface LiveSessionFormData {
  titre:          string;
  description:    string;
  matiere:        string;
  niveau:         string;
  classe:         string;
  urlYoutube:     string;
  dateDebut:      string;   // Format ISO string pour l'input datetime-local
  dureeEstimee:   number;
  acces:          AccesLive;
  groupeId:       string;
  groupeNom:      string;
  envoyerNotif:   boolean;  // Envoyer une notification aux élèves à la création ?
}

/** Valeurs initiales du formulaire */
export const FORM_LIVE_INITIAL: LiveSessionFormData = {
  titre:         '',
  description:   '',
  matiere:       '',
  niveau:        '',
  classe:        '',
  urlYoutube:    '',
  dateDebut:     '',
  dureeEstimee:  60,
  acces:         'public',
  groupeId:      '',
  groupeNom:     '',
  envoyerNotif:  true,
};

// ─────────────────────────────────────────────────────────────
// FILTRES — Pour la page catalogue élève
// ─────────────────────────────────────────────────────────────

export interface FiltresLive {
  statut?:  StatutLive | '';
  matiere?: string;
  niveau?:  string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES — Labels et helpers
// ─────────────────────────────────────────────────────────────

/** Labels affichés dans l'interface pour chaque statut */
export const LABELS_STATUT_LIVE: Record<StatutLive, { label: string; icone: string; couleur: string }> = {
  planifie:  { label: 'Planifié',     icone: '📅', couleur: '#2563eb' },
  en_direct: { label: 'En direct',    icone: '🔴', couleur: '#dc2626' },
  termine:   { label: 'Replay dispo', icone: '▶️', couleur: '#16a34a' },
  annule:    { label: 'Annulé',       icone: '❌', couleur: '#6b7280' },
};

/** Labels pour les niveaux d'accès */
export const LABELS_ACCES_LIVE: Record<AccesLive, { label: string; icone: string }> = {
  public:   { label: 'Tous les élèves', icone: '🌍' },
  premium:  { label: 'Premium uniquement', icone: '⭐' },
  groupe:   { label: 'Groupe-classe', icone: '👥' },
};

/** Durées prédéfinies pour le formulaire */
export const OPTIONS_DUREE = [
  { valeur: 30,  label: '30 minutes' },
  { valeur: 45,  label: '45 minutes' },
  { valeur: 60,  label: '1 heure' },
  { valeur: 90,  label: '1h30' },
  { valeur: 120, label: '2 heures' },
  { valeur: 180, label: '3 heures' },
];
