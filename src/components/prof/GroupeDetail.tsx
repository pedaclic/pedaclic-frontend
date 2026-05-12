/**
 * ============================================================
 * COMPOSANT GROUPE DETAIL — PedaClic Phase 11
 * ============================================================
 * 
 * Vue détaillée d'un groupe-classe sélectionné.
 * Affiche : stats globales, liste des élèves avec tri/filtre,
 * détail par élève, analyse par quiz, alertes, export CSV.
 * 
 * Fichier : src/components/prof/GroupeDetail.tsx
 * Dépendances :
 *   - ../../services/profGroupeService
 *   - ../../types/prof
 *   - ../../styles/prof.css
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
// Navigation vers la page de planification complète (Phase 32 — branchement total)
import { useNavigate } from 'react-router-dom';
import {
  getStatsGroupe,
  getStatsElevesGroupe,
  getStatsQuizGroupe,
  getQuizParMatiere,
  genererAlertesProf,
  genererExportCSV,
  telechargerCSV,
  retirerEleve,
  modifierNomEleve,
  getElevesGroupe
} from '../../services/profGroupeService';
// 🆕 Édition a posteriori du sexe d'une inscription (depuis la liste Élèves).
import { mettreAJourSexeInscription, type SexeEleve } from '../../services/inscriptionDirecteService';
import {
  marquerAbsences,
  getAppelByDate,
  getAbsencesByPeriod,
  sauvegarderObservation,
  getObservationEleve,
} from '../../services/groupeAbsencesService';
import type { DetailRetard, MotifRetard, DetailExclusion } from '../../types/groupeAbsences.types';
// Phase 38 — Helpers de lecture multi-séances (rétro-compat legacy)
import { getEntreeTitres } from '../../types/groupeAbsences.types';
// 🆕 (mai 2026) — Service & types pour la FEUILLE DE SUIVI ÉLÈVE :
//   absence séance précédente, observations qualitatives, matériel non
//   amené, travail non fait, et notification des parents en temps réel.
import {
  getSuivisJour,
  upsertSuiviSeance,
  calculerAbsencesSeancePrecedente,
  notifierParents,
} from '../../services/suiviSeanceService';
import type { SuiviSeanceEleve, TonaliteObservation } from '../../types/groupeAbsences.types';
import {
  TONALITE_OBSERVATION_LABELS,
  TONALITE_OBSERVATION_COULEURS,
} from '../../types/groupeAbsences.types';
// ✨ Formatage "Prénoms NOM" (dernier mot en MAJUSCULES)
//    + tri alphabétique par nom de famille
import { formatEleveNom, compareParNomFamille } from '../../utils/formatNom';
import {
  creerTravailAFaire,
  getTravauxByGroupe,
  supprimerTravailAFaire,
} from '../../services/travauxAFaireService';
// Phase 36 — cellule "Corrigé" avec date+heure auto + éditable
import CorrigeTravailCell from './CorrigeTravailCell';
import { getCahiersForGroupe, getEntreesCahier } from '../../services/cahierTextesService';
import type { CahierTextes, RubriqueCahier, EntreeCahier } from '../../types/cahierTextes.types';
import { useAuth } from '../../hooks/useAuth';
import FeuillesNotesManager from './FeuillesNotesManager';
import CahierGroupeWidget from './CahierGroupeWidget';
import PlanificationWidget from './PlanificationWidget';
import InscriptionDirecteModal from './InscriptionDirecteModal';
// Phase 38 — Modale "Bulletin de suivi des absences/retards" (PDF).
import BulletinAbsencesModal from './BulletinAbsencesModal';
import type {
  GroupeProf,
  StatsGroupe,
  EleveGroupeStats,
  StatsQuizGroupe,
  AlerteProf,
  InscriptionGroupe,
} from '../../types/prof';
// Pictogrammes ♂ / ♀ / ✱ pour les listes denses (cellule "Élève").
import { SEXE_PICTOS, SEXE_LABELS } from '../../types';
import type { TravailAFaire } from '../../types/groupeAbsences.types';
import RichTextEditor from '../RichTextEditor';
import '../../styles/prof.css';
import '../../styles/feuillesNotes.css';
import '../../styles/CahierEnrichi.css';


// ==================== TYPES LOCAUX ====================

/** Onglets disponibles dans le détail du groupe */
type OngletActif = 'apercu' | 'eleves' | 'appel' | 'travaux' | 'notes' | 'quiz' | 'cahier' | 'planification' | 'alertes';

/** Options de tri pour la liste des élèves */
type TriEleves = 'moyenne_desc' | 'moyenne_asc' | 'nom' | 'streak' | 'quiz_count';


// ==================== SOUS-COMPOSANT : SUIVI ABSENCES + RETARDS ====================

interface AppelSuiviTableProps {
  groupeId: string;
  profId: string;
  /** Nom dénormalisé du prof (pour l'émetteur des notifications parents). */
  profNom?: string;
  statsEleves: EleveGroupeStats[];
  periode: 'jour' | 'semaine' | 'mois';
  /**
   * Map eleveId → sexe ('M' | 'F' | 'autre'). Permet d'afficher un petit
   *   pictogramme ♂/♀/✱ devant le nom dans la liste de suivi.
   *   Optionnel : la table reste fonctionnelle même sans cette donnée
   *   (rétro-compat : élèves inscrits avant l'introduction du champ).
   */
  sexeMap?: Record<string, 'M' | 'F' | 'autre' | undefined>;
}

/**
 * Tableau de suivi : affiche pour chaque élève le nombre d'absences
 * ET le nombre de retards cumulés sur la période choisie, ainsi que
 * les séances manquées.
 * Les noms sont affichés au format « Prénoms NOM » et triés par NOM.
 *
 * 🆕 (mai 2026) — FEUILLE DE SUIVI ÉLÈVE enrichie :
 *   En plus des compteurs historiques (absences / retards / exclusions),
 *   on ajoute 4 colonnes dynamiques par ÉLÈVE pour la journée courante :
 *     • Absence séance précédente (auto-renseignée + surchargeable)
 *     • Observation (positive / négative / neutre)
 *     • Matériel non amené
 *     • Travail non fait
 *
 *   Chaque modification est persistée dans la collection Firestore
 *   `suivi_seance` et notifie les parents en TEMPS RÉEL via
 *   `notifierParents` (canal in-app).
 *
 *   La rétro-compat est préservée : si aucune donnée de suivi n'est
 *   présente, les cellules affichent leur valeur neutre par défaut.
 */
function AppelSuiviTable({ groupeId, profId, profNom, statsEleves, periode, sexeMap }: AppelSuiviTableProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [retards, setRetards] = useState<Record<string, number>>({});
  // Phase 40 — compteur d'exclusions sur la période sélectionnée
  const [exclusions, setExclusions] = useState<Record<string, number>>({});
  /*
    🆕 (mai 2026) — La liste des séances manquées par élève stocke désormais
    POUR CHAQUE absence : la DATE (YYYY-MM-DD) ET le TITRE/contenu de la
    séance. Cette structure enrichie alimente la nouvelle colonne
    « Historique des absences » : la cellule affiche le compteur (count[id])
    et son infobulle (title) liste « date — titre » pour chaque absence,
    avec un popover détaillé au clic pour une lecture confortable.
  */
  const [seancesManquees, setSeancesManquees] = useState<Record<string, Array<{ date: string; titre: string }>>>({});
  // 🆕 (mai 2026) — ID de l'élève dont le popover « Historique des absences »
  // est actuellement ouvert. `null` = popover fermé. Géré au niveau du
  // tableau pour qu'un seul popover soit ouvert à la fois (clarté UX).
  const [popoverHistoEleveId, setPopoverHistoEleveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 🆕 État local des SUIVIS DU JOUR par élève — alimenté au chargement
  //    depuis `getSuivisJour` et `calculerAbsencesSeancePrecedente`.
  //    Clé = eleveId ; valeur = champs de la feuille de suivi (booléens,
  //    observation libre, tonalité, …). Les modifications sont
  //    optimistes : on met à jour ce state IMMÉDIATEMENT puis on lance
  //    la persistance Firestore + la notification parent en parallèle.
  const [suiviMap, setSuiviMap] = useState<Record<string, Partial<SuiviSeanceEleve>>>({});
  // Date du jour utilisée comme clé pour le suivi (YYYY-MM-DD)
  const dateJour = new Date().toISOString().slice(0, 10);
  // Edition en cours d'une observation (eleveId → texte en cours de saisie)
  const [draftObs, setDraftObs] = useState<Record<string, string>>({});

  /*
    🆕 (mai 2026) — Fermeture du popover « Historique des absences »
    ──────────────────────────────────────────────────────────────
    Deux raccourcis ergonomiques pour fermer le popover :
      • Touche Échap (Esc) : ferme immédiatement.
      • Clic en dehors du popover ET du bouton-compteur : ferme.
    Les écouteurs ne sont posés QUE lorsqu'un popover est ouvert,
    pour éviter tout coût lors du rendu standard du tableau.
  */
  useEffect(() => {
    if (!popoverHistoEleveId) return;
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPopoverHistoEleveId(null);
    };
    const handleClickOutside = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      // On considère le clic comme "intérieur" s'il se produit dans
      // un bouton-compteur OU dans le popover lui-même.
      if (
        target &&
        (target.closest('.groupe-histo-abs-btn') ||
          target.closest('.groupe-histo-abs-popover'))
      ) {
        return;
      }
      setPopoverHistoEleveId(null);
    };
    document.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverHistoEleveId]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    let debut: string, fin: string;
    if (periode === 'jour') {
      debut = fin = today.toISOString().slice(0, 10);
    } else if (periode === 'semaine') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      debut = d.toISOString().slice(0, 10);
      fin = today.toISOString().slice(0, 10);
    } else {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 1);
      debut = d.toISOString().slice(0, 10);
      fin = today.toISOString().slice(0, 10);
    }

    (async () => {
      try {
        // Filtre profId passé explicitement pour satisfaire la règle Firestore
        const absences = await getAbsencesByPeriod(groupeId, debut, fin, profId);
        const c: Record<string, number> = {};
        const r: Record<string, number> = {};
        // Phase 40 — accumulateur des exclusions par élève
        const x: Record<string, number> = {};
        // 🆕 (mai 2026) — accumulateur enrichi : pour chaque absence, on
        // conserve la DATE et le TITRE de la séance manquée. Ces données
        // alimentent la nouvelle colonne « Historique des absences »
        // (infobulle + popover détaillé au clic).
        const sm: Record<string, Array<{ date: string; titre: string }>> = {};
        statsEleves.forEach(e => { c[e.eleveId] = 0; r[e.eleveId] = 0; x[e.eleveId] = 0; sm[e.eleveId] = []; });
        absences.forEach(a => {
          // Phase 38 + 39 — Comptage granulaire par séance.
          //   Si `seancesAbsentsPar` est défini, on compte +1 par séance
          //   où l'élève apparaît (ce qui permet d'avoir 1 absence sur
          //   séance 1 mais "présent" sur séance 2).
          //   Sinon, on retombe sur le legacy : +1 par appel pour
          //   chaque élève dans `eleveIdsAbsents`.
          const titresSeances = getEntreeTitres(a);
          const idsSeances = Array.isArray(a.entreeIds) && a.entreeIds.length > 0
            ? a.entreeIds
            : a.entreeId
            ? [a.entreeId]
            : [];

          if (a.seancesAbsentsPar && Object.keys(a.seancesAbsentsPar).length > 0) {
            // ── Mode granulaire (Phase 39) ─────────────────────
            for (const [entreeId, eleveIds] of Object.entries(a.seancesAbsentsPar)) {
              const titreSeance =
                titresSeances[idsSeances.indexOf(entreeId)] || a.entreeTitre || '';
              eleveIds.forEach((id) => {
                if (c[id] !== undefined) c[id]++;
                // On stocke l'objet { date, titre } — la date provient
                // toujours du document parent (`a.date`, format YYYY-MM-DD).
                if (sm[id]) sm[id].push({ date: a.date, titre: titreSeance || '(séance non précisée)' });
              });
            }
          } else {
            // ── Mode legacy : 1 absence comptée par appel ───────
            (a.eleveIdsAbsents || []).forEach((id: string) => {
              if (c[id] !== undefined) c[id]++;
              if (sm[id]) {
                if (titresSeances.length > 0) {
                  // Une entrée par séance liée à l'appel
                  titresSeances.forEach((t) => {
                    sm[id].push({ date: a.date, titre: t || '(séance non précisée)' });
                  });
                } else {
                  // Aucun titre disponible : on garde quand même la date
                  // afin que l'historique reste exhaustif.
                  sm[id].push({ date: a.date, titre: '(séance non précisée)' });
                }
              }
            });
          }

          if (a.seancesRetardsPar && Object.keys(a.seancesRetardsPar).length > 0) {
            for (const eleveIds of Object.values(a.seancesRetardsPar)) {
              eleveIds.forEach((id) => {
                if (r[id] !== undefined) r[id]++;
              });
            }
          } else {
            (a.eleveIdsRetards || []).forEach((id: string) => {
              if (r[id] !== undefined) r[id]++;
            });
          }

          // Phase 40 — Comptage des exclusions (granulaire ou legacy)
          if (a.seancesExclusPar && Object.keys(a.seancesExclusPar).length > 0) {
            for (const eleveIds of Object.values(a.seancesExclusPar)) {
              eleveIds.forEach((id) => {
                if (x[id] !== undefined) x[id]++;
              });
            }
          } else {
            (a.eleveIdsExclus || []).forEach((id: string) => {
              if (x[id] !== undefined) x[id]++;
            });
          }
        });
        if (!cancelled) {
          setCounts(c); setRetards(r); setExclusions(x); setSeancesManquees(sm);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupeId, profId, statsEleves, periode]);

  /*
    🆕 (mai 2026) — Chargement du SUIVI ÉLÈVE pour la journée courante.
    ──────────────────────────────────────────────────────────────────
      • Récupère les documents de suivi déjà saisis aujourd'hui.
      • Pré-calcule la map « absent à la séance précédente » pour
        l'auto-remplissage de la colonne dédiée.
      • Fusionne les deux sources dans `suiviMap` (clé eleveId).

    Le hook est isolé des compteurs historiques (effet précédent) pour
    ne pas le ré-exécuter inutilement quand la période change.
  */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [suivis, mapAbsPrec] = await Promise.all([
          getSuivisJour(groupeId, dateJour, profId),
          calculerAbsencesSeancePrecedente(groupeId, dateJour, profId),
        ]);
        if (cancelled) return;
        const map: Record<string, Partial<SuiviSeanceEleve>> = {};
        const drafts: Record<string, string> = {};
        statsEleves.forEach((e) => {
          // Suivi déjà existant pour cet élève aujourd'hui (peut être undefined)
          const existant = suivis.find((s) => s.eleveId === e.eleveId);
          map[e.eleveId] = {
            // Le calcul auto a la priorité ; le champ stocké manuel
            // surcharge si l'enseignant a explicitement réglé la valeur.
            absenceSeancePrecedente:
              existant?.absenceSeancePrecedente ?? mapAbsPrec[e.eleveId] ?? false,
            observation: existant?.observation ?? '',
            tonaliteObservation: existant?.tonaliteObservation ?? 'neutre',
            materielNonAmene: existant?.materielNonAmene ?? false,
            materielNonAmeneDetail: existant?.materielNonAmeneDetail ?? '',
            travailNonFait: existant?.travailNonFait ?? false,
            travailNonFaitDetail: existant?.travailNonFaitDetail ?? '',
          };
          drafts[e.eleveId] = existant?.observation ?? '';
        });
        setSuiviMap(map);
        setDraftObs(drafts);
      } catch (err) {
        // Suivi indisponible (par exemple : règles Firestore non
        // appliquées). On ne casse pas le tableau — les colonnes
        // « suivi » resteront simplement vides / éditables.
        console.error('[AppelSuiviTable] chargement suivi du jour :', err);
      }
    })();
    return () => { cancelled = true; };
  }, [groupeId, profId, dateJour, statsEleves]);

  /**
   * 🆕 Helper de PATCH OPTIMISTE :
   *   1. Met à jour le state local immédiatement (réactivité UI).
   *   2. Persiste en arrière-plan via `upsertSuiviSeance`.
   *   3. Notifie les parents en temps réel selon le type de patch.
   */
  const patchSuivi = async (
    eleveId: string,
    eleveNom: string,
    patch: Partial<SuiviSeanceEleve>,
    notif?: {
      type: 'observation_positive' | 'observation_negative' | 'materiel_non_amene' | 'travail_non_fait' | 'absence_seance_precedente';
      sujet: string;
      message: string;
    },
  ) => {
    // 1) Update optimiste — l'écran reflète tout de suite la saisie.
    setSuiviMap((prev) => ({
      ...prev,
      [eleveId]: { ...(prev[eleveId] || {}), ...patch },
    }));

    // 2) Persistance Firestore (ne bloque pas l'UI).
    try {
      await upsertSuiviSeance(groupeId, dateJour, eleveId, eleveNom, profId, patch);
    } catch (err) {
      console.error('[AppelSuiviTable] erreur enregistrement suivi :', err);
    }

    // 3) Notification temps réel des parents si demandée (canal in-app).
    if (notif) {
      notifierParents({
        eleveId,
        eleveNom,
        profNom: profNom || 'Enseignant',
        sujet: notif.sujet,
        message: notif.message,
        type: notif.type,
      });
    }
  };

  if (loading) return <p className="text-muted">Chargement...</p>;

  // Tri : élèves avec le plus d'absences d'abord, puis retards, puis ordre alphabétique
  const sorted = [...statsEleves].sort((a, b) => {
    const diffAbs = (counts[b.eleveId] || 0) - (counts[a.eleveId] || 0);
    if (diffAbs !== 0) return diffAbs;
    const diffRet = (retards[b.eleveId] || 0) - (retards[a.eleveId] || 0);
    if (diffRet !== 0) return diffRet;
    return compareParNomFamille(a.eleveNom, b.eleveNom);
  });

  return (
    <table className="groupe-eleves-table groupe-appel-suivi-table">
      <thead>
        <tr>
          <th>Élève</th>
          <th>Absences ({periode})</th>
          <th>Retards ({periode})</th>
          {/* Phase 40 — colonne Exclusions (mesures disciplinaires) */}
          <th title="Nombre d'exclusions disciplinaires sur la période">Exclusions ({periode})</th>
          {/*
            🆕 (mai 2026) — Colonne « HISTORIQUE DES ABSENCES »
            ──────────────────────────────────────────────────
            Remplace l'ancienne colonne « Abs. séance préc. » (case à
            cocher booléenne, peu informative). Affiche désormais le
            nombre total d'absences sur la période sélectionnée
            (jour / semaine / mois) avec :
              • Une INFOBULLE NATIVE (title) listant chaque absence
                au format « JJ/MM/AAAA — Titre de la séance ».
              • Un POPOVER cliquable plus riche (mise en forme,
                dates en français, contenu complet de la séance).
            Aucune perte d'information : la donnée « séances
            manquées » est désormais fusionnée dans cette colonne
            unique, plus lisible et plus pédagogique.
          */}
          <th title="Cliquez sur le nombre pour voir le détail (dates et contenu des séances manquées)">
            Historique des absences
          </th>
          {/*
            🆕 (mai 2026) — Trois colonnes de SUIVI ÉLÈVE
            ─────────────────────────────────────────────
            Toutes saisies pour la journée courante et synchronisées
            en temps réel avec le compte parent / tuteur.
          */}
          <th title="Observation qualitative (positive / neutre / négative)">
            Observation
          </th>
          <th title="Élève venu sans son matériel scolaire à la séance du jour">
            Matériel non amené
          </th>
          <th title="Travail demandé non rendu / non fait à la séance du jour">
            Travail non fait
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(e => {
          // Pictogramme ♂ / ♀ / ✱ devant le nom, en couleur (bleu / rose / gris)
          // Aucun pictogramme si sexe non renseigné — la cellule reste neutre.
          const sx = sexeMap?.[e.eleveId];
          const picto = sx ? SEXE_PICTOS[sx] : '';
          const couleurPicto = sx === 'F' ? '#ec4899' : sx === 'M' ? '#3b82f6' : '#9ca3af';
          // 🆕 État de suivi du jour pour cet élève (jamais undefined :
          // initialisé dans le useEffect avec des valeurs neutres).
          const suivi = suiviMap[e.eleveId] || {};
          const tonalite: TonaliteObservation =
            (suivi.tonaliteObservation as TonaliteObservation) || 'neutre';
          return (
          <tr key={e.eleveId}>
            {/* Nom formaté "Prénoms NOM" + pictogramme sexe (optionnel) */}
            <td>
              {sx && (
                <span
                  aria-label={SEXE_LABELS[sx]}
                  title={SEXE_LABELS[sx]}
                  style={{ color: couleurPicto, fontWeight: 700, marginRight: 6 }}
                >
                  {picto}
                </span>
              )}
              {formatEleveNom(e.eleveNom)}
            </td>
            <td className={counts[e.eleveId] > 0 ? 'prof-note-critique' : ''}>
              {counts[e.eleveId] || 0}
            </td>
            <td className={retards[e.eleveId] > 0 ? 'prof-note-insuffisant' : ''}>
              {retards[e.eleveId] || 0}
            </td>
            {/* Phase 40 — Cellule Exclusions : style brique si > 0 */}
            <td
              style={exclusions[e.eleveId] > 0
                ? { color: '#7c2d12', background: '#fed7aa', fontWeight: 700 }
                : undefined}
            >
              {exclusions[e.eleveId] || 0}
            </td>
            {/*
              🆕 COLONNE « HISTORIQUE DES ABSENCES »
              ─────────────────────────────────────
              • Affiche le NOMBRE total d'absences (counts[id]).
              • Tooltip natif (attribut `title`) listant chaque
                absence au format « JJ/MM/AAAA — Titre séance ».
              • Au CLIC, ouvre/ferme un POPOVER lisible avec mise
                en forme : date en gras puis contenu complet.
              • Affichage neutre « — » si zéro absence.
            */}
            <td className="groupe-histo-abs-cell" style={{ position: 'relative', textAlign: 'center' }}>
              {(() => {
                // Liste enrichie pour cet élève (date + titre par absence)
                const histo = seancesManquees[e.eleveId] || [];
                const total = counts[e.eleveId] || 0;
                // Formatte une date YYYY-MM-DD vers JJ/MM/AAAA (FR)
                const formatDateFR = (iso: string): string => {
                  if (!iso) return '';
                  const [y, m, d] = iso.split('-');
                  return d && m && y ? `${d}/${m}/${y}` : iso;
                };
                // Construction du tooltip natif (texte brut multi-lignes)
                const tooltipText = histo.length > 0
                  ? histo.map(h => `${formatDateFR(h.date)} — ${h.titre}`).join('\n')
                  : 'Aucune absence sur la période';
                // Le popover est ouvert si l'eleveId courant matche l'état
                const popoverOuvert = popoverHistoEleveId === e.eleveId;
                return total > 0 ? (
                  <>
                    <button
                      type="button"
                      className={`groupe-histo-abs-btn ${popoverOuvert ? 'is-open' : ''}`}
                      title={tooltipText}
                      aria-label={`Historique des absences de ${formatEleveNom(e.eleveNom)} : ${total} absence${total > 1 ? 's' : ''}. Cliquez pour voir le détail.`}
                      aria-haspopup="dialog"
                      aria-expanded={popoverOuvert}
                      onClick={() =>
                        setPopoverHistoEleveId(prev => (prev === e.eleveId ? null : e.eleveId))
                      }
                    >
                      {total}
                    </button>
                    {popoverOuvert && (
                      <div
                        className="groupe-histo-abs-popover"
                        role="dialog"
                        aria-label={`Détail des absences de ${formatEleveNom(e.eleveNom)}`}
                      >
                        <div className="groupe-histo-abs-popover-head">
                          <strong>{formatEleveNom(e.eleveNom)}</strong>
                          <span className="groupe-histo-abs-popover-count">
                            {total} absence{total > 1 ? 's' : ''} ({periode})
                          </span>
                          <button
                            type="button"
                            className="groupe-histo-abs-popover-close"
                            aria-label="Fermer le détail"
                            onClick={() => setPopoverHistoEleveId(null)}
                          >
                            ✕
                          </button>
                        </div>
                        <ul className="groupe-histo-abs-popover-list">
                          {histo.map((h, i) => (
                            <li key={`${h.date}-${i}`}>
                              <span className="groupe-histo-abs-popover-date">
                                {formatDateFR(h.date)}
                              </span>
                              <span className="groupe-histo-abs-popover-titre">
                                {h.titre}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-muted" title="Aucune absence sur la période">—</span>
                );
              })()}
            </td>
            {/*
              🆕 COLONNE 2 — OBSERVATION QUALITATIVE
              ─────────────────────────────────────
              Champ texte + sélecteur de tonalité (😊/😐/😟).
              Sauvegarde + notification parents au blur (perte de focus)
              et lors du changement de tonalité.
            */}
            <td style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  value={tonalite}
                  onChange={(ev) => {
                    const t = ev.target.value as TonaliteObservation;
                    patchSuivi(e.eleveId, e.eleveNom, { tonaliteObservation: t });
                  }}
                  title={TONALITE_OBSERVATION_LABELS[tonalite]}
                  aria-label="Tonalité de l'observation"
                  style={{
                    padding: '2px 4px',
                    fontSize: '0.74rem',
                    border: `1px solid ${TONALITE_OBSERVATION_COULEURS[tonalite]}`,
                    color: TONALITE_OBSERVATION_COULEURS[tonalite],
                    borderRadius: 4,
                    background: '#fff',
                    fontWeight: 600,
                  }}
                >
                  <option value="positive">😊 Positive</option>
                  <option value="neutre">😐 Neutre</option>
                  <option value="negative">😟 Négative</option>
                </select>
                <input
                  type="text"
                  placeholder="Observation du jour…"
                  value={draftObs[e.eleveId] ?? ''}
                  onChange={(ev) => setDraftObs((d) => ({ ...d, [e.eleveId]: ev.target.value }))}
                  onBlur={(ev) => {
                    const texte = ev.target.value.trim();
                    if (texte === (suivi.observation || '').trim()) return; // pas de changement
                    patchSuivi(
                      e.eleveId,
                      e.eleveNom,
                      { observation: texte, tonaliteObservation: tonalite },
                      texte ? {
                        type: tonalite === 'positive' ? 'observation_positive' : 'observation_negative',
                        sujet:
                          tonalite === 'positive'
                            ? 'Observation positive du professeur'
                            : 'Observation du professeur',
                        message: `Observation concernant ${formatEleveNom(e.eleveNom)} : ${texte}`,
                      } : undefined,
                    );
                  }}
                  style={{
                    padding: '3px 6px',
                    fontSize: '0.78rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                  }}
                  title="Observation libre — sauvegarde automatique à la sortie du champ"
                  aria-label={`Observation pour ${e.eleveNom}`}
                />
              </div>
            </td>
            {/*
              🆕 COLONNE 3 — MATÉRIEL NON AMENÉ
              ────────────────────────────────
              Toggle + précision facultative. Couleur ambre si vrai.
              Notification parents déclenchée à la coche.
            */}
            <td style={{ textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={!!suivi.materielNonAmene}
                onChange={(ev) => {
                  const checked = ev.target.checked;
                  patchSuivi(
                    e.eleveId,
                    e.eleveNom,
                    { materielNonAmene: checked },
                    checked ? {
                      type: 'materiel_non_amene',
                      sujet: 'Matériel scolaire non amené',
                      message: `${formatEleveNom(e.eleveNom)} n'a pas amené son matériel à la séance d'aujourd'hui (${dateJour}).`,
                    } : undefined,
                  );
                }}
                title="Cocher si l'élève n'a pas amené son matériel scolaire"
                aria-label="Matériel non amené"
                style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </td>
            {/*
              🆕 COLONNE 4 — TRAVAIL NON FAIT
              ──────────────────────────────
              Toggle + précision facultative. Couleur rouge si vrai.
              Notification parents déclenchée à la coche.
            */}
            <td style={{ textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={!!suivi.travailNonFait}
                onChange={(ev) => {
                  const checked = ev.target.checked;
                  patchSuivi(
                    e.eleveId,
                    e.eleveNom,
                    { travailNonFait: checked },
                    checked ? {
                      type: 'travail_non_fait',
                      sujet: 'Travail non fait',
                      message: `${formatEleveNom(e.eleveNom)} n'a pas rendu / fait le travail demandé pour aujourd'hui (${dateJour}).`,
                    } : undefined,
                  );
                }}
                title="Cocher si l'élève n'a pas fait / rendu son travail"
                aria-label="Travail non fait"
                style={{ accentColor: '#dc2626', cursor: 'pointer' }}
              />
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}


// ==================== INTERFACE PROPS ====================

interface GroupeDetailProps {
  /** Le groupe sélectionné à afficher */
  groupe: GroupeProf;
  /** Callback pour revenir à la liste des groupes */
  onRetour: () => void;
  /**
   * ✨ Onglet à pré-sélectionner à l'ouverture (ex. 'notes' lorsqu'on
   *    revient depuis l'éditeur de feuille de notes). Si non fourni,
   *    l'onglet par défaut « apercu » est utilisé.
   */
  initialOnglet?: OngletActif;
}


// ==================== COMPOSANT PRINCIPAL ====================

const GroupeDetail: React.FC<GroupeDetailProps> = ({ groupe, onRetour, initialOnglet }) => {
  const { currentUser } = useAuth();
  // Hook de navigation utilisé par l'onglet Planification pour ouvrir la page complète
  const navigate = useNavigate();

  // ===== États : données =====
  const [statsGroupe, setStatsGroupe] = useState<StatsGroupe | null>(null);
  const [statsEleves, setStatsEleves] = useState<EleveGroupeStats[]>([]);
  // Inscriptions complètes (incluent eleveSexe / eleveSexeAutre) — utilisées
  // pour afficher les pictogrammes ♂/♀ et calculer la répartition genrée.
  const [inscriptions, setInscriptions] = useState<InscriptionGroupe[]>([]);
  const [alertes, setAlertes] = useState<AlerteProf[]>([]);
  const [quizDisponibles, setQuizDisponibles] = useState<{ id: string; titre: string; source?: string }[]>([]);
  const [statsQuiz, setStatsQuiz] = useState<StatsQuizGroupe | null>(null);
  const [travaux, setTravaux] = useState<TravailAFaire[]>([]);
  const [observations, setObservations] = useState<Record<string, string>>({});

  // ===== États : Appel / Absences / Retards =====
  const [dateAppel, setDateAppel] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [absentsIds, setAbsentsIds] = useState<string[]>([]);
  // ✨ Retards : IDs des élèves en retard + détails (minutes, motif, commentaire)
  const [retardsIds, setRetardsIds] = useState<string[]>([]);
  const [retardsDetails, setRetardsDetails] = useState<Record<string, DetailRetard>>({});
  /* PHASE 40 — Exclusions
     Statut disciplinaire : un élève renvoyé du cours (ou exclu pour
     plusieurs jours) ne doit pas être confondu avec un absent ou un
     retardataire. Détails : durée en jours, motif, décideur, commentaire.
     Mutuellement exclusif avec absent/retard côté UI ET côté service. */
  const [exclusIds, setExclusIds] = useState<string[]>([]);
  const [exclusionsDetails, setExclusionsDetails] = useState<Record<string, DetailExclusion>>({});
  const [loadingAppel, setLoadingAppel] = useState(false);
  // Feedback de sauvegarde ("idle" | "ok" | "err") pour l'utilisateur
  const [appelSaveState, setAppelSaveState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [periodeSuivi, setPeriodeSuivi] = useState<'jour' | 'semaine' | 'mois'>('semaine');
  /*
    🆕 (mai 2026) — SOUS-ONGLETS INTERNES DE L'ONGLET « APPEL »
    ──────────────────────────────────────────────────────────
    L'onglet ✅ Appel est désormais segmenté en deux feuilles
    distinctes pour une meilleure ergonomie :
      • 'feuille-appel'  → Saisie de l'appel du jour (marquer les
        absents / retards / exclus, lier aux séances, enregistrer).
      • 'feuille-suivi'  → Feuille de gestion & suivi : tableau
        synthétique des absences, observations, matériel, travail,
        et bouton de génération du bulletin PDF.
    La sélection est persistée localement le temps de la session
    (state local — pas de stockage durable nécessaire).
  */
  const [sousOngletAppel, setSousOngletAppel] = useState<'feuille-appel' | 'feuille-suivi'>('feuille-appel');
  // Liaison absence ↔ séance
  const [appelCahiers, setAppelCahiers] = useState<CahierTextes[]>([]);
  const [appelCahierId, setAppelCahierId] = useState('');
  const [appelEntrees, setAppelEntrees] = useState<EntreeCahier[]>([]);
  /**
   * Phase 38 — On supporte désormais une liste d'IDs de séances
   * (multi-séances dans la même journée). Les anciens enregistrements
   * (un seul `entreeId`) sont chargés sous forme de tableau à 1 élément
   * lors de la lecture (cf. `getAppelByDate` plus bas).
   */
  const [appelEntreeIds, setAppelEntreeIds] = useState<string[]>([]);

  /**
   * Phase 39 — Statut DÉTAILLÉ par élève ET par séance.
   *   Structure : { [eleveId]: { [entreeId]: 'absent' | 'retard' | 'present' } }
   *   - Un élève peut être 'absent' à la 1re heure et 'present' à la 2de.
   *   - Si un élève n'a pas de clé pour une séance donnée, on retombe
   *     sur le statut GLOBAL (`absentsIds` / `retardsIds`) qui s'applique
   *     à TOUTES les séances liées (rétro-compat).
   *   - Quand l'utilisateur clique sur un chip de séance, on bascule
   *     l'override pour cette séance précise.
   */
  type StatutEleveSeance = 'absent' | 'retard' | 'present';
  const [seancesParEleve, setSeancesParEleve] = useState<
    Record<string /*eleveId*/, Record<string /*entreeId*/, StatutEleveSeance>>
  >({});
  /** Éleve dont la grille de détail-séance est dépliée (UI uniquement). */
  const [detailSeanceEleve, setDetailSeanceEleve] = useState<string | null>(null);

  // ===== États : Travaux à faire =====
  const [nouveauTravailTitre, setNouveauTravailTitre] = useState('');
  const [nouveauTravailDesc, setNouveauTravailDesc] = useState('');
  const [nouveauTravailEcheance, setNouveauTravailEcheance] = useState('');
  const [nouveauTravailHeure, setNouveauTravailHeure] = useState('');
  const [nouveauTravailRubriqueId, setNouveauTravailRubriqueId] = useState('');
  const [savingTravail, setSavingTravail] = useState(false);
  // Phase 31 — Cahiers liés au groupe (pour sélecteur rubrique)
  const [cahiersGroupe, setCahiersGroupe] = useState<CahierTextes[]>([]);
  const [cahierSelectionne, setCahierSelectionne] = useState('');
  // Phase 31 — Filtres travaux
  const [filtreTravailRubrique, setFiltreTravailRubrique] = useState<string>('tous');
  const [filtreTravailEcheance, setFiltreTravailEcheance] = useState<'tous' | 'aujourdhui' | 'semaine' | 'mois'>('tous');
  const [filtreTravailCorrige, setFiltreTravailCorrige] = useState<'tous' | 'corrige' | 'non_corrige'>('tous');
  // Phase 32 — Planification
  const [planifCahierIdx, setPlanifCahierIdx] = useState(0);
  const [planifEntrees, setPlanifEntrees] = useState<EntreeCahier[]>([]);
  const [planifCahiers, setPlanifCahiers] = useState<CahierTextes[]>([]);
  const [loadingPlanif, setLoadingPlanif] = useState(false);

  // ===== États : UI =====
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // ✨ initialOnglet (prop) prime sur la valeur par défaut « apercu » :
  //    permet d'ouvrir le détail d'un groupe directement sur l'onglet
  //    « Notes » lors d'un retour depuis l'éditeur de feuille de notes.
  const [ongletActif, setOngletActif] = useState<OngletActif>(initialOnglet || 'apercu');
  const [triEleves, setTriEleves] = useState<TriEleves>('moyenne_desc');
  const [eleveSelectionne, setEleveSelectionne] = useState<string | null>(null);
  const [observationEdit, setObservationEdit] = useState('');
  const [savingObservation, setSavingObservation] = useState<string | null>(null);
  const [quizSelectionne, setQuizSelectionne] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState<boolean>(false);
  const [loadingRetrait, setLoadingRetrait] = useState<string | null>(null);
  // ✨ Édition inline du nom d'un élève (correction d'orthographe, etc.).
  //    `editEleveId` : eleveId en cours d'édition (null = aucun).
  //    `draftEleveNom` : valeur du champ pendant la saisie.
  //    `savingEleveNom` : eleveId en cours de sauvegarde (loader visuel).
  const [editEleveId, setEditEleveId] = useState<string | null>(null);
  const [draftEleveNom, setDraftEleveNom] = useState<string>('');
  const [savingEleveNom, setSavingEleveNom] = useState<string | null>(null);
  // 🆕 Édition inline du SEXE d'un élève — fonctionne en parallèle de
  //    l'édition du nom. Les deux modes sont mutuellement exclusifs côté UI
  //    pour éviter qu'un même clic ouvre 2 sous-formulaires.
  const [editSexeEleveId, setEditSexeEleveId] = useState<string | null>(null);
  const [draftSexe, setDraftSexe] = useState<SexeEleve | undefined>(undefined);
  const [draftSexeAutre, setDraftSexeAutre] = useState<string>('');
  const [savingSexeEleveId, setSavingSexeEleveId] = useState<string | null>(null);
  const [modalInscriptionOuvert, setModalInscriptionOuvert] = useState(false);
  // Phase 38 — Modale Bulletin de suivi (absences/retards) ouverte ?
  const [modalBulletinOuvert, setModalBulletinOuvert] = useState(false);


  /* ═══════════════════════════════════════════════════════════════════
     PHASE 40 — Rappel des antécédents (30 derniers jours)
     ═══════════════════════════════════════════════════════════════════
     Pour chaque élève du groupe, on calcule (à l'ouverture de l'onglet
     « Appel ») le nombre d'absences, retards et exclusions sur les 30
     derniers jours qui précèdent la date d'appel sélectionnée. Ces
     compteurs sont affichés sous forme de mini-badges à côté du nom,
     pour que l'enseignant ait immédiatement à l'œil le profil
     d'assiduité de chaque élève au moment du marquage.
     Mis en cache côté client (state) pour éviter les recalculs.
     ═══════════════════════════════════════════════════════════════════ */
  type AntecedentsCount = { absences: number; retards: number; exclusions: number };
  const [antecedentsParEleve, setAntecedentsParEleve] = useState<Record<string, AntecedentsCount>>({});

  useEffect(() => {
    if (ongletActif !== 'appel') return;
    if (!currentUser?.uid) return;
    if (!dateAppel) return;

    let annule = false;
    // Fenêtre : 30 jours avant la date d'appel (exclu)
    const fin = new Date(dateAppel);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - 30);
    const debutStr = debut.toISOString().slice(0, 10);
    // On regarde JUSQU'À la veille de l'appel pour ne pas inclure
    // l'appel en cours lui-même (sinon l'enseignant verrait
    // immédiatement ses propres saisies récentes).
    const veille = new Date(fin);
    veille.setDate(veille.getDate() - 1);
    const finStr = veille.toISOString().slice(0, 10);
    if (finStr < debutStr) return;

    getAbsencesByPeriod(groupe.id, debutStr, finStr, currentUser.uid)
      .then((appels) => {
        if (annule) return;
        const acc: Record<string, AntecedentsCount> = {};
        appels.forEach((a) => {
          (a.eleveIdsAbsents || []).forEach((id) => {
            acc[id] = acc[id] || { absences: 0, retards: 0, exclusions: 0 };
            acc[id].absences += 1;
          });
          (a.eleveIdsRetards || []).forEach((id) => {
            acc[id] = acc[id] || { absences: 0, retards: 0, exclusions: 0 };
            acc[id].retards += 1;
          });
          (a.eleveIdsExclus || []).forEach((id) => {
            acc[id] = acc[id] || { absences: 0, retards: 0, exclusions: 0 };
            acc[id].exclusions += 1;
          });
        });
        setAntecedentsParEleve(acc);
      })
      .catch((err) => {
        // Silencieux : la fonction de rappel est non bloquante pour l'appel
        console.warn('Antécédents indisponibles :', err);
      });

    return () => { annule = true; };
  }, [ongletActif, groupe.id, currentUser?.uid, dateAppel]);

  // ==================== CHARGEMENT DES DONNÉES ====================

  /**
   * Charge toutes les données du groupe :
   * stats globales, stats par élève, alertes, quiz disponibles
   */
  const chargerDonneesGroupe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ===== Chargement parallèle =====
      // ⚠️ On ajoute getElevesGroupe pour récupérer les inscriptions
      //    enrichies (eleveSexe, eleveSexeAutre) — indispensables pour
      //    les statistiques genrées et les pictogrammes ♂/♀.
      const [stats, elevesStats, quiz, inscs] = await Promise.all([
        getStatsGroupe(groupe.id),
        getStatsElevesGroupe(groupe.id),
        getQuizParMatiere(groupe.matiereId, groupe.id),
        getElevesGroupe(groupe.id),
      ]);

      setStatsGroupe(stats);
      setStatsEleves(elevesStats);
      setInscriptions(inscs);
      setQuizDisponibles(quiz);

      // ===== Générer les alertes =====
      const alertesGenerees = genererAlertesProf(elevesStats, groupe.nom);
      setAlertes(alertesGenerees);

    } catch (err: any) {
      console.error('Erreur chargement détail groupe:', err);
      setError('Impossible de charger les données du groupe.');
    } finally {
      setLoading(false);
    }
  }, [groupe.id, groupe.matiereId, groupe.nom]);

  useEffect(() => {
    chargerDonneesGroupe();
  }, [chargerDonneesGroupe]);

  /** Charge l'appel complet du jour (absences + retards) + cahiers */
  useEffect(() => {
    if (ongletActif !== 'appel') return;
    // ✨ On charge l'appel complet pour récupérer absents ET retards
    getAppelByDate(groupe.id, dateAppel)
      .then((appel) => {
        setAbsentsIds(appel?.eleveIdsAbsents || []);
        setRetardsIds(appel?.eleveIdsRetards || []);
        setRetardsDetails(appel?.retardsDetails || {});
        // Phase 40 — Restauration des exclusions persistées
        setExclusIds(appel?.eleveIdsExclus || []);
        setExclusionsDetails(appel?.exclusionsDetails || {});
        // Phase 38 — On restaure la sélection multi-séances (ou legacy
        // unique si l'appel a été enregistré avant la Phase 38).
        if (appel) {
          if (Array.isArray(appel.entreeIds) && appel.entreeIds.length > 0) {
            setAppelEntreeIds(appel.entreeIds);
          } else if (appel.entreeId) {
            setAppelEntreeIds([appel.entreeId]);
          } else {
            setAppelEntreeIds([]);
          }
          // Phase 39 — Reconstruction de l'index inversé eleveId → {entreeId: statut}.
          //   Le stockage Firestore est par séance ; côté UI on indexe
          //   plutôt par élève pour pouvoir afficher rapidement la
          //   grille de détail dans la ligne de l'élève.
          const idxEleveSeance: Record<string, Record<string, 'absent' | 'retard' | 'present'>> = {};
          const remplir = (
            src: Record<string, string[]> | undefined,
            statut: 'absent' | 'retard',
          ) => {
            if (!src) return;
            for (const [entreeId, eleveIds] of Object.entries(src)) {
              for (const eId of eleveIds) {
                idxEleveSeance[eId] = idxEleveSeance[eId] || {};
                idxEleveSeance[eId][entreeId] = statut;
              }
            }
          };
          remplir(appel.seancesAbsentsPar, 'absent');
          remplir(appel.seancesRetardsPar, 'retard');
          setSeancesParEleve(idxEleveSeance);
        } else {
          setAppelEntreeIds([]);
          setSeancesParEleve({});
        }
      })
      .catch(() => {
        setAbsentsIds([]);
        setRetardsIds([]);
        setRetardsDetails({});
        setAppelEntreeIds([]);
        setSeancesParEleve({});
      });
    if (currentUser?.uid) {
      getCahiersForGroupe(groupe.id, currentUser.uid)
        .then(c => { setAppelCahiers(c); if (c.length === 1) setAppelCahierId(c[0].id); })
        .catch(() => setAppelCahiers([]));
    }
  }, [ongletActif, groupe.id, dateAppel, currentUser?.uid]);

  /** Charge les entrées du cahier sélectionné pour l'appel (filtrées par date) */
  useEffect(() => {
    if (!appelCahierId) { setAppelEntrees([]); setAppelEntreeIds([]); return; }
    getEntreesCahier(appelCahierId).then(entries => {
      const filtered = entries.filter(e => {
        const d = e.date?.toDate?.();
        return d && d.toISOString().slice(0, 10) === dateAppel;
      });
      // Si aucune séance ce jour, montrer toutes les séances pour sélection libre
      setAppelEntrees(filtered.length > 0 ? filtered : entries);
      setAppelEntreeIds([]);
    }).catch(() => setAppelEntrees([]));
  }, [appelCahierId, dateAppel]);

  /** Charge les travaux à faire + cahiers liés au groupe (rubriques) */
  useEffect(() => {
    if (ongletActif !== 'travaux') return;
    getTravauxByGroupe(groupe.id).then(setTravaux).catch(() => setTravaux([]));
    if (currentUser?.uid) {
      getCahiersForGroupe(groupe.id, currentUser.uid)
        .then((cahiers) => {
          setCahiersGroupe(cahiers);
          if (cahiers.length === 1) setCahierSelectionne(cahiers[0].id);
        })
        .catch(() => setCahiersGroupe([]));
    }
  }, [ongletActif, groupe.id, currentUser?.uid]);

  /** Phase 32 — Charge les cahiers + entrées pour la planification */
  useEffect(() => {
    if (ongletActif !== 'planification' || !currentUser?.uid) return;
    let cancelled = false;
    setLoadingPlanif(true);
    getCahiersForGroupe(groupe.id, currentUser.uid)
      .then(async (cahiers) => {
        if (cancelled) return;
        setPlanifCahiers(cahiers);
        if (cahiers.length > 0) {
          const idx = Math.min(planifCahierIdx, cahiers.length - 1);
          setPlanifCahierIdx(idx);
          const entries = await getEntreesCahier(cahiers[idx].id);
          if (!cancelled) setPlanifEntrees(entries);
        } else {
          setPlanifEntrees([]);
        }
      })
      .catch(() => { if (!cancelled) { setPlanifCahiers([]); setPlanifEntrees([]); } })
      .finally(() => { if (!cancelled) setLoadingPlanif(false); });
    return () => { cancelled = true; };
  }, [ongletActif, groupe.id, currentUser?.uid, planifCahierIdx]);

  /** Charge l'observation de l'élève sélectionné */
  useEffect(() => {
    if (!eleveSelectionne) {
      setObservationEdit('');
      return;
    }
    getObservationEleve(groupe.id, eleveSelectionne).then((t) => {
      setObservationEdit(t);
      setObservations(prev => ({ ...prev, [eleveSelectionne]: t }));
    }).catch(() => setObservationEdit(''));
  }, [groupe.id, eleveSelectionne]);


  // ==================== HANDLERS ====================

  /**
   * Analyse un quiz spécifique
   */
  const handleAnalyserQuiz = async (quizId: string, quizSource?: string) => {
    try {
      setLoadingQuiz(true);
      setQuizSelectionne(quizId);
      const stats = await getStatsQuizGroupe(groupe.id, quizId, quizSource);
      setStatsQuiz(stats);
    } catch (err) {
      console.error('Erreur analyse quiz:', err);
    } finally {
      setLoadingQuiz(false);
    }
  };

  /**
   * Exporte les résultats en CSV
   */
  const handleExportCSV = () => {
    const csv = genererExportCSV(statsEleves, groupe.nom);
    const nomFichier = `PedaClic_${groupe.nom.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    telechargerCSV(csv, nomFichier);
  };

  /**
   * Retire un élève du groupe — sans rechargement complet de la page.
   *
   *   ⚡ Optimistic update :
   *     1. Lookup de l'inscription dans l'état local.
   *     2. Suppression Firestore (`retirerEleve`).
   *     3. Patch local sur :
   *          • `inscriptions` (filter)
   *          • `statsEleves` (filter)
   *          • `alertes` (filter — celles qui ciblaient l'élève disparaissent)
   *          • `statsGroupe.nombreEleves` (décrément ; jamais < 0)
   *     4. Si l'élève retiré était sélectionné dans le panneau détail,
   *        on referme le panneau pour éviter un état orphelin.
   *
   *   En cas d'échec Firestore, on tombe en repli sur un rechargement
   *   complet pour ne pas laisser l'UI désynchronisée.
   */
  const handleRetirerEleve = async (eleveId: string) => {
    const inscription = inscriptions.find((i) => i.eleveId === eleveId);
    if (!inscription) {
      // Cas rare : la liste locale n'a pas l'élève (désynchronisation
      // en background, par exemple). On retombe alors sur le chemin
      // Firestore complet pour rester sûr.
      try {
        setLoadingRetrait(eleveId);
        const inscs = await getElevesGroupe(groupe.id);
        const insc = inscs.find((i) => i.eleveId === eleveId);
        if (insc) {
          await retirerEleve(insc.id, groupe.id);
          await chargerDonneesGroupe();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingRetrait(null);
      }
      return;
    }

    try {
      setLoadingRetrait(eleveId);
      await retirerEleve(inscription.id, groupe.id);

      // ── Mise à jour locale (instantanée pour l'utilisateur) ──
      setInscriptions((prev) => prev.filter((i) => i.eleveId !== eleveId));
      setStatsEleves((prev) => prev.filter((s) => s.eleveId !== eleveId));
      setAlertes((prev) => prev.filter((a) => a.eleveId !== eleveId));
      setStatsGroupe((prev) =>
        prev
          ? { ...prev, nombreEleves: Math.max(0, prev.nombreEleves - 1) }
          : prev,
      );
      // Si le panneau détail visait cet élève, on le referme.
      if (eleveSelectionne === eleveId) {
        setEleveSelectionne(null);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de retirer l'élève.");
      // Sécurité : resync depuis Firestore en cas d'erreur de write
      chargerDonneesGroupe().catch(() => {});
    } finally {
      setLoadingRetrait(null);
    }
  };

  /**
   * ✨ Persiste le nom d'un élève (correction d'une coquille).
   *
   *  Étapes :
   *   1. Validation locale : nom non vide.
   *   2. Lookup de l'inscription correspondante (un élève peut être
   *      dans plusieurs groupes ; on cible bien celle de CE groupe).
   *   3. Appel `modifierNomEleve` (Firestore).
   *   4. Recharge des données du groupe pour rafraîchir partout
   *      (tableau, classement, alertes, exports, feuilles de notes).
   *
   *  Aucune modification destructive : les notes, l'historique d'appel
   *  et les feuilles de notes sont préservés (le nom est dénormalisé,
   *  donc il suffit de le mettre à jour à un seul endroit).
   */
  /**
   * Persiste le nouveau nom d'un élève et met à jour l'UI SANS recharger
   * toute la page.
   *
   *   ⚡ Pattern « optimistic update » :
   *      1. Validation locale (nom non vide).
   *      2. Lookup de l'inscription dans l'état local `inscriptions`
   *         (déjà chargé) — évite un round-trip Firestore inutile.
   *      3. Si le nom a changé : appel `modifierNomEleve` (1 write).
   *      4. Mise à jour locale en miroir de TOUS les états dérivés :
   *           • `inscriptions` (source de vérité pour pictogrammes & co.)
   *           • `statsEleves`  (utilisée par la liste + le panneau détail)
   *           • `alertes`      (les messages incluent le nom — on patch
   *                             aussi pour rester cohérent visuellement).
   *      5. PAS de `chargerDonneesGroupe()` : la page reste fluide.
   *
   *   Si le write Firestore échoue, on rollback en re-déclenchant le
   *   chargement complet (sécurité : l'état local doit refléter la base).
   */
  const handleEditerNomEleve = async (eleveId: string) => {
    const valeur = draftEleveNom.trim();
    if (!valeur) {
      setError('Le nom ne peut pas être vide.');
      return;
    }
    // Lookup via l'état local — pas de Firestore.
    const inscription = inscriptions.find((i) => i.eleveId === eleveId);
    if (!inscription) {
      setError("Inscription introuvable pour cet élève.");
      return;
    }
    // Pas de changement → on évite l'écriture inutile.
    if (inscription.eleveNom === valeur) {
      setEditEleveId(null);
      return;
    }
    try {
      setSavingEleveNom(eleveId);
      await modifierNomEleve(inscription.id, valeur);

      // ── Mise à jour optimiste de TOUS les états dérivés ──
      setInscriptions((prev) =>
        prev.map((i) => (i.eleveId === eleveId ? { ...i, eleveNom: valeur } : i)),
      );
      setStatsEleves((prev) =>
        prev.map((s) => (s.eleveId === eleveId ? { ...s, eleveNom: valeur } : s)),
      );
      setAlertes((prev) =>
        prev.map((a) => (a.eleveId === eleveId ? { ...a, eleveNom: valeur } : a)),
      );

      setEditEleveId(null);
    } catch (err: any) {
      setError(err.message || "Impossible de mettre à jour le nom.");
      // Rollback de sécurité : on resynchronise depuis Firestore en cas
      // d'écriture partielle / erreur de règles.
      chargerDonneesGroupe().catch(() => {});
    } finally {
      setSavingEleveNom(null);
    }
  };

  /**
   * 🆕 Persiste le sexe d'un élève saisi inline depuis la liste « Élèves ».
   *
   *   - Lookup de l'inscription correspondant à `eleveId` dans CE groupe.
   *   - Appel `mettreAJourSexeInscription` (Firestore `inscriptions_groupe`).
   *   - Mise à jour optimiste de l'état local `inscriptions` (réutilisé par
   *     les pictogrammes ♂/♀ + carte « Répartition F/M » de l'aperçu)
   *     pour afficher la nouvelle valeur sans recharger toute la page.
   *   - Validation : si « Autre » → précision libre obligatoire.
   */
  const handleEditerSexeEleve = async (eleveId: string) => {
    if (draftSexe === 'autre' && !draftSexeAutre.trim()) {
      setError('Veuillez préciser le libellé pour « Autre ».');
      return;
    }
    try {
      setSavingSexeEleveId(eleveId);
      const inscription = inscriptions.find((i) => i.eleveId === eleveId);
      if (!inscription) {
        throw new Error("Inscription introuvable pour cet élève.");
      }
      await mettreAJourSexeInscription(
        inscription.id,
        draftSexe ?? null,
        draftSexe === 'autre' ? draftSexeAutre.trim() : null,
      );
      // Mise à jour optimiste : on évite un round-trip Firestore complet.
      //   → la carte Répartition F/M et les pictogrammes se rafraîchissent
      //     instantanément à l'écran.
      setInscriptions((prev) =>
        prev.map((i) =>
          i.eleveId === eleveId
            ? {
                ...i,
                eleveSexe: draftSexe,
                eleveSexeAutre: draftSexe === 'autre' ? draftSexeAutre.trim() : undefined,
              }
            : i,
        ),
      );
      // Reset de l'état d'édition local
      setEditSexeEleveId(null);
      setDraftSexe(undefined);
      setDraftSexeAutre('');
    } catch (err: any) {
      setError(err.message || 'Impossible de mettre à jour le sexe.');
    } finally {
      setSavingSexeEleveId(null);
    }
  };

  /**
   * Enregistre l'appel : absents + retards (minutes/motif/commentaire)
   * + séance liée (optionnelle).
   * Affiche un feedback visuel OK/KO à l'utilisateur.
   */
  const handleMarquerAbsences = async () => {
    if (!currentUser?.uid) {
      setError("Vous devez être connecté pour enregistrer l'appel.");
      setAppelSaveState('err');
      return;
    }
    try {
      setLoadingAppel(true);
      setAppelSaveState('idle');
      // Phase 38 — On collecte TOUTES les séances sélectionnées
      // (multi-séances : un élève peut manquer maths le matin + français
      //  l'après-midi → les deux séances sont liées au même appel).
      const entreesSelectionnees = appelEntreeIds
        .map((id) => appelEntrees.find((e) => e.id === id))
        .filter((e): e is EntreeCahier => !!e);
      const idsSeances = entreesSelectionnees.map((e) => e.id);
      const titresSeances = entreesSelectionnees.map((e) => e.chapitre);

      // Ne conserve les détails que pour les élèves effectivement en retard
      const detailsNets: Record<string, DetailRetard> = {};
      retardsIds.forEach((id) => {
        const d = retardsDetails[id] || { minutes: 0 };
        detailsNets[id] = {
          minutes: typeof d.minutes === 'number' ? d.minutes : 0,
          // motif/commentaire ne sont inclus que s'ils sont définis
          ...(d.motif ? { motif: d.motif } : {}),
          ...(d.commentaire ? { commentaire: d.commentaire } : {}),
        };
      });

      // ── Phase 39 — Construction des index par-séance ────────────────
      //   Pour chaque élève absent/retard globalement OU avec des
      //   overrides par séance, on construit `seancesAbsentsPar[seance]`
      //   = liste des eleveIds. Règle :
      //     • Si l'élève a un override `seancesParEleve[id]` → on respecte
      //       précisément les statuts par séance (chip cliqué).
      //     • Sinon, on retombe sur le statut GLOBAL (toutes séances liées).
      //   Cela rend le stockage minimal et préserve la rétro-compat.
      const seancesAbsentsPar: Record<string, string[]> = {};
      const seancesRetardsPar: Record<string, string[]> = {};
      for (const seanceId of idsSeances) {
        seancesAbsentsPar[seanceId] = [];
        seancesRetardsPar[seanceId] = [];
      }
      // 1) On part des élèves marqués globalement
      const tousElevesConcernes = new Set<string>([
        ...absentsIds,
        ...retardsIds,
        ...Object.keys(seancesParEleve),
      ]);
      for (const eleveId of tousElevesConcernes) {
        const overrides = seancesParEleve[eleveId];
        // Statut par défaut au cas où il n'y a pas d'override
        const statutGlobal: 'absent' | 'retard' | 'present' = absentsIds.includes(eleveId)
          ? 'absent'
          : retardsIds.includes(eleveId)
          ? 'retard'
          : 'present';
        for (const seanceId of idsSeances) {
          // Override prioritaire si défini, sinon statut global
          const statut = overrides?.[seanceId] ?? statutGlobal;
          if (statut === 'absent') seancesAbsentsPar[seanceId].push(eleveId);
          else if (statut === 'retard') seancesRetardsPar[seanceId].push(eleveId);
        }
      }

      // Phase 40 — Construction du dispatch par séance pour les exclusions
      // (même logique que absents/retards : si overrides, on les respecte ;
      //  sinon, on étend l'exclusion globale à toutes les séances liées).
      const seancesExclusPar: Record<string, string[]> = {};
      for (const seanceId of idsSeances) seancesExclusPar[seanceId] = [];
      for (const eleveId of tousElevesConcernes) {
        if (!exclusIds.includes(eleveId)) continue;
        for (const seanceId of idsSeances) seancesExclusPar[seanceId].push(eleveId);
      }

      await marquerAbsences(
        groupe.id,
        dateAppel,
        absentsIds,
        currentUser.uid,
        // Tableaux d'IDs/titres (multi-séances) — le service accepte
        // string | string[] et privilégie le format array depuis Phase 38.
        idsSeances,
        titresSeances,
        retardsIds,
        detailsNets,
        // Phase 39 — détail par séance/par élève (vides si 0 séance liée)
        idsSeances.length > 0 ? seancesAbsentsPar : undefined,
        idsSeances.length > 0 ? seancesRetardsPar : undefined,
        // Phase 40 — Exclusions
        exclusIds,
        exclusionsDetails,
        idsSeances.length > 0 ? seancesExclusPar : undefined,
      );
      setAppelSaveState('ok');
      // Le message "✅ Enregistré" disparaît après 3s
      setTimeout(() => setAppelSaveState('idle'), 3000);
    } catch (err: any) {
      console.error('❌ Erreur enregistrement appel:', err);
      setError(
        err?.message?.includes('permission')
          ? "Permission refusée. Vérifiez que les règles Firestore sont bien déployées (voir documentation)."
          : err?.message || "Impossible d'enregistrer l'appel.",
      );
      setAppelSaveState('err');
    } finally {
      setLoadingAppel(false);
    }
  };

  /**
   * Bascule un élève entre Présent / Retard / Absent / Exclu (exclusifs).
   * Phase 40 : ajout du statut « exclu » (mesure disciplinaire).
   * @param action 'absent' | 'retard' | 'exclu' — si l'élève est déjà dans cet état, il redevient présent.
   */
  const toggleStatutEleve = (eleveId: string, action: 'absent' | 'retard' | 'exclu') => {
    if (action === 'absent') {
      if (absentsIds.includes(eleveId)) {
        setAbsentsIds(prev => prev.filter(id => id !== eleveId));
      } else {
        setAbsentsIds(prev => [...prev, eleveId]);
        // Mutuellement exclusif : un absent n'est ni en retard ni exclu
        setRetardsIds(prev => prev.filter(id => id !== eleveId));
        setExclusIds(prev => prev.filter(id => id !== eleveId));
      }
    } else if (action === 'retard') {
      if (retardsIds.includes(eleveId)) {
        setRetardsIds(prev => prev.filter(id => id !== eleveId));
      } else {
        setRetardsIds(prev => [...prev, eleveId]);
        setAbsentsIds(prev => prev.filter(id => id !== eleveId));
        setExclusIds(prev => prev.filter(id => id !== eleveId));
        // Initialise les détails par défaut si vide
        setRetardsDetails(prev => prev[eleveId]
          ? prev
          : { ...prev, [eleveId]: { minutes: 0 } }
        );
      }
    } else {
      // Phase 40 — exclusion (mesure disciplinaire)
      if (exclusIds.includes(eleveId)) {
        setExclusIds(prev => prev.filter(id => id !== eleveId));
      } else {
        setExclusIds(prev => [...prev, eleveId]);
        setAbsentsIds(prev => prev.filter(id => id !== eleveId));
        setRetardsIds(prev => prev.filter(id => id !== eleveId));
        // Initialise une exclusion d'1 jour par défaut, décidée par le prof
        setExclusionsDetails(prev => prev[eleveId]
          ? prev
          : { ...prev, [eleveId]: { dureeJours: 1, decideePar: 'prof' } }
        );
      }
    }
  };

  /** Phase 40 — Met à jour un champ des détails d'exclusion pour un élève. */
  const updateExclusionDetail = (
    eleveId: string,
    patch: Partial<DetailExclusion>,
  ) => {
    setExclusionsDetails(prev => {
      const current: DetailExclusion = prev[eleveId] ?? { dureeJours: 1 };
      return {
        ...prev,
        [eleveId]: { ...current, ...patch },
      };
    });
  };

  /**
   * Phase 39 — Statut effectif d'un élève pour une séance précise.
   *   Priorité : override eleveId/seanceId → statut global (absentsIds/
   *   retardsIds appliqués à toutes les séances) → présent.
   */
  const getStatutSeanceEleve = (
    eleveId: string,
    seanceId: string,
  ): 'absent' | 'retard' | 'present' => {
    const ov = seancesParEleve[eleveId]?.[seanceId];
    if (ov) return ov;
    if (absentsIds.includes(eleveId)) return 'absent';
    if (retardsIds.includes(eleveId)) return 'retard';
    return 'present';
  };

  /**
   * Phase 39 — Cycle le statut d'un élève sur UNE séance précise :
   *   présent → absent → retard → présent
   *   et synchronise le statut global (cases « Absent / Retard » de la
   *   ligne) selon que l'élève a au moins une séance dans chaque catégorie.
   */
  const cyclerStatutSeanceEleve = (eleveId: string, seanceId: string) => {
    setSeancesParEleve((prev) => {
      const current = prev[eleveId]?.[seanceId] ?? getStatutSeanceEleve(eleveId, seanceId);
      const suivant: 'absent' | 'retard' | 'present' =
        current === 'present' ? 'absent' : current === 'absent' ? 'retard' : 'present';
      const elevePrev = { ...(prev[eleveId] || {}) };
      // Si on revient à 'present' ET que c'est aussi le statut global
      // par défaut → on enlève l'entrée pour garder le store minimal.
      if (suivant === 'present' && !absentsIds.includes(eleveId) && !retardsIds.includes(eleveId)) {
        delete elevePrev[seanceId];
      } else {
        elevePrev[seanceId] = suivant;
      }
      const next = { ...prev, [eleveId]: elevePrev };
      if (Object.keys(elevePrev).length === 0) {
        delete next[eleveId];
      }
      return next;
    });

    // Synchronisation des coches globales : si l'élève a au moins UNE
    // séance "absent" → on coche Absent ; au moins UNE séance "retard"
    // → on coche Retard ; sinon ni l'un ni l'autre.
    setTimeout(() => {
      setSeancesParEleve((latest) => {
        const overrides = latest[eleveId] || {};
        const seancesEffectives = appelEntreeIds;
        let auMoinsUnAbsent = false;
        let auMoinsUnRetard = false;
        for (const sId of seancesEffectives) {
          const st = overrides[sId]
            ?? (absentsIds.includes(eleveId) ? 'absent' : retardsIds.includes(eleveId) ? 'retard' : 'present');
          if (st === 'absent') auMoinsUnAbsent = true;
          if (st === 'retard') auMoinsUnRetard = true;
        }
        // Bascule cohérente des cases globales
        setAbsentsIds((prevAbs) => {
          const has = prevAbs.includes(eleveId);
          if (auMoinsUnAbsent && !has) return [...prevAbs, eleveId];
          if (!auMoinsUnAbsent && has) return prevAbs.filter((x) => x !== eleveId);
          return prevAbs;
        });
        setRetardsIds((prevRet) => {
          const has = prevRet.includes(eleveId);
          if (auMoinsUnRetard && !has) return [...prevRet, eleveId];
          if (!auMoinsUnRetard && has) return prevRet.filter((x) => x !== eleveId);
          return prevRet;
        });
        return latest;
      });
    }, 0);
  };

  /** Met à jour un champ des détails de retard pour un élève. */
  const updateRetardDetail = (
    eleveId: string,
    patch: Partial<DetailRetard>,
  ) => {
    setRetardsDetails(prev => {
      // Repart de l'état précédent (ou d'un objet vide si premier patch)
      const current: DetailRetard = prev[eleveId] ?? { minutes: 0 };
      return {
        ...prev,
        [eleveId]: { ...current, ...patch },
      };
    });
  };

  /** Sauvegarde une observation sur l'élève sélectionné */
  const handleSaveObservation = async () => {
    if (!eleveSelectionne || !currentUser?.uid) return;
    const eleve = statsEleves.find(e => e.eleveId === eleveSelectionne);
    if (!eleve) return;
    try {
      setSavingObservation(eleveSelectionne);
      await sauvegarderObservation(groupe.id, eleveSelectionne, eleve.eleveNom, observationEdit, currentUser.uid);
      setObservations(prev => ({ ...prev, [eleveSelectionne]: observationEdit }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingObservation(null);
    }
  };

  /** Rubriques disponibles (issues du cahier sélectionné) */
  const rubriquesDisponibles: RubriqueCahier[] = (() => {
    if (!cahierSelectionne) return [];
    const c = cahiersGroupe.find(c => c.id === cahierSelectionne);
    return c?.rubriques ?? [];
  })();

  /** Filtrage des travaux côté prof (Phase 31) */
  const travauxFiltres = travaux.filter(t => {
    // Filtre par rubrique
    if (filtreTravailRubrique !== 'tous') {
      if (filtreTravailRubrique === '__sans_rubrique__') {
        if (t.rubriqueId) return false;
      } else if (t.rubriqueId !== filtreTravailRubrique) {
        return false;
      }
    }
    // Filtre par statut corrigé
    if (filtreTravailCorrige !== 'tous') {
      if (filtreTravailCorrige === 'corrige' && !t.corrige) return false;
      if (filtreTravailCorrige === 'non_corrige' && t.corrige) return false;
    }
    // Filtre par échéance
    if (filtreTravailEcheance !== 'tous') {
      const now = new Date();
      const echeance = t.dateEcheance instanceof Date ? t.dateEcheance : new Date(t.dateEcheance);
      if (filtreTravailEcheance === 'aujourdhui') {
        if (echeance.toDateString() !== now.toDateString()) return false;
      } else if (filtreTravailEcheance === 'semaine') {
        const dans7j = new Date(now);
        dans7j.setDate(dans7j.getDate() + 7);
        if (echeance > dans7j) return false;
      } else if (filtreTravailEcheance === 'mois') {
        const dans30j = new Date(now);
        dans30j.setDate(dans30j.getDate() + 30);
        if (echeance > dans30j) return false;
      }
    }
    return true;
  });

  /** Toutes les rubriques uniques présentes dans les travaux (pour le filtre) */
  const rubriquesTravauxUniques = (() => {
    const map = new Map<string, string>();
    travaux.forEach(t => {
      if (t.rubriqueId && t.rubriqueNom) map.set(t.rubriqueId, t.rubriqueNom);
    });
    return [...map.entries()].map(([id, nom]) => ({ id, nom }));
  })();

  /** Ajoute un travail à faire */
  const handleAjouterTravail = async () => {
    if (!currentUser?.uid || !nouveauTravailTitre.trim()) return;
    const echeance = nouveauTravailEcheance ? new Date(nouveauTravailEcheance) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Phase 31 — Résolution de la rubrique sélectionnée
    // On lit d'abord les valeurs saisies pour les champs optionnels,
    // puis on ne les inclut dans le payload QUE si elles sont réellement définies.
    // Firestore rejette tout champ à `undefined` (ex. rubriqueId sans rubrique sélectionnée)
    // — d'où l'usage d'un spread conditionnel plutôt que d'un objet monolithique.
    const rubrique = rubriquesDisponibles.find(r => r.id === nouveauTravailRubriqueId);
    const descriptionTrim = nouveauTravailDesc.trim();
    try {
      setSavingTravail(true);
      // Construction progressive : on part du socle obligatoire,
      // puis on ajoute chaque champ optionnel seulement s'il a une valeur.
      const payload: Parameters<typeof creerTravailAFaire>[0] = {
        groupeId: groupe.id,
        groupeNom: groupe.nom,
        titre: nouveauTravailTitre.trim(),
        dateEcheance: echeance,
        matiere: groupe.matiereNom,
        profId: currentUser.uid,
      };
      if (descriptionTrim) payload.description = descriptionTrim;
      if (nouveauTravailHeure) payload.heureEcheance = nouveauTravailHeure;
      if (cahierSelectionne) payload.cahierId = cahierSelectionne;
      // rubriqueId / rubriqueNom ne sont ajoutés qu'ensemble et seulement si
      // une rubrique valide a été trouvée — jamais `undefined`.
      if (rubrique) {
        payload.rubriqueId = rubrique.id;
        payload.rubriqueNom = rubrique.nom;
      }
      await creerTravailAFaire(payload);
      setNouveauTravailTitre('');
      setNouveauTravailDesc('');
      setNouveauTravailEcheance('');
      setNouveauTravailHeure('');
      setNouveauTravailRubriqueId('');
      const liste = await getTravauxByGroupe(groupe.id);
      setTravaux(liste);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTravail(false);
    }
  };

  /** Supprime un travail à faire */
  const handleSupprimerTravail = async (id: string) => {
    try {
      await supprimerTravailAFaire(id);
      setTravaux(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err?.message);
    }
  };


  // ==================== TRI DES ÉLÈVES ====================

  const elevesTries = [...statsEleves].sort((a, b) => {
    switch (triEleves) {
      case 'moyenne_desc': return b.moyenne - a.moyenne;
      case 'moyenne_asc': return a.moyenne - b.moyenne;
      // Tri "nom" = tri alphabétique par NOM de famille (cf. formatNom.ts)
      case 'nom': return compareParNomFamille(a.eleveNom, b.eleveNom);
      case 'streak': return b.streak.actuel - a.streak.actuel;
      case 'quiz_count': return b.totalQuiz - a.totalQuiz;
      default: return 0;
    }
  });


  // ==================== HELPERS DE RENDU ====================

  /** Retourne la classe CSS selon la moyenne */
  const getClasseMoyenne = (moyenne: number): string => {
    if (moyenne >= 16) return 'prof-note-excellent';
    if (moyenne >= 12) return 'prof-note-bien';
    if (moyenne >= 10) return 'prof-note-passable';
    if (moyenne >= 8) return 'prof-note-insuffisant';
    return 'prof-note-critique';
  };

  /** Emoji pour la tendance */
  const getTendanceEmoji = (tendance: string): string => {
    switch (tendance) {
      case 'hausse': return '📈';
      case 'baisse': return '📉';
      default: return '➡️';
    }
  };

  /** Emoji pour le type d'alerte */
  const getAlerteEmoji = (type: string): string => {
    switch (type) {
      case 'difficulte': return '🔴';
      case 'inactivite': return '💤';
      case 'baisse': return '📉';
      case 'felicitation': return '🌟';
      default: return '⚡';
    }
  };


  // ==================== RENDU : LOADING ====================

  if (loading) {
    return (
      <div className="prof-loading">
        <div className="spinner"></div>
        <p>Chargement des données de "{groupe.nom}"...</p>
      </div>
    );
  }


  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="groupe-detail">

      {/* ===== NAVIGATION : RETOUR + TITRE ===== */}
      <div className="groupe-detail-header">
        <button className="prof-btn prof-btn-secondary" onClick={onRetour}>
          ← Retour aux groupes
        </button>
        <div className="groupe-detail-titre-section">
          <h2 className="groupe-detail-titre">{groupe.nom}</h2>
          <p className="groupe-detail-subtitle">
            {groupe.matiereNom} • {groupe.classeNiveau} • {groupe.anneeScolaire}
          </p>
        </div>
        <button className="prof-btn prof-btn-secondary" onClick={handleExportCSV}>
          📥 Export CSV
        </button>
      </div>

      {/* ===== MESSAGE D'ERREUR ===== */}
      {error && (
        <div className="prof-alert prof-alert-error">
          ❌ {error}
          <button onClick={() => setError(null)} className="prof-alert-close">✕</button>
        </div>
      )}

      {/* ===== ONGLETS ===== */}
      <div className="groupe-detail-onglets">
        {[
          { id: 'apercu' as OngletActif, label: '📊 Aperçu', count: null },
          { id: 'eleves' as OngletActif, label: '👥 Élèves', count: statsEleves.length },
          { id: 'appel' as OngletActif, label: '✅ Appel', count: null },
          { id: 'travaux' as OngletActif, label: '📋 Travaux', count: travaux.length },
          { id: 'notes' as OngletActif, label: '📝 Notes', count: null },
          { id: 'quiz' as OngletActif, label: '📝 Quiz', count: quizDisponibles.length },
          { id: 'cahier' as OngletActif, label: '📓 Cahier de textes', count: null },
          { id: 'planification' as OngletActif, label: '📅 Planification', count: null },
          { id: 'alertes' as OngletActif, label: '🔔 Alertes', count: alertes.length }
        ].map(onglet => (
          <button
            key={onglet.id}
            className={`groupe-onglet ${ongletActif === onglet.id ? 'active' : ''}`}
            onClick={() => setOngletActif(onglet.id)}
          >
            {onglet.label}
            {onglet.count !== null && onglet.count > 0 && (
              <span className="groupe-onglet-badge">{onglet.count}</span>
            )}
          </button>
        ))}
      </div>


      {/* ============================================================ */}
      {/* ONGLET 1 : APERÇU (VUE D'ENSEMBLE)                         */}
      {/* ============================================================ */}
      {ongletActif === 'apercu' && statsGroupe && (
        <div className="groupe-apercu">

          {/* Cartes de statistiques globales */}
          <div className="groupe-stats-grid">
            {/* Moyenne de la classe */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📊</div>
              <div className="groupe-stat-card-content">
                <span className={`groupe-stat-card-value ${getClasseMoyenne(statsGroupe.moyenneClasse)}`}>
                  {statsGroupe.moyenneClasse}/20
                </span>
                <span className="groupe-stat-card-label">Moyenne classe</span>
              </div>
            </div>

            {/* Taux de réussite */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">✅</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.tauxReussite}%</span>
                <span className="groupe-stat-card-label">Taux de réussite</span>
              </div>
            </div>

            {/* Nombre d'élèves */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">👥</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.nombreEleves}</span>
                <span className="groupe-stat-card-label">Élèves inscrits</span>
              </div>
            </div>

            {/* Quiz passés */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📝</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.totalQuizPasses}</span>
                <span className="groupe-stat-card-label">Quiz passés</span>
              </div>
            </div>

            {/* Participation */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📈</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.tauxParticipation}%</span>
                <span className="groupe-stat-card-label">Participation</span>
              </div>
            </div>

            {/* Élèves en difficulté */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">⚠️</div>
              <div className="groupe-stat-card-content">
                <span className={`groupe-stat-card-value ${
                  statsGroupe.elevesEnDifficulte > 0 ? 'prof-note-critique' : 'prof-note-excellent'
                }`}>
                  {statsGroupe.elevesEnDifficulte}
                </span>
                <span className="groupe-stat-card-label">En difficulté</span>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────
                CARTE RÉPARTITION F / M (statistiques genrées)
                ─────────────────────────────────────────────────────────
                On compte les inscriptions actives par sexe puis on calcule
                également la moyenne pondérée par groupe (F vs M) à partir
                de `statsEleves`. Cela donne au prof un aperçu rapide de
                l'équité des résultats entre filles et garçons. */}
            {(() => {
              // Mémo simple : on n'utilise pas useMemo pour rester proche
              // du style du composant existant (pas de hooks ajoutés).
              const sexeMap: Record<string, 'M' | 'F' | 'autre' | undefined> = {};
              inscriptions.forEach((i) => { sexeMap[i.eleveId] = i.eleveSexe; });

              const moyenneSur = (sexe: 'M' | 'F') => {
                const items = statsEleves.filter((e) => sexeMap[e.eleveId] === sexe && e.totalQuiz > 0);
                if (items.length === 0) return 0;
                const sum = items.reduce((s, e) => s + e.moyenne, 0);
                return Math.round((sum / items.length) * 100) / 100;
              };

              const nbF = inscriptions.filter((i) => i.eleveSexe === 'F').length;
              const nbM = inscriptions.filter((i) => i.eleveSexe === 'M').length;
              const nbAutre = inscriptions.filter((i) => i.eleveSexe === 'autre').length;
              const nbInconnu = inscriptions.length - nbF - nbM - nbAutre;
              const moyF = moyenneSur('F');
              const moyM = moyenneSur('M');

              return (
                <div className="groupe-stat-card" title="Répartition par sexe et moyennes genrées">
                  <div className="groupe-stat-card-icon">⚧</div>
                  <div className="groupe-stat-card-content">
                    {/* Ligne principale : compteurs F / M / Autre */}
                    <span className="groupe-stat-card-value" style={{ fontSize: '1rem', lineHeight: 1.2 }}>
                      <span style={{ color: '#ec4899' }}>♀ {nbF}</span>
                      {' · '}
                      <span style={{ color: '#3b82f6' }}>♂ {nbM}</span>
                      {nbAutre > 0 && <> {' · '}<span style={{ color: '#6b7280' }}>✱ {nbAutre}</span></>}
                      {nbInconnu > 0 && <> {' · '}<span style={{ color: '#9ca3af' }} title="Sexe non renseigné">? {nbInconnu}</span></>}
                    </span>
                    {/* Sous-ligne : moyennes genrées (si dispo) */}
                    <span className="groupe-stat-card-label">
                      {moyF > 0 || moyM > 0 ? (
                        <>
                          Moy. ♀ {moyF || '—'} / ♂ {moyM || '—'}
                        </>
                      ) : (
                        'Répartition F / M'
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Barre de notes (meilleure / pire) */}
          <div className="groupe-apercu-notes">
            <div className="groupe-note-range">
              <span className="groupe-note-range-label">Plage des notes :</span>
              <span className="prof-note-critique">{statsGroupe.pireNote}/20</span>
              <div className="groupe-note-barre">
                <div
                  className="groupe-note-barre-fill"
                  style={{
                    left: `${(statsGroupe.pireNote / 20) * 100}%`,
                    width: `${((statsGroupe.meilleureNote - statsGroupe.pireNote) / 20) * 100}%`
                  }}
                />
              </div>
              <span className="prof-note-excellent">{statsGroupe.meilleureNote}/20</span>
            </div>
          </div>

          {/* Top 3 et Bottom 3 */}
          {statsEleves.length >= 3 && (
            <div className="groupe-apercu-classement">
              {/* Top 3 */}
              <div className="groupe-classement-section">
                <h4>🏆 Top 3</h4>
                {statsEleves.slice(0, 3).map((eleve, idx) => (
                  <div key={eleve.eleveId} className="groupe-classement-item">
                    <span className="groupe-classement-rang">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    {/* Nom formaté "Prénoms NOM" */}
                    <span className="groupe-classement-nom">{formatEleveNom(eleve.eleveNom)}</span>
                    <span className={`groupe-classement-note ${getClasseMoyenne(eleve.moyenne)}`}>
                      {eleve.moyenne}/20
                    </span>
                  </div>
                ))}
              </div>

              {/* Élèves en difficulté */}
              <div className="groupe-classement-section">
                <h4>⚠️ À surveiller</h4>
                {statsEleves
                  .filter(e => e.moyenne < 8 && e.totalQuiz > 0)
                  .slice(0, 3)
                  .map(eleve => (
                    <div key={eleve.eleveId} className="groupe-classement-item">
                      <span className="groupe-classement-rang">🔴</span>
                      {/* Nom formaté "Prénoms NOM" */}
                      <span className="groupe-classement-nom">{formatEleveNom(eleve.eleveNom)}</span>
                      <span className={`groupe-classement-note ${getClasseMoyenne(eleve.moyenne)}`}>
                        {eleve.moyenne}/20
                      </span>
                    </div>
                  ))
                }
                {statsEleves.filter(e => e.moyenne < 8 && e.totalQuiz > 0).length === 0 && (
                  <p className="groupe-classement-vide">Aucun élève en difficulté 🎉</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET 2 : LISTE DES ÉLÈVES                                 */}
      {/* ============================================================ */}
      {ongletActif === 'eleves' && (
        <div className="groupe-eleves">

          {/* Barre de tri + Inscription directe */}
          <div className="groupe-eleves-toolbar">
            <label htmlFor="tri-eleves">Trier par :</label>
            <select
              id="tri-eleves"
              value={triEleves}
              onChange={(e) => setTriEleves(e.target.value as TriEleves)}
              className="prof-select prof-select-sm"
            >
              <option value="moyenne_desc">Moyenne (↓)</option>
              <option value="moyenne_asc">Moyenne (↑)</option>
              <option value="nom">Nom (A-Z)</option>
              <option value="streak">Streak (↓)</option>
              <option value="quiz_count">Quiz passés (↓)</option>
            </select>
            <span className="groupe-eleves-count">
              {statsEleves.length} élève{statsEleves.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="prof-btn prof-btn-primary"
              onClick={() => setModalInscriptionOuvert(true)}
              style={{ marginLeft: 'auto' }}
            >
              👥 Inscrire un élève
            </button>
          </div>

          {/* État vide */}
          {statsEleves.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">👥</div>
              <h3>Aucun élève inscrit</h3>
              <p>Partagez le code <strong>{groupe.codeInvitation}</strong> à vos élèves, ou inscrivez directement un élève membre de PedaClic.</p>
              <button
                type="button"
                className="prof-btn prof-btn-primary"
                onClick={() => setModalInscriptionOuvert(true)}
                style={{ marginTop: '1rem' }}
              >
                👥 Inscrire un élève
              </button>
            </div>
          ) : (
            <>
              {/* Tableau des élèves */}
              <div className="groupe-eleves-table-wrapper">
                <table className="groupe-eleves-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Élève</th>
                      <th>Moyenne</th>
                      <th>Quiz</th>
                      <th>Réussite</th>
                      <th>Streak</th>
                      <th>Tendance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevesTries.map((eleve, idx) => (
                      <tr
                        key={eleve.eleveId}
                        className={`${eleveSelectionne === eleve.eleveId ? 'groupe-eleve-row-active' : ''}`}
                      >
                        <td className="groupe-eleve-rang">{idx + 1}</td>
                        <td className="groupe-eleve-nom-cell">
                          {/*
                            ✨ Édition inline du nom de l'élève.
                            En lecture : nom formaté + email + bouton crayon
                            (✏️) qui ouvre un input contrôlé.
                            En édition : input + ✓ (Enter) / ✕ (Escape).
                            En cas de coquille, le prof corrige directement
                            sans devoir retirer puis ré-inscrire l'élève
                            (préserve toutes les notes et l'historique).
                          */}
                          {editEleveId === eleve.eleveId ? (
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                              }}
                            >
                              <input
                                type="text"
                                className="prof-select prof-select-sm"
                                autoFocus
                                value={draftEleveNom}
                                onChange={(e) => setDraftEleveNom(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditerNomEleve(eleve.eleveId);
                                  if (e.key === 'Escape') setEditEleveId(null);
                                }}
                                maxLength={120}
                                style={{ minWidth: 200 }}
                                aria-label={`Nouveau nom pour ${eleve.eleveNom}`}
                              />
                              <button
                                className="prof-btn-icon"
                                title="Enregistrer"
                                onClick={() => handleEditerNomEleve(eleve.eleveId)}
                                disabled={savingEleveNom === eleve.eleveId}
                              >
                                {savingEleveNom === eleve.eleveId ? '⏳' : '✓'}
                              </button>
                              <button
                                className="prof-btn-icon"
                                title="Annuler"
                                onClick={() => setEditEleveId(null)}
                                disabled={savingEleveNom === eleve.eleveId}
                              >
                                ✕
                              </button>
                              <span className="groupe-eleve-email" style={{ flexBasis: '100%' }}>
                                {eleve.eleveEmail}
                              </span>
                            </div>
                          ) : editSexeEleveId === eleve.eleveId ? (
                            // ─────────────────────────────────────────────
                            // 🆕 ÉDITION INLINE DU SEXE
                            // ─────────────────────────────────────────────
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ minWidth: 180 }}>
                                <strong>{formatEleveNom(eleve.eleveNom)}</strong>
                              </div>
                              {/* Trois radios M / F / Autre — couleurs alignées
                                  sur la palette du dashboard (♂ bleu, ♀ rose, ✱ gris). */}
                              {([
                                { v: 'M' as SexeEleve, label: '♂ M', color: '#3b82f6' },
                                { v: 'F' as SexeEleve, label: '♀ F', color: '#ec4899' },
                                { v: 'autre' as SexeEleve, label: '✱ Autre', color: '#6b7280' },
                              ]).map((opt) => (
                                <label
                                  key={opt.v}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    border: `1px solid ${draftSexe === opt.v ? opt.color : '#e5e7eb'}`,
                                    borderRadius: 4,
                                    background: draftSexe === opt.v ? `${opt.color}15` : 'white',
                                    color: draftSexe === opt.v ? opt.color : '#374151',
                                    fontWeight: 600,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`draftSexe-${eleve.eleveId}`}
                                    value={opt.v}
                                    checked={draftSexe === opt.v}
                                    onChange={() => setDraftSexe(opt.v)}
                                    style={{ margin: 0 }}
                                    disabled={savingSexeEleveId === eleve.eleveId}
                                  />
                                  {opt.label}
                                </label>
                              ))}
                              {draftSexe === 'autre' && (
                                <input
                                  type="text"
                                  placeholder="Précisez…"
                                  value={draftSexeAutre}
                                  onChange={(e) => setDraftSexeAutre(e.target.value)}
                                  maxLength={40}
                                  style={{
                                    padding: '4px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.78rem',
                                    flex: '1 1 120px',
                                  }}
                                  disabled={savingSexeEleveId === eleve.eleveId}
                                />
                              )}
                              <button
                                className="prof-btn-icon"
                                title="Enregistrer le sexe"
                                onClick={() => handleEditerSexeEleve(eleve.eleveId)}
                                disabled={
                                  savingSexeEleveId === eleve.eleveId ||
                                  (draftSexe === 'autre' && !draftSexeAutre.trim())
                                }
                              >
                                {savingSexeEleveId === eleve.eleveId ? '⏳' : '✓'}
                              </button>
                              <button
                                className="prof-btn-icon"
                                title="Annuler"
                                onClick={() => {
                                  setEditSexeEleveId(null);
                                  setDraftSexe(undefined);
                                  setDraftSexeAutre('');
                                }}
                                disabled={savingSexeEleveId === eleve.eleveId}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div>
                                {/* 🆕 Pictogramme ♂ / ♀ / ✱ AVANT le nom — invisible
                                    si non renseigné (incite à compléter via le bouton ⚧). */}
                                {(() => {
                                  const sx = inscriptions.find((i) => i.eleveId === eleve.eleveId)?.eleveSexe;
                                  if (!sx) return null;
                                  const couleur = sx === 'F' ? '#ec4899' : sx === 'M' ? '#3b82f6' : '#9ca3af';
                                  const picto = sx === 'F' ? '♀' : sx === 'M' ? '♂' : '✱';
                                  const label =
                                    sx === 'M' ? 'Masculin' : sx === 'F' ? 'Féminin' : 'Autre';
                                  return (
                                    <span
                                      title={label}
                                      aria-label={label}
                                      style={{
                                        color: couleur,
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        marginRight: 6,
                                      }}
                                    >
                                      {picto}
                                    </span>
                                  );
                                })()}
                                {/* Nom formaté "Prénoms NOM" */}
                                <strong>{formatEleveNom(eleve.eleveNom)}</strong>
                                <span className="groupe-eleve-email">{eleve.eleveEmail}</span>
                              </div>
                              <button
                                className="prof-btn-icon"
                                title="Renommer l'élève (corriger le nom)"
                                onClick={() => {
                                  setEditEleveId(eleve.eleveId);
                                  setDraftEleveNom(eleve.eleveNom);
                                }}
                              >
                                ✏️
                              </button>
                              {/* 🆕 Bouton ⚧ : ouvre l'édition inline du sexe.
                                  Coloré violet si renseigné, rouge clair sinon
                                  (visuellement urgent pour les fiches incomplètes). */}
                              {(() => {
                                const inscription = inscriptions.find((i) => i.eleveId === eleve.eleveId);
                                const sx = inscription?.eleveSexe;
                                return (
                                  <button
                                    className="prof-btn-icon"
                                    title={
                                      sx
                                        ? `Modifier le sexe (actuel : ${sx === 'M' ? 'Masculin' : sx === 'F' ? 'Féminin' : 'Autre'})`
                                        : 'Renseigner le sexe (manquant)'
                                    }
                                    onClick={() => {
                                      setEditSexeEleveId(eleve.eleveId);
                                      setDraftSexe(sx);
                                      setDraftSexeAutre(inscription?.eleveSexeAutre || '');
                                    }}
                                    style={{
                                      background: sx ? '#f3e8ff' : '#fee2e2',
                                      color: sx ? '#6b21a8' : '#991b1b',
                                      borderColor: sx ? '#e9d5ff' : '#fecaca',
                                    }}
                                  >
                                    ⚧
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`groupe-note-badge ${getClasseMoyenne(eleve.moyenne)}`}>
                            {eleve.moyenne}/20
                          </span>
                        </td>
                        <td>{eleve.totalQuiz}</td>
                        <td>{eleve.tauxReussite}%</td>
                        <td>
                          <span className="groupe-streak">
                            🔥 {eleve.streak.actuel}j
                          </span>
                        </td>
                        <td>{getTendanceEmoji(eleve.tendance)} {eleve.tendance}</td>
                        <td className="groupe-eleve-actions">
                          <button
                            className="prof-btn-icon"
                            onClick={() => setEleveSelectionne(
                              eleveSelectionne === eleve.eleveId ? null : eleve.eleveId
                            )}
                            title="Voir détails"
                          >
                            {eleveSelectionne === eleve.eleveId ? '🔽' : '▶️'}
                          </button>
                          <button
                            className="prof-btn-icon prof-btn-icon-danger"
                            onClick={() => handleRetirerEleve(eleve.eleveId)}
                            disabled={loadingRetrait === eleve.eleveId}
                            title="Retirer du groupe"
                          >
                            {loadingRetrait === eleve.eleveId ? '⏳' : '✕'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===== DÉTAIL D'UN ÉLÈVE (panneau déplié) ===== */}
              {eleveSelectionne && (() => {
                const eleve = statsEleves.find(e => e.eleveId === eleveSelectionne);
                if (!eleve) return null;

                return (
                  <div className="groupe-eleve-detail">
                    <div className="groupe-eleve-detail-header">
                      {/* Nom formaté "Prénoms NOM" */}
                      <h3>📋 Détail — {formatEleveNom(eleve.eleveNom)}</h3>
                      <button
                        className="prof-btn-icon"
                        onClick={() => setEleveSelectionne(null)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="groupe-eleve-detail-grid">
                      {/* Score global */}
                      <div className="groupe-eleve-detail-card">
                        <h4>Score global</h4>
                        <div className="groupe-eleve-score-circle">
                          <span className={getClasseMoyenne(eleve.scoreGlobal / 5)}>
                            {eleve.scoreGlobal}/100
                          </span>
                        </div>
                      </div>

                      {/* Streak */}
                      <div className="groupe-eleve-detail-card">
                        <h4>🔥 Streak</h4>
                        <p>Actuel : <strong>{eleve.streak.actuel} jour{eleve.streak.actuel !== 1 ? 's' : ''}</strong></p>
                        <p>Meilleur : {eleve.streak.meilleur} jours</p>
                      </div>

                      {/* Lacunes */}
                      <div className="groupe-eleve-detail-card groupe-eleve-detail-card-wide">
                        <h4>⚠️ Lacunes détectées</h4>
                        {eleve.lacunes.length === 0 ? (
                          <p className="text-muted">Aucune lacune détectée 🎉</p>
                        ) : (
                          <ul className="groupe-lacunes-liste">
                            {eleve.lacunes.map((lacune, idx) => (
                              <li key={idx} className={`groupe-lacune-item groupe-lacune-${lacune.niveauUrgence}`}>
                                <span className="groupe-lacune-nom">
                                  {lacune.disciplineNom}
                                  {lacune.chapitre && ` — ${lacune.chapitre}`}
                                </span>
                                <span className="groupe-lacune-moyenne">
                                  {lacune.moyenne}/20
                                </span>
                                <span className={`groupe-lacune-badge groupe-lacune-badge-${lacune.niveauUrgence}`}>
                                  {lacune.niveauUrgence}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Observations */}
                      <div className="groupe-eleve-detail-card groupe-eleve-detail-card-wide">
                        <h4>📝 Observations</h4>
                        <textarea
                          className="prof-textarea"
                          rows={3}
                          placeholder="Notes sur cet élève..."
                          value={observationEdit}
                          onChange={(e) => setObservationEdit(e.target.value)}
                        />
                        <button
                          className="prof-btn prof-btn-primary prof-btn-sm"
                          onClick={handleSaveObservation}
                          disabled={savingObservation === eleve.eleveId}
                        >
                          {savingObservation === eleve.eleveId ? 'Enregistrement...' : '💾 Enregistrer'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET APPEL : PRÉSENCES / ABSENCES                          */}
      {/* ============================================================ */}
      {ongletActif === 'appel' && (
        <div className="groupe-appel">
          <div className="groupe-appel-header">
            <label htmlFor="date-appel">Date de l'appel :</label>
            <input
              id="date-appel"
              type="date"
              value={dateAppel}
              onChange={(e) => setDateAppel(e.target.value)}
              className="prof-input prof-input-sm"
            />
          </div>

          {/* ─────────────────────────────────────────────────────────
              Liaison absence ↔ séance(s)  — Phase 38 : MULTI-SÉANCES
              ─────────────────────────────────────────────────────────
              Un élève peut être absent à plusieurs séances dans la même
              journée (ex. mathématiques le matin + français l'après-midi).
              On affiche donc :
                • Un select pour choisir le CAHIER (si plusieurs liés au groupe)
                • Une grille de cases à cocher pour SÉLECTIONNER UNE OU
                  PLUSIEURS séances de ce cahier sur le jour choisi.
              Le mode legacy (1 seule séance via select) reste compatible
              au stockage car le service accepte aussi un id unique.
              ───────────────────────────────────────────────────────── */}
          {appelCahiers.length > 0 && (
            <div className="groupe-appel-seance">
              <label className="groupe-appel-seance-label">
                📓 Lier à une ou plusieurs séances :
              </label>
              <div className="groupe-appel-seance-selects">
                {appelCahiers.length > 1 && (
                  <select
                    className="prof-select prof-select-sm"
                    value={appelCahierId}
                    onChange={e => setAppelCahierId(e.target.value)}
                  >
                    <option value="">— Cahier —</option>
                    {appelCahiers.map(c => (
                      <option key={c.id} value={c.id}>{c.titre} ({c.matiere})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Liste à cocher des séances disponibles ce jour-là */}
              {appelCahierId && appelEntrees.length > 0 && (
                <div
                  className="groupe-appel-seances-checks"
                  role="group"
                  aria-label="Sélection des séances liées à cet appel"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    marginTop: '0.4rem',
                  }}
                >
                  {appelEntrees.map(e => {
                    const d = e.date?.toDate?.();
                    const dateLabel = d
                      ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      : '';
                    const heureLabel = e.heureDebut
                      ? ` ${e.heureDebut}${e.heureFin ? `→${e.heureFin}` : ''}`
                      : '';
                    const checked = appelEntreeIds.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className={`groupe-appel-seance-check ${checked ? 'is-checked' : ''}`}
                        title={`${dateLabel} — ${e.chapitre}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.6rem',
                          border: `1px solid ${checked ? '#2563eb' : '#d1d5db'}`,
                          borderRadius: 6,
                          background: checked ? '#eff6ff' : '#ffffff',
                          color: checked ? '#1e40af' : '#374151',
                          fontSize: '0.78rem',
                          fontWeight: checked ? 600 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setAppelEntreeIds((prev) =>
                              prev.includes(e.id)
                                ? prev.filter((id) => id !== e.id)
                                : [...prev, e.id],
                            );
                          }}
                          style={{ margin: 0 }}
                          aria-label={`Lier à la séance ${e.chapitre}${heureLabel}`}
                        />
                        <span>
                          {dateLabel}{heureLabel ? ` ·${heureLabel}` : ''} — {e.chapitre}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Récapitulatif des séances sélectionnées */}
              {appelEntreeIds.length > 0 && (
                <div
                  className="groupe-appel-seance-info"
                  style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#1e40af' }}
                >
                  📌 <strong>{appelEntreeIds.length} séance{appelEntreeIds.length > 1 ? 's' : ''} liée{appelEntreeIds.length > 1 ? 's' : ''}</strong> :{' '}
                  {appelEntreeIds
                    .map((id) => appelEntrees.find((e) => e.id === id)?.chapitre)
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}

          {/*
            ════════════════════════════════════════════════════════
            🆕 (mai 2026) — SOUS-ONGLETS « FEUILLE D'APPEL » / « SUIVI »
            ════════════════════════════════════════════════════════
            Séparation ergonomique en 2 feuilles distinctes :
              • Feuille d'appel : saisie quotidienne (marquage des
                statuts + enregistrement).
              • Feuille de gestion & suivi : tableau de synthèse +
                bulletin PDF + historique des absences.
            Mêmes styles visuels que les onglets principaux pour
            assurer une cohérence d'interaction (border-bottom
            actif, color primary, transitions).
            ════════════════════════════════════════════════════════ */}
          <div
            className="groupe-appel-sous-onglets"
            role="tablist"
            aria-label="Sous-onglets de l'appel"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sousOngletAppel === 'feuille-appel'}
              className={`groupe-appel-sous-onglet ${sousOngletAppel === 'feuille-appel' ? 'active' : ''}`}
              onClick={() => setSousOngletAppel('feuille-appel')}
            >
              📝 Feuille d'appel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sousOngletAppel === 'feuille-suivi'}
              className={`groupe-appel-sous-onglet ${sousOngletAppel === 'feuille-suivi' ? 'active' : ''}`}
              onClick={() => setSousOngletAppel('feuille-suivi')}
            >
              📊 Feuille de gestion &amp; suivi
            </button>
          </div>

          {statsEleves.length === 0 ? (
            <div className="prof-empty-state">
              <p>Aucun élève inscrit. Partagez le code pour inviter des élèves.</p>
            </div>
          ) : (
            <>
              {/* ============================================ */}
              {/* SOUS-ONGLET 1 — FEUILLE D'APPEL              */}
              {/* Marquage Présent/Retard/Absent/Exclu         */}
              {/* + bouton "Enregistrer l'appel"               */}
              {/* Format "Prénoms NOM" trié par nom de famille */}
              {/* ============================================ */}
              {sousOngletAppel === 'feuille-appel' && (
              <>
              <div className="groupe-appel-liste">
                <div className="groupe-appel-liste-header">
                  <h4>☑️ Marquer l'appel</h4>
                  <div className="groupe-appel-legende">
                    <span className="legende-item legende-present">🟢 Présent (par défaut)</span>
                    <span className="legende-item legende-retard">🟠 Retard</span>
                    <span className="legende-item legende-absent">🔴 Absent</span>
                    <span className="legende-item legende-exclu">⛔ Exclu</span>
                  </div>
                </div>

                {/* Tri alphabétique par NOM de famille pour un appel clair */}
                {[...statsEleves]
                  .sort((a, b) => compareParNomFamille(a.eleveNom, b.eleveNom))
                  .map((eleve) => {
                    const estAbsent = absentsIds.includes(eleve.eleveId);
                    const estRetard = retardsIds.includes(eleve.eleveId);
                    const estExclu = exclusIds.includes(eleve.eleveId);
                    const detail = retardsDetails[eleve.eleveId] || { minutes: 0 };
                    const detailExcl = exclusionsDetails[eleve.eleveId] || { dureeJours: 1 };
                    // Phase 40 — Rappel des antécédents :
                    //   on lit l'agrégat 'mois' calculé par le service de suivi
                    //   pour TOUTES les statsEleves. Affiche un badge si > 0.
                    const antecedents = antecedentsParEleve[eleve.eleveId];
                    return (
                      <div
                        key={eleve.eleveId}
                        className={`groupe-appel-item groupe-appel-item--v2 ${
                          estAbsent ? 'is-absent' : estRetard ? 'is-retard' : estExclu ? 'is-exclu' : ''
                        }`}
                      >
                        {/* Nom de l'élève — format "Prénoms NOM" + badge antécédents */}
                        <span className="groupe-appel-nom">
                          {formatEleveNom(eleve.eleveNom)}
                          {antecedents && (antecedents.absences > 0 || antecedents.retards > 0 || antecedents.exclusions > 0) && (
                            <span
                              className="groupe-appel-antecedents"
                              title={`Antécédents (30 derniers jours) : ${antecedents.absences} absence(s), ${antecedents.retards} retard(s), ${antecedents.exclusions} exclusion(s)`}
                              style={{
                                marginLeft: 8,
                                display: 'inline-flex',
                                gap: 4,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                verticalAlign: 'middle',
                              }}
                            >
                              {antecedents.absences > 0 && (
                                <span style={{ color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 10 }}>
                                  🔴 {antecedents.absences}
                                </span>
                              )}
                              {antecedents.retards > 0 && (
                                <span style={{ color: '#d97706', background: '#fef3c7', padding: '1px 6px', borderRadius: 10 }}>
                                  🟠 {antecedents.retards}
                                </span>
                              )}
                              {antecedents.exclusions > 0 && (
                                <span style={{ color: '#7c2d12', background: '#fed7aa', padding: '1px 6px', borderRadius: 10 }}>
                                  ⛔ {antecedents.exclusions}
                                </span>
                              )}
                            </span>
                          )}
                        </span>

                        {/* Boutons radio visuels : Présent / Retard / Absent / Exclu */}
                        <div className="groupe-appel-statuts">
                          <label
                            className={`statut-pill statut-absent ${estAbsent ? 'active' : ''}`}
                            title="Marquer absent"
                          >
                            <input
                              type="checkbox"
                              checked={estAbsent}
                              onChange={() => toggleStatutEleve(eleve.eleveId, 'absent')}
                            />
                            <span>Absent</span>
                          </label>
                          <label
                            className={`statut-pill statut-retard ${estRetard ? 'active' : ''}`}
                            title="Marquer en retard"
                          >
                            <input
                              type="checkbox"
                              checked={estRetard}
                              onChange={() => toggleStatutEleve(eleve.eleveId, 'retard')}
                            />
                            <span>Retard</span>
                          </label>
                          {/* Phase 40 — Statut « Exclu » (mesure disciplinaire) */}
                          <label
                            className={`statut-pill statut-exclu ${estExclu ? 'active' : ''}`}
                            title="Marquer exclu(e) du cours"
                          >
                            <input
                              type="checkbox"
                              checked={estExclu}
                              onChange={() => toggleStatutEleve(eleve.eleveId, 'exclu')}
                            />
                            <span>Exclu</span>
                          </label>
                        </div>

                        {/* Détails de retard — affichés uniquement si l'élève est en retard */}
                        {estRetard && (
                          <div className="groupe-appel-retard-details">
                            <input
                              type="number"
                              min={0}
                              max={240}
                              step={1}
                              placeholder="min"
                              aria-label={`Minutes de retard pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm retard-input-min"
                              value={detail.minutes || ''}
                              onChange={(e) => updateRetardDetail(eleve.eleveId, {
                                minutes: Number(e.target.value) || 0,
                              })}
                            />
                            <span className="retard-unite">min</span>
                            <select
                              aria-label={`Motif du retard pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-select prof-select-sm retard-motif"
                              value={detail.motif || ''}
                              onChange={(e) => updateRetardDetail(eleve.eleveId, {
                                motif: (e.target.value || undefined) as MotifRetard | undefined,
                              })}
                            >
                              <option value="">— Motif —</option>
                              <option value="justifie">✅ Justifié</option>
                              <option value="non_justifie">❌ Non justifié</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Commentaire (optionnel)"
                              aria-label={`Commentaire pour le retard de ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm retard-commentaire"
                              value={detail.commentaire || ''}
                              onChange={(e) => updateRetardDetail(eleve.eleveId, {
                                commentaire: e.target.value,
                              })}
                            />
                          </div>
                        )}

                        {/* ════════════════════════════════════════════════════
                            Phase 40 — Détails de l'EXCLUSION
                            ────────────────────────────────────────────────────
                            Affiché uniquement quand l'élève est exclu.
                            Champs :
                              • durée en jours (1 par défaut, max 30)
                              • motif (texte libre)
                              • décideur (prof / CPE / direction)
                              • date de retour prévue (calculée par défaut
                                = date appel + dureeJours, modifiable)
                              • commentaire libre
                            ════════════════════════════════════════════════════ */}
                        {estExclu && (
                          <div className="groupe-appel-exclu-details" style={{
                            display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center',
                            marginTop: '0.4rem', padding: '0.4rem 0.5rem',
                            background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6,
                          }}>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              step={1}
                              aria-label={`Durée d'exclusion en jours pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm"
                              style={{ width: 70 }}
                              value={detailExcl.dureeJours || 1}
                              onChange={(e) => updateExclusionDetail(eleve.eleveId, {
                                dureeJours: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                              })}
                            />
                            <span style={{ fontSize: '0.78rem', color: '#7c2d12' }}>jour(s)</span>
                            <select
                              aria-label={`Décideur de l'exclusion pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-select prof-select-sm"
                              value={detailExcl.decideePar || 'prof'}
                              onChange={(e) => updateExclusionDetail(eleve.eleveId, {
                                decideePar: e.target.value as 'prof' | 'cpe' | 'direction',
                              })}
                            >
                              <option value="prof">👨‍🏫 Décision prof</option>
                              <option value="cpe">📋 CPE</option>
                              <option value="direction">🏛️ Direction</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Motif (ex. comportement)"
                              aria-label={`Motif de l'exclusion pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm"
                              style={{ minWidth: 180, flex: 1 }}
                              value={detailExcl.motif || ''}
                              onChange={(e) => updateExclusionDetail(eleve.eleveId, {
                                motif: e.target.value,
                              })}
                            />
                            <input
                              type="date"
                              aria-label={`Date de retour prévue pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm"
                              value={detailExcl.dateRetour || ''}
                              onChange={(e) => updateExclusionDetail(eleve.eleveId, {
                                dateRetour: e.target.value || undefined,
                              })}
                              title="Date de retour prévue"
                            />
                            <input
                              type="text"
                              placeholder="Commentaire (optionnel)"
                              aria-label={`Commentaire d'exclusion pour ${formatEleveNom(eleve.eleveNom)}`}
                              className="prof-input prof-input-sm"
                              style={{ minWidth: 180, flex: 1 }}
                              value={detailExcl.commentaire || ''}
                              onChange={(e) => updateExclusionDetail(eleve.eleveId, {
                                commentaire: e.target.value,
                              })}
                            />
                          </div>
                        )}

                        {/* ════════════════════════════════════════════════════
                            Phase 39 — Détail PAR SÉANCE pour cet élève
                            ────────────────────────────────────────────────────
                            Visible uniquement quand au moins 2 séances sont
                            liées à l'appel. Permet à l'enseignant de marquer
                            l'élève absent à la 1re heure et présent à la 2de
                            (ou inversement). Chaque chip = 1 séance, cliquable
                            pour cycler entre 🟢 Présent / 🔴 Absent / 🟠 Retard.
                            Les coches globales en haut se synchronisent
                            automatiquement.
                            ════════════════════════════════════════════════════ */}
                        {appelEntreeIds.length > 1 && (
                          <div
                            className="groupe-appel-detail-seances"
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '0.4rem',
                              marginTop: '0.4rem',
                              paddingLeft: '0.25rem',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setDetailSeanceEleve((cur) => (cur === eleve.eleveId ? null : eleve.eleveId))
                              }
                              className="prof-btn prof-btn-sm prof-btn-secondary"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.55rem',
                                whiteSpace: 'nowrap',
                              }}
                              aria-expanded={detailSeanceEleve === eleve.eleveId}
                              title="Préciser le statut séance par séance"
                            >
                              {detailSeanceEleve === eleve.eleveId ? '▾' : '▸'} Détail séance
                            </button>
                            {detailSeanceEleve === eleve.eleveId &&
                              appelEntreeIds.map((sId) => {
                                const seance = appelEntrees.find((s) => s.id === sId);
                                if (!seance) return null;
                                const statut = getStatutSeanceEleve(eleve.eleveId, sId);
                                const couleur =
                                  statut === 'absent'
                                    ? '#dc2626'
                                    : statut === 'retard'
                                    ? '#d97706'
                                    : '#059669';
                                const fond =
                                  statut === 'absent'
                                    ? '#fee2e2'
                                    : statut === 'retard'
                                    ? '#fef3c7'
                                    : '#d1fae5';
                                const emoji =
                                  statut === 'absent'
                                    ? '🔴'
                                    : statut === 'retard'
                                    ? '🟠'
                                    : '🟢';
                                const heureLabel = seance.heureDebut
                                  ? ` ${seance.heureDebut}`
                                  : '';
                                return (
                                  <button
                                    key={sId}
                                    type="button"
                                    onClick={() =>
                                      cyclerStatutSeanceEleve(eleve.eleveId, sId)
                                    }
                                    title={`${seance.chapitre}${heureLabel} — ${
                                      statut === 'present'
                                        ? 'Présent'
                                        : statut === 'absent'
                                        ? 'Absent'
                                        : 'En retard'
                                    } — cliquez pour changer`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: 14,
                                      border: `1px solid ${couleur}`,
                                      background: fond,
                                      color: couleur,
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {emoji}
                                    {heureLabel
                                      ? `${heureLabel.trim()} · ${seance.chapitre}`
                                      : seance.chapitre}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* ============================================ */}
              {/* ACTIONS : Enregistrement + feedback          */}
              {/* ============================================ */}
              <div className="groupe-appel-actions">
                <button
                  className="prof-btn prof-btn-primary"
                  onClick={handleMarquerAbsences}
                  disabled={loadingAppel}
                >
                  {loadingAppel ? 'Enregistrement...' : '✅ Enregistrer l\'appel'}
                </button>
                {appelSaveState === 'ok' && (
                  <span className="groupe-appel-feedback groupe-appel-feedback--ok">
                    ✔️ Appel enregistré
                  </span>
                )}
                {appelSaveState === 'err' && (
                  <span className="groupe-appel-feedback groupe-appel-feedback--err">
                    ⚠️ Échec — voir message d'erreur
                  </span>
                )}
                <span className="groupe-appel-compteur">
                  {absentsIds.length} absent{absentsIds.length > 1 ? 's' : ''} •{' '}
                  {retardsIds.length} retard{retardsIds.length > 1 ? 's' : ''} •{' '}
                  {exclusIds.length} exclu{exclusIds.length > 1 ? 's' : ''}
                </span>
              </div>
              </>
              )}

              {/* ============================================ */}
              {/* SOUS-ONGLET 2 — FEUILLE DE GESTION & SUIVI   */}
              {/* Tableau de synthèse + bulletin PDF           */}
              {/* SUIVI SUR PÉRIODE — Absences + Retards       */}
              {/* ============================================ */}
              {sousOngletAppel === 'feuille-suivi' && (
              <div className="groupe-appel-suivi">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0 }}>📊 Suivi des absences &amp; retards</h4>
                  {/*
                    Phase 38 — Bouton « Bulletin de suivi »
                    Ouvre une modale qui demande la période et le périmètre
                    (élève précis ou tout le groupe), puis génère un PDF
                    propre, signable, à remettre aux familles.
                  */}
                  <button
                    type="button"
                    className="prof-btn prof-btn-primary"
                    onClick={() => setModalBulletinOuvert(true)}
                    title="Générer un bulletin PDF des absences et retards"
                    style={{ fontSize: '0.85rem' }}
                  >
                    📄 Bulletin de suivi (PDF)
                  </button>
                </div>
                <div className="groupe-appel-suivi-btns">
                  {(['jour', 'semaine', 'mois'] as const).map((p) => (
                    <button
                      key={p}
                      className={`prof-btn prof-btn-sm prof-btn-secondary ${periodeSuivi === p ? 'active' : ''}`}
                      onClick={() => setPeriodeSuivi(p)}
                    >
                      {p === 'jour' ? 'Jour' : p === 'semaine' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>
                {currentUser?.uid && (
                  <AppelSuiviTable
                    groupeId={groupe.id}
                    profId={currentUser.uid}
                    /* 🆕 (mai 2026) — `profNom` est passé pour signer les
                       notifications temps réel envoyées aux parents lors
                       d'une saisie dans les nouvelles colonnes de suivi
                       (observations / matériel / travail). */
                    profNom={currentUser.displayName || 'Enseignant'}
                    statsEleves={statsEleves}
                    periode={periodeSuivi}
                    /* Map eleveId → sexe : permet l'affichage du pictogramme
                       ♂/♀/✱ devant le nom dans la liste de suivi. */
                    sexeMap={inscriptions.reduce<Record<string, 'M' | 'F' | 'autre' | undefined>>((acc, i) => {
                      acc[i.eleveId] = i.eleveSexe;
                      return acc;
                    }, {})}
                  />
                )}
              </div>
              )}
            </>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET TRAVAUX À FAIRE                                       */}
      {/* ============================================================ */}
      {ongletActif === 'travaux' && (
        <div className="groupe-travaux">
          <div className="groupe-travaux-form">
            <h4>➕ Nouveau travail</h4>
            <input
              type="text"
              className="prof-input"
              placeholder="Titre du travail"
              value={nouveauTravailTitre}
              onChange={(e) => setNouveauTravailTitre(e.target.value)}
            />
            <div className="groupe-travaux-desc-editor">
              <label className="groupe-travaux-desc-label">Description (optionnel) — texte enrichi</label>
              <RichTextEditor
                value={nouveauTravailDesc}
                onChange={setNouveauTravailDesc}
                placeholder="Décrivez le travail à réaliser (gras, listes, tableaux…)"
                minHeight={160}
                className="groupe-travaux-rte"
              />
            </div>
            <div className="groupe-travaux-echeance">
              <label>Échéance :</label>
              <input
                type="date"
                className="prof-input prof-input-sm"
                value={nouveauTravailEcheance}
                onChange={(e) => setNouveauTravailEcheance(e.target.value)}
              />
              <label style={{ marginLeft: '0.75rem' }}>Heure :</label>
              <input
                type="time"
                className="prof-input prof-input-sm"
                value={nouveauTravailHeure}
                onChange={(e) => setNouveauTravailHeure(e.target.value)}
                style={{ width: '120px' }}
              />
            </div>

            {/* Phase 31 — Sélecteur cahier + rubrique */}
            {cahiersGroupe.length > 0 && (
              <div className="groupe-travaux-rubrique" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {cahiersGroupe.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Cahier :</label>
                    <select
                      className="prof-input prof-input-sm"
                      value={cahierSelectionne}
                      onChange={(e) => {
                        setCahierSelectionne(e.target.value);
                        setNouveauTravailRubriqueId('');
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">— Aucun cahier —</option>
                      {cahiersGroupe.map((c) => (
                        <option key={c.id} value={c.id}>{c.titre} ({c.matiere})</option>
                      ))}
                    </select>
                  </div>
                )}
                {rubriquesDisponibles.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Rubrique :</label>
                    <select
                      className="prof-input prof-input-sm"
                      value={nouveauTravailRubriqueId}
                      onChange={(e) => setNouveauTravailRubriqueId(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">— Sans rubrique —</option>
                      {rubriquesDisponibles.map((r) => (
                        <option key={r.id} value={r.id}>{r.nom}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              className="prof-btn prof-btn-primary"
              onClick={handleAjouterTravail}
              disabled={savingTravail || !nouveauTravailTitre.trim()}
              style={{ marginTop: '0.75rem' }}
            >
              {savingTravail ? 'Ajout...' : 'Ajouter le travail'}
            </button>
          </div>

          <div className="groupe-travaux-liste">
            <h4>📋 Travaux en cours</h4>

            {/* Phase 31 — Filtres travaux */}
            {travaux.length > 0 && (
              <div className="groupe-travaux-filtres" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Filtrer :</span>
                <select
                  className="prof-input prof-input-sm"
                  value={filtreTravailEcheance}
                  onChange={(e) => setFiltreTravailEcheance(e.target.value as any)}
                  style={{ width: 'auto', minWidth: '130px' }}
                >
                  <option value="tous">Toutes échéances</option>
                  <option value="aujourdhui">Aujourd'hui</option>
                  <option value="semaine">Cette semaine</option>
                  <option value="mois">Ce mois</option>
                </select>
                {rubriquesTravauxUniques.length > 0 && (
                  <select
                    className="prof-input prof-input-sm"
                    value={filtreTravailRubrique}
                    onChange={(e) => setFiltreTravailRubrique(e.target.value)}
                    style={{ width: 'auto', minWidth: '150px' }}
                  >
                    <option value="tous">Toutes rubriques</option>
                    {rubriquesTravauxUniques.map((r) => (
                      <option key={r.id} value={r.id}>{r.nom}</option>
                    ))}
                    <option value="__sans_rubrique__">Sans rubrique</option>
                  </select>
                )}
                <select
                  className="prof-input prof-input-sm"
                  value={filtreTravailCorrige}
                  onChange={(e) => setFiltreTravailCorrige(e.target.value as any)}
                  style={{ width: 'auto', minWidth: '140px' }}
                >
                  <option value="tous">Tous statuts</option>
                  <option value="corrige">✅ Fait & corrigé</option>
                  <option value="non_corrige">⏳ Non corrigé</option>
                </select>
                {(filtreTravailEcheance !== 'tous' || filtreTravailRubrique !== 'tous' || filtreTravailCorrige !== 'tous') && (
                  <button
                    className="prof-btn prof-btn-sm prof-btn-secondary"
                    onClick={() => { setFiltreTravailEcheance('tous'); setFiltreTravailRubrique('tous'); setFiltreTravailCorrige('tous'); }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    ✕ Réinitialiser
                  </button>
                )}
              </div>
            )}

            {travauxFiltres.length === 0 ? (
              <p className="text-muted">
                {travaux.length === 0
                  ? 'Aucun travail à faire pour l\'instant.'
                  : 'Aucun travail ne correspond aux filtres.'}
              </p>
            ) : (
              <ul className="groupe-travaux-items">
                {travauxFiltres.map((t) => (
                  <li key={t.id} className="groupe-travaux-item" style={t.corrige ? { opacity: 0.7, background: '#f0fdf4' } : {}}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      {/* Phase 36 — cellule "Corrigé" (checkbox + date/heure auto + éditable) */}
                      <CorrigeTravailCell
                        travail={t}
                        onChanged={(patch) => {
                          // Mise à jour optimiste du state local avec le patch complet
                          setTravaux(prev => prev.map(x => x.id === patch.id ? {
                            ...x,
                            corrige: patch.corrige,
                            corrigeDate: patch.corrigeDate,
                            corrigeHeure: patch.corrigeHeure,
                          } : x));
                        }}
                      />
                    <div>
                      <strong style={t.corrige ? { textDecoration: 'line-through', color: '#6b7280' } : {}}>{t.titre}</strong>
                      {t.rubriqueNom && (
                        <span style={{
                          fontSize: '0.72rem',
                          background: '#eff6ff',
                          color: '#2563eb',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          marginLeft: '0.5rem',
                          fontWeight: 600,
                        }}>
                          📂 {t.rubriqueNom}
                        </span>
                      )}
                      {t.description && (
                        <div
                          className="groupe-travaux-desc groupe-travaux-desc--html"
                          dangerouslySetInnerHTML={{ __html: t.description }}
                        />
                      )}
                      <span className="groupe-travaux-date">
                        📅 {t.dateEcheance instanceof Date ? t.dateEcheance.toLocaleDateString('fr-FR') : new Date(t.dateEcheance).toLocaleDateString('fr-FR')}
                        {t.heureEcheance && ` à ${t.heureEcheance}`}
                        {/* Le badge "Fait & corrigé le ..." est désormais porté par CorrigeTravailCell,
                            on laisse la date d'échéance seule ici pour éviter les doublons. */}
                      </span>
                    </div>
                    </div>
                    <button
                      className="prof-btn-icon prof-btn-icon-danger"
                      onClick={() => handleSupprimerTravail(t.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET FEUILLES DE NOTES                                     */}
      {/* ============================================================ */}
      {ongletActif === 'notes' && currentUser && (
        <div className="groupe-notes">
          <FeuillesNotesManager groupe={groupe} currentUser={currentUser} />
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET 3 : ANALYSE PAR QUIZ                                  */}
      {/* ============================================================ */}
      {ongletActif === 'quiz' && (
        <div className="groupe-quiz">

          {/* Sélection du quiz */}
          <div className="groupe-quiz-selector">
            <label htmlFor="select-quiz">Sélectionner un quiz à analyser :</label>
            <select
              id="select-quiz"
              value={quizSelectionne || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const q = quizDisponibles.find(x => x.id === val);
                  handleAnalyserQuiz(val, q?.source);
                }
              }}
              className="prof-select"
            >
              <option value="">— Choisir un quiz —</option>
              {quizDisponibles.map(q => (
                <option key={q.id} value={q.id}>
                  {q.source === 'quizzes_v2' ? '🧠 ' : ''}{q.titre}
                </option>
              ))}
            </select>
          </div>

          {/* État vide : pas de quiz sélectionné */}
          {!quizSelectionne && (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">📝</div>
              <h3>Analyse par quiz</h3>
              <p>Sélectionnez un quiz pour voir les statistiques détaillées et les questions les plus ratées.</p>
            </div>
          )}

          {/* Loading quiz */}
          {loadingQuiz && (
            <div className="prof-loading">
              <div className="spinner"></div>
              <p>Analyse en cours...</p>
            </div>
          )}

          {/* Résultats de l'analyse quiz */}
          {statsQuiz && !loadingQuiz && (
            <div className="groupe-quiz-resultats">
              {/* Stats globales du quiz */}
              <div className="groupe-quiz-stats-header">
                <h3>{statsQuiz.quizTitre}</h3>
                <div className="groupe-quiz-stats-grid">
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">{statsQuiz.totalPassages}</span>
                    <span className="groupe-stat-mini-label">Passages</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className={`groupe-stat-mini-value ${getClasseMoyenne(statsQuiz.moyenneScore)}`}>
                      {statsQuiz.moyenneScore}/20
                    </span>
                    <span className="groupe-stat-mini-label">Moyenne</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">{statsQuiz.tauxReussite}%</span>
                    <span className="groupe-stat-mini-label">Réussite</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">
                      {Math.floor(statsQuiz.tempsEcouleMoyen / 60)}min
                    </span>
                    <span className="groupe-stat-mini-label">Temps moyen</span>
                  </div>
                </div>
              </div>

              {/* Questions les plus ratées */}
              <div className="groupe-quiz-questions">
                <h4>❌ Questions les plus ratées</h4>
                {statsQuiz.questionsRatees
                  .filter(q => q.tauxEchec > 30)
                  .map((question, idx) => (
                    <div key={idx} className="groupe-quiz-question-card">
                      <div className="groupe-quiz-question-header">
                        <span className="groupe-quiz-question-num">
                          Q{question.questionIndex + 1}
                        </span>
                        <span className="groupe-quiz-question-echec">
                          {question.tauxEchec}% d'échec
                        </span>
                      </div>
                      <p className="groupe-quiz-question-texte">{question.questionTexte}</p>
                      <div className="groupe-quiz-question-reponse">
                        <span className="groupe-quiz-bonne-reponse">
                          ✅ Bonne réponse : {question.reponseCorrecte}
                        </span>
                      </div>
                      {question.reponsesFrequentes.length > 0 && (
                        <div className="groupe-quiz-mauvaises-reponses">
                          <span>Erreurs fréquentes :</span>
                          {question.reponsesFrequentes.slice(0, 2).map((rep, rIdx) => (
                            <span key={rIdx} className="groupe-quiz-mauvaise-reponse">
                              ❌ {rep.reponse} ({rep.nombre} élève{rep.nombre > 1 ? 's' : ''})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
                {statsQuiz.questionsRatees.filter(q => q.tauxEchec > 30).length === 0 && (
                  <p className="text-muted">Toutes les questions ont un taux de réussite supérieur à 70% 🎉</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET : CAHIER DE TEXTES (lié à ce groupe)                   */}
      {/* ============================================================ */}
      {ongletActif === 'cahier' && (
        <div className="groupe-cahier-onglet">
          <CahierGroupeWidget
            groupe={{
              id: groupe.id,
              profId: groupe.profId,
              nom: groupe.nom,
              classe: groupe.classeNiveau,
              codeInvitation: groupe.codeInvitation,
              nombreInscrits: groupe.nombreInscrits,
              anneeScolaire: groupe.anneeScolaire,
            }}
          />
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET PLANIFICATION (Phase 32)                               */}
      {/* ============================================================ */}
      {ongletActif === 'planification' && (
        <div className="groupe-planification" style={{ padding: 'var(--spacing-lg)' }}>
          {loadingPlanif ? (
            <div className="prof-loading"><div className="spinner"></div><p>Chargement de la planification…</p></div>
          ) : planifCahiers.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">📅</div>
              <h3>Aucun cahier de textes lié</h3>
              <p>Créez ou liez un cahier de textes à ce groupe pour accéder à la planification.</p>
            </div>
          ) : (
            <>
              {/* Sélecteur de cahier si plusieurs */}
              {planifCahiers.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Cahier :</label>
                  <select
                    className="prof-input prof-input-sm"
                    value={planifCahierIdx}
                    onChange={e => setPlanifCahierIdx(Number(e.target.value))}
                    style={{ width: 'auto', minWidth: '200px' }}
                  >
                    {planifCahiers.map((c, i) => (
                      <option key={c.id} value={i}>{c.titre} ({c.matiere})</option>
                    ))}
                  </select>
                </div>
              )}

              {planifCahiers[planifCahierIdx] && (
                <>
                  {/* Widget de planification — affiche les séances triées du cahier sélectionné */}
                  <PlanificationWidget
                    cahier={planifCahiers[planifCahierIdx]}
                    entrees={planifEntrees}
                  />
                  {/* Lien vers la page complète : ouvre PlanificationPage du cahier courant */}
                  <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/prof/cahiers/${planifCahiers[planifCahierIdx].id}/planification`,
                        )
                      }
                      style={{
                        background: 'transparent',
                        border: '1px solid #2563eb',
                        color: '#2563eb',
                        padding: '0.45rem 0.9rem',
                        borderRadius: 8,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Voir la planification complète →
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET ALERTES                                                */}
      {/* ============================================================ */}
      {ongletActif === 'alertes' && (
        <div className="groupe-alertes">
          {alertes.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">🔔</div>
              <h3>Aucune alerte</h3>
              <p>Tous vos élèves se portent bien ! Les alertes apparaîtront ici quand un élève aura besoin d'attention.</p>
            </div>
          ) : (
            <div className="groupe-alertes-liste">
              {alertes.map(alerte => (
                <div
                  key={alerte.id}
                  className={`groupe-alerte-card groupe-alerte-${alerte.niveauUrgence}`}
                >
                  <div className="groupe-alerte-header">
                    <span className="groupe-alerte-emoji">
                      {getAlerteEmoji(alerte.type)}
                    </span>
                    <span className="groupe-alerte-eleve">{formatEleveNom(alerte.eleveNom)}</span>
                    <span className={`groupe-alerte-badge groupe-alerte-badge-${alerte.niveauUrgence}`}>
                      {alerte.niveauUrgence}
                    </span>
                  </div>
                  <p className="groupe-alerte-message">{alerte.message}</p>
                  {/* Action rapide : voir détail de l'élève */}
                  <button
                    className="prof-btn prof-btn-secondary prof-btn-sm"
                    onClick={() => {
                      setOngletActif('eleves');
                      setEleveSelectionne(alerte.eleveId);
                    }}
                  >
                    📋 Voir détail
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal inscription directe (élèves membres PedaClic) */}
      {modalInscriptionOuvert && currentUser && (
        <InscriptionDirecteModal
          groupeId={groupe.id}
          groupeNom={groupe.nom}
          profId={currentUser.uid}
          onClose={() => setModalInscriptionOuvert(false)}
          onSuccess={chargerDonneesGroupe}
        />
      )}

      {/* Phase 38 — Modal "Bulletin de suivi des absences/retards" (PDF) */}
      {currentUser && (
        <BulletinAbsencesModal
          ouvert={modalBulletinOuvert}
          onFermer={() => setModalBulletinOuvert(false)}
          groupe={groupe}
          eleves={statsEleves}
          profId={currentUser.uid}
          profNom={currentUser.displayName || undefined}
        />
      )}
    </div>
  );
};

export default GroupeDetail;
