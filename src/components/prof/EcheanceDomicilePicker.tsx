// ============================================================
// PedaClic — Phase 32 : EcheanceDomicilePicker
// ============================================================
// Petit composant contrôlé pour sélectionner une échéance
// date + heure associée à un "Exercice à domicile".
//
// Conventions :
//   - null / undefined = pas d'échéance (pas de travail créé)
//   - { date: 'YYYY-MM-DD', heure: 'HH:mm' } = échéance prévue
//
// Le composant est purement présentationnel ; la création du
// TravailAFaire est faite dans EntreeEditorPage après soumission
// (cf. upsertTravailDepuisExerciceDomicile).
// ============================================================

import React from 'react';

export interface EcheanceDomicile {
  /** Date au format ISO court (YYYY-MM-DD) */
  date: string;
  /** Heure au format HH:mm (24h) */
  heure: string;
}

export interface EcheanceDomicilePickerProps {
  /** Valeur courante de l'échéance (null = non définie). */
  valeur: EcheanceDomicile | null;
  /** Callback de mise à jour. */
  onChange: (v: EcheanceDomicile | null) => void;
  /** Désactive les champs (lecture seule). */
  readonly?: boolean;
}

const EcheanceDomicilePicker: React.FC<EcheanceDomicilePickerProps> = ({
  valeur,
  onChange,
  readonly = false,
}) => {
  // ── État local dérivé des props (formulaire contrôlé) ──
  const date = valeur?.date ?? '';
  const heure = valeur?.heure ?? '';

  /**
   * Met à jour la valeur courante en fusionnant la modification
   * (date OU heure). Si les deux champs deviennent vides, on
   * repasse à null pour signaler "pas d'échéance".
   */
  const handleChange = (champ: 'date' | 'heure', val: string) => {
    const nouvelle: EcheanceDomicile = {
      date: champ === 'date' ? val : date,
      heure: champ === 'heure' ? val : heure,
    };
    // Heure par défaut à 23:59 si l'utilisateur a choisi une date mais pas encore d'heure
    if (nouvelle.date && !nouvelle.heure) {
      nouvelle.heure = '23:59';
    }
    // Si tout est vide, on vide l'échéance
    if (!nouvelle.date && !nouvelle.heure) {
      onChange(null);
      return;
    }
    // Date obligatoire pour créer un travail ; sinon, on ne propage pas
    if (!nouvelle.date) {
      onChange(null);
      return;
    }
    onChange(nouvelle);
  };

  const handleEffacer = () => onChange(null);

  return (
    <div className="echeance-domicile-picker" aria-label="Échéance de l'exercice à domicile">
      <div className="echeance-domicile-picker__titre">
        📅 Échéance <span className="echeance-domicile-picker__hint">(facultatif)</span>
      </div>

      <div className="echeance-domicile-picker__ligne">
        {/* Champ date */}
        <label className="echeance-domicile-picker__label">
          <span>Date</span>
          <input
            type="date"
            className="form-input"
            value={date}
            disabled={readonly}
            onChange={(e) => handleChange('date', e.target.value)}
          />
        </label>

        {/* Champ heure */}
        <label className="echeance-domicile-picker__label">
          <span>Heure</span>
          <input
            type="time"
            className="form-input"
            value={heure}
            disabled={readonly || !date /* heure significative uniquement si une date est posée */}
            onChange={(e) => handleChange('heure', e.target.value)}
          />
        </label>

        {/* Bouton d'effacement — masqué si déjà vide ou en lecture seule */}
        {!readonly && valeur && (
          <button
            type="button"
            className="echeance-domicile-picker__clear"
            onClick={handleEffacer}
            title="Supprimer l'échéance"
          >
            ✕ Effacer
          </button>
        )}
      </div>

      <p className="echeance-domicile-picker__aide">
        Si une échéance est définie, l'exercice à domicile apparaîtra automatiquement dans
        la liste « Travaux à faire » des élèves, avec la date et l'heure limites.
      </p>
    </div>
  );
};

export default EcheanceDomicilePicker;
