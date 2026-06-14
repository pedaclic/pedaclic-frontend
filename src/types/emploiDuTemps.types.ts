// ============================================================
// PedaClic — Emploi du Temps : Types
// Module neuf. Emploi du temps PARTAGÉ au niveau de la CLASSE
// (un document par classe + année scolaire). Sert de pré-requis
// à la création d'un cahier de textes (conditionnement souple).
// ============================================================

import { Timestamp } from 'firebase/firestore';
import type { Classe, Matiere, AnneeScolaire } from './cahierTextes.types';

// ─────────────────────────────────────────────────────────────
// JOURS DE LA SEMAINE
// ─────────────────────────────────────────────────────────────
export type JourSemaine =
  | 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi';

/** Liste ordonnée (libellé complet + abrégé pour la grille) */
export const JOURS_SEMAINE: Array<{ valeur: JourSemaine; label: string; court: string }> = [
  { valeur: 'lundi',     label: 'Lundi',     court: 'Lun' },
  { valeur: 'mardi',     label: 'Mardi',     court: 'Mar' },
  { valeur: 'mercredi',  label: 'Mercredi',  court: 'Mer' },
  { valeur: 'jeudi',     label: 'Jeudi',     court: 'Jeu' },
  { valeur: 'vendredi',  label: 'Vendredi',  court: 'Ven' },
  { valeur: 'samedi',    label: 'Samedi',    court: 'Sam' },
];

export type StatutEmploi = 'brouillon' | 'publie';

// ─────────────────────────────────────────────────────────────
// CRÉNEAU (une case de la grille)
//   jour / heureDebut / heureFin / activite / salle  = requis
//   matiere + profId/profNom                          = optionnels
//   → quand `matiere` est renseignée, le créneau devient un
//     raccourci cliquable vers la saisie du Cahier de textes.
// ─────────────────────────────────────────────────────────────
export interface Creneau {
  id: string;           // identifiant local (uid)
  jour: JourSemaine;
  heureDebut: string;   // "HH:mm" (24h)
  heureFin: string;     // "HH:mm" (24h)
  activite: string;     // libellé libre (ex: "Cours", "TP", nom de matière…)
  salle: string;        // salle / local
  matiere?: Matiere;    // optionnel — active le lien vers le cahier
  profId?: string;      // optionnel — prof responsable du créneau
  profNom?: string;     // optionnel — nom affiché
}

// ─────────────────────────────────────────────────────────────
// EMPLOI DU TEMPS — un document par classe + année scolaire
// ─────────────────────────────────────────────────────────────
export interface EmploiDuTemps {
  id: string;                 // = emploiDuTempsId(classe, annee)
  classe: Classe;
  anneeScolaire: AnneeScolaire;
  creneaux: Creneau[];
  statut: StatutEmploi;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedByNom: string;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────
// IDENTIFIANT DÉTERMINISTE
//   Permet un getDoc direct (pas d'index composite) et garantit
//   l'unicité « une classe = un emploi du temps par année ».
//   Ex : ('6ème', '2025-2026') → "6eme_2025-2026"
// ─────────────────────────────────────────────────────────────
export function emploiDuTempsId(classe: Classe, annee: AnneeScolaire): string {
  const slug = classe
    .toLowerCase()
    .replace(/[èéêë]/g, 'e')   // 6ème/5ème/4ème/3ème/1ère → e (ASCII-safe)
    .replace(/[àâä]/g, 'a')
    .replace(/\s+/g, '');      // retire les espaces éventuels
  return `${slug}_${annee}`;
}

/** Génère un identifiant local simple pour un créneau. */
export function genererCreneauId(): string {
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
