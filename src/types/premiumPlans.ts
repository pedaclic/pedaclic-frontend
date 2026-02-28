// ============================================================
// PedaClic — Types Plans Premium et Cours à la carte
// www.pedaclic.sn | Extension Cours à la carte
// ============================================================
// Formules : 1 cours, 3 cours, 7 cours, Tous les contenus
// Prix mensuels en FCFA
// ============================================================

/**
 * Type de formule Premium
 * - mensuel / annuel : accès illimité (formule classique)
 * - a_la_carte_1 / a_la_carte_3 / a_la_carte_7 / a_la_carte_tous : Cours à la carte
 */
export type FormulePremium =
  | 'mensuel'
  | 'annuel'
  | 'a_la_carte_1'
  | 'a_la_carte_3'
  | 'a_la_carte_7'
  | 'a_la_carte_tous';

/**
 * Configuration d'un plan Premium
 */
export interface PlanPremium {
  id: FormulePremium;
  nom: string;
  description: string;
  prix: number;
  prixOriginal?: number;
  duree: string;
  economie?: string;
  popular?: boolean;
  /** Nombre max de cours accessibles (null = illimité) */
  nombreCoursMax: number | null;
  /** True si accès à tous les contenus sans limite */
  accesIllimite: boolean;
}

/**
 * Plans Premium classiques (accès illimité)
 */
export const PLANS_CLASSIQUES: PlanPremium[] = [
  {
    id: 'mensuel',
    nom: 'Mensuel',
    description: 'Accès illimité à tous les cours',
    prix: 2000,
    duree: '1 mois',
    nombreCoursMax: null,
    accesIllimite: true,
  },
  {
    id: 'annuel',
    nom: 'Annuel',
    description: 'Accès illimité à tous les cours',
    prix: 20000,
    prixOriginal: 24000,
    duree: '12 mois',
    economie: '4 000 FCFA',
    popular: true,
    nombreCoursMax: null,
    accesIllimite: true,
  },
];

/**
 * Plans Cours à la carte (choix par discipline et niveau)
 */
export const PLANS_A_LA_CARTE: PlanPremium[] = [
  {
    id: 'a_la_carte_1',
    nom: '1 cours',
    description: 'Choisissez 1 cours par discipline et niveau',
    prix: 1000,
    duree: '1 mois',
    nombreCoursMax: 1,
    accesIllimite: false,
  },
  {
    id: 'a_la_carte_3',
    nom: '3 cours',
    description: 'Choisissez 3 cours par discipline et niveau',
    prix: 2000,
    duree: '1 mois',
    nombreCoursMax: 3,
    accesIllimite: false,
  },
  {
    id: 'a_la_carte_7',
    nom: '7 cours',
    description: 'Choisissez 7 cours par discipline et niveau',
    prix: 5000,
    duree: '1 mois',
    nombreCoursMax: 7,
    accesIllimite: false,
  },
  {
    id: 'a_la_carte_tous',
    nom: 'Tous les contenus',
    description: 'Accès à l\'intégralité du catalogue',
    prix: 25000,
    duree: '1 mois',
    nombreCoursMax: null,
    accesIllimite: true,
  },
];

/** Tous les plans Premium */
export const TOUS_LES_PLANS: PlanPremium[] = [
  ...PLANS_A_LA_CARTE,
  ...PLANS_CLASSIQUES,
];

/**
 * Vérifie si une formule est "à la carte" (choix limité de cours)
 */
export function estFormuleALaCarte(formule: FormulePremium): boolean {
  return formule.startsWith('a_la_carte_');
}

/**
 * Retourne le nombre max de cours pour une formule
 */
export function getNombreCoursMax(formule: FormulePremium): number | null {
  const plan = TOUS_LES_PLANS.find(p => p.id === formule);
  return plan?.nombreCoursMax ?? null;
}

/**
 * Vérifie si l'utilisateur a accès illimité
 */
export function aAccesIllimite(formule: FormulePremium): boolean {
  const plan = TOUS_LES_PLANS.find(p => p.id === formule);
  return plan?.accesIllimite ?? false;
}
