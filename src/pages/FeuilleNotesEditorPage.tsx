/**
 * Éditeur de feuille de notes — PedaClic
 * Tableau éditable, export Excel/PDF/Word
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, FileText, File, GripVertical, Trash2, Pencil, Check, X, Plus, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getFeuilleById,
  updateNoteBulk,
  updateEvaluationsFeuille,
  updateCompetencesDefFeuille,
  updateCompetenceEleve,
  buildLignesNotes,
} from '../services/feuillesNotesService';
import { getElevesGroupe } from '../services/profGroupeService';
import { exportFeuilleExcel, exportFeuillePDF, exportFeuilleWord } from '../utils/feuillesNotesExport';
import type { FeuilleDeNotes, LigneNotes, CompetenceDef, CompetenceStatus } from '../types/feuillesNotes.types';
import { COMPETENCES_PAR_DEFAUT, COMPETENCE_STATUS_LABELS, COMPETENCE_STATUS_COLORS } from '../types/feuillesNotes.types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import '../styles/prof.css';
import '../styles/feuillesNotes.css';

const FeuilleNotesEditorPage: React.FC = () => {
  const { feuilleId } = useParams<{ feuilleId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [feuille, setFeuille] = useState<FeuilleDeNotes | null>(null);
  const [lignes, setLignes] = useState<LigneNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editCell, setEditCell] = useState<{ eleveId: string; evalId: string } | null>(null);
  const [draftNote, setDraftNote] = useState<string>('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editEvalId, setEditEvalId] = useState<string | null>(null);
  const [draftLibelle, setDraftLibelle] = useState<string>('');
  const [showCompPanel, setShowCompPanel] = useState(false);
  const [newCompLib, setNewCompLib] = useState('');

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
      toast.error('Erreur export : ' + (err as Error)?.message);
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

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx || !feuille) { setDragIdx(null); setOverIdx(null); return; }
    const evals = [...(feuille.evaluations || [])];
    const [moved] = evals.splice(dragIdx, 1);
    evals.splice(idx, 0, moved);
    setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    updateEvaluationsFeuille(feuille.id, evals).catch(console.error);
    setDragIdx(null);
    setOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  const renommerEval = (evalId: string) => {
    if (!feuille || !draftLibelle.trim()) { setEditEvalId(null); return; }
    const evals = feuille.evaluations.map((e) => e.id === evalId ? { ...e, libelle: draftLibelle.trim() } : e);
    setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    updateEvaluationsFeuille(feuille.id, evals).catch(console.error);
    setEditEvalId(null);
  };

  const supprimerEval = (evalId: string) => {
    if (!feuille) return;
    const evals = feuille.evaluations.filter((e) => e.id !== evalId);
    setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    updateEvaluationsFeuille(feuille.id, evals).catch(console.error);
  };

  // ── Compétences ──
  const compDefs: CompetenceDef[] = feuille?.competencesDef ?? [];

  const initCompDefaults = () => {
    if (!feuille) return;
    const defs = COMPETENCES_PAR_DEFAUT;
    setFeuille((f) => (f ? { ...f, competencesDef: defs } : null));
    updateCompetencesDefFeuille(feuille.id, defs).catch(console.error);
    toast.success('Compétences par défaut ajoutées');
  };

  const ajouterComp = () => {
    if (!feuille || !newCompLib.trim()) return;
    const id = 'comp_' + Date.now();
    const defs = [...compDefs, { id, libelle: newCompLib.trim() }];
    setFeuille((f) => (f ? { ...f, competencesDef: defs } : null));
    updateCompetencesDefFeuille(feuille.id, defs).catch(console.error);
    setNewCompLib('');
  };

  const supprimerComp = (compId: string) => {
    if (!feuille) return;
    const defs = compDefs.filter((c) => c.id !== compId);
    setFeuille((f) => (f ? { ...f, competencesDef: defs } : null));
    updateCompetencesDefFeuille(feuille.id, defs).catch(console.error);
  };

  const cycleCompStatus = (eleveId: string, evalId: string, compId: string) => {
    if (!feuille || !feuilleId) return;
    const current = feuille.competences?.[eleveId]?.[evalId]?.[compId];
    const order: CompetenceStatus[] = ['non_acquis', 'en_cours', 'acquis'];
    const next = order[(order.indexOf(current || 'non_acquis') + 1) % 3];
    const updated = JSON.parse(JSON.stringify(feuille.competences || {}));
    if (!updated[eleveId]) updated[eleveId] = {};
    if (!updated[eleveId][evalId]) updated[eleveId][evalId] = {};
    updated[eleveId][evalId][compId] = next;
    setFeuille((f) => (f ? { ...f, competences: updated } : null));
    updateCompetenceEleve(feuilleId, eleveId, evalId, compId, next).catch(console.error);
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
          <Plus size={14} /> Ajouter une évaluation
        </button>
        <button
          className={`prof-btn prof-btn-sm ${showCompPanel ? 'prof-btn-primary' : 'prof-btn-secondary'}`}
          onClick={() => setShowCompPanel((v) => !v)}
          style={{ marginLeft: 8 }}
        >
          <BookOpen size={14} /> Compétences {showCompPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showCompPanel && (
        <div className="comp-panel">
          <div className="comp-panel-header">
            <h3>Compétences évaluées</h3>
            {compDefs.length === 0 && (
              <button className="prof-btn prof-btn-secondary prof-btn-sm" onClick={initCompDefaults}>
                Charger les compétences par défaut
              </button>
            )}
          </div>
          <div className="comp-list">
            {compDefs.map((c) => (
              <span key={c.id} className="comp-tag">
                {c.libelle}
                <button className="comp-tag-remove" onClick={() => supprimerComp(c.id)}><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="comp-add">
            <input
              type="text" placeholder="Nouvelle compétence…" className="comp-add-input"
              value={newCompLib} onChange={(e) => setNewCompLib(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ajouterComp(); }}
            />
            <button className="prof-btn prof-btn-primary prof-btn-sm" onClick={ajouterComp} disabled={!newCompLib.trim()}>Ajouter</button>
          </div>
        </div>
      )}

      <div className="feuille-editor-table-wrapper">
        <table className="feuille-editor-table">
          <thead>
            <tr>
              <th className="col-eleve">Élève</th>
              {evals.map((e, idx) => (
                <th
                  key={e.id}
                  className={`col-note${overIdx === idx ? ' eval-drag-over' : ''}${dragIdx === idx ? ' eval-dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(ev) => handleDragOver(ev, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="eval-header">
                    <span className="eval-grip" title="Glisser pour réordonner"><GripVertical size={14} /></span>
                    {editEvalId === e.id ? (
                      <span className="eval-rename">
                        <input
                          type="text" className="eval-rename-input" autoFocus
                          value={draftLibelle}
                          onChange={(ev) => setDraftLibelle(ev.target.value)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') renommerEval(e.id); if (ev.key === 'Escape') setEditEvalId(null); }}
                        />
                        <button className="eval-action-btn eval-ok" onClick={() => renommerEval(e.id)}><Check size={12} /></button>
                        <button className="eval-action-btn eval-cancel" onClick={() => setEditEvalId(null)}><X size={12} /></button>
                      </span>
                    ) : (
                      <span className="eval-label">
                        {e.libelle}
                        {e.coefficient && e.coefficient !== 1 && (
                          <span className="coef"> (coef. {e.coefficient})</span>
                        )}
                      </span>
                    )}
                    {editEvalId !== e.id && (
                      <span className="eval-actions">
                        <button className="eval-action-btn" title="Renommer" onClick={() => { setEditEvalId(e.id); setDraftLibelle(e.libelle); }}><Pencil size={12} /></button>
                        {evals.length > 1 && (
                          <button className="eval-action-btn eval-delete" title="Supprimer" onClick={() => supprimerEval(e.id)}><Trash2 size={12} /></button>
                        )}
                      </span>
                    )}
                  </div>
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
                      {compDefs.length > 0 && (
                        <div className="comp-cell-list">
                          {compDefs.map((c) => {
                            const st = feuille.competences?.[ligne.eleveId]?.[e.id]?.[c.id] || 'non_acquis';
                            return (
                              <button
                                key={c.id}
                                className="comp-dot"
                                title={`${c.libelle} : ${COMPETENCE_STATUS_LABELS[st]}`}
                                style={{ background: COMPETENCE_STATUS_COLORS[st] }}
                                onClick={() => cycleCompStatus(ligne.eleveId, e.id, c.id)}
                              >
                                {c.libelle.charAt(0)}
                              </button>
                            );
                          })}
                        </div>
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
