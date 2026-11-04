// ============================================================
// PedaClic — Phase 49 : Cellules pédagogiques (types)
// ------------------------------------------------------------
// Une cellule réunit les enseignants d'une même discipline
// (établissement ou zone). Principe : on partage des MODÈLES
// (progressions, séances) que chacun COPIE dans son propre cahier ;
// personne ne modifie le cahier d'un collègue.
//
// Firestore :
//   cellules/{id}                     → la cellule (membres, animateur)
//   cellules_codes/{CODE}             → code d'invitation → id de cellule
//   cellules/{id}/demandes/{uid}      → demandes d'adhésion
//   cellules/{id}/progressions/{pid}  → progressions communes
//   cellules/{id}/ressources/{rid}    → séances partagées
//   cellules/{id}/avancements/{uid}   → avancement publié par un membre
// ============================================================

import type { Timestamp } from 'firebase/firestore';
import type { RubriqueCahier, TypeContenu, LienExterne } from './cahierTextes.types';

export type RoleCellule = 'animateur' | 'membre';
export type PorteeCellule = 'etablissement' | 'zone';

export const PORTEES_CELLULE: Array<{ valeur: PorteeCellule; label: string }> = [
  { valeur: 'etablissement', label: 'Cellule d\'établissement' },
  { valeur: 'zone', label: 'Cellule de zone (IEF)' },
];

/** Fiche d'un membre (stockée dans la map `membres`) */
export interface MembreCellule {
  nom: string;
  /** 'observateur' ajouté en Phase 51 */
  role: RoleCellule | 'observateur';
  depuis: Timestamp;
}

export interface Cellule {
  id: string;
  nom: string;                       // « Cellule de Français — LLG »
  discipline: string;
  portee: PorteeCellule;
  etablissementNom: string;          // établissement ou zone
  ief: string;
  anneeScolaire: string;
  description: string;
  animateurId: string;
  animateurNom: string;
  /** Liste des uid membres (animateur inclus) — utilisée par les règles */
  membreIds: string[];
  /** Détails des membres, indexés par uid */
  membres: Record<string, MembreCellule>;
  /** Code d'invitation actuel (aussi stocké dans cellules_codes) */
  codeInvitation: string;
  /** Phase 51 — observateurs (lecture seule), aussi présents dans membreIds */
  observateurIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CelluleFormData {
  nom: string;
  discipline: string;
  portee: PorteeCellule;
  etablissementNom: string;
  ief: string;
  anneeScolaire: string;
  description: string;
}

/** Demande d'adhésion (ID du document = uid du demandeur) */
export interface DemandeAdhesion {
  id: string;            // = uid
  nom: string;
  code: string;          // code saisi (vérifié par les règles)
  createdAt: Timestamp;
}

/** Progression commune (rubriques + leçons, au format du cahier) */
export interface ProgressionCellule {
  id: string;
  titre: string;         // « Progression 3ème — 2026-2027 »
  classe: string;
  rubriques: RubriqueCahier[];
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Séance partagée dans la bibliothèque (SANS notes privées ni pièces jointes) */
export interface RessourceCellule {
  id: string;
  type: 'seance';
  titre: string;              // = chapitre de la séance
  classe: string;
  matiere: string;
  typeContenu: TypeContenu;
  contenu: string;
  objectifs: string;
  competences: string[];
  exerciceJour: string;
  exerciceDomicile: string;
  liens: LienExterne[];
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
}

/** Ligne d'avancement d'une rubrique */
export interface AvancementRubrique {
  nom: string;
  couleur: string;
  realise: number;
  prevu: number;
  pourcentage: number;
}

/** Avancement publié par un membre (ID = uid du membre) */
export interface AvancementMembre {
  id: string;
  nom: string;
  cahierId: string;
  cahierTitre: string;
  classe: string;
  global: { realise: number; prevu: number; pourcentage: number };
  parRubrique: AvancementRubrique[];
  updatedAt: Timestamp;
}

/** Caractères du code (sans 0/O ni 1/I/L, pour éviter les confusions) */
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function genererCodeCellule(longueur = 6): string {
  let code = '';
  const aleas = new Uint32Array(longueur);
  crypto.getRandomValues(aleas);
  for (const a of aleas) code += ALPHABET_CODE[a % ALPHABET_CODE.length];
  return code;
}

/** Normalise un code saisi : majuscules, sans espaces ni tirets */
export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ═════════════════════════════════════════════════════════════
// PHASE 50 — LOT 2 : CALENDRIER, COMPTES RENDUS, NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
//   cellules/{id}/evenements/{eid}                     → calendrier
//   cellules/{id}/comptesRendus/{crId}                 → comptes rendus
//   cellules/{id}/comptesRendus/{crId}/commentaires/{c} → échanges
// ═════════════════════════════════════════════════════════════

export type TypeEvenementCellule = 'devoir_harmonise' | 'composition' | 'reunion' | 'autre';

export const TYPE_EVENEMENT_CONFIG: Record<TypeEvenementCellule, { label: string; emoji: string; couleur: string }> = {
  devoir_harmonise: { label: 'Devoir harmonisé', emoji: '📝', couleur: '#2563eb' },
  composition:      { label: 'Composition',      emoji: '📊', couleur: '#C00000' },
  reunion:          { label: 'Réunion de cellule', emoji: '🤝', couleur: '#059669' },
  autre:            { label: 'Autre',            emoji: '📌', couleur: '#6b7280' },
};

export interface EvenementCellule {
  id: string;
  type: TypeEvenementCellule;
  titre: string;
  date: string;          // AAAA-MM-JJ
  heure: string;         // HH:mm ('' = journée entière)
  duree: number;         // minutes (agenda .ics) — 0 si journée entière
  lieu: string;
  classe: string;        // '' = toutes les classes
  description: string;
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EvenementFormData = Pick<
  EvenementCellule, 'type' | 'titre' | 'date' | 'heure' | 'duree' | 'lieu' | 'classe' | 'description'
>;

export interface CompteRenduCellule {
  id: string;
  titre: string;
  dateReunion: string;       // AAAA-MM-JJ
  lieu: string;
  presentsIds: string[];     // membres présents (uid)
  presentsNoms: string[];    // noms dénormalisés (PDF, anciens membres)
  ordreDuJour: string;       // un point par ligne
  deliberations: string;     // texte libre
  decisions: string;         // une décision par ligne
  prochaineReunion: string;  // AAAA-MM-JJ ou ''
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CompteRenduFormData = Pick<
  CompteRenduCellule,
  'titre' | 'dateReunion' | 'lieu' | 'presentsIds' | 'presentsNoms' | 'ordreDuJour' | 'deliberations' | 'decisions' | 'prochaineReunion'
>;

export interface CommentaireCR {
  id: string;
  texte: string;
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
}

/** « 2026-11-12 » → « jeudi 12 novembre 2026 » */
export function dateLongue(iso: string): string {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Nombre de jours entre aujourd'hui et une date AAAA-MM-JJ (négatif = passé) */
export function joursAvant(iso: string): number {
  const [a, m, j] = iso.split('-').map(Number);
  const cible = new Date(a, m - 1, j).getTime();
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  return Math.round((cible - auj.getTime()) / 86_400_000);
}

/** Libellé relatif : « aujourd'hui », « demain », « dans 5 jours », « il y a 2 jours » */
export function libelleEcheance(iso: string): string {
  const n = joursAvant(iso);
  if (n === 0) return 'aujourd\'hui';
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

// ═════════════════════════════════════════════════════════════
// PHASE 51 — LOT 3 : OBSERVATEUR, ÉPREUVE COMMUNE, STATISTIQUES
// ─────────────────────────────────────────────────────────────
//   Cellule.observateurIds (optionnel)       → lecture seule
//   cellules/{id}/epreuves/{eid}             → épreuve commune
//   cellules/{id}/epreuves/{eid}/versions/{v}→ historique
//   cellules/{id}/epreuves/{eid}/resultats/{uid} → statistiques
// ═════════════════════════════════════════════════════════════

/** Rôle étendu (la map `membres` peut contenir 'observateur') */
export type RoleCelluleEtendu = RoleCellule | 'observateur';

/** Un observateur (censeur, inspecteur…) lit tout mais n'écrit rien */
export function estObservateur(cellule: Pick<Cellule, 'membres'> & { observateurIds?: string[] }, uid: string): boolean {
  return (cellule.observateurIds ?? []).includes(uid);
}

export type StatutEpreuve = 'brouillon' | 'validee';

/** Une ligne du barème */
export interface LigneBareme {
  intitule: string;   // « I. Compréhension du texte »
  points: number;
}

export interface EpreuveCommune {
  id: string;
  titre: string;              // « Devoir harmonisé n°1 — 3ème »
  classe: string;
  type: 'devoir_harmonise' | 'composition';
  date: string;               // AAAA-MM-JJ ('' = non fixée)
  duree: string;              // « 2 h »
  noteSur: number;            // 20 par défaut
  sujet: string;              // texte du sujet
  bareme: LigneBareme[];
  corrige: string;            // corrigé / éléments de réponse
  statut: StatutEpreuve;
  version: number;            // incrémentée à chaque enregistrement
  derniereModifParId: string;
  derniereModifParNom: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EpreuveFormData = Pick<
  EpreuveCommune, 'titre' | 'classe' | 'type' | 'date' | 'duree' | 'noteSur' | 'sujet' | 'bareme' | 'corrige'
>;

/** Instantané d'une version (historique) */
export interface VersionEpreuve {
  id: string;
  numero: number;
  sujet: string;
  bareme: LigneBareme[];
  corrige: string;
  note: string;               // commentaire de la modification
  auteurId: string;
  auteurNom: string;
  createdAt: Timestamp;
}

/** Tranches de notes (sur 20) pour la répartition */
export const TRANCHES_NOTES: Array<{ label: string; min: number; max: number }> = [
  { label: '0 – 5',   min: 0,  max: 5 },
  { label: '5 – 8',   min: 5,  max: 8 },
  { label: '8 – 10',  min: 8,  max: 10 },
  { label: '10 – 12', min: 10, max: 12 },
  { label: '12 – 14', min: 12, max: 14 },
  { label: '14 – 16', min: 14, max: 16 },
  { label: '16 – 20', min: 16, max: 20.0001 },
];

/**
 * Résultats ANONYMES publiés par un professeur pour une classe :
 * uniquement des agrégats — aucun nom, aucune note individuelle.
 */
export interface ResultatsEpreuve {
  id: string;                 // = uid du professeur
  profNom: string;
  groupeNom: string;          // « 3ème B »
  effectif: number;           // élèves de la feuille
  presents: number;           // notes saisies
  moyenne: number;
  mediane: number;
  min: number;
  max: number;
  ecartType: number;
  tauxReussite: number;       // % de notes ≥ moyenne de réussite (10/20)
  repartition: number[];      // effectifs par tranche (TRANCHES_NOTES)
  updatedAt: Timestamp;
}
