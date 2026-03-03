/**
 * Gestionnaire de feuilles de notes — PedaClic
 * Liste des feuilles par groupe, création, navigation vers l'éditeur
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getFeuillesByGroupe,
  creerFeuilleDeNotes,
  supprimerFeuille,
} from '../../services/feuillesNotesService';
import type { FeuilleDeNotes, PeriodeType } from '../../types/feuillesNotes.types';
import { PERIODE_LABELS } from '../../types/feuillesNotes.types';
import type { GroupeProf } from '../../types/prof';
import '../../styles/prof.css';

interface FeuillesNotesManagerProps {
  groupe: GroupeProf;
  currentUser: { uid: string; displayName?: string };
}

/** Génère les dates pour une période */
function getPeriodeDates(type: PeriodeType, annee: number, index: number): { debut: Date; fin: Date; label: string } {
  const debut = new Date(annee, 8, 1); // 1er sept
  if (type === 'mensuelle') {
    debut.setMonth(8 + index);
    const fin = new Date(debut);
    fin.setMonth(fin.getMonth() + 1);
    fin.setDate(0);
    const mois = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][debut.getMonth() + 1];
    return { debut, fin, label: `${mois} ${debut.getFullYear()}` };
  }
  if (type === 'trimestrielle') {
    const trim = index + 1;
    debut.setMonth(8 + (trim - 1) * 3);
    const fin = new Date(debut);
    fin.setMonth(fin.getMonth() + 3);
    fin.setDate(0);
    return { debut, fin, label: `${trim}er trimestre` };
  }
  // semestrielle
  debut.setMonth(8 + index * 6);
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + 6);
  fin.setDate(0);
  return { debut, fin, label: `${index + 1}er semestre` };
}

const FeuillesNotesManager: React.FC<FeuillesNotesManagerProps> = ({ groupe, currentUser }) => {
  const navigate = useNavigate();
  const [feuilles, setFeuilles] = useState<FeuilleDeNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPeriodeType, setNewPeriodeType] = useState<PeriodeType>('trimestrielle');
  const [newPeriodeIndex, setNewPeriodeIndex] = useState(0);

  useEffect(() => {
    getFeuillesByGroupe(groupe.id).then(setFeuilles).catch(console.error).finally(() => setLoading(false));
  }, [groupe.id]);

  const handleCreate = async () => {
    if (!currentUser?.uid) return;
    setCreating(true);
    try {
      const annee = parseInt(groupe.anneeScolaire.split('-')[0], 10);
      const { debut, fin, label } = getPeriodeDates(newPeriodeType, annee, newPeriodeIndex);
      const f = await creerFeuilleDeNotes(
        groupe.id,
        groupe.nom,
        groupe.matiereId,
        groupe.matiereNom,
        currentUser.uid,
        currentUser.displayName || 'Professeur',
        groupe.anneeScolaire,
        newPeriodeType,
        label,
        debut,
        fin
      );
      setShowCreate(false);
      setFeuilles((prev) => [f, ...prev]);
      navigate(`/prof/feuilles/${f.id}`);
    } catch (err: any) {
      alert(err?.message || 'Erreur création');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette feuille de notes ?')) return;
    try {
      await supprimerFeuille(id);
      setFeuilles((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Erreur suppression');
    }
  };

  const periodeOptions =
    newPeriodeType === 'mensuelle'
      ? Array.from({ length: 10 }, (_, i) => ({ i, label: getPeriodeDates('mensuelle', parseInt(groupe.anneeScolaire.split('-')[0], 10), i).label }))
      : newPeriodeType === 'trimestrielle'
        ? [
            { i: 0, label: '1er trimestre' },
            { i: 1, label: '2e trimestre' },
            { i: 2, label: '3e trimestre' },
          ]
        : [
            { i: 0, label: '1er semestre' },
            { i: 1, label: '2e semestre' },
          ];

  return (
    <div className="feuilles-notes-manager">
      <div className="feuilles-notes-header">
        <h3 className="feuilles-notes-titre">
          <FileSpreadsheet size={22} /> Feuilles de notes
        </h3>
        <button
          className="prof-btn prof-btn-primary"
          onClick={() => setShowCreate(!showCreate)}
          disabled={creating}
        >
          <Plus size={18} /> Nouvelle feuille
        </button>
      </div>

      {showCreate && (
        <div className="feuilles-notes-create-card">
          <h4>Créer une feuille</h4>
          <div className="feuilles-notes-create-form">
            <div className="form-group">
              <label>Période</label>
              <select
                className="prof-select"
                value={newPeriodeType}
                onChange={(e) => setNewPeriodeType(e.target.value as PeriodeType)}
              >
                {(['mensuelle', 'trimestrielle', 'semestrielle'] as PeriodeType[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIODE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Période</label>
              <select
                className="prof-select"
                value={newPeriodeIndex}
                onChange={(e) => setNewPeriodeIndex(Number(e.target.value))}
              >
                {periodeOptions.map((opt) => (
                  <option key={opt.i} value={opt.i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="feuilles-notes-create-actions">
              <button className="prof-btn prof-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Création...' : 'Créer'}
              </button>
              <button className="prof-btn prof-btn-secondary" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement...</p>
      ) : feuilles.length === 0 ? (
        <div className="prof-empty-state">
          <FileSpreadsheet size={48} style={{ opacity: 0.5 }} />
          <p>Aucune feuille de notes. Créez-en une pour suivre les notes de la classe.</p>
        </div>
      ) : (
        <div className="feuilles-notes-list">
          {feuilles.map((f) => (
            <div key={f.id} className="feuilles-notes-card">
              <div className="feuilles-notes-card-body">
                <strong>{f.periodeLabel}</strong>
                <span className="feuilles-notes-meta">
                  {f.matiereNom} • {f.anneeScolaire}
                </span>
              </div>
              <div className="feuilles-notes-card-actions">
                <button
                  className="prof-btn prof-btn-primary prof-btn-sm"
                  onClick={() => navigate(`/prof/feuilles/${f.id}`)}
                >
                  <Pencil size={14} /> Modifier
                </button>
                <button
                  className="prof-btn prof-btn-danger prof-btn-sm"
                  onClick={() => handleDelete(f.id)}
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeuillesNotesManager;
