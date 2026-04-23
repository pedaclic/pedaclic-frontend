/**
 * ============================================================
 * UTILITAIRE : Formatage des noms d'élèves "Prénoms NOM"
 * ============================================================
 *
 * Règle métier (PedaClic / Sénégal) :
 *   - Format canonique affiché : « Prénoms NOM »
 *   - Le dernier mot est traité comme NOM de famille et passé
 *     en MAJUSCULES (éventuels accents conservés).
 *   - Les mots précédents sont les prénoms (casse préservée
 *     avec première lettre capitalisée pour un rendu propre).
 *
 * Exemples :
 *   "déguène sy"         → "Déguène SY"
 *   "Kor Diop THIAM"     → "Kor Diop THIAM"
 *   "aliou badara touré" → "Aliou Badara TOURÉ"
 *   "Sow"                → "SOW"        (nom seul → MAJ)
 *   "  "                 → ""
 *
 * Le tri alphabétique est fait sur le NOM de famille
 * (meilleure pratique pour un appel de classe).
 *
 * Fichier : src/utils/formatNom.ts
 * ============================================================
 */

/**
 * Met en majuscules un mot en respectant les accents (Unicode).
 * "touré" → "TOURÉ"
 */
function toUpperAccent(str: string): string {
  return str.toLocaleUpperCase('fr-FR');
}

/**
 * Capitalise la première lettre d'un mot (prénom).
 * "déguène" → "Déguène"
 * "jean-pierre" → "Jean-Pierre"  (gère les traits d'union)
 */
function capitalizeFirst(str: string): string {
  if (!str) return '';
  // Gérer les noms composés avec trait d'union
  return str
    .split('-')
    .map((part) => {
      if (!part) return '';
      return part.charAt(0).toLocaleUpperCase('fr-FR') + part.slice(1).toLocaleLowerCase('fr-FR');
    })
    .join('-');
}

/**
 * Formate un nom complet en "Prénoms NOM".
 *
 * @param nomComplet - Nom brut depuis la base (peut être en casse variée)
 * @returns Nom formaté, ou chaîne vide si l'entrée est vide
 *
 * Heuristique : le dernier "token" (mot séparé par un espace)
 * est le NOM de famille. Tout ce qui précède = prénoms.
 */
export function formatEleveNom(nomComplet?: string | null): string {
  if (!nomComplet) return '';
  const trim = String(nomComplet).trim().replace(/\s+/g, ' ');
  if (!trim) return '';

  const parts = trim.split(' ');
  // Cas : un seul mot → considéré comme nom de famille → MAJ
  if (parts.length === 1) {
    return toUpperAccent(parts[0]);
  }

  // Cas général : dernier mot = NOM, autres = prénoms
  const nom = toUpperAccent(parts[parts.length - 1]);
  const prenoms = parts.slice(0, -1).map(capitalizeFirst).join(' ');
  return `${prenoms} ${nom}`;
}

/**
 * Extrait uniquement le NOM de famille formaté (pour tri/affichage).
 */
export function extraireNomFamille(nomComplet?: string | null): string {
  if (!nomComplet) return '';
  const trim = String(nomComplet).trim().replace(/\s+/g, ' ');
  if (!trim) return '';
  const parts = trim.split(' ');
  return toUpperAccent(parts[parts.length - 1]);
}

/**
 * Comparateur de tri alphabétique par NOM de famille (A→Z).
 * À utiliser avec Array.sort() — ex. pour l'appel ou la feuille de notes.
 *
 * Usage :
 *   eleves.sort((a, b) => compareParNomFamille(a.eleveNom, b.eleveNom));
 */
export function compareParNomFamille(a?: string | null, b?: string | null): number {
  const nomA = extraireNomFamille(a);
  const nomB = extraireNomFamille(b);
  return nomA.localeCompare(nomB, 'fr-FR', { sensitivity: 'base' });
}
