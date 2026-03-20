// ============================================================
// PedaClic – Phase 29 : Widget de Progression du Cahier de Textes
// Affiche le taux de réalisation global et par rubrique
// ============================================================

import React, { useMemo, useState } from 'react';
import type { EntreeCahier, RubriqueCahier } from '../../types/cahierTextes.types';
import { calculerProgression, type ProgressionItem } from '../../services/cahierTextesService';
import './CahierProgressionWidget.css';

interface CahierProgressionWidgetProps {
  entrees: EntreeCahier[];
  rubriques: RubriqueCahier[];
  showDetails?: boolean;
  titre?: string;
}

const BarreProgression: React.FC<{
  item: ProgressionItem;
  isGlobal?: boolean;
}> = ({ item, isGlobal = false }) => {
  const pct = Math.round(item.pourcentage);
  const base = Math.max(item.total, 1);
  const pctRealise = (item.realise / base) * 100;
  const pctPlanifie = (item.planifie / base) * 100;
  const pctAnnule = (item.annule / base) * 100;

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
          style={{ width: `${pctRealise}%` }}
          title={`Réalisé : ${item.realise}`}
        />
        <div
          className="prog-fill prog-fill-planifie"
          style={{ width: `${pctPlanifie}%`, left: `${pctRealise}%` }}
          title={`Planifié : ${item.planifie}`}
        />
        <div
          className="prog-fill prog-fill-annule"
          style={{
            width: `${pctAnnule}%`,
            left: `${pctRealise + pctPlanifie}%`,
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
            ? `${item.realise} / ${item.seancesPrevu} séance${item.seancesPrevu > 1 ? 's' : ''} prévue${item.seancesPrevu > 1 ? 's' : ''}`
            : `${item.total} séance${item.total > 1 ? 's' : ''} au total`}
        </span>
      </div>
    </div>
  );
};

const CahierProgressionWidget: React.FC<CahierProgressionWidgetProps> = ({
  entrees,
  rubriques,
  showDetails = true,
  titre = 'Progression',
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  const { progGlobal, parRubrique } = useMemo(() => {
    const { global, parRubrique: parR } = calculerProgression(entrees, rubriques);
    return { progGlobal: global, parRubrique: parR };
  }, [entrees, rubriques]);

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
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CahierProgressionWidget;
