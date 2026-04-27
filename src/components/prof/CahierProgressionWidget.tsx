// ============================================================
// PedaClic – Phase 29 : Widget de Progression du Cahier de Textes
// Affiche le taux de réalisation global et par rubrique
// + Phase 37 : Filtre des titres restants (par rubrique / statut / matière)
// ============================================================

import React, { useMemo, useState } from 'react';
import type {
  EntreeCahier,
  RubriqueCahier,
  StatutTitre,
  TitreRubrique,
} from '../../types/cahierTextes.types';
import { STATUT_TITRE_CONFIG } from '../../types/cahierTextes.types';
import { calculerProgression, type ProgressionItem } from '../../services/cahierTextesService';
import './CahierProgressionWidget.css';

interface CahierProgressionWidgetProps {
  entrees: EntreeCahier[];
  rubriques: RubriqueCahier[];
  showDetails?: boolean;
  titre?: string;
  /**
   * Phase 37 — Matière courante du cahier (affichée dans le filtre des
   * titres restants pour clarté lorsqu'on consulte plusieurs cahiers).
   */
  matiere?: string;
}

/**
 * Phase 37 — Représente un titre restant (non achevé) avec son contexte
 * de rubrique. Aplatit `RubriqueCahier.titres[]` en une liste plate
 * filtrable par statut/rubrique/matière dans la section dédiée.
 */
interface TitreRestant {
  rubriqueId: string;
  rubriqueNom: string;
  rubriqueCouleur: string;
  titre: TitreRubrique;
}

const BarreProgression: React.FC<{
  item: ProgressionItem;
  isGlobal?: boolean;
  rubrique?: RubriqueCahier;
}> = ({ item, isGlobal = false, rubrique }) => {
  const pct = Math.round(item.pourcentage);
  const denomVisuel = item.seancesPrevu != null && item.seancesPrevu > 0
    ? Math.max(item.seancesPrevu, item.total)
    : Math.max(item.total, 1);
  const segRealise = Math.min((item.realise / denomVisuel) * 100, 100);
  const segPlanifie = Math.min((item.planifie / denomVisuel) * 100, Math.max(0, 100 - segRealise));
  const segAnnule = Math.min((item.annule / denomVisuel) * 100, Math.max(0, 100 - segRealise - segPlanifie));

  const pctClass =
    pct >= 100 ? 'prog-pct-badge prog-pct-complete'
    : pct >= 50 ? 'prog-pct-badge prog-pct-mid'
    : 'prog-pct-badge';

  return (
    <div className={`prog-barre-wrapper${isGlobal ? ' prog-barre-global' : ''}`}>
      <div className="prog-barre-header">
        {isGlobal ? (
          <span className="prog-global-label">
            <span className="prog-global-icon" aria-hidden="true">📊</span>
            Progression globale
          </span>
        ) : (
          <span
            className="prog-rubrique-tag"
            style={{
              backgroundColor: item.couleur + '1a',
              borderColor: item.couleur,
              color: item.couleur,
            }}
          >
            {item.rubriqueNom}
          </span>
        )}
        <span className={pctClass}>{pct} %</span>
      </div>

      <div
        className="prog-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Réalisation : ${pct}%`}
      >
        <div
          className="prog-fill prog-fill-realise"
          style={{ width: `${segRealise}%` }}
          title={`Réalisé : ${item.realise}`}
        />
        <div
          className="prog-fill prog-fill-planifie"
          style={{ width: `${segPlanifie}%`, left: `${segRealise}%` }}
          title={`Planifié : ${item.planifie}`}
        />
        <div
          className="prog-fill prog-fill-annule"
          style={{
            width: `${segAnnule}%`,
            left: `${segRealise + segPlanifie}%`,
          }}
          title={`Annulé : ${item.annule}`}
        />
      </div>

      <div className="prog-counts">
        {item.realise > 0 && (
          <span className="prog-count prog-count-realise">
            ✅ {item.realise} réalisée{item.realise > 1 ? 's' : ''}
          </span>
        )}
        {item.planifie > 0 && (
          <span className="prog-count prog-count-planifie">
            📋 {item.planifie} planifiée{item.planifie > 1 ? 's' : ''}
          </span>
        )}
        {item.annule > 0 && (
          <span className="prog-count prog-count-annule">
            ❌ {item.annule} annulée{item.annule > 1 ? 's' : ''}
          </span>
        )}
        <span className="prog-count prog-count-total">
          {item.seancesPrevu != null && item.seancesPrevu > 0
            ? `${item.realise} / ${item.seancesPrevu} séances prévues`
            : `${item.total} séance${item.total > 1 ? 's' : ''} au total`}
        </span>
        {/* Phase 33 — stats titres */}
        {rubrique?.titres && rubrique.titres.length > 0 && (() => {
          const titres = rubrique.titres!;
          const acheves = titres.filter(t => t.statut === 'acheve').length;
          const enCours = titres.filter(t => t.statut === 'en_cours').length;
          const pctT = Math.round((acheves / titres.length) * 100);
          return (
            <span className="prog-count prog-count-titres" title={`${acheves} achevé(s), ${enCours} en cours sur ${titres.length} titre(s)`}>
              📝 Titres : {acheves}/{titres.length} ({pctT}%)
            </span>
          );
        })()}
      </div>
    </div>
  );
};

const CahierProgressionWidget: React.FC<CahierProgressionWidgetProps> = ({
  entrees,
  rubriques,
  showDetails = true,
  titre = 'Progression',
  matiere,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  // ── Phase 37 — État local du filtre des titres restants ──────────
  // On expose 3 dimensions : rubrique, statut, recherche texte.
  // Persiste pendant la session de consultation du widget.
  const [filtreRubriqueId, setFiltreRubriqueId] = useState<string>('toutes');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutTitre>('tous');
  const [filtreRecherche, setFiltreRecherche] = useState<string>('');
  const [titresRestantsExpanded, setTitresRestantsExpanded] = useState<boolean>(true);

  const { progGlobal, parRubrique } = useMemo(() => {
    const { global, parRubrique: parR } = calculerProgression(entrees, rubriques);
    return { progGlobal: global, parRubrique: parR };
  }, [entrees, rubriques]);

  // ──────────────────────────────────────────────────────────────────
  // Phase 37 — Construction et filtrage des « titres restants »
  // ──────────────────────────────────────────────────────────────────
  //   « Restant » = statut différent de 'acheve'. On agrège les titres
  //   de toutes les rubriques en une liste plate avec leur contexte
  //   (rubrique, couleur) pour rendre le filtrage et l'affichage
  //   simples côté UI.
  const titresRestants = useMemo<TitreRestant[]>(() => {
    const restants: TitreRestant[] = [];
    rubriques.forEach((r) => {
      (r.titres || []).forEach((t) => {
        if (t.statut !== 'acheve') {
          restants.push({
            rubriqueId: r.id,
            rubriqueNom: r.nom,
            rubriqueCouleur: r.couleur ?? '#64748b',
            titre: t,
          });
        }
      });
    });
    return restants;
  }, [rubriques]);

  /** Liste filtrée selon les 3 dimensions du filtre (rubrique / statut / recherche). */
  const titresRestantsFiltres = useMemo<TitreRestant[]>(() => {
    const recherche = filtreRecherche.trim().toLowerCase();
    return titresRestants
      .filter((t) => filtreRubriqueId === 'toutes' || t.rubriqueId === filtreRubriqueId)
      .filter((t) => filtreStatut === 'tous' || t.titre.statut === filtreStatut)
      .filter((t) => !recherche || t.titre.nom.toLowerCase().includes(recherche))
      .sort((a, b) => {
        // Ordre : non_commence < en_cours, puis par ordre dans la rubrique
        const sa = a.titre.statut === 'non_commence' ? 0 : 1;
        const sb = b.titre.statut === 'non_commence' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        if (a.rubriqueNom !== b.rubriqueNom) return a.rubriqueNom.localeCompare(b.rubriqueNom, 'fr-FR');
        return (a.titre.ordre || 0) - (b.titre.ordre || 0);
      });
  }, [titresRestants, filtreRubriqueId, filtreStatut, filtreRecherche]);

  /** Liste des rubriques qui contiennent au moins un titre restant (pour le select). */
  const rubriquesAvecTitresRestants = useMemo(() => {
    const ids = new Set(titresRestants.map((t) => t.rubriqueId));
    return rubriques.filter((r) => ids.has(r.id));
  }, [titresRestants, rubriques]);

  if (entrees.length === 0 && rubriques.length === 0) {
    return (
      <div className="prog-widget prog-widget-empty">
        <span className="prog-empty-icon" aria-hidden="true">📋</span>
        <span>Aucune séance enregistrée pour l'instant.</span>
      </div>
    );
  }

  return (
    <div className="prog-widget">
      <div
        className="prog-widget-header"
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(prev => !prev)}
      >
        <h3 className="prog-widget-titre">
          <span className="prog-widget-icon" aria-hidden="true">📈</span>
          {titre}
          {!expanded && (
            <span className="prog-widget-summary">
              {Math.round(progGlobal.pourcentage)} % réalisé
            </span>
          )}
        </h3>
        <button
          className="prog-toggle-btn"
          aria-label={expanded ? 'Réduire' : 'Développer'}
          tabIndex={-1}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="prog-widget-body">
          <BarreProgression item={progGlobal} isGlobal />

          <div className="prog-legende" aria-label="Légende">
            <span className="prog-legende-item prog-legende-realise">Réalisé</span>
            <span className="prog-legende-item prog-legende-planifie">Planifié</span>
            <span className="prog-legende-item prog-legende-annule">Annulé</span>
          </div>

          {showDetails && parRubrique.length > 0 && (
            <>
              <div className="prog-separator">
                <span>Détail par rubrique</span>
              </div>
              <div className="prog-rubriques-list">
                {parRubrique.map(item => (
                  <BarreProgression
                    key={item.rubriqueId ?? '__sans_rubrique__'}
                    item={item}
                    rubrique={rubriques.find(r => r.id === item.rubriqueId)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              Phase 37 — Section « Titres restants » avec filtre
              ────────────────────────────────────────────────────────────
              Affichée uniquement s'il existe au moins un titre non
              encore achevé. Permet au prof de :
                • Filtrer par rubrique (chapitre / module)
                • Filtrer par statut (non commencé / en cours)
                • Rechercher par texte (nom du titre)
              ════════════════════════════════════════════════════════════ */}
          {titresRestants.length > 0 && (
            <>
              <div className="prog-separator">
                <span>
                  Titres restants
                  {matiere && <> · {matiere}</>}
                </span>
              </div>

              {/* Toggle pour replier/déplier la liste — utile sur mobile */}
              <div className="prog-titres-restants-header">
                <button
                  type="button"
                  className="prog-titres-restants-toggle"
                  onClick={() => setTitresRestantsExpanded((v) => !v)}
                  aria-expanded={titresRestantsExpanded}
                  title={titresRestantsExpanded ? 'Replier' : 'Déplier'}
                >
                  <span className="prog-titres-restants-chevron">
                    {titresRestantsExpanded ? '▾' : '▸'}
                  </span>
                  <span className="prog-titres-restants-count">
                    {titresRestantsFiltres.length} / {titresRestants.length}
                  </span>
                  <span className="prog-titres-restants-label">
                    titre{titresRestants.length > 1 ? 's' : ''} non achevé{titresRestants.length > 1 ? 's' : ''}
                  </span>
                </button>
              </div>

              {titresRestantsExpanded && (
                <>
                  {/* ── Barre de filtres (rubrique · statut · recherche) ── */}
                  <div className="prog-titres-restants-filtres" role="group" aria-label="Filtres des titres restants">
                    <select
                      className="prog-filtre-select"
                      value={filtreRubriqueId}
                      onChange={(e) => setFiltreRubriqueId(e.target.value)}
                      aria-label="Filtrer par rubrique"
                      title="Filtrer par rubrique"
                    >
                      <option value="toutes">📂 Toutes les rubriques</option>
                      {rubriquesAvecTitresRestants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nom}
                        </option>
                      ))}
                    </select>

                    <select
                      className="prog-filtre-select"
                      value={filtreStatut}
                      onChange={(e) => setFiltreStatut(e.target.value as 'tous' | StatutTitre)}
                      aria-label="Filtrer par statut"
                      title="Filtrer par statut"
                    >
                      <option value="tous">⏺ Tous statuts</option>
                      <option value="non_commence">⬜ Non commencé</option>
                      <option value="en_cours">🟡 En cours</option>
                    </select>

                    <input
                      type="search"
                      className="prog-filtre-recherche"
                      value={filtreRecherche}
                      onChange={(e) => setFiltreRecherche(e.target.value)}
                      placeholder="🔎 Rechercher un titre…"
                      aria-label="Rechercher dans les titres restants"
                    />

                    {(filtreRubriqueId !== 'toutes' || filtreStatut !== 'tous' || filtreRecherche) && (
                      <button
                        type="button"
                        className="prog-filtre-reset"
                        onClick={() => {
                          setFiltreRubriqueId('toutes');
                          setFiltreStatut('tous');
                          setFiltreRecherche('');
                        }}
                        title="Réinitialiser les filtres"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* ── Liste filtrée des titres restants ── */}
                  {titresRestantsFiltres.length === 0 ? (
                    <p className="prog-titres-restants-empty">
                      Aucun titre ne correspond aux filtres actifs.
                    </p>
                  ) : (
                    <ul className="prog-titres-restants-list" aria-label="Titres restants à traiter">
                      {titresRestantsFiltres.map((t) => {
                        const cfg = STATUT_TITRE_CONFIG[t.titre.statut];
                        return (
                          <li
                            key={`${t.rubriqueId}_${t.titre.id}`}
                            className="prog-titre-restant-item"
                            style={{ borderLeftColor: t.rubriqueCouleur }}
                          >
                            <span
                              className="prog-titre-restant-rubrique"
                              style={{
                                backgroundColor: t.rubriqueCouleur + '1a',
                                color: t.rubriqueCouleur,
                                borderColor: t.rubriqueCouleur,
                              }}
                              title={`Rubrique : ${t.rubriqueNom}`}
                            >
                              {t.rubriqueNom}
                            </span>
                            <span className="prog-titre-restant-nom">{t.titre.nom}</span>
                            <span
                              className="prog-titre-restant-statut"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}
                              title={cfg.label}
                            >
                              {cfg.emoji} {cfg.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CahierProgressionWidget;
