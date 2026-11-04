// ============================================================
// PedaClic — Phase 51 : statistiques de notes (logique PURE)
// ------------------------------------------------------------
// Calculées CHEZ le professeur à partir de sa feuille de notes ;
// seuls les agrégats sont publiés dans la cellule (anonymat).
// Toutes les notes sont ramenées sur 20 pour comparer les classes.
// ============================================================

import { TRANCHES_NOTES, type ResultatsEpreuve } from '../types/cellule.types';

export type AgregatsNotes = Omit<ResultatsEpreuve, 'id' | 'profNom' | 'groupeNom' | 'updatedAt'>;

const arrondi = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * @param notesBrutes notes saisies (sur `noteSur`)
 * @param effectif    nombre d'élèves de la classe
 * @param noteSur     barème de l'épreuve (20 par défaut)
 */
export function calculerStatistiques(notesBrutes: number[], effectif: number, noteSur = 20): AgregatsNotes {
  // Ramène sur 20 et écarte les valeurs aberrantes
  const notes = notesBrutes
    .filter(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= noteSur)
    .map(n => (n * 20) / (noteSur || 20))
    .sort((a, b) => a - b);

  const n = notes.length;
  const repartition = TRANCHES_NOTES.map(t => notes.filter(x => x >= t.min && x < t.max).length);
  if (n === 0) {
    return { effectif, presents: 0, moyenne: 0, mediane: 0, min: 0, max: 0, ecartType: 0, tauxReussite: 0, repartition };
  }

  const somme = notes.reduce((s, x) => s + x, 0);
  const moyenne = somme / n;
  const mediane = n % 2 ? notes[(n - 1) / 2] : (notes[n / 2 - 1] + notes[n / 2]) / 2;
  const variance = notes.reduce((s, x) => s + (x - moyenne) ** 2, 0) / n;

  return {
    effectif: Math.max(effectif, n),
    presents: n,
    moyenne: arrondi(moyenne),
    mediane: arrondi(mediane),
    min: arrondi(notes[0]),
    max: arrondi(notes[n - 1]),
    ecartType: arrondi(Math.sqrt(variance)),
    tauxReussite: arrondi((notes.filter(x => x >= 10).length / n) * 100, 1),
    repartition,
  };
}

/**
 * Agrège les résultats de plusieurs classes (vue « cellule »).
 * Moyenne PONDÉRÉE par le nombre de présents ; écart-type global
 * reconstitué par la formule de décomposition de la variance.
 * La médiane globale n'est pas calculable sans notes individuelles.
 */
export function agregerResultats(liste: Array<Pick<ResultatsEpreuve,
  'effectif' | 'presents' | 'moyenne' | 'min' | 'max' | 'ecartType' | 'tauxReussite' | 'repartition'>>
): Omit<AgregatsNotes, 'mediane'> | null {
  const avecNotes = liste.filter(r => r.presents > 0);
  if (!avecNotes.length) return null;
  const N = avecNotes.reduce((s, r) => s + r.presents, 0);
  const moyenne = avecNotes.reduce((s, r) => s + r.moyenne * r.presents, 0) / N;
  // Var totale = Σ nᵢ (σᵢ² + (μᵢ − μ)²) / N
  const variance = avecNotes.reduce((s, r) => s + r.presents * (r.ecartType ** 2 + (r.moyenne - moyenne) ** 2), 0) / N;
  const reussis = avecNotes.reduce((s, r) => s + (r.tauxReussite / 100) * r.presents, 0);
  return {
    effectif: liste.reduce((s, r) => s + r.effectif, 0),
    presents: N,
    moyenne: arrondi(moyenne),
    min: Math.min(...avecNotes.map(r => r.min)),
    max: Math.max(...avecNotes.map(r => r.max)),
    ecartType: arrondi(Math.sqrt(variance)),
    tauxReussite: arrondi((reussis / N) * 100, 1),
    repartition: TRANCHES_NOTES.map((_, i) => liste.reduce((s, r) => s + (r.repartition[i] ?? 0), 0)),
  };
}
