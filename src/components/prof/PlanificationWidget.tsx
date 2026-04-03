import React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface PlanificationWidgetProps {
  cahier?: any;      // Données du cahier de textes
  entrees?: any[];   // Liste des entrées pédagogiques
  compact?: boolean; // Mode compact (affichage réduit)
}

// ── PlanificationWidget : widget de planification pédagogique ──────────────
const PlanificationWidget: React.FC<PlanificationWidgetProps> = ({
  cahier,
  entrees = [],
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <p className="text-sm font-medium text-blue-700">
          Planification — {entrees.length} entrée{entrees.length !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Planification</h3>
      {entrees.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune entrée planifiée.</p>
      ) : (
        <ul className="space-y-2">
          {entrees.map((entree: any, i: number) => (
            <li key={i} className="text-sm text-gray-600 border-l-2 border-blue-300 pl-3">
              {entree?.titre || entree?.title || `Entrée ${i + 1}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlanificationWidget;
