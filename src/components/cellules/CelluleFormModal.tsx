// ============================================================
// PedaClic — Phase 49 : formulaire de création / modification
// d'une cellule pédagogique (fenêtre modale).
// ============================================================

import React, { useState } from 'react';
import { texteErreur } from '../../utils/messageErreurFirestore';
import { PORTEES_CELLULE, type CelluleFormData } from '../../types/cellule.types';
import { useDisciplinesOptions } from '../../hooks/useDisciplinesOptions';
import { useAnneesScolaires } from '../../hooks/useAnneesScolaires';
import { anneesPourSelect } from '../../types/anneesScolaires.types';

interface CelluleFormModalProps {
  titre: string;
  initial: CelluleFormData;
  libelleValider: string;
  onValider: (form: CelluleFormData) => Promise<void>;
  onClose: () => void;
}

const CelluleFormModal: React.FC<CelluleFormModalProps> = ({
  titre, initial, libelleValider, onValider, onClose,
}) => {
  const [form, setForm] = useState<CelluleFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const { matieres, loading } = useDisciplinesOptions();
  const { config, anneeCourante } = useAnneesScolaires();

  const maj = (p: Partial<CelluleFormData>) => setForm(f => ({ ...f, ...p }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.discipline) { setErreur('Nom et discipline sont requis.'); return; }
    setSaving(true);
    setErreur('');
    try { await onValider(form); }
    catch (err) { setErreur(texteErreur(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay cel-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-form-titre">
        <h2 className="modal-title" id="cel-form-titre">{titre}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cel-nom">Nom de la cellule *</label>
            <input id="cel-nom" className="form-input" required maxLength={100} autoFocus
              placeholder="Ex : Cellule de Français — Lycée Lamine Guèye"
              value={form.nom} onChange={e => maj({ nom: e.target.value })} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cel-discipline">Discipline *</label>
              <select id="cel-discipline" className="form-select" required disabled={loading}
                value={form.discipline} onChange={e => maj({ discipline: e.target.value })}>
                <option value="">{loading ? 'Chargement…' : '— Sélectionner —'}</option>
                {matieres.map(m => <option key={m.valeur} value={m.valeur}>{m.label}</option>)}
                {form.discipline && !matieres.some(m => m.valeur === form.discipline) && (
                  <option value={form.discipline}>{form.discipline}</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cel-annee">Année scolaire</label>
              <select id="cel-annee" className="form-select"
                value={form.anneeScolaire} onChange={e => maj({ anneeScolaire: e.target.value })}>
                {anneesPourSelect(config, anneeCourante, [form.anneeScolaire]).map(a => (
                  <option key={a} value={a}>{a}{a === anneeCourante ? ' (en cours)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cel-portee">Portée</label>
              <select id="cel-portee" className="form-select"
                value={form.portee} onChange={e => maj({ portee: e.target.value as CelluleFormData['portee'] })}>
                {PORTEES_CELLULE.map(p => <option key={p.valeur} value={p.valeur}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cel-etab">
                {form.portee === 'zone' ? 'Zone / localité' : 'Établissement'}
              </label>
              <input id="cel-etab" className="form-input" maxLength={100}
                placeholder={form.portee === 'zone' ? 'Ex : Dakar-Plateau' : 'Ex : Lycée Lamine Guèye'}
                value={form.etablissementNom} onChange={e => maj({ etablissementNom: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cel-ief">Inspection (IA / IEF)</label>
            <input id="cel-ief" className="form-input" maxLength={80} placeholder="Ex : IEF Dakar-Plateau"
              value={form.ief} onChange={e => maj({ ief: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cel-desc">Description (optionnel)</label>
            <textarea id="cel-desc" className="form-textarea" rows={2} maxLength={500}
              placeholder="Objectifs de la cellule, jour de réunion…"
              value={form.description} onChange={e => maj({ description: e.target.value })} />
          </div>

          {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : libelleValider}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CelluleFormModal;
