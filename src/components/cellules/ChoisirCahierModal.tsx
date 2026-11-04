// ============================================================
// PedaClic — Phase 49 : choix d'un de MES cahiers (fenêtre modale)
// ------------------------------------------------------------
// Réutilisée pour : importer une progression, dupliquer une séance,
// publier mon avancement. Les cahiers de la classe concernée sont
// proposés en premier.
// ============================================================

import React, { useState } from 'react';
import { texteErreur } from '../../utils/messageErreurFirestore';
import type { CahierTextes } from '../../types/cahierTextes.types';
import { libelleClasse } from '../../utils/organisateurCahiers';

interface ChoisirCahierModalProps {
  titre: string;
  explication: string;
  libelleValider: string;
  cahiers: CahierTextes[];
  /** Classe à proposer en priorité (ex. classe de la progression) */
  classePreferee?: string;
  onValider: (cahier: CahierTextes) => Promise<void>;
  onClose: () => void;
}

const ChoisirCahierModal: React.FC<ChoisirCahierModalProps> = ({
  titre, explication, libelleValider, cahiers, classePreferee, onValider, onClose,
}) => {
  // Tri : classe préférée d'abord, puis ordre alphabétique des titres
  const tries = [...cahiers].sort((a, b) =>
    Number(b.classe === classePreferee) - Number(a.classe === classePreferee) ||
    a.titre.localeCompare(b.titre, 'fr')
  );
  const [choix, setChoix] = useState<string>(tries[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async () => {
    const cahier = cahiers.find(c => c.id === choix);
    if (!cahier) return;
    setSaving(true);
    setErreur('');
    try { await onValider(cahier); }
    catch (err) { setErreur(texteErreur(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay cel-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-choix-titre">
        <h2 className="modal-title" id="cel-choix-titre">{titre}</h2>
        <p className="cel-aide">{explication}</p>

        {tries.length === 0 ? (
          <p className="cel-aide">Vous n'avez encore aucun cahier de textes actif.</p>
        ) : (
          <ul className="cel-choix-liste" role="radiogroup">
            {tries.map(c => (
              <li key={c.id}>
                <label className={choix === c.id ? 'actif' : ''}>
                  <input type="radio" name="cel-cahier" value={c.id}
                    checked={choix === c.id} onChange={() => setChoix(c.id)} />
                  <span className="cel-pastille" style={{ background: c.couleur }} aria-hidden="true" />
                  <span className="cel-choix-titre">{c.titre}</span>
                  <span className="cel-choix-meta">
                    {libelleClasse(c)} · {c.anneeScolaire}{c.etablissementNom ? ` · ${c.etablissementNom}` : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary" onClick={valider} disabled={saving || !choix}>
            {saving ? 'En cours…' : libelleValider}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChoisirCahierModal;
