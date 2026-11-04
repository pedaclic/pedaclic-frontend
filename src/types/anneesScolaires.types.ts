// ============================================================
// PedaClic — Phase 45 : Types — Années scolaires administrables
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ------------------------------------------------------------
// Stockage : settings/annees_scolaires (lecture publique,
//            écriture admin — règle existante `settings/{docId}`).
// Écran    : /admin/annees-scolaires (AnneesScolairesManager).
//
// Principe : l'application doit TOUJOURS fonctionner, même si le
// document Firestore n'existe pas encore (première mise en ligne)
// ou si le réseau est indisponible. Toutes les fonctions ci-dessous
// sont donc pures et disposent de valeurs par défaut sûres.
// ============================================================

import { ANNEES_SCOLAIRES } from './cahierTextes.types';

// ------------------------------------------------------------
// 1. MODÈLE DE DONNÉES
// ------------------------------------------------------------

/** Une année scolaire proposée dans les listes déroulantes */
export interface AnneeScolaireEntree {
  /** Libellé canonique « AAAA-AAAA » (ex. « 2026-2027 ») */
  libelle: string;
  /** false = masquée des listes (les données existantes restent intactes) */
  active: boolean;
}

/** Mode de détermination de l'année « en cours » */
export type ModeAnneeCourante = 'auto' | 'manuel';

/** Contenu du document settings/annees_scolaires */
export interface AnneesScolairesConfig {
  /** Années proposées aux enseignants (triées par ordre chronologique) */
  annees: AnneeScolaireEntree[];
  /**
   * 'auto'   → calculée d'après la date du jour et le mois de rentrée ;
   * 'manuel' → imposée par l'administrateur (anneeCouranteManuelle).
   */
  mode: ModeAnneeCourante;
  /** Année imposée en mode 'manuel' (ignorée en mode 'auto') */
  anneeCouranteManuelle: string | null;
  /** Mois de rentrée (1 = janvier … 12 = décembre). Sénégal : octobre (10). */
  moisRentree: number;
}

// ------------------------------------------------------------
// 2. CONSTANTES
// ------------------------------------------------------------

/** Mois de rentrée par défaut : octobre (calendrier scolaire sénégalais) */
export const MOIS_RENTREE_DEFAUT = 10;

/** Libellés des mois pour l'écran d'administration */
export const MOIS_LIBELLES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

/** Format strict « AAAA-AAAA » */
const REGEX_ANNEE = /^(\d{4})-(\d{4})$/;

// ------------------------------------------------------------
// 3. OUTILS PURS
// ------------------------------------------------------------

/** Vrai si le libellé respecte « AAAA-(AAAA+1) » (ex. 2026-2027) */
export function estAnneeScolaireValide(libelle: string | null | undefined): boolean {
  const m = REGEX_ANNEE.exec((libelle ?? '').trim());
  if (!m) return false;
  const debut = Number(m[1]);
  return Number(m[2]) === debut + 1 && debut >= 2000 && debut <= 2100;
}

/** Construit le libellé à partir de l'année de rentrée (2026 → « 2026-2027 ») */
export function libelleDepuisDebut(debut: number): string {
  return `${debut}-${debut + 1}`;
}

/** Année de rentrée d'un libellé (« 2026-2027 » → 2026), NaN si invalide */
export function debutAnnee(libelle: string): number {
  return Number(libelle.slice(0, 4));
}

/** Borne un mois de rentrée dans 1..12 (valeur par défaut sinon) */
function moisValide(mois: unknown): number {
  const n = Number(mois);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : MOIS_RENTREE_DEFAUT;
}

/**
 * Calcule l'année scolaire en cours d'après une date.
 * Ex. (rentrée en octobre) : 4 nov. 2026 → « 2026-2027 » ; 15 sept. 2026 → « 2025-2026 ».
 * Même règle que GroupeManager (mois >= octobre → nouvelle année).
 */
export function calculerAnneeScolaireEnCours(
  date: Date = new Date(),
  moisRentree: number = MOIS_RENTREE_DEFAUT,
): string {
  const mois = date.getMonth() + 1; // getMonth() est 0-indexé
  const debut = mois >= moisValide(moisRentree) ? date.getFullYear() : date.getFullYear() - 1;
  return libelleDepuisDebut(debut);
}

/** Trie des libellés par ordre chronologique et supprime les doublons / invalides */
export function trierAnnees(libelles: string[]): string[] {
  return Array.from(new Set(libelles.filter(estAnneeScolaireValide)))
    .sort((a, b) => debutAnnee(a) - debutAnnee(b));
}

// ------------------------------------------------------------
// 4. CONFIGURATION PAR DÉFAUT
// ------------------------------------------------------------

/**
 * Configuration utilisée tant que l'admin n'a rien enregistré.
 * Elle reprend les années historiques codées en dur (ANNEES_SCOLAIRES,
 * pour que les cahiers existants restent accessibles) + l'année
 * précédente, en cours et suivante.
 */
export function configParDefaut(date: Date = new Date()): AnneesScolairesConfig {
  const debutCourant = debutAnnee(calculerAnneeScolaireEnCours(date));
  const libelles = trierAnnees([
    ...ANNEES_SCOLAIRES,
    libelleDepuisDebut(debutCourant - 1),
    libelleDepuisDebut(debutCourant),
    libelleDepuisDebut(debutCourant + 1),
  ]);
  return {
    annees: libelles.map((libelle) => ({ libelle, active: true })),
    mode: 'auto',
    anneeCouranteManuelle: null,
    moisRentree: MOIS_RENTREE_DEFAUT,
  };
}

/**
 * Nettoie un document Firestore (partiel, ancien ou corrompu)
 * et garantit un objet complet et cohérent.
 */
export function normaliserConfig(data: Partial<AnneesScolairesConfig> | undefined | null): AnneesScolairesConfig {
  const defaut = configParDefaut();
  if (!data) return defaut;

  // Années : on garde les entrées valides, sans doublon, triées
  const vues = new Set<string>();
  const annees: AnneeScolaireEntree[] = (Array.isArray(data.annees) ? data.annees : [])
    .filter((a) => a && estAnneeScolaireValide(a.libelle))
    .map((a) => ({ libelle: a.libelle.trim(), active: a.active !== false }))
    .filter((a) => (vues.has(a.libelle) ? false : (vues.add(a.libelle), true)))
    .sort((a, b) => debutAnnee(a.libelle) - debutAnnee(b.libelle));

  const manuelle = estAnneeScolaireValide(data.anneeCouranteManuelle) ? data.anneeCouranteManuelle! : null;
  return {
    annees: annees.length > 0 ? annees : defaut.annees,
    // Mode manuel sans année valide → retour au calcul automatique
    mode: data.mode === 'manuel' && manuelle ? 'manuel' : 'auto',
    anneeCouranteManuelle: manuelle,
    moisRentree: moisValide(data.moisRentree),
  };
}

// ------------------------------------------------------------
// 5. RÉSOLUTION (utilisée par le hook et l'écran admin)
// ------------------------------------------------------------

/** Année « en cours » effective selon la configuration */
export function resoudreAnneeCourante(config: AnneesScolairesConfig, date: Date = new Date()): string {
  if (config.mode === 'manuel' && estAnneeScolaireValide(config.anneeCouranteManuelle)) {
    return config.anneeCouranteManuelle as string;
  }
  return calculerAnneeScolaireEnCours(date, config.moisRentree);
}

/**
 * Liste à afficher dans un <select> :
 *   années actives + année en cours (toujours présente)
 *   + valeurs « à conserver » (ex. l'année d'un cahier existant
 *     dont l'année a été désactivée — évite un <select> incohérent).
 */
export function anneesPourSelect(
  config: AnneesScolairesConfig,
  anneeCourante: string,
  aConserver: Array<string | null | undefined> = [],
): string[] {
  return trierAnnees([
    ...config.annees.filter((a) => a.active).map((a) => a.libelle),
    anneeCourante,
    ...(aConserver.filter(Boolean) as string[]),
  ]);
}
