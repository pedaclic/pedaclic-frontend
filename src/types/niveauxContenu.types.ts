// ============================================================
// PedaClic — Phase 44 : Types — Contenu éditorial des niveaux
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ------------------------------------------------------------
// Décrit le texte affiché :
//   • sur les 5 cartes « Tous les niveaux, toutes les matières »
//     de la page d'accueil ;
//   • dans l'en-tête des pages publiques /niveaux/:slug.
//
// Stockage Firestore : document unique  settings/niveaux
//   (collection "settings" : lecture publique, écriture admin —
//    règle déjà en place, aucune modification de firestore.rules)
//
// Si le document n'existe pas encore, les valeurs par défaut
// ci-dessous sont utilisées : elles reprennent MOT POUR MOT le
// contenu codé en dur jusqu'ici sur l'accueil → aucun changement
// visible tant que l'admin n'a rien modifié.
// ============================================================

import type { Niveau } from './index';

/** Contenu éditable d'un niveau (carte d'accueil + en-tête de page) */
export interface NiveauContenu {
  /** Afficher ce niveau sur l'accueil et rendre sa page accessible */
  actif: boolean;
  /** Emoji affiché sur la carte et dans l'en-tête */
  icone: string;
  /** Titre (ex. « Collège ») */
  titre: string;
  /** Ligne sous le titre (ex. « 6ème · 5ème · 4ème · 3ème ») */
  sousTitre: string;
  /** Points forts listés avec une coche verte (2 à 4 conseillés) */
  pointsForts: string[];
  /** Libellé du lien en bas de carte (ex. « Voir les cours ») */
  ctaLabel: string;
  /** Texte d'introduction affiché en haut de la page du niveau */
  introduction: string;
  /** Ordre d'affichage sur l'accueil (1 = premier) */
  ordre: number;
}

/** Document settings/niveaux : un bloc par niveau */
export type NiveauxContenuMap = Record<Niveau, NiveauContenu>;

/** Liste ordonnée des niveaux (ordre scolaire sénégalais) */
export const NIVEAUX_ORDONNES: Niveau[] = [
  'maternelle',
  'elementaire',
  'college',
  'lycee',
  'formation_libre',
];

// ------------------------------------------------------------
// CORRESPONDANCE slug d'URL ↔ Niveau
// L'URL utilise un tiret (« formation-libre »), Firestore un
// underscore (« formation_libre »). Les autres sont identiques.
// ------------------------------------------------------------

/** Niveau → slug d'URL */
export function niveauVersSlug(niveau: Niveau): string {
  return niveau.replace('_', '-');
}

/** Slug d'URL → Niveau (null si slug inconnu) */
export function slugVersNiveau(slug: string | undefined): Niveau | null {
  if (!slug) return null;
  const n = slug.toLowerCase().replace('-', '_') as Niveau;
  return NIVEAUX_ORDONNES.includes(n) ? n : null;
}

// ------------------------------------------------------------
// VALEURS PAR DÉFAUT — identiques à l'ancien Home.tsx
// ------------------------------------------------------------
export const NIVEAUX_CONTENU_DEFAUT: NiveauxContenuMap = {
  maternelle: {
    actif: true,
    icone: '🧒',
    titre: 'Maternelle',
    sousTitre: 'PS · MS · GS',
    pointsForts: ['Éveil et découverte', 'Activités ludiques'],
    ctaLabel: 'Découvrir',
    introduction:
      "Des activités d'éveil et de découverte pour accompagner les tout-petits de la Petite à la Grande Section.",
    ordre: 1,
  },
  elementaire: {
    actif: true,
    icone: '📖',
    titre: 'Élémentaire',
    sousTitre: 'CI · CP · CE1 · CE2 · CM1 · CM2',
    pointsForts: ['Fondamentaux solides', 'Exercices progressifs'],
    ctaLabel: 'Découvrir',
    introduction:
      "Lecture, écriture, calcul : des ressources progressives pour bâtir des fondamentaux solides du CI au CM2.",
    ordre: 2,
  },
  college: {
    actif: true,
    icone: '🏫',
    titre: 'Collège',
    sousTitre: '6ème · 5ème · 4ème · 3ème',
    pointsForts: ['Préparation au BFEM', 'Exercices corrigés'],
    ctaLabel: 'Voir les cours',
    introduction:
      "Cours, exercices corrigés et quiz conformes au programme sénégalais, de la 6ème jusqu'à la préparation du BFEM.",
    ordre: 3,
  },
  lycee: {
    actif: true,
    icone: '🎓',
    titre: 'Lycée',
    sousTitre: '2nde · 1ère · Terminale',
    pointsForts: ['Séries L, S, STEG, T', 'Préparation au BAC'],
    ctaLabel: 'Voir les cours',
    introduction:
      "Choisissez votre classe puis votre série pour accéder aux cours et ressources adaptés, jusqu'à la préparation du BAC.",
    ordre: 4,
  },
  formation_libre: {
    actif: true,
    icone: '🌍',
    titre: 'Formation libre',
    sousTitre: 'Tous publics',
    pointsForts: ['Apprentissage autonome', 'Contenus variés'],
    ctaLabel: 'Découvrir',
    introduction:
      "Des parcours ouverts à tous, du niveau débutant au niveau avancé, pour apprendre à votre rythme.",
    ordre: 5,
  },
};
