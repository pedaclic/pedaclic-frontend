// ============================================================
// PedaClic — Sélecteur Matières / Niveaux
// www.pedaclic.sn
// ============================================================
// Composant réutilisable pour filtrer les contenus par matière et niveau.
// Utilisé sur PremiumPage (aperçu), PremiumCoursChoicePage, etc.
// La sélection du niveau restreint la palette affichée.
// ============================================================

import React from 'react';
import type { SelectOption } from '../../hooks/useDisciplinesOptions';
import './MatieresNiveauxSelector.css';
import { getNombreCoursMax, type FormulePremium } from '../../types/premiumPlans';

export interface MatieresNiveauxValue {
  matiere: string;
  niveau: string;
}

export interface MatieresNiveauxSelectorProps {
  matieres: SelectOption[];
  niveaux: SelectOption[];
  value: MatieresNiveauxValue;
  onChange: (value: MatieresNiveauxValue) => void;
  formule?: FormulePremium | string;
  /** Message personnalisé (ex. "Filtrez pour voir les cours disponibles") */
  hint?: string;
  /** Mode compact pour intégration dans une carte */
  compact?: boolean;
}

/**
 * Sélecteur matière + niveau pour le choix des cours à la carte
 */
const MatieresNiveauxSelector: React.FC<MatieresNiveauxSelectorProps> = ({
  matieres,
  niveaux,
  value,
  onChange,
  formule,
  hint,
  compact = false,
}) => {
  const maxCours = formule ? getNombreCoursMax(formule) : null;

  return (
    <div className={`matieres-niveaux-selector ${compact ? 'matieres-niveaux-selector--compact' : ''}`}>
      <div className="matieres-niveaux-selector__row">
        <div className="matieres-niveaux-selector__field">
          <label htmlFor="mn-matiere" className="matieres-niveaux-selector__label">
            Matière
          </label>
          <select
            id="mn-matiere"
            value={value.matiere}
            onChange={(e) => onChange({ ...value, matiere: e.target.value })}
            className="matieres-niveaux-selector__select"
            aria-label="Filtrer par matière"
          >
            <option value="">Toutes les matières</option>
            {matieres.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="matieres-niveaux-selector__field">
          <label htmlFor="mn-niveau" className="matieres-niveaux-selector__label">
            Niveau
          </label>
          <select
            id="mn-niveau"
            value={value.niveau}
            onChange={(e) => onChange({ ...value, niveau: e.target.value })}
            className="matieres-niveaux-selector__select"
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {niveaux.map((n) => (
              <option key={n.valeur} value={n.valeur}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(hint || (maxCours !== null && maxCours !== undefined)) && (
        <p className="matieres-niveaux-selector__hint">
          {hint}
          {maxCours !== null && maxCours !== undefined && (
            <span>
              {hint ? ' — ' : ''}
              Sélection possible : jusqu'à <strong>{maxCours} cours</strong>.
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export default MatieresNiveauxSelector;
