// ============================================================
// PedaClic — Phase 46 : Saisie d'étiquettes (puces)
// ------------------------------------------------------------
// Entrée / virgule = ajouter · Retour arrière sur champ vide = retirer
// la dernière · Suggestions issues des étiquettes déjà utilisées.
// ============================================================

import React, { useState } from 'react';
import { nettoyerEtiquettes, normaliser } from '../../utils/organisateurCahiers';

interface EtiquettesInputProps {
  value: string[];
  onChange: (etiquettes: string[]) => void;
  /** Étiquettes déjà utilisées par le professeur */
  suggestions: string[];
  placeholder?: string;
}

const EtiquettesInput: React.FC<EtiquettesInputProps> = ({
  value, onChange, suggestions, placeholder = 'Ex : Cellule Lettres, Classe d\'examen…',
}) => {
  const [saisie, setSaisie] = useState('');

  // Ajoute une ou plusieurs étiquettes (séparées par des virgules)
  const ajouter = (texte: string) => {
    const nouvelles = texte.split(',').map(s => s.trim()).filter(Boolean);
    if (nouvelles.length) onChange(nettoyerEtiquettes([...value, ...nouvelles]));
    setSaisie('');
  };

  const retirer = (etiquette: string) => onChange(value.filter(e => e !== etiquette));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();          // Entrée ne doit pas soumettre le formulaire du cahier
      ajouter(saisie);
    } else if (e.key === 'Backspace' && !saisie && value.length) {
      retirer(value[value.length - 1]);
    }
  };

  // Suggestions non encore choisies, filtrées par la saisie en cours
  const dejaPrises = new Set(value.map(normaliser));
  const proposees = suggestions
    .filter(s => !dejaPrises.has(normaliser(s)))
    .filter(s => !saisie || normaliser(s).includes(normaliser(saisie)))
    .slice(0, 6);

  return (
    <div className="org-etiquettes-input">
      {/* Zone de saisie : puces existantes + champ texte */}
      <div className="org-etiquettes-champ">
        {value.map(e => (
          <span key={e} className="org-puce-etiquette">
            #{e}
            <button type="button" onClick={() => retirer(e)} aria-label={`Retirer l'étiquette ${e}`}>✕</button>
          </span>
        ))}
        <input
          type="text"
          value={saisie}
          onChange={e => setSaisie(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => saisie.trim() && ajouter(saisie)}
          placeholder={value.length ? '' : placeholder}
          maxLength={40}
          aria-label="Ajouter une étiquette"
        />
      </div>

      {/* Suggestions cliquables */}
      {proposees.length > 0 && (
        <div className="org-etiquettes-suggestions">
          {proposees.map(s => (
            <button key={s} type="button" className="org-suggestion" onClick={() => ajouter(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EtiquettesInput;
