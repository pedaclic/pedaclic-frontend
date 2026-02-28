// ============================================================
// PedaClic — Phase 27 : Types — Module Médiathèque
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { Timestamp } from 'firebase/firestore';

/** Type de média — détermine le lecteur à utiliser */
export type TypeMedia =
  | 'video'
  | 'audio'
  | 'podcast'
  | 'webinaire';

/** Statut de publication du média */
export type StatutMedia =
  | 'publie'
  | 'brouillon'
  | 'archive';

/** Qualité de streaming disponible */
export type QualiteVideo = '360p' | '480p' | '720p' | 'auto';

export interface MediaItem {
  id: string;
  titre: string;
  description: string;
  type: TypeMedia;
  url: string;
  urlBasse?: string;
  thumbnailUrl?: string;
  duree: number;
  taille: number;
  mimeType: string;
  discipline: string;
  disciplineId: string;
  classe: string;
  niveau: string;
  tags: string[];
  isPremium: boolean;
  auteurId: string;
  auteurNom: string;
  statut: StatutMedia;
  vues: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MediaVue {
  id: string;
  mediaId: string;
  userId: string;
  vueAt: Timestamp;
  dureeVisionnee: number;
  positionReprise: number;
  estTermine: boolean;
}

export interface FiltresMediatheque {
  type: TypeMedia | 'all';
  discipline: string;
  niveau: string;
  recherche: string;
  acces: 'all' | 'gratuit' | 'premium';
}

export interface EtatLecteur {
  enLecture: boolean;
  position: number;
  dureeTotal: number;
  volume: number;
  pleinEcran: boolean;
  chargement: boolean;
  erreur: string | null;
}

export type MediaFormData = Omit<
  MediaItem,
  'id' | 'auteurId' | 'auteurNom' | 'createdAt' | 'updatedAt' | 'vues'
>;

export const CONFIG_TYPE_MEDIA: Record<
  TypeMedia,
  { label: string; emoji: string; couleur: string; bg: string; accept: string }
> = {
  video:     { label: 'Vidéo',     emoji: '🎬', couleur: '#2563eb', bg: '#eff6ff', accept: 'video/*' },
  audio:     { label: 'Audio',     emoji: '🎵', couleur: '#7c3aed', bg: '#f5f3ff', accept: 'audio/*' },
  podcast:   { label: 'Podcast',   emoji: '🎙️', couleur: '#059669', bg: '#ecfdf5', accept: 'audio/*' },
  webinaire: { label: 'Webinaire', emoji: '🎓', couleur: '#d97706', bg: '#fffbeb', accept: 'video/*' },
};

export const CONFIG_STATUT_MEDIA: Record<
  StatutMedia,
  { label: string; couleur: string; bg: string }
> = {
  publie:    { label: 'Publié',    couleur: '#16a34a', bg: '#f0fdf4' },
  brouillon: { label: 'Brouillon', couleur: '#6b7280', bg: '#f3f4f6' },
  archive:   { label: 'Archivé',  couleur: '#9ca3af', bg: '#f9fafb' },
};

export const DUREE_APERCU_GRATUIT = 30;

export const DISCIPLINES_MEDIATHEQUE = [
  'Mathématiques',
  'Français',
  'Sciences de la Vie et de la Terre (SVT)',
  'Histoire-Géographie',
  'Physique-Chimie',
  'Anglais',
  'Philosophie',
  'Sciences Économiques et Sociales',
  'Éducation Civique',
  'Informatique',
  'Arabe',
] as const;

export const NIVEAUX_MEDIATHEQUE = [
  { valeur: '6eme',      label: '6ème' },
  { valeur: '5eme',      label: '5ème' },
  { valeur: '4eme',      label: '4ème' },
  { valeur: '3eme',      label: '3ème (BFEM)' },
  { valeur: '2nde',      label: '2nde' },
  { valeur: '1ere',      label: '1ère' },
  { valeur: 'terminale', label: 'Terminale (BAC)' },
] as const;

export function formatDuree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTaille(octets: number): string {
  if (octets === 0) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  if (octets < 1024 * 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(octets / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}
