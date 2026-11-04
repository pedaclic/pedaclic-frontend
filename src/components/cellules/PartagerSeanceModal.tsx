// ============================================================
// PedaClic — Phase 49 : partager une de MES séances avec la cellule
// ------------------------------------------------------------
// 1. choix du cahier → 2. choix de la séance → 3. partage.
// La copie publiée ne contient NI notes privées NI pièces jointes.
// ============================================================

import React, { useEffect, useState } from 'react';
import { texteErreur } from '../../utils/messageErreurFirestore';
import type { CahierTextes, EntreeCahier } from '../../types/cahierTextes.types';
import { TYPE_CONTENU_CONFIG } from '../../types/cahierTextes.types';
import { getEntreesCahier } from '../../services/cahierTextesService';
import { libelleClasse } from '../../utils/organisateurCahiers';

interface PartagerSeanceModalProps {
  cahiers: CahierTextes[];
  onValider: (entree: EntreeCahier, cahier: CahierTextes) => Promise<void>;
  onClose: () => void;
}

const PartagerSeanceModal: React.FC<PartagerSeanceModalProps> = ({ cahiers, onValider, onClose }) => {
  const [cahierId, setCahierId] = useState(cahiers[0]?.id ?? '');
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [entreeId, setEntreeId] = useState('');
  const [chargement, setChargement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const cahier = cahiers.find(c => c.id === cahierId);

  // Charge les séances du cahier choisi (les plus récentes d'abord)
  useEffect(() => {
    if (!cahier) { setEntrees([]); return; }
    let actif = true;
    setChargement(true);
    setEntreeId('');
    getEntreesCahier(cahier.id, cahier.profId)
      .then(liste => {
        if (!actif) return;
        setEntrees([...liste].sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0)));
      })
      .catch(() => { if (actif) setEntrees([]); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [cahierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const valider = async () => {
    const entree = entrees.find(e => e.id === entreeId);
    if (!entree || !cahier) return;
    setSaving(true);
    setErreur('');
    try { await onValider(entree, cahier); }
    catch (err) { setErreur(texteErreur(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay cel-overlay" onClick={onClose}>
      <div className="modal-content cel-modal-large" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-partage-titre">
        <h2 className="modal-title" id="cel-partage-titre">📤 Partager une séance</h2>
        <p className="cel-aide">
          Une copie est publiée dans la bibliothèque de la cellule. Vos notes privées et
          vos pièces jointes ne sont pas partagées ; votre cahier n'est pas modifié.
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="cel-partage-cahier">Cahier</label>
          <select id="cel-partage-cahier" className="form-select" value={cahierId} onChange={e => setCahierId(e.target.value)}>
            {cahiers.map(c => <option key={c.id} value={c.id}>{c.titre} — {libelleClasse(c)}</option>)}
          </select>
        </div>

        {chargement ? (
          <p className="cel-aide">Chargement des séances…</p>
        ) : entrees.length === 0 ? (
          <p className="cel-aide">Aucune séance dans ce cahier.</p>
        ) : (
          <ul className="cel-choix-liste" role="radiogroup" aria-label="Séances">
            {entrees.map(e => {
              const type = TYPE_CONTENU_CONFIG[e.typeContenu];
              return (
                <li key={e.id}>
                  <label className={entreeId === e.id ? 'actif' : ''}>
                    <input type="radio" name="cel-seance" checked={entreeId === e.id} onChange={() => setEntreeId(e.id)} />
                    <span aria-hidden="true">{type?.emoji ?? '📘'}</span>
                    <span className="cel-choix-titre">{e.chapitre || 'Séance sans titre'}</span>
                    <span className="cel-choix-meta">
                      {e.date?.toDate?.().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) ?? ''}
                      {type ? ` · ${type.label}` : ''}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary" onClick={valider} disabled={saving || !entreeId}>
            {saving ? 'Partage…' : 'Partager avec la cellule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartagerSeanceModal;
