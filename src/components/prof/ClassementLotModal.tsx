// ============================================================
// PedaClic — Phase 46 : Classement des cahiers EN LOT
// ------------------------------------------------------------
// Rattrapage des cahiers créés avant l'organisateur : on coche
// plusieurs cahiers, on choisit un établissement, on applique
// (writeBatch). Les cahiers non classés sont précochés.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { classerCahiersEnLot } from '../../services/etablissementsService';
import type { CahierTextes } from '../../types/cahierTextes.types';
import type { EtablissementProf } from '../../types/etablissement.types';
import { libelleClasse } from '../../utils/organisateurCahiers';

interface ClassementLotModalProps {
  cahiers: CahierTextes[];
  etablissements: EtablissementProf[];   // actifs uniquement
  onClose: () => void;
  onGererEtablissements: () => void;
}

const ClassementLotModal: React.FC<ClassementLotModalProps> = ({
  cahiers, etablissements, onClose, onGererEtablissements,
}) => {
  const { toast } = useToast();
  const idsConnus = useMemo(() => new Set(etablissements.map(e => e.id)), [etablissements]);
  const estNonClasse = (c: CahierTextes) => !c.etablissementId || !idsConnus.has(c.etablissementId);

  const [afficherTous, setAfficherTous] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(cahiers.filter(estNonClasse).map(c => c.id))
  );
  const [cible, setCible] = useState<string>(etablissements[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const visibles = afficherTous ? cahiers : cahiers.filter(estNonClasse);

  const basculer = (id: string) => setSelection(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const toutCocher = (oui: boolean) =>
    setSelection(oui ? new Set(visibles.map(c => c.id)) : new Set());

  const appliquer = async () => {
    // Seuls les cahiers visibles ET cochés sont traités
    const ids = visibles.filter(c => selection.has(c.id)).map(c => c.id);
    if (!ids.length) return;
    const etab = cible ? etablissements.find(e => e.id === cible) ?? null : null;
    setSaving(true);
    try {
      await classerCahiersEnLot(ids, etab ? { id: etab.id, nom: etab.nom } : null);
      toast.success(etab
        ? `${ids.length} cahier(s) rattaché(s) à ${etab.nom}.`
        : `${ids.length} cahier(s) déclassé(s).`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Classement impossible. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  };

  const nbCoches = visibles.filter(c => selection.has(c.id)).length;

  return (
    <div className="modal-overlay org-modal-superpose" onClick={onClose}>
      <div className="modal-content org-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="org-lot-titre">
        <h2 className="modal-title" id="org-lot-titre">🗂️ Classer mes cahiers</h2>

        {etablissements.length === 0 ? (
          /* Aucun établissement : on oriente d'abord vers le carnet */
          <>
            <p className="org-aide">Ajoutez d'abord au moins un établissement.</p>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
              <button type="button" className="btn-primary" onClick={onGererEtablissements}>🏫 Ajouter un établissement</button>
            </div>
          </>
        ) : (
          <>
            {/* ── Choix de la destination ── */}
            <div className="form-group">
              <label className="form-label" htmlFor="org-lot-cible">Rattacher à</label>
              <select id="org-lot-cible" className="form-select" value={cible} onChange={e => setCible(e.target.value)}>
                {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                <option value="">— Aucun (déclasser) —</option>
              </select>
            </div>

            {/* ── Outils de sélection ── */}
            <div className="org-lot-outils">
              <label className="toggle-partage">
                <input type="checkbox" checked={afficherTous} onChange={e => setAfficherTous(e.target.checked)} />
                <span>Afficher aussi les cahiers déjà classés</span>
              </label>
              <span className="org-lot-liens">
                <button type="button" onClick={() => toutCocher(true)}>Tout cocher</button>
                {' · '}
                <button type="button" onClick={() => toutCocher(false)}>Tout décocher</button>
              </span>
            </div>

            {/* ── Liste à cocher ── */}
            {visibles.length === 0 ? (
              <p className="org-aide">✅ Tous les cahiers de cette année sont classés.</p>
            ) : (
              <ul className="org-lot-liste">
                {visibles.map(c => (
                  <li key={c.id}>
                    <label>
                      <input type="checkbox" checked={selection.has(c.id)} onChange={() => basculer(c.id)} />
                      <span className="org-etab-pastille" style={{ background: c.couleur }} aria-hidden="true" />
                      <span className="org-lot-titre">{c.titre}</span>
                      <span className="org-lot-meta">
                        {libelleClasse(c)} · {c.matiere}
                        {c.etablissementNom ? ` · ${c.etablissementNom}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
              <button type="button" className="btn-primary" onClick={appliquer} disabled={saving || nbCoches === 0}>
                {saving ? 'Classement…' : `Appliquer à ${nbCoches} cahier(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassementLotModal;
