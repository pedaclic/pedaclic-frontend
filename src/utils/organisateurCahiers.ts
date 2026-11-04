// ============================================================
// PedaClic — Phase 46 : logique PURE de l'organisateur
// ------------------------------------------------------------
// Filtrage, regroupement et mémorisation des filtres de la liste
// /prof/cahiers. Aucune requête Firestore : tout se fait sur les
// cahiers déjà chargés (requête existante inchangée).
// ============================================================

import {
  CLASSES_PAR_NIVEAU,
  NIVEAUX_SCOLAIRES,
  type CahierTextes,
  type NiveauScolaire,
} from '../types/cahierTextes.types';
import {
  FILTRE_SANS_ETABLISSEMENT,
  libelleCourtEtablissement,
  type EtablissementProf,
} from '../types/etablissement.types';

// ─────────────────────────────────────────────────────────────
// ÉTAT DES FILTRES
// ─────────────────────────────────────────────────────────────
export type Regroupement = 'etablissement' | 'niveau' | 'aucun';

export interface FiltresOrganisateur {
  /** IDs d'établissements cochés (+ FILTRE_SANS_ETABLISSEMENT). Vide = tous */
  etablissements: string[];
  /** Cycle : '' = tous */
  cycle: NiveauScolaire | '';
  /** Classe précise : '' = toutes */
  classe: string;
  /** Matière : '' = toutes */
  matiere: string;
  /** Étiquettes (normalisées) : le cahier doit les porter TOUTES */
  etiquettes: string[];
  /** Recherche plein texte */
  recherche: string;
  regroupement: Regroupement;
}

export const filtresVides = (): FiltresOrganisateur => ({
  etablissements: [],
  cycle: '',
  classe: '',
  matiere: '',
  etiquettes: [],
  recherche: '',
  regroupement: 'etablissement',
});

/** Nombre de critères actifs (badge « Réinitialiser (n) ») */
export function nombreFiltresActifs(f: FiltresOrganisateur): number {
  return (f.etablissements.length ? 1 : 0) + (f.cycle ? 1 : 0) + (f.classe ? 1 : 0) +
         (f.matiere ? 1 : 0) + f.etiquettes.length + (f.recherche.trim() ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
// MÉMORISATION (localStorage — volontairement PAS dans l'URL :
// la page réagit aux paramètres d'URL — Phase 22 / Phase 40)
// ─────────────────────────────────────────────────────────────
const LS_FILTRES = 'pedaclic.cahier.organisateur';
const LS_DERNIER_ETAB = 'pedaclic.cahier.dernierEtablissement';

export function lireFiltresMemorises(): FiltresOrganisateur {
  try {
    const raw = localStorage.getItem(LS_FILTRES);
    if (!raw) return filtresVides();
    return { ...filtresVides(), ...(JSON.parse(raw) as Partial<FiltresOrganisateur>) };
  } catch {
    return filtresVides();
  }
}

export function memoriserFiltres(f: FiltresOrganisateur): void {
  try { localStorage.setItem(LS_FILTRES, JSON.stringify(f)); } catch { /* stockage indisponible */ }
}

export function lireDernierEtablissement(): string {
  try { return localStorage.getItem(LS_DERNIER_ETAB) || ''; } catch { return ''; }
}

export function memoriserDernierEtablissement(id: string): void {
  try { localStorage.setItem(LS_DERNIER_ETAB, id); } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────
// OUTILS
// ─────────────────────────────────────────────────────────────

/** Normalise pour comparaison : minuscules, sans accents, espaces réduits */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nettoie une liste d'étiquettes saisies (doublons, vides, longueur) */
export function nettoyerEtiquettes(liste: string[]): string[] {
  const vues = new Set<string>();
  const res: string[] = [];
  for (const brut of liste) {
    const e = brut.replace(/\s+/g, ' ').trim().slice(0, 40);
    const cle = normaliser(e);
    if (e && !vues.has(cle)) { vues.add(cle); res.push(e); }
  }
  return res.slice(0, 10);
}

/** Cycle (collège, lycée…) d'une classe */
export function cycleDeClasse(classe: string): NiveauScolaire | null {
  for (const [cycle, options] of Object.entries(CLASSES_PAR_NIVEAU)) {
    if (options.some(o => o.valeur === classe)) return cycle as NiveauScolaire;
  }
  return null;
}

/** « 3ème B » si une division est renseignée, sinon « 3ème » */
export function libelleClasse(c: Pick<CahierTextes, 'classe' | 'division'>): string {
  return c.division?.trim() ? `${c.classe} ${c.division.trim()}` : c.classe;
}

/** Toutes les étiquettes déjà utilisées (suggestions de saisie) */
export function etiquettesConnues(cahiers: CahierTextes[]): string[] {
  return nettoyerEtiquettes(cahiers.flatMap(c => c.etiquettes ?? []))
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

// ─────────────────────────────────────────────────────────────
// FILTRAGE
// ─────────────────────────────────────────────────────────────
export function filtrerCahiers(
  cahiers: CahierTextes[],
  f: FiltresOrganisateur,
  etabsParId: Map<string, EtablissementProf>
): CahierTextes[] {
  const motCle = normaliser(f.recherche);
  const etiquettesVoulues = f.etiquettes.map(normaliser);

  return cahiers.filter(c => {
    // 1. Établissement (un ID inconnu = établissement supprimé → « non classé »)
    if (f.etablissements.length) {
      const cle = c.etablissementId && etabsParId.has(c.etablissementId)
        ? c.etablissementId
        : FILTRE_SANS_ETABLISSEMENT;
      if (!f.etablissements.includes(cle)) return false;
    }
    // 2. Cycle puis classe
    if (f.cycle && cycleDeClasse(c.classe) !== f.cycle) return false;
    if (f.classe && c.classe !== f.classe) return false;
    // 3. Matière
    if (f.matiere && c.matiere !== f.matiere) return false;
    // 4. Étiquettes (ET logique)
    if (etiquettesVoulues.length) {
      const siennes = (c.etiquettes ?? []).map(normaliser);
      if (!etiquettesVoulues.every(e => siennes.includes(e))) return false;
    }
    // 5. Recherche plein texte
    if (motCle) {
      const etab = c.etablissementId ? etabsParId.get(c.etablissementId) : undefined;
      const texte = normaliser([
        c.titre, c.description ?? '', libelleClasse(c), c.matiere, c.anneeScolaire,
        etab?.nom ?? c.etablissementNom ?? '', etab?.sigle ?? '',
        ...(c.etiquettes ?? []),
      ].join(' '));
      if (!texte.includes(motCle)) return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// REGROUPEMENT
// ─────────────────────────────────────────────────────────────
export interface GroupeCahiers {
  cle: string;
  titre: string;
  couleur: string;
  sousTitre?: string;
  cahiers: CahierTextes[];
}

/** Épinglés d'abord ; l'ordre d'arrivée (updatedAt desc) est conservé */
function epinglesDabord(liste: CahierTextes[]): CahierTextes[] {
  return [...liste].sort((a, b) => Number(!!b.epingle) - Number(!!a.epingle));
}

export function grouperCahiers(
  cahiers: CahierTextes[],
  mode: Regroupement,
  etablissements: EtablissementProf[]
): GroupeCahiers[] {
  if (mode === 'aucun') {
    return [{ cle: 'tous', titre: '', couleur: '', cahiers: epinglesDabord(cahiers) }];
  }

  if (mode === 'niveau') {
    const groupes: GroupeCahiers[] = NIVEAUX_SCOLAIRES.map(n => ({
      cle: n.valeur,
      titre: `${n.emoji} ${n.label}`,
      couleur: '#2563eb',
      cahiers: epinglesDabord(cahiers.filter(c => cycleDeClasse(c.classe) === n.valeur)),
    }));
    const autres = cahiers.filter(c => !cycleDeClasse(c.classe));
    if (autres.length) groupes.push({ cle: 'autres', titre: 'Autres', couleur: '#6b7280', cahiers: autres });
    return groupes.filter(g => g.cahiers.length);
  }

  // mode === 'etablissement' : ordre du carnet, puis « Non classés »
  const ids = new Set(etablissements.map(e => e.id));
  const groupes: GroupeCahiers[] = etablissements.map(e => ({
    cle: e.id,
    titre: e.nom,
    sousTitre: [libelleCourtEtablissement(e) !== e.nom ? e.sigle : '', e.ville]
      .filter(Boolean).join(' · ') || undefined,
    couleur: e.couleur,
    cahiers: epinglesDabord(cahiers.filter(c => c.etablissementId === e.id)),
  }));
  const nonClasses = cahiers.filter(c => !c.etablissementId || !ids.has(c.etablissementId));
  groupes.push({
    cle: FILTRE_SANS_ETABLISSEMENT,
    titre: 'Non classés',
    couleur: '#9ca3af',
    cahiers: epinglesDabord(nonClasses),
  });
  return groupes.filter(g => g.cahiers.length);
}
