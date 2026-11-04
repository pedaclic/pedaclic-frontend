// ============================================================
// PedaClic — Phase 46 : Organisateur des cahiers de textes
// Types « Établissement » (carnet PERSONNEL du professeur)
// ------------------------------------------------------------
// Un professeur qui officie dans plusieurs établissements les
// enregistre une fois ; chaque cahier de textes peut ensuite y
// être rattaché (champ optionnel `etablissementId`).
// Collection Firestore : `etablissements_prof` (1 doc / établissement)
// ============================================================

import type { Timestamp } from 'firebase/firestore';

/** Couleurs proposées pour les pastilles d'établissement */
export const COULEURS_ETABLISSEMENT = [
  '#1F3864', // Bleu marine PedaClic
  '#2563eb', // Bleu
  '#059669', // Vert
  '#d97706', // Ambre
  '#C00000', // Rouge PedaClic
  '#7c3aed', // Violet
  '#0891b2', // Cyan
  '#db2777', // Rose
] as const;

/** Établissement enregistré par un professeur */
export interface EtablissementProf {
  id: string;
  /** Propriétaire — utilisé par les règles Firestore */
  profId: string;
  /** Nom complet : « Lycée Lamine Guèye » */
  nom: string;
  /** Sigle court affiché sur les cartes : « LLG » (optionnel) */
  sigle: string;
  /** Ville / localité (optionnel) */
  ville: string;
  /** Inspection de rattachement — IA / IEF (optionnel, utile Phase 49 cellules) */
  ief: string;
  /** Couleur de la pastille */
  couleur: string;
  /** Ordre d'affichage (croissant) */
  ordre: number;
  /** Établissement quitté : masqué des choix, historique conservé */
  isArchived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Données saisies dans le formulaire d'établissement */
export type EtablissementFormData = Pick<
  EtablissementProf,
  'nom' | 'sigle' | 'ville' | 'ief' | 'couleur'
>;

export const etablissementFormVide = (): EtablissementFormData => ({
  nom: '',
  sigle: '',
  ville: '',
  ief: '',
  couleur: COULEURS_ETABLISSEMENT[0],
});

/** Libellé court d'un établissement : sigle s'il existe, sinon nom */
export function libelleCourtEtablissement(
  e: Pick<EtablissementProf, 'nom' | 'sigle'> | null | undefined
): string {
  if (!e) return '';
  return e.sigle?.trim() || e.nom;
}

/** Valeur spéciale du filtre : cahiers sans établissement */
export const FILTRE_SANS_ETABLISSEMENT = '__aucun__';
