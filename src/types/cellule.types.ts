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
  role: RoleCellule;
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
