// ============================================================
// PedaClic — Phase 32 : FiltreActivitesEleve
// ============================================================
// Filtre par type d'activité affiché dans la vue élève d'une
// séance (ElveCahierPage) et à l'échelle du cahier.
//
// 4 types supportés (source unique de vérité pour toute la Phase 32) :
//   - cours              : contenu HTML de la séance (champ `contenu`)
//   - exercice_jour      : exercice d'application (exerciceJour)
//   - exercice_domicile  : exercice à domicile (exerciceDomicile)
//   - quiz               : quiz rattaché à la séance
//
// Ergonomie : boutons "chips" sélectionnables individuellement.
// La sélection vide = tout afficher (comportement par défaut).
// ============================================================

import React from 'react';

/**
 * Types d'activités filtrables.
 * Exporté pour être référencé dans ElveCahierPage.
 */
export type TypeActivite =
  | 'cours'
  | 'exercice_jour'
  | 'exercice_domicile'
  | 'quiz';

/** Configuration d'affichage (centralisée pour cohérence UI). */
export const TYPES_ACTIVITE_CONFIG: Record<
  TypeActivite,
  { label: string; emoji: string; couleur: string }
> = {
  cours:              { label: 'Cours',               emoji: '📘', couleur: '#2563eb' },
  exercice_jour:      { label: 'Exercice du jour',    emoji: '🎯', couleur: '#7c3aed' },
  exercice_domicile:  { label: 'Exercice à domicile', emoji: '🏠', couleur: '#d97706' },
  quiz:               { label: 'Quiz',                emoji: '🧩', couleur: '#059669' },
};

export const TYPES_ACTIVITE_LISTE: TypeActivite[] = [
  'cours',
  'exercice_jour',
  'exercice_domicile',
  'quiz',
];

export interface FiltreActivitesEleveProps {
  /** Ensemble des types actuellement sélectionnés. Vide = tous affichés. */
  selection: Set<TypeActivite>;
  /** Callback lors d'un changement. */
  onChange: (selection: Set<TypeActivite>) => void;
  /** Compteur indicatif par type (optionnel, affiché entre parenthèses). */
  compteurs?: Partial<Record<TypeActivite, number>>;
}

const FiltreActivitesEleve: React.FC<FiltreActivitesEleveProps> = ({
  selection,
  onChange,
  compteurs,
}) => {
  /** Bascule un type dans la sélection. */
  const toggle = (type: TypeActivite) => {
    const copie = new Set(selection);
    if (copie.has(type)) copie.delete(type);
    else copie.add(type);
    onChange(copie);
  };

  const effacer = () => onChange(new Set());

  const tousAffiches = selection.size === 0;

  return (
    <div
      className="filtre-activites-eleve"
      role="group"
      aria-label="Filtrer les activités par type"
    >
      <div className="filtre-activites-eleve__titre">
        🔍 Filtrer par type d'activité
        {!tousAffiches && (
          <button
            type="button"
            className="filtre-activites-eleve__clear"
            onClick={effacer}
            title="Afficher toutes les activités"
          >
            ✕ Afficher tout
          </button>
        )}
      </div>

      <div className="filtre-activites-eleve__chips">
        {TYPES_ACTIVITE_LISTE.map((type) => {
          const cfg = TYPES_ACTIVITE_CONFIG[type];
          const actif = selection.has(type) || tousAffiches;
          const nb = compteurs?.[type];
          return (
            <button
              key={type}
              type="button"
              className={`filtre-activites-eleve__chip${
                actif ? ' filtre-activites-eleve__chip--actif' : ''
              }`}
              style={
                actif
                  ? {
                      backgroundColor: cfg.couleur + '1a',
                      borderColor: cfg.couleur,
                      color: cfg.couleur,
                    }
                  : {}
              }
              onClick={() => toggle(type)}
              aria-pressed={actif}
            >
              <span aria-hidden="true">{cfg.emoji}</span> {cfg.label}
              {nb !== undefined && nb > 0 && (
                <span className="filtre-activites-eleve__count">{nb}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="filtre-activites-eleve__aide">
        {tousAffiches
          ? 'Toutes les activités sont affichées. Cliquez sur un type pour filtrer.'
          : `${selection.size} type${selection.size > 1 ? 's' : ''} sélectionné${
              selection.size > 1 ? 's' : ''
            }.`}
      </p>
    </div>
  );
};

export default FiltreActivitesEleve;
