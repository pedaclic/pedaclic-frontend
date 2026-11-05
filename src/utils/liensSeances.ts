// ============================================================
// PedaClic — Phase 52 : liens « titre / créneau → séance »
// ------------------------------------------------------------
// Logique PURE (aucun appel Firestore) partagée par :
//   • CahierDetailPage : chaque titre d'une rubrique devient un
//     lien vers la séance correspondante (en cours ou achevée),
//     ou vers une nouvelle séance pré-remplie s'il n'en existe pas.
//   • EdtAujourdhui    : chaque cours du bandeau ouvre la séance
//     déjà saisie à cette date, sinon une nouvelle séance.
// ============================================================

import type { CahierTextes, EntreeCahier, RubriqueCahier } from '../types/cahierTextes.types';
import type { CreneauContexte, JourSemaine } from '../types/emploiDuTemps.types';
import { JOURS_SEMAINE } from '../types/emploiDuTemps.types';
import type { OuvrirCahierInfo } from '../components/prof/EmploiDuTempsDrawer';
import { normaliserLibelleRubrique, resoudreRubriqueIdPourEntree } from '../services/cahierTextesService';

// ─────────────────────────────────────────────────────────────
// 1. DATES — format « YYYY-MM-DD » identique au formulaire de séance
// ─────────────────────────────────────────────────────────────

/**
 * Clé jour d'une séance enregistrée.
 * Les séances sont créées avec `new Date('YYYY-MM-DD')` (minuit UTC) et
 * relues par l'éditeur avec `toISOString().slice(0, 10)` : on applique
 * EXACTEMENT la même règle pour rester cohérent avec l'existant.
 */
export function cleJourEntree(e: Pick<EntreeCahier, 'date'>): string {
  const d = e.date?.toDate?.();
  return d ? d.toISOString().slice(0, 10) : '';
}

/** Clé jour d'une date du calendrier local (composantes locales) */
export function cleJourLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Lundi de la semaine de référence (00:00 local), décalé de `offset` semaines.
 * Le dimanche, on bascule sur la semaine qui commence le lendemain
 * (même convention que `jourCourant()` : dimanche → lundi).
 */
export function lundiDeSemaine(offset = 0, ref: Date = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const jour = d.getDay(); // 0 = dimanche … 6 = samedi
  const delta = jour === 0 ? 1 : 1 - jour;
  d.setDate(d.getDate() + delta + offset * 7);
  return d;
}

/** Date (locale) d'un jour de la semaine commençant au lundi donné */
export function dateDuJour(lundi: Date, jour: JourSemaine): Date {
  const idx = JOURS_SEMAINE.findIndex(j => j.valeur === jour);
  const d = new Date(lundi);
  d.setDate(d.getDate() + Math.max(0, idx));
  return d;
}

// ─────────────────────────────────────────────────────────────
// 2. TITRE DE RUBRIQUE → SÉANCE(S)
// ─────────────────────────────────────────────────────────────

/** Séparateur interne des clés (caractère improbable dans un titre) */
const SEP = '␟';

/** Clé d'indexation « rubrique + titre normalisé » */
const cleTitreSeance = (rubriqueId: string | null, nomTitre: string) =>
  `${rubriqueId ?? ''}${SEP}${normaliserLibelleRubrique(nomTitre)}`;

/**
 * Indexe les séances par (rubrique, titre) — la séance est rattachée à un
 * titre lorsque son champ `chapitre` reprend le nom du titre (c'est ce que
 * fait l'éditeur quand on choisit un titre dans la liste déroulante).
 * Chaque liste est triée de la plus récente à la plus ancienne.
 */
export function indexerSeancesParTitre(
  entrees: EntreeCahier[],
  rubriques: RubriqueCahier[],
): Map<string, EntreeCahier[]> {
  const index = new Map<string, EntreeCahier[]>();
  for (const e of entrees) {
    if (!e.chapitre?.trim()) continue;
    const rid = resoudreRubriqueIdPourEntree(e, rubriques);
    const cle = cleTitreSeance(rid, e.chapitre);
    index.set(cle, [...(index.get(cle) ?? []), e]);
  }
  for (const liste of index.values()) {
    liste.sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));
  }
  return index;
}

/**
 * Séances liées à un titre :
 *   1) séances de la MÊME rubrique portant ce titre ;
 *   2) à défaut, séances SANS rubrique portant ce titre (anciennes saisies).
 * Une séance d'une autre rubrique n'est jamais retenue (évite les
 * confusions entre deux « Introduction » de modules différents).
 */
export function seancesDuTitre(
  index: Map<string, EntreeCahier[]>,
  rubriqueId: string,
  nomTitre: string,
): EntreeCahier[] {
  return index.get(cleTitreSeance(rubriqueId, nomTitre))
      ?? index.get(cleTitreSeance(null, nomTitre))
      ?? [];
}

// ─────────────────────────────────────────────────────────────
// 3. CRÉNEAU DE L'EMPLOI DU TEMPS → CAHIER → SÉANCE
// ─────────────────────────────────────────────────────────────

/**
 * Cahier correspondant à un créneau (logique historique de
 * CahierTextesPage, désormais partagée) :
 *   1) cahier du GROUPE exact (groupeIds) ;
 *   2) sinon classe + matière, en privilégiant le même établissement.
 */
export function trouverCahierPourCreneau(
  cahiers: CahierTextes[],
  info: Pick<OuvrirCahierInfo, 'classe' | 'matiere' | 'groupeId' | 'etablissementId'>,
): CahierTextes | undefined {
  let found = info.groupeId
    ? cahiers.find(c => (c.groupeIds ?? []).includes(info.groupeId as string))
    : undefined;
  if (!found && info.matiere) {
    const candidats = cahiers.filter(c => c.classe === info.classe && c.matiere === info.matiere);
    found = candidats.find(c => (c.etablissementId ?? null) === (info.etablissementId ?? null))
         ?? candidats[0];
  }
  return found;
}

/**
 * Associe les créneaux d'UN cahier pour UN jour aux séances saisies ce jour-là.
 *   1) correspondance exacte sur l'heure de début ;
 *   2) puis appariement dans l'ordre chronologique des séances restantes
 *      (cas des séances saisies sans heure : 1er créneau ↔ 1re séance…).
 * Retourne Map<cle du créneau, séance>.
 */
export function associerSeancesAuxCreneaux(
  creneaux: CreneauContexte[],
  seancesDuJour: EntreeCahier[],
): Map<string, EntreeCahier> {
  const resultat = new Map<string, EntreeCahier>();
  const restantes = [...seancesDuJour].sort((a, b) =>
    (a.heureDebut || '99:99').localeCompare(b.heureDebut || '99:99') || (a.ordre ?? 0) - (b.ordre ?? 0)
  );
  const creneauxTries = [...creneaux].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

  // Passe 1 — même heure de début
  const sansSeance: CreneauContexte[] = [];
  for (const c of creneauxTries) {
    const i = restantes.findIndex(e => e.heureDebut && e.heureDebut === c.heureDebut);
    if (i >= 0) { resultat.set(c.cle, restantes[i]); restantes.splice(i, 1); }
    else sansSeance.push(c);
  }
  // Passe 2 — appariement dans l'ordre, uniquement avec des séances sans heure
  //            (une séance à 10:10 ne doit pas « voler » le créneau de 15:00)
  const sansHeure = restantes.filter(e => !e.heureDebut);
  sansSeance.forEach((c, i) => { if (sansHeure[i]) resultat.set(c.cle, sansHeure[i]); });
  return resultat;
}
