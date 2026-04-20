// ============================================================
// PedaClic — Types Plans Premium et Cours à la carte
// www.pedaclic.sn | Extension Cours à la carte
// ============================================================
// Formules : 1 cours, 3 cours, 7 cours, Tous les contenus
// Prix mensuels en FCFA
// ============================================================

/**
 * Type de formule Premium
 * - illimite_3m / illimite_6m / illimite_1an : accès illimité
 * - a_la_carte_1 / a_la_carte_3 / a_la_carte_7 / a_la_carte_tous : Cours à la carte
 */
export type FormulePremium =
  | 'illimite_3m'
  | 'illimite_6m'
  | 'illimite_1an'
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
 * Plans Premium accès illimité
 * 10 000 FCFA / 3 mois ; 20 000 FCFA / 6 mois ; 30 000 FCFA / an
 */
export const PLANS_CLASSIQUES: PlanPremium[] = [
  {
    id: 'illimite_3m',
    nom: '3 mois',
    description: 'Accès illimité à tous les cours',
    prix: 10000,
    duree: '3 mois',
    nombreCoursMax: null,
    accesIllimite: true,
  },
  {
    id: 'illimite_6m',
    nom: '6 mois',
    description: 'Accès illimité à tous les cours',
    prix: 20000,
    duree: '6 mois',
    economie: '10 000 FCFA vs 2×3 mois',
    popular: true,
    nombreCoursMax: null,
    accesIllimite: true,
  },
  {
    id: 'illimite_1an',
    nom: '1 an',
    description: 'Accès illimité à tous les cours',
    prix: 30000,
    duree: '12 mois',
    economie: '30 000 FCFA vs 4×3 mois',
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
    duree: '9 mois',
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
export function estFormuleALaCarte(formule: FormulePremium | string | undefined): boolean {
  if (!formule || typeof formule !== 'string') return false;
  return formule.startsWith('a_la_carte_');
}

/**
 * Retourne le nombre max de cours pour une formule
 */
export function getNombreCoursMax(formule: FormulePremium | string | undefined): number | null {
  if (!formule) return null;
  const plan = TOUS_LES_PLANS.find(p => p.id === formule);
  return plan?.nombreCoursMax ?? null;
}

/**
 * Vérifie si l'utilisateur a accès illimité
 */
export function aAccesIllimite(formule: FormulePremium | string | undefined): boolean {
  if (!formule) return false;
  const plan = TOUS_LES_PLANS.find(p => p.id === formule);
  if (plan) return plan.accesIllimite;
  return ['mensuel', 'annuel', 'illimite_3m', 'illimite_6m', 'illimite_1an'].includes(formule);
}

/** Formules Premium Pro : accès illimité aux ressources (générations, téléchargements, séquences) */
const FORMULES_PREMIUM_PRO: FormulePremium[] = ['illimite_1an', 'a_la_carte_tous'];

/**
 * Vérifie si la formule est Premium Pro (accès illimité aux ressources)
 * Premium Pro = illimite_1an ou a_la_carte_tous
 */
export function estPremiumPro(formule: FormulePremium | string | undefined): boolean {
  if (!formule) return false;
  return (FORMULES_PREMIUM_PRO as string[]).includes(formule);
}

/**
 * Limites de ressources MENSUELLES (générations IA + téléchargements + séquences)
 *
 * ÉVOLUTION (avril 2026) :
 * - Avant : 30/mois pour toutes les formules non-Pro
 * - Désormais :
 *   • Premium Pro (illimite_1an, a_la_carte_tous) → illimité (null)
 *   • Premium annuel legacy ("annuel") → 70/mois
 *   • Toutes les autres formules Premium (mensuel, illimite_3m, illimite_6m,
 *     a_la_carte_1/3/7) → 50/mois
 *
 * La limite constante historique LIMITE_RESSOURCES_NON_PRO est conservée
 * comme alias de compatibilité (= 50) pour ne casser aucun import externe.
 */
export const LIMITE_RESSOURCES_STANDARD = 50; // mensuel, 3m, 6m, à la carte 1/3/7
export const LIMITE_RESSOURCES_ANNUEL = 70;   // formule "annuel" legacy

/** @deprecated Utiliser LIMITE_RESSOURCES_STANDARD. Conservé pour compat ascendante. */
export const LIMITE_RESSOURCES_NON_PRO = LIMITE_RESSOURCES_STANDARD;

/** Liste des identifiants de formule annuelle NON-Pro (legacy) */
const FORMULES_ANNUELLES_NON_PRO = ['annuel'];

/**
 * Retourne la limite MENSUELLE de ressources pour une formule.
 * - null  → accès illimité (Premium Pro)
 * - 70    → formule annuelle non-Pro ('annuel' legacy)
 * - 50    → toutes les autres formules premium / par défaut
 */
export function getLimiteRessources(formule: FormulePremium | string | undefined): number | null {
  // Premium Pro → illimité (comportement inchangé)
  if (estPremiumPro(formule)) return null;

  // Formule annuelle non-Pro (legacy) → 70/mois
  if (typeof formule === 'string' && FORMULES_ANNUELLES_NON_PRO.includes(formule)) {
    return LIMITE_RESSOURCES_ANNUEL;
  }

  // Toutes les autres formules (y compris undefined) → 50/mois
  return LIMITE_RESSOURCES_STANDARD;
}
