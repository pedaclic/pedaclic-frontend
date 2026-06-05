/**
 * ============================================================
 * PedaClic — Modale « Statistiques des notes »
 * ============================================================
 *
 * Ouvre une fenêtre contextuelle au-dessus de l'éditeur de feuille
 * de notes pour présenter, de façon professionnelle :
 *
 *   • Les statistiques GÉNÉRALES de la classe :
 *       - Effectif noté / effectif total
 *       - Moyenne, médiane, écart-type
 *       - Min / Max
 *       - Taux de réussite (≥ 10/20)
 *       - Distribution par tranches de 5 points
 *
 *   • Les statistiques PAR SEXE (M / F / autre) :
 *       - Mêmes indicateurs, segmentés
 *       - Permet d'identifier d'éventuels écarts pédagogiques
 *
 * Composant 100 % autonome, contrôlé par `ouvert` côté parent.
 * Aucune dépendance à un service externe : il ne consomme que
 * les `lignes` (déjà calculées par buildLignesNotes côté éditeur).
 *
 * Charte PedaClic : palette --ct-* (bleu PedaClic / gris neutres),
 * coins arrondis var(--ct-radius), ombres var(--ct-shadow-lg).
 * Réutilise les classes `rte-modale*` existantes pour le shell modal,
 * et n'introduit ses propres règles que pour le contenu interne.
 *
 * Fichier : src/components/prof/StatsNotesModal.tsx
 * ============================================================
 */

import React, { useMemo, useState } from 'react';
import { X, BarChart2, Users, TrendingUp, Award, BookOpen, User } from 'lucide-react';
import type {
  LigneNotes,
  FeuilleDeNotes,
  CompetenceDef,
  CompetenceStatus,
} from '../../types/feuillesNotes.types';
import {
  COMPETENCE_STATUS_LABELS,
  COMPETENCE_STATUS_COLORS,
} from '../../types/feuillesNotes.types';

// ──────────────────────────────────────────────────────────────
// PROPS
// ──────────────────────────────────────────────────────────────

interface StatsNotesModalProps {
  /** État ouvert/fermé contrôlé par le parent. */
  ouvert: boolean;
  /** Callback de fermeture (clic overlay ou bouton ✕ ou Esc). */
  onFermer: () => void;
  /** Lignes de la feuille de notes (élève + moyennes calculées). */
  lignes: LigneNotes[];
  /** Map eleveId → sexe — alimentée par l'éditeur depuis les inscriptions. */
  sexeMap: Record<string, 'M' | 'F' | 'autre' | undefined>;
  /**
   * Feuille complète (optionnelle). Quand elle est fournie, la modale active
   * les vues « Par compétence » (taux d'acquisition / remédiation) et
   * « Par élève » (encadrement individuel). Optionnelle pour rester
   * rétro-compatible avec les appels existants.
   */
  feuille?: FeuilleDeNotes | null;
  /** Libellé optionnel à afficher en sous-titre (ex. nom de la classe). */
  contexteLibelle?: string;
}

// ──────────────────────────────────────────────────────────────
// TYPES INTERNES — COMPÉTENCES & ÉLÈVES
// ──────────────────────────────────────────────────────────────

/** Statistiques agrégées pour une compétence donnée. */
interface StatsCompetence {
  id: string;
  libelle: string;
  acquis: number;        // Nombre de statuts « acquis »
  enCours: number;       // Nombre de statuts « en cours »
  nonAcquis: number;     // Nombre de statuts « non acquis »
  total: number;         // Total des statuts saisis pour cette compétence
  tauxAcquis: number;    // % acquis (acquis / total * 100)
  tauxMaitrise: number;  // % (acquis + en cours) / total * 100
}

/** Synthèse par élève pour cibler l'encadrement individuel. */
interface SyntheseEleve {
  eleveId: string;
  eleveNom: string;
  moyenneGenerale: number;
  moyenneDevoirs: number;
  noteComposition: number;
  rang: number;
  ecartMoyenneClasse: number;   // moyenneGenerale - moyenne de la classe
  nbCompetences: number;        // Compétences évaluées pour cet élève
  nbAcquis: number;
  nbEnCours: number;
  nbNonAcquis: number;
  tauxAcquis: number | null;    // null si aucune compétence évaluée
  nbAbsJ: number;
  nbAbsNJ: number;
}

// ──────────────────────────────────────────────────────────────
// TYPES INTERNES
// ──────────────────────────────────────────────────────────────

/**
 * Conteneur de statistiques calculées sur un sous-ensemble de moyennes.
 * Les valeurs `null` indiquent qu'il n'y a aucune note pour ce groupe
 * (cas standard d'une cohorte vide après filtrage par sexe par exemple).
 */
interface StatsBloc {
  effectif: number;            // Nombre d'élèves dans le groupe
  effectifNote: number;        // Nombre d'élèves avec au moins une note
  moyenne: number | null;      // Moyenne arithmétique des moyennes générales
  mediane: number | null;      // Médiane (50e percentile)
  ecartType: number | null;    // Écart-type (population)
  min: number | null;          // Plus petite moyenne ≥ 0
  max: number | null;          // Plus grande moyenne
  tauxReussite: number | null; // % d'élèves dont moyenne ≥ 10
  tauxMention: number | null;  // % d'élèves dont moyenne ≥ 14
  distribution: number[];      // Histogramme : 5 tranches [0-5[, [5-10[, [10-14[, [14-16[, [16-20]
}

// ──────────────────────────────────────────────────────────────
// HELPERS DE CALCUL
// ──────────────────────────────────────────────────────────────

/** Arrondi à 2 décimales. */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Couleur d'une moyenne /20 (charte PedaClic : du rouge au vert). */
function couleurMoyenne(m: number): string {
  if (m >= 16) return '#0d9488';
  if (m >= 12) return '#16a34a';
  if (m >= 10) return '#2563eb';
  if (m >= 8) return '#f59e0b';
  return '#dc2626';
}

/**
 * Calcule un bloc complet de statistiques pour un ensemble de lignes.
 *   - Une moyenne est dite "valide" si elle est strictement > 0 OU si
 *     l'élève a au moins une note saisie (pour ne pas surévaluer la
 *     classe avec des élèves « non encore notés » qui ressortiraient
 *     à 0 par défaut).
 *   - On tolère les groupes vides : tous les indicateurs sont alors null,
 *     `effectif` reste à 0 et la distribution est un tableau de zéros.
 */
function calculerStats(lignes: LigneNotes[]): StatsBloc {
  const effectif = lignes.length;

  // ── Sélection des moyennes exploitables ──
  const moyennes = lignes
    .filter((l) => Object.keys(l.notes).length > 0 || l.moyenneGenerale > 0)
    .map((l) => l.moyenneGenerale)
    .filter((v) => Number.isFinite(v));

  const effectifNote = moyennes.length;

  // Distribution standard PedaClic (5 tranches lisibles sur un bulletin)
  // Indices :  0=[0-5[  1=[5-10[  2=[10-14[  3=[14-16[  4=[16-20]
  const distribution = [0, 0, 0, 0, 0];
  for (const m of moyennes) {
    if (m < 5) distribution[0] += 1;
    else if (m < 10) distribution[1] += 1;
    else if (m < 14) distribution[2] += 1;
    else if (m < 16) distribution[3] += 1;
    else distribution[4] += 1;
  }

  if (moyennes.length === 0) {
    return {
      effectif,
      effectifNote: 0,
      moyenne: null,
      mediane: null,
      ecartType: null,
      min: null,
      max: null,
      tauxReussite: null,
      tauxMention: null,
      distribution,
    };
  }

  // ── Statistiques classiques ──
  const somme = moyennes.reduce((acc, v) => acc + v, 0);
  const moyenne = somme / moyennes.length;

  const triees = [...moyennes].sort((a, b) => a - b);
  const mid = Math.floor(triees.length / 2);
  const mediane = triees.length % 2 === 0
    ? (triees[mid - 1] + triees[mid]) / 2
    : triees[mid];

  const variance = moyennes.reduce((acc, v) => acc + (v - moyenne) ** 2, 0) / moyennes.length;
  const ecartType = Math.sqrt(variance);

  const min = triees[0];
  const max = triees[triees.length - 1];

  const reussite = moyennes.filter((v) => v >= 10).length;
  const mention = moyennes.filter((v) => v >= 14).length;

  return {
    effectif,
    effectifNote,
    moyenne: r2(moyenne),
    mediane: r2(mediane),
    ecartType: r2(ecartType),
    min: r2(min),
    max: r2(max),
    tauxReussite: Math.round((reussite / moyennes.length) * 100),
    tauxMention: Math.round((mention / moyennes.length) * 100),
    distribution,
  };
}

// ──────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS DE PRÉSENTATION
// ──────────────────────────────────────────────────────────────

/**
 * Carte d'indicateur (KPI) — utilisée pour les statistiques générales
 * et chacun des sous-blocs par sexe. Style sobre, charte PedaClic,
 * accent coloré contrôlable via la prop `accent`.
 */
const KpiCard: React.FC<{
  label: string;
  valeur: string;
  description?: string;
  accent?: string;
}> = ({ label, valeur, description, accent = '#2563eb' }) => (
  <div
    className="stats-notes-kpi"
    style={{
      background: '#fff',
      border: `1px solid #e5e7eb`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 10,
      padding: '0.75rem 0.9rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
    }}
  >
    <span
      style={{
        fontSize: '0.72rem',
        color: '#6b7280',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
      {valeur}
    </span>
    {description && (
      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
        {description}
      </span>
    )}
  </div>
);

/**
 * Histogramme horizontal très simple (CSS pur, sans dépendance) qui
 * affiche la distribution sur 5 tranches de notes. Hauteur fixe et
 * couleurs charte PedaClic (bleu pour la masse, vert pour les
 * meilleures tranches, rouge pour la tranche [0-5[).
 */
const Histogramme: React.FC<{
  distribution: number[];
  total: number;
}> = ({ distribution, total }) => {
  // Mapping libellé / couleur par tranche — couleurs sobres, lisibles
  // sur fond clair, alignées avec les bandes existantes (réussite / mention).
  const tranches = [
    { label: '0 – 5',   couleur: '#dc2626' },
    { label: '5 – 10',  couleur: '#f59e0b' },
    { label: '10 – 14', couleur: '#2563eb' },
    { label: '14 – 16', couleur: '#16a34a' },
    { label: '16 – 20', couleur: '#0d9488' },
  ];
  const max = Math.max(1, ...distribution); // évite division par 0

  return (
    <div
      role="figure"
      aria-label="Distribution des moyennes par tranche"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {tranches.map((t, i) => {
        const valeur = distribution[i] ?? 0;
        const pct = total > 0 ? Math.round((valeur / total) * 100) : 0;
        const largeur = Math.round((valeur / max) * 100);
        return (
          <div
            key={t.label}
            style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px', alignItems: 'center', gap: 10 }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
              {t.label}
            </span>
            <div
              style={{
                position: 'relative',
                background: '#f3f4f6',
                borderRadius: 999,
                height: 14,
                overflow: 'hidden',
              }}
              aria-label={`${valeur} élève${valeur > 1 ? 's' : ''} dans la tranche ${t.label}`}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${largeur}%`,
                  background: t.couleur,
                  transition: 'width 0.3s ease',
                  borderRadius: 999,
                }}
              />
            </div>
            <span style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'right' }}>
              {valeur} <span style={{ color: '#9ca3af' }}>({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Barre de répartition d'une compétence : segments Acquis / En cours /
 * Non acquis (couleurs charte) + taux d'acquisition mis en avant.
 */
const CompetenceBar: React.FC<{ stats: StatsCompetence }> = ({ stats }) => {
  const seg = (n: number) => (stats.total > 0 ? (n / stats.total) * 100 : 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1f2937', flex: 1, minWidth: 0 }}>
          {stats.libelle}
        </span>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            color: stats.tauxAcquis >= 50 ? '#16a34a' : '#dc2626',
          }}
          title="Taux d'acquisition (Acquis / total des statuts saisis)"
        >
          {stats.tauxAcquis}%
        </span>
        <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
          ({stats.total} éval.)
        </span>
      </div>
      {/* Barre empilée */}
      <div
        style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#f3f4f6' }}
        role="img"
        aria-label={`Acquis ${stats.acquis}, en cours ${stats.enCours}, non acquis ${stats.nonAcquis}`}
      >
        <div style={{ width: `${seg(stats.acquis)}%`, background: COMPETENCE_STATUS_COLORS.acquis }} />
        <div style={{ width: `${seg(stats.enCours)}%`, background: COMPETENCE_STATUS_COLORS.en_cours }} />
        <div style={{ width: `${seg(stats.nonAcquis)}%`, background: COMPETENCE_STATUS_COLORS.non_acquis }} />
      </div>
      {/* Légende chiffrée */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.72rem', color: '#6b7280' }}>
        <span style={{ color: COMPETENCE_STATUS_COLORS.acquis, fontWeight: 600 }}>
          ● {COMPETENCE_STATUS_LABELS.acquis} : {stats.acquis}
        </span>
        <span style={{ color: COMPETENCE_STATUS_COLORS.en_cours, fontWeight: 600 }}>
          ● {COMPETENCE_STATUS_LABELS.en_cours} : {stats.enCours}
        </span>
        <span style={{ color: COMPETENCE_STATUS_COLORS.non_acquis, fontWeight: 600 }}>
          ● {COMPETENCE_STATUS_LABELS.non_acquis} : {stats.nonAcquis}
        </span>
      </div>
    </div>
  );
};

/**
 * Carte de synthèse d'un élève : moyennes, rang, écart à la classe,
 * taux d'acquisition des compétences et absences. Sert à repérer en un
 * coup d'œil le niveau d'encadrement individuel nécessaire.
 */
const EleveSynthese: React.FC<{
  synthese: SyntheseEleve;
  getClasseColor: (m: number) => string;
}> = ({ synthese: s, getClasseColor }) => {
  const couleurMoy = getClasseColor(s.moyenneGenerale);
  const ecartPositif = s.ecartMoyenneClasse >= 0;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${couleurMoy}`,
        borderRadius: 10,
        padding: '0.7rem 0.9rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Identité + rang */}
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{s.eleveNom}</div>
        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
          {s.rang > 0 ? `Rang ${s.rang}` : 'Rang —'} ·{' '}
          <span style={{ color: ecartPositif ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {ecartPositif ? '+' : ''}{s.ecartMoyenneClasse} vs classe
          </span>
        </div>
      </div>

      {/* Moyennes */}
      <div style={{ textAlign: 'center', minWidth: 70 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: couleurMoy, lineHeight: 1 }}>
          {s.moyenneGenerale > 0 ? s.moyenneGenerale.toFixed(2) : '—'}
        </div>
        <div style={{ fontSize: '0.66rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Moy. gén.
        </div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 60, fontSize: '0.75rem', color: '#6b7280' }}>
        <div>D : <strong>{s.moyenneDevoirs > 0 ? s.moyenneDevoirs.toFixed(1) : '—'}</strong></div>
        <div>C : <strong>{s.noteComposition > 0 ? s.noteComposition.toFixed(1) : '—'}</strong></div>
      </div>

      {/* Compétences */}
      <div style={{ minWidth: 120 }}>
        {s.nbCompetences > 0 ? (
          <>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 3 }}>
              Compétences : <strong style={{ color: s.tauxAcquis! >= 50 ? '#16a34a' : '#dc2626' }}>{s.tauxAcquis}% acquis</strong>
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: '#f3f4f6' }}>
              <div style={{ width: `${(s.nbAcquis / s.nbCompetences) * 100}%`, background: COMPETENCE_STATUS_COLORS.acquis }} />
              <div style={{ width: `${(s.nbEnCours / s.nbCompetences) * 100}%`, background: COMPETENCE_STATUS_COLORS.en_cours }} />
              <div style={{ width: `${(s.nbNonAcquis / s.nbCompetences) * 100}%`, background: COMPETENCE_STATUS_COLORS.non_acquis }} />
            </div>
          </>
        ) : (
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
            Pas de compétence évaluée
          </span>
        )}
      </div>

      {/* Absences */}
      {(s.nbAbsJ > 0 || s.nbAbsNJ > 0) && (
        <div style={{ fontSize: '0.7rem', color: '#6b7280', textAlign: 'right', minWidth: 60 }}>
          {s.nbAbsJ > 0 && <div style={{ color: '#f59e0b', fontWeight: 600 }}>{s.nbAbsJ} AJ</div>}
          {s.nbAbsNJ > 0 && <div style={{ color: '#ef4444', fontWeight: 600 }}>{s.nbAbsNJ} ANJ</div>}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ──────────────────────────────────────────────────────────────

const StatsNotesModal: React.FC<StatsNotesModalProps> = ({
  ouvert,
  onFermer,
  lignes,
  sexeMap,
  feuille,
  contexteLibelle,
}) => {
  // Fermeture clavier (Échap) — accessible et conforme à l'UX existante
  // des autres modales du projet (BulletinAbsencesModal, modale RTE).
  React.useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ouvert, onFermer]);

  // ── Calculs mémoïsés ──
  //   Les stats globales et par sexe sont recalculées uniquement quand
  //   `lignes` ou `sexeMap` changent, jamais à chaque rendu.
  const statsGenerales = useMemo<StatsBloc>(() => calculerStats(lignes), [lignes]);

  const lignesFilles = useMemo(
    () => lignes.filter((l) => sexeMap[l.eleveId] === 'F'),
    [lignes, sexeMap],
  );
  const lignesGarcons = useMemo(
    () => lignes.filter((l) => sexeMap[l.eleveId] === 'M'),
    [lignes, sexeMap],
  );
  const lignesAutres = useMemo(
    () => lignes.filter((l) => {
      const s = sexeMap[l.eleveId];
      return s !== 'F' && s !== 'M';
    }),
    [lignes, sexeMap],
  );

  const statsFilles = useMemo(() => calculerStats(lignesFilles), [lignesFilles]);
  const statsGarcons = useMemo(() => calculerStats(lignesGarcons), [lignesGarcons]);
  const statsAutres = useMemo(() => calculerStats(lignesAutres), [lignesAutres]);

  // ── Onglet actif (Vue d'ensemble / Par compétence / Par élève) ──
  const [ongletActif, setOngletActif] = useState<'ensemble' | 'competences' | 'eleves'>('ensemble');

  // Disponibilité des vues avancées : nécessitent la feuille complète.
  const aDonneesCompetences = !!feuille?.competences && Object.keys(feuille.competences).length > 0;
  const aFeuille = !!feuille;

  // ── Libellés des compétences (id → libellé) ──
  //   On agrège la liste globale (competencesDef) ET les compétences propres
  //   à chaque évaluation, pour libeller toutes les compétences saisies.
  const competenceLibelles = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (!feuille) return map;
    (feuille.competencesDef ?? []).forEach((c) => map.set(c.id, c.libelle));
    (feuille.evaluations ?? []).forEach((ev) =>
      (ev.competences ?? []).forEach((c: CompetenceDef) => {
        if (!map.has(c.id)) map.set(c.id, c.libelle);
      }),
    );
    return map;
  }, [feuille]);

  // ── Statistiques par compétence (taux d'acquisition / remédiation) ──
  const statsCompetences = useMemo<StatsCompetence[]>(() => {
    if (!feuille?.competences) return [];
    const acc = new Map<string, { acquis: number; enCours: number; nonAcquis: number }>();
    // competences : eleveId → evalId → compId → statut
    Object.values(feuille.competences).forEach((parEval) => {
      Object.values(parEval).forEach((parComp) => {
        Object.entries(parComp).forEach(([compId, statut]) => {
          if (!acc.has(compId)) acc.set(compId, { acquis: 0, enCours: 0, nonAcquis: 0 });
          const e = acc.get(compId)!;
          if (statut === 'acquis') e.acquis += 1;
          else if (statut === 'en_cours') e.enCours += 1;
          else e.nonAcquis += 1;
        });
      });
    });
    const result: StatsCompetence[] = [];
    acc.forEach((v, id) => {
      const total = v.acquis + v.enCours + v.nonAcquis;
      result.push({
        id,
        libelle: competenceLibelles.get(id) ?? id,
        acquis: v.acquis,
        enCours: v.enCours,
        nonAcquis: v.nonAcquis,
        total,
        tauxAcquis: total ? Math.round((v.acquis / total) * 100) : 0,
        tauxMaitrise: total ? Math.round(((v.acquis + v.enCours) / total) * 100) : 0,
      });
    });
    // Tri par taux d'acquisition croissant : les compétences les plus
    // fragiles (à remédier en priorité) apparaissent en haut.
    return result.sort((a, b) => a.tauxAcquis - b.tauxAcquis);
  }, [feuille, competenceLibelles]);

  // ── Synthèse par élève (encadrement individuel) ──
  const synthesesEleves = useMemo<SyntheseEleve[]>(() => {
    if (!feuille) return [];
    // Moyenne de classe de référence (mêmes règles que la vue d'ensemble).
    const valsClasse = lignes
      .filter((l) => Object.keys(l.notes).length > 0 || l.moyenneGenerale > 0)
      .map((l) => l.moyenneGenerale)
      .filter((v) => Number.isFinite(v));
    const moyenneClasse = valsClasse.length
      ? valsClasse.reduce((s, v) => s + v, 0) / valsClasse.length
      : 0;

    return lignes
      .map((l) => {
        const comp = feuille.competences?.[l.eleveId] ?? {};
        let acquis = 0, enCours = 0, nonAcquis = 0;
        Object.values(comp).forEach((parComp) =>
          Object.values(parComp).forEach((st: CompetenceStatus) => {
            if (st === 'acquis') acquis += 1;
            else if (st === 'en_cours') enCours += 1;
            else nonAcquis += 1;
          }),
        );
        const nbComp = acquis + enCours + nonAcquis;
        return {
          eleveId: l.eleveId,
          eleveNom: l.eleveNom,
          moyenneGenerale: l.moyenneGenerale,
          moyenneDevoirs: l.moyenneDevoirs,
          noteComposition: l.noteComposition,
          rang: l.rang,
          ecartMoyenneClasse: r2(l.moyenneGenerale - moyenneClasse),
          nbCompetences: nbComp,
          nbAcquis: acquis,
          nbEnCours: enCours,
          nbNonAcquis: nonAcquis,
          tauxAcquis: nbComp ? Math.round((acquis / nbComp) * 100) : null,
          nbAbsJ: l.nbAbsencesJustifiees,
          nbAbsNJ: l.nbAbsencesNonJustifiees,
        };
      })
      .sort((a, b) => (a.rang || 9999) - (b.rang || 9999));
  }, [feuille, lignes]);

  if (!ouvert) return null;

  // ── Helper d'affichage pour valeurs nulles ──
  //   On affiche un tiret cadratin « — » plutôt que « 0 » ou « NaN »
  //   pour bien marquer l'absence de donnée exploitable.
  const fmt = (v: number | null, suffix = ''): string =>
    v === null ? '—' : `${v}${suffix}`;

  /**
   * Petit composant d'affichage d'un sous-bloc de stats par catégorie
   * (Filles / Garçons / Autres). On factorise pour garder le rendu
   * principal lisible — chaque bloc affiche les mêmes 6 KPI + un
   * histogramme compact.
   */
  const renderSousBloc = (titre: string, accent: string, picto: string, stats: StatsBloc) => (
    <div
      style={{
        background: '#fafbff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 700,
          color: accent,
        }}
      >
        <span style={{ fontSize: '1.05rem' }}>{picto}</span>
        <span>{titre}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            color: '#6b7280',
            fontWeight: 500,
          }}
        >
          {stats.effectifNote} / {stats.effectif} noté{stats.effectifNote > 1 ? 's' : ''}
        </span>
      </div>

      {stats.effectif === 0 ? (
        <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic' }}>
          Aucun élève dans cette catégorie.
        </p>
      ) : stats.effectifNote === 0 ? (
        <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic' }}>
          Aucune note saisie pour le moment.
        </p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
            }}
          >
            <KpiCard label="Moyenne" valeur={fmt(stats.moyenne, ' /20')} accent={accent} />
            <KpiCard label="Médiane" valeur={fmt(stats.mediane, ' /20')} accent={accent} />
            <KpiCard label="Écart-type" valeur={fmt(stats.ecartType)} accent={accent} />
            <KpiCard label="Min" valeur={fmt(stats.min, ' /20')} accent={accent} />
            <KpiCard label="Max" valeur={fmt(stats.max, ' /20')} accent={accent} />
            <KpiCard
              label="≥ 10 / 20"
              valeur={fmt(stats.tauxReussite, ' %')}
              description="Taux de réussite"
              accent={accent}
            />
          </div>
          <Histogramme distribution={stats.distribution} total={stats.effectifNote} />
        </>
      )}
    </div>
  );

  return (
    <div
      className="rte-modale-overlay"
      onClick={onFermer}
      role="presentation"
      aria-hidden="false"
    >
      <div
        className="rte-modale"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-notes-titre"
        style={{ maxWidth: 880, width: '95%' }}
      >
        {/* ── En-tête ── */}
        <div className="rte-modale__header">
          <h3 id="stats-notes-titre" className="rte-modale__titre">
            <BarChart2
              size={18}
              style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 6 }}
            />
            Statistiques des notes
            {contexteLibelle && (
              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8, fontSize: '0.85rem' }}>
                — {contexteLibelle}
              </span>
            )}
          </h3>
          <button
            type="button"
            className="rte-modale__fermer"
            onClick={onFermer}
            aria-label="Fermer la fenêtre des statistiques"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Barre d'onglets ──
             Vue d'ensemble (existant) · Par compétence · Par élève.
             Les deux derniers onglets ne sont proposés que si la feuille
             complète est disponible (compétences / synthèse individuelle). */}
        {aFeuille && (
          <div
            role="tablist"
            aria-label="Vues statistiques"
            style={{
              display: 'flex',
              gap: 4,
              padding: '0 1rem',
              borderBottom: '1px solid #e5e7eb',
              flexWrap: 'wrap',
            }}
          >
            {([
              { cle: 'ensemble' as const, label: "Vue d'ensemble", Icone: BarChart2 },
              { cle: 'competences' as const, label: 'Par compétence', Icone: BookOpen },
              { cle: 'eleves' as const, label: 'Par élève', Icone: User },
            ]).map(({ cle, label, Icone }) => {
              const actif = ongletActif === cle;
              return (
                <button
                  key={cle}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOngletActif(cle)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.85rem',
                    fontWeight: actif ? 700 : 500,
                    color: actif ? '#2563eb' : '#6b7280',
                    borderBottom: `2px solid ${actif ? '#2563eb' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >
                  <Icone size={15} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Corps ── */}
        <div
          className="rte-modale__body"
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto' }}
        >
          {/* ════════════ ONGLET « VUE D'ENSEMBLE » ════════════ */}
          {ongletActif === 'ensemble' && (
          <>
          {/* ── Section 1 : Statistiques générales ── */}
          <section aria-labelledby="stats-notes-section-generale">
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: '2px solid #e5e7eb',
              }}
            >
              <TrendingUp size={16} style={{ color: '#2563eb' }} />
              <h4
                id="stats-notes-section-generale"
                style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 700 }}
              >
                Statistiques générales
              </h4>
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280' }}>
                {statsGenerales.effectifNote} / {statsGenerales.effectif} élève{statsGenerales.effectif > 1 ? 's' : ''} noté{statsGenerales.effectifNote > 1 ? 's' : ''}
              </span>
            </header>

            {statsGenerales.effectifNote === 0 ? (
              <p style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
                Aucune note saisie : impossible de calculer les statistiques.
                Saisissez quelques notes puis rouvrez ce panneau.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <KpiCard label="Moyenne classe" valeur={fmt(statsGenerales.moyenne, ' /20')} accent="#2563eb" />
                  <KpiCard label="Médiane" valeur={fmt(statsGenerales.mediane, ' /20')} accent="#2563eb" />
                  <KpiCard label="Écart-type" valeur={fmt(statsGenerales.ecartType)} description="Dispersion" accent="#2563eb" />
                  <KpiCard label="Min" valeur={fmt(statsGenerales.min, ' /20')} accent="#dc2626" />
                  <KpiCard label="Max" valeur={fmt(statsGenerales.max, ' /20')} accent="#16a34a" />
                  <KpiCard
                    label="Taux de réussite"
                    valeur={fmt(statsGenerales.tauxReussite, ' %')}
                    description="Élèves ≥ 10 / 20"
                    accent="#16a34a"
                  />
                  <KpiCard
                    label="Mention (≥ 14)"
                    valeur={fmt(statsGenerales.tauxMention, ' %')}
                    description="Excellence"
                    accent="#7c3aed"
                  />
                </div>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '0.9rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#374151',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Award
                      size={13}
                      style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 4 }}
                    />
                    Distribution par tranches de notes
                  </div>
                  <Histogramme
                    distribution={statsGenerales.distribution}
                    total={statsGenerales.effectifNote}
                  />
                </div>
              </>
            )}
          </section>

          {/* ── Section 2 : Statistiques par sexe ── */}
          <section aria-labelledby="stats-notes-section-sexe">
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: '2px solid #e5e7eb',
              }}
            >
              <Users size={16} style={{ color: '#2563eb' }} />
              <h4
                id="stats-notes-section-sexe"
                style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 700 }}
              >
                Statistiques par sexe
              </h4>
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                Vue comparative — repérage d'écarts pédagogiques éventuels
              </span>
            </header>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  lignesAutres.length > 0
                    ? 'repeat(auto-fit, minmax(260px, 1fr))'
                    : 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 12,
              }}
            >
              {/* Filles — couleur charte « rose / fuchsia » cohérente avec
                  le pictogramme ♀ utilisé dans l'éditeur */}
              {renderSousBloc('Filles', '#ec4899', '♀', statsFilles)}
              {/* Garçons — bleu PedaClic, cohérent avec ♂ */}
              {renderSousBloc('Garçons', '#3b82f6', '♂', statsGarcons)}
              {/* Autres / non renseigné — gris neutre, n'apparaît que si pertinent */}
              {lignesAutres.length > 0 &&
                renderSousBloc('Autre / non renseigné', '#6b7280', '✱', statsAutres)}
            </div>
          </section>
          </>
          )}

          {/* ════════════ ONGLET « PAR COMPÉTENCE » ════════════ */}
          {ongletActif === 'competences' && (
            <section aria-label="Taux de réussite par compétence">
              {!aDonneesCompetences ? (
                <p style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
                  Aucune compétence évaluée pour le moment. Renseignez les
                  compétences des élèves dans le tableau de notes (pastilles
                  Acquis / En cours / Non acquis) pour visualiser ici le taux
                  de réussite par compétence.
                </p>
              ) : (
                <>
                  <header
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #e5e7eb',
                    }}
                  >
                    <BookOpen size={16} style={{ color: '#2563eb' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 700 }}>
                      Taux de réussite par compétence
                    </h4>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                      Trié du plus fragile au mieux acquis
                    </span>
                  </header>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {statsCompetences.map((c) => (
                      <CompetenceBar key={c.id} stats={c} />
                    ))}
                  </div>

                  {/* Encart remédiation : compétences sous 50 % d'acquisition */}
                  {(() => {
                    const aRemedier = statsCompetences.filter((c) => c.tauxAcquis < 50);
                    if (aRemedier.length === 0) {
                      return (
                        <p style={{ marginTop: 14, fontSize: '0.8rem', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10 }}>
                          ✅ Toutes les compétences évaluées dépassent 50 % d'acquisition.
                        </p>
                      );
                    }
                    return (
                      <div style={{ marginTop: 14, fontSize: '0.82rem', color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 10 }}>
                        <strong>🎯 Remédiation prioritaire :</strong>{' '}
                        {aRemedier.map((c) => `${c.libelle} (${c.tauxAcquis}%)`).join(' · ')}.
                        <div style={{ marginTop: 4, color: '#b45309' }}>
                          Prévoyez des activités de soutien ciblées sur ces compétences.
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </section>
          )}

          {/* ════════════ ONGLET « PAR ÉLÈVE » ════════════ */}
          {ongletActif === 'eleves' && (
            <section aria-label="Statistiques par élève">
              {synthesesEleves.length === 0 ? (
                <p style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
                  Aucun élève à afficher.
                </p>
              ) : (
                <>
                  <header
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #e5e7eb',
                    }}
                  >
                    <User size={16} style={{ color: '#2563eb' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 700 }}>
                      Synthèse individuelle
                    </h4>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                      Cibler l'encadrement de chaque élève
                    </span>
                  </header>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {synthesesEleves.map((s) => (
                      <EleveSynthese key={s.eleveId} synthese={s} getClasseColor={couleurMoyenne} />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Note méthodologique ── */}
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              color: '#9ca3af',
              fontStyle: 'italic',
              borderTop: '1px dashed #e5e7eb',
              paddingTop: 10,
            }}
          >
            Calculs effectués sur la <strong>moyenne générale</strong> de chaque élève
            (moyenne PedaClic = (Moy. devoirs + Composition) / 2). Les évaluations
            marquées « Hors moyenne » et les absences justifiées (AJ) sont exclues
            du calcul ; les absences non justifiées (ANJ) comptent 0 / 20.
            {aDonneesCompetences && ' Les taux de compétence sont calculés sur l\'ensemble des statuts saisis (Acquis / En cours / Non acquis).'}
          </p>
        </div>

        {/* ── Pied — bouton de fermeture explicite ── */}
        <div
          className="rte-modale__footer"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onFermer}
            style={{ padding: '0.5rem 1.1rem', fontWeight: 600 }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsNotesModal;
