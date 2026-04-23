// ============================================================
// PedaClic — Phase 36 : CorrigeTravailCell
// ------------------------------------------------------------
// Composant réutilisable pour la clôture d'un "Exercice à domicile"
// (TravailAFaire) :
//   - checkbox "Corrigé"
//   - date + heure de correction (auto au clic, éditables par le prof)
//
// Comportement :
//   • Cocher   → appelle toggleCorrigeTravail(id, true)
//                qui auto-remplit date/heure = instant local courant.
//   • Décocher → toggleCorrigeTravail(id, false) efface date & heure.
//   • Clic sur "✏️ Éditer" → ouvre deux inputs (type="date" + type="time")
//     pré-remplis avec la valeur actuelle. "Enregistrer" appelle
//     modifierTravailAFaire et propage la mise à jour.
//
// Le parent fournit le TravailAFaire courant et un callback onChanged
// qui reçoit le patch à fusionner dans son state (id, corrige,
// corrigeDate, corrigeHeure).
// ============================================================

import React, { useState } from 'react';
import {
  toggleCorrigeTravail,
  modifierTravailAFaire,
  maintenantDateHeure,
} from '../../services/travauxAFaireService';
import type { TravailAFaire } from '../../types/groupeAbsences.types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface CorrigePatch {
  id: string;
  corrige: boolean;
  corrigeDate: string;
  corrigeHeure: string;
}

interface CorrigeTravailCellProps {
  /** Travail courant (nécessaire pour id + valeurs à afficher) */
  travail: Pick<TravailAFaire, 'id' | 'corrige' | 'corrigeDate' | 'corrigeHeure'>;
  /** Remontée du patch au parent (mise à jour optimiste) */
  onChanged: (patch: CorrigePatch) => void;
  /** Affiche la checkbox dans un layout compact (optionnel) */
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────
// FORMATAGE AFFICHAGE LISIBLE
// ─────────────────────────────────────────────────────────────

/**
 * Formate "YYYY-MM-DD" en "JJ/MM/YYYY" pour l'affichage FR.
 * Retourne chaîne vide si entrée invalide.
 */
function formatDateFr(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

const CorrigeTravailCell: React.FC<CorrigeTravailCellProps> = ({
  travail,
  onChanged,
  compact = false,
}) => {
  // Mode édition local (n'impacte pas le parent tant qu'on ne valide pas)
  const [enEdition, setEnEdition] = useState(false);
  // Valeurs tampon pendant l'édition
  const [dateTmp, setDateTmp] = useState<string>(travail.corrigeDate ?? '');
  const [heureTmp, setHeureTmp] = useState<string>(travail.corrigeHeure ?? '');
  // Indicateur de sauvegarde en cours (désactive les contrôles)
  const [enCours, setEnCours] = useState(false);

  // ── Bascule "Corrigé" ────────────────────────────────────────
  const handleToggle = async () => {
    if (enCours) return;
    const nouveauCorrige = !travail.corrige;
    setEnCours(true);
    try {
      // Le service auto-remplit la date/heure côté Firestore ET
      // nous les renvoie pour qu'on synchronise le state parent.
      const res = await toggleCorrigeTravail(travail.id, nouveauCorrige);
      onChanged({
        id: travail.id,
        corrige: res.corrige,
        corrigeDate: res.corrigeDate,
        corrigeHeure: res.corrigeHeure,
      });
      // Alimente le formulaire tampon pour qu'une édition juste après
      // parte des valeurs fraîches auto-générées.
      if (res.corrige) {
        setDateTmp(res.corrigeDate);
        setHeureTmp(res.corrigeHeure);
      }
    } catch {
      /* échec silencieux — cohérent avec le comportement existant */
    } finally {
      setEnCours(false);
    }
  };

  // ── Entrer en édition ────────────────────────────────────────
  const handleOuvrirEdition = () => {
    // Si pas de valeurs enregistrées, on initialise avec "maintenant".
    const defaut = maintenantDateHeure();
    setDateTmp(travail.corrigeDate || defaut.date);
    setHeureTmp(travail.corrigeHeure || defaut.heure);
    setEnEdition(true);
  };

  const handleAnnulerEdition = () => {
    setEnEdition(false);
    setDateTmp(travail.corrigeDate ?? '');
    setHeureTmp(travail.corrigeHeure ?? '');
  };

  // ── Sauvegarder l'édition manuelle ──────────────────────────
  const handleEnregistrerEdition = async () => {
    if (enCours) return;
    // Validation minimale : date obligatoire au format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTmp)) {
      return;
    }
    // Heure optionnelle — si vide, on force à "00:00" pour rester lisible
    const heureSafe = /^\d{2}:\d{2}$/.test(heureTmp) ? heureTmp : '00:00';
    setEnCours(true);
    try {
      await modifierTravailAFaire(travail.id, {
        corrige: true,
        corrigeDate: dateTmp,
        corrigeHeure: heureSafe,
      });
      onChanged({
        id: travail.id,
        corrige: true,
        corrigeDate: dateTmp,
        corrigeHeure: heureSafe,
      });
      setEnEdition(false);
    } catch {
      /* échec silencieux */
    } finally {
      setEnCours(false);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────
  return (
    <div className={`corrige-cell${compact ? ' corrige-cell--compact' : ''}`}>
      {/* Checkbox principale — toujours visible */}
      <label className="corrige-cell__checkbox-wrap" title={travail.corrige ? 'Marquer comme non corrigé' : 'Marquer comme fait & corrigé'}>
        <input
          type="checkbox"
          checked={!!travail.corrige}
          onChange={handleToggle}
          disabled={enCours}
          className="corrige-cell__checkbox"
          aria-label="Basculer le statut corrigé"
        />
      </label>

      {/* Zone droite : soit étiquette lisible, soit inputs en édition */}
      {travail.corrige && !enEdition && (
        <span className="corrige-cell__etiquette">
          ✅ Fait &amp; corrigé
          {travail.corrigeDate && (
            <>
              {' '}le <strong>{formatDateFr(travail.corrigeDate)}</strong>
              {travail.corrigeHeure ? (
                <> à <strong>{travail.corrigeHeure}</strong></>
              ) : null}
            </>
          )}
          {/* Bouton discret pour éditer la date/heure */}
          <button
            type="button"
            className="corrige-cell__btn-edit"
            onClick={handleOuvrirEdition}
            title="Corriger la date ou l'heure de correction"
            aria-label="Éditer la date et l'heure de correction"
          >
            ✏️
          </button>
        </span>
      )}

      {/* Mode édition : 2 inputs + actions */}
      {enEdition && (
        <div className="corrige-cell__editor" role="group" aria-label="Édition date et heure de correction">
          <input
            type="date"
            value={dateTmp}
            onChange={(e) => setDateTmp(e.target.value)}
            className="corrige-cell__input"
            disabled={enCours}
            aria-label="Date de correction"
          />
          <input
            type="time"
            value={heureTmp}
            onChange={(e) => setHeureTmp(e.target.value)}
            className="corrige-cell__input"
            disabled={enCours}
            aria-label="Heure de correction"
          />
          <button
            type="button"
            className="corrige-cell__btn-ok"
            onClick={handleEnregistrerEdition}
            disabled={enCours}
            title="Enregistrer la date et l'heure"
          >
            {enCours ? '⏳' : '✓'}
          </button>
          <button
            type="button"
            className="corrige-cell__btn-cancel"
            onClick={handleAnnulerEdition}
            disabled={enCours}
            title="Annuler"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default CorrigeTravailCell;
