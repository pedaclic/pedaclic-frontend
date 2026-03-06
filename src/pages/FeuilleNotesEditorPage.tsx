/**
 * Éditeur de feuille de notes — PedaClic
 * Tableau éditable, export Excel/PDF/Word
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import {
  getFeuilleById,
  updateNoteBulk,
  updateEvaluationsFeuille,
  buildLignesNotes,
} from '../services/feuillesNotesService';
import { getElevesGroupe } from '../services/profGroupeService';
import { exportFeuilleExcel, exportFeuillePDF, exportFeuilleWord } from '../utils/feuillesNotesExport';
import type { FeuilleDeNotes, LigneNotes } from '../types/feuillesNotes.types';
import { useAuth } from '../hooks/useAuth';
import '../styles/prof.css';
import '../styles/feuillesNotes.css';

const FeuilleNotesEditorPage: React.FC = () => {
  const { feuilleId } = useParams<{ feuilleId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [feuille, setFeuille] = useState<FeuilleDeNotes | null>(null);
  const [lignes, setLignes] = useState<LigneNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editCell, setEditCell] = useState<{ eleveId: string; evalId: string } | null>(null);
  const [draftNote, setDraftNote] = useState<string>('');

  const load = useCallback(async () => {
    if (!feuilleId) return;
    setLoading(true);
    setError(null);
    try {
      const f = await getFeuilleById(feuilleId);
      if (!f) {
        setError('Feuille introuvable');
        return;
      }
      const inscriptions = await getElevesGroupe(f.groupeId);
      setFeuille(f);
      setLignes(
        buildLignesNotes(
          f,
          inscriptions.map((i) => ({ eleveId: i.eleveId, eleveNom: i.eleveNom, eleveEmail: i.eleveEmail }))
        )
      );
    } catch (err: any) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [feuilleId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNoteChange = (eleveId: string, evalId: string, value: string) => {
    const num = value === '' ? null : parseFloat(value.replace(',', '.'));
    if (num !== null && (num < 0 || num > 20 || isNaN(num))) return;
    setLignes((prev) =>
      prev.map((l) =>
        l.eleveId === eleveId
          ? { ...l, notes: { ...l.notes, [evalId]: num ?? 0 } }
          : l
      )
    );
    // Debounced save
    if (feuilleId) {
      updateNoteBulk(feuilleId, [{ eleveId, evaluationId: evalId, note: num }]).catch(console.error);
    }
    setEditCell(null);
  };

  const getClasseMoyenne = (m: number) => {
    if (m >= 16) return 'prof-note-excellent';
    if (m >= 12) return 'prof-note-bien';
    if (m >= 10) return 'prof-note-passable';
    if (m >= 8) return 'prof-note-insuffisant';
    return 'prof-note-critique';
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    if (!feuille) return;
    const name = `Notes_${feuille.groupeNom.replace(/\s+/g, '_')}_${feuille.periodeLabel.replace(/\s+/g, '_')}`;
    try {
      if (format === 'excel') await exportFeuilleExcel(feuille, lignes, name);
      else if (format === 'pdf') await exportFeuillePDF(feuille, lignes, name);
      else exportFeuilleWord(feuille, lignes, name);
    } catch (err) {
      alert('Erreur export : ' + (err as Error)?.message);
    }
  };

  const ajouterEvaluation = () => {
    if (!feuille) return;
    const evals = [...(feuille.evaluations || [])];
    const id = 'e' + (evals.length + 1);
    evals.push({ id, libelle: `Évaluation ${evals.length + 1}`, coefficient: 1 });
    updateEvaluationsFeuille(feuille.id, evals).then(() => {
      setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    });
  };

  if (loading || !feuille) {
    return (
      <div className="feuille-editor-page">
        <div className="prof-loading">
          <div className="spinner" />
          <p>{loading ? 'Chargement...' : 'Feuille introuvable'}</p>
        </div>
      </div>
    );
  }

  const evals = feuille.evaluations || [];
  const moyenneClasse =
    lignes.length > 0
      ? lignes.reduce((s, l) => s + l.moyenne, 0) / lignes.filter((l) => l.moyenne > 0).length || 0
      : 0;

  return (
    <div className="feuille-editor-page">
      <header className="feuille-editor-header">
        <button className="prof-btn prof-btn-secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="feuille-editor-titre">
          <h1>Feuille de notes — {feuille.groupeNom}</h1>
          <p>{feuille.matiereNom} • {feuille.periodeLabel} • {feuille.anneeScolaire}</p>
        </div>
        <div className="feuille-editor-export">
          <button className="prof-btn prof-btn-secondary" onClick={() => handleExport('excel')} title="Excel">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button className="prof-btn prof-btn-secondary" onClick={() => handleExport('pdf')} title="PDF">
            <FileText size={18} /> PDF
          </button>
          <button className="prof-btn prof-btn-secondary" onClick={() => handleExport('word')} title="Word">
            <File size={18} /> Word
          </button>
        </div>
      </header>

      {error && (
        <div className="prof-alert prof-alert-error">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="feuille-editor-toolbar">
        <button className="prof-btn prof-btn-primary prof-btn-sm" onClick={ajouterEvaluation}>
          + Ajouter une évaluation
        </button>
      </div>

      <div className="feuille-editor-table-wrapper">
        <table className="feuille-editor-table">
          <thead>
            <tr>
              <th className="col-eleve">Élève</th>
              {evals.map((e) => (
                <th key={e.id} className="col-note">
                  {e.libelle}
                  {e.coefficient && e.coefficient !== 1 && (
                    <span className="coef"> (coef. {e.coefficient})</span>
                  )}
                </th>
              ))}
              <th className="col-moyenne">Moyenne</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.eleveId}>
                <td className="col-eleve">
                  <strong>{ligne.eleveNom}</strong>
                </td>
                {evals.map((e) => {
                  const isEdit = editCell?.eleveId === ligne.eleveId && editCell?.evalId === e.id;
                  const val = ligne.notes[e.id];
                  return (
                    <td key={e.id} className="col-note">
                      {isEdit ? (
                        <input
                          type="text"
                          className="note-input"
                          autoFocus
                          value={draftNote}
                          onChange={(ev) => setDraftNote(ev.target.value)}
                          onBlur={() => handleNoteChange(ligne.eleveId, e.id, draftNote)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') handleNoteChange(ligne.eleveId, e.id, draftNote);
                          }}
                        />
                      ) : (
                        <span
                          className="note-cell"
                          onClick={() => {
                            setEditCell({ eleveId: ligne.eleveId, evalId: e.id });
                            setDraftNote(val != null ? String(val) : '');
                          }}
                        >
                          {val != null ? val : '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={`col-moyenne ${getClasseMoyenne(ligne.moyenne)}`}>
                  {ligne.moyenne > 0 ? ligne.moyenne.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
            <tr className="feuille-moyenne-classe">
              <td className="col-eleve">
                <strong>Moyenne classe</strong>
              </td>
              {evals.map((e) => (
                <td key={e.id} className="col-note" />
              ))}
              <td className={`col-moyenne ${getClasseMoyenne(moyenneClasse)}`}>
                {moyenneClasse > 0 ? moyenneClasse.toFixed(2) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeuilleNotesEditorPage;
