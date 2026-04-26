/**
 * Éditeur de feuille de notes — PedaClic
 * Tableau éditable, export Excel/PDF/Word
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, FileText, File, GripVertical, Trash2, Pencil, Check, X, Plus, BookOpen, ChevronDown, ChevronUp, Award, GraduationCap } from 'lucide-react';
import {
  getFeuilleById,
  updateNoteBulk,
  updateEvaluationsFeuille,
  updateCompetencesDefFeuille,
  updateCompetenceEleve,
  updateTitreFeuille,
  buildLignesNotes,
} from '../services/feuillesNotesService';
import { getElevesGroupe } from '../services/profGroupeService';
import { exportFeuilleExcel, exportFeuillePDF, exportFeuilleWord } from '../utils/feuillesNotesExport';
import type { FeuilleDeNotes, LigneNotes, CompetenceDef, CompetenceStatus, TypeEvaluation } from '../types/feuillesNotes.types';
import { COMPETENCES_PAR_DEFAUT, COMPETENCE_STATUS_LABELS, COMPETENCE_STATUS_COLORS, TYPE_EVAL_LABELS } from '../types/feuillesNotes.types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
// ✨ Formatage "Prénoms NOM" + tri alphabétique par nom de famille
import { formatEleveNom, compareParNomFamille } from '../utils/formatNom';
import '../styles/prof.css';
import '../styles/feuillesNotes.css';

const FeuilleNotesEditorPage: React.FC = () => {
  const { feuilleId } = useParams<{ feuilleId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // useLocation : pour récupérer un éventuel state {groupeId, fromTab}
  // posé par FeuillesNotesManager au moment de la navigation.
  const location = useLocation();
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
  // ✨ Édition inline du TITRE de la feuille (en haut de l'éditeur).
  //    `editTitre` ouvre/ferme le mode édition ; `draftTitre` porte la
  //    saisie en cours. Validation : Enter / clic ✓ ; annulation : Esc.
  const [editTitre, setEditTitre] = useState<boolean>(false);
  const [draftTitre, setDraftTitre] = useState<string>('');
  const [showCompPanel, setShowCompPanel] = useState(false);
  const [newCompLib, setNewCompLib] = useState('');
  // ── Navigation clavier dans la grille de notes ──
  //   On indexe chaque input note par (eleveId, evalId) pour pouvoir
  //   déplacer le focus via Enter / Tab / flèches sans perdre la
  //   sauvegarde automatique onBlur existante.
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cellKey = (eleveId: string, evalId: string) => `${eleveId}::${evalId}`;

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
      // Tri alphabétique par NOM de famille pour la feuille de notes
      // (cohérent avec l'appel : élèves listés dans le même ordre partout)
      const inscriptionsTriees = [...inscriptions].sort((a, b) =>
        compareParNomFamille(a.eleveNom, b.eleveNom),
      );
      setLignes(
        buildLignesNotes(
          f,
          inscriptionsTriees.map((i) => ({ eleveId: i.eleveId, eleveNom: i.eleveNom, eleveEmail: i.eleveEmail }))
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

  /**
   * Sauvegarde une note saisie (Firestore + état local).
   * `keepEdit` permet de conserver la cellule ouverte (utile lors d'une
   * navigation clavier où l'on enchaîne sur la cellule suivante).
   */
  const handleNoteChange = (eleveId: string, evalId: string, value: string, keepEdit = false) => {
    const num = value === '' ? null : parseFloat(value.replace(',', '.'));
    if (num !== null && (num < 0 || num > 20 || isNaN(num))) return;
    setLignes((prev) =>
      prev.map((l) =>
        l.eleveId === eleveId
          ? { ...l, notes: { ...l.notes, [evalId]: num ?? 0 } }
          : l,
      ),
    );
    // Sauvegarde immédiate (idempotente) — onBlur + onKeyDown appellent cette fonction
    if (feuilleId) {
      updateNoteBulk(feuilleId, [{ eleveId, evaluationId: evalId, note: num }]).catch(console.error);
    }
    if (!keepEdit) setEditCell(null);
  };

  /**
   * Déplace le focus depuis la cellule (eleveId, evalId) vers la cellule
   * voisine selon la direction demandée :
   *   - right / Tab / Enter : évaluation suivante sur la même ligne ;
   *     en fin de ligne, on descend sur la première évaluation de la ligne suivante.
   *   - left / Shift+Tab    : évaluation précédente (wrap inverse).
   *   - down                : même évaluation, élève suivant.
   *   - up                  : même évaluation, élève précédent.
   */
  const moveFocus = (
    eleveId: string,
    evalId: string,
    direction: 'right' | 'left' | 'down' | 'up',
  ) => {
    if (!feuille) return;
    const evaluationsList = feuille.evaluations || [];
    const colIdx = evaluationsList.findIndex((e) => e.id === evalId);
    const rowIdx = lignes.findIndex((l) => l.eleveId === eleveId);
    if (colIdx < 0 || rowIdx < 0) return;

    let nextRow = rowIdx;
    let nextCol = colIdx;

    if (direction === 'right') {
      nextCol = colIdx + 1;
      if (nextCol >= evaluationsList.length) { nextCol = 0; nextRow = rowIdx + 1; }
    } else if (direction === 'left') {
      nextCol = colIdx - 1;
      if (nextCol < 0) { nextCol = evaluationsList.length - 1; nextRow = rowIdx - 1; }
    } else if (direction === 'down') {
      nextRow = rowIdx + 1;
    } else if (direction === 'up') {
      nextRow = rowIdx - 1;
    }

    // Limites : ne sort pas de la grille
    if (nextRow < 0 || nextRow >= lignes.length) return;
    if (nextCol < 0 || nextCol >= evaluationsList.length) return;

    const nextLigne = lignes[nextRow];
    const nextEval = evaluationsList[nextCol];
    const val = nextLigne.notes[nextEval.id];

    // Ouvre la cellule suivante en édition. Le focus sera réappliqué par
    // l'effet ci-dessous dès que l'input sera monté par React.
    setEditCell({ eleveId: nextLigne.eleveId, evalId: nextEval.id });
    setDraftNote(val != null ? String(val) : '');
  };

  /**
   * Quand la cellule éditée change, on focalise/sélectionne automatiquement
   * le nouvel input (pour que la saisie clavier continue sans interruption).
   */
  useEffect(() => {
    if (!editCell) return;
    const key = cellKey(editCell.eleveId, editCell.evalId);
    // Après render, le ref de l'input ciblé est peuplé : on focus + select.
    const id = requestAnimationFrame(() => {
      const input = cellRefs.current[key];
      if (input) {
        input.focus();
        input.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [editCell]);

  const getClasseMoyenne = (m: number) => {
    if (m >= 16) return 'prof-note-excellent';
    if (m >= 12) return 'prof-note-bien';
    if (m >= 10) return 'prof-note-passable';
    if (m >= 8) return 'prof-note-insuffisant';
    return 'prof-note-critique';
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'word') => {
    if (!feuille) return;
    // ✨ Le nom de fichier inclut le titre (s'il existe) pour
    //    différencier deux exports d'une même période / discipline.
    //    Caractères incompatibles avec les FS retirés.
    const sanitize = (s: string) => s.replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/\s+/g, '_');
    const baseTitre = feuille.titre ? `${sanitize(feuille.titre)}_` : '';
    const name = `Notes_${baseTitre}${sanitize(feuille.groupeNom)}_${sanitize(feuille.periodeLabel)}`;
    try {
      if (format === 'excel') await exportFeuilleExcel(feuille, lignes, name);
      else if (format === 'pdf') await exportFeuillePDF(feuille, lignes, name);
      else exportFeuilleWord(feuille, lignes, name);
    } catch (err) {
      toast.error('Erreur export : ' + (err as Error)?.message);
    }
  };

  /**
   * Ajoute une évaluation en choisissant son type.
   * Par défaut « devoir » (cas le plus fréquent).
   *
   * ✨ Intitulé personnalisé :
   *   1. On propose un nom par défaut (« Devoir 3 », « Composition 1 », …)
   *      via window.prompt — l'utilisateur peut alors saisir un titre
   *      personnalisé (ex. « Évaluation grammaire — adjectif qualificatif »).
   *   2. Si le prompt est annulé, on retombe sur le nom par défaut.
   *   3. Après création, on entre AUSSI en mode renommage en ligne pour
   *      offrir un second point d'édition cohérent avec l'UI existante,
   *      utile si le prompt n'a pas été affiché (ex. user-agent restrictif).
   */
  const ajouterEvaluation = (type: TypeEvaluation = 'devoir') => {
    if (!feuille) return;
    const evals = [...(feuille.evaluations || [])];
    const id = 'e' + Date.now().toString(36);
    const nbDuType = evals.filter((e) => (e.type ?? 'devoir') === type).length + 1;
    const libelleDefaut = type === 'composition' ? `Composition ${nbDuType}` : `Devoir ${nbDuType}`;

    // Saisie du titre par l'enseignant (annulable). On garde la même
    // logique « titre par défaut » comme repli pour ne jamais bloquer
    // l'ajout d'évaluation.
    let libelle = libelleDefaut;
    try {
      const saisie = window.prompt(
        type === 'composition'
          ? "Intitulé de la composition (ex. « Composition 1er trimestre »)"
          : "Intitulé du devoir (ex. « Devoir surveillé n°2 — Conjugaison »)",
        libelleDefaut,
      );
      if (saisie !== null) {
        const trimmed = saisie.trim();
        if (trimmed.length > 0) libelle = trimmed;
      }
    } catch {
      // Environnements sans prompt() : on conserve le titre par défaut.
    }

    evals.push({ id, libelle, coefficient: 1, type });
    updateEvaluationsFeuille(feuille.id, evals).then(() => {
      setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
      // Active immédiatement le mode renommage en ligne sur la nouvelle
      // évaluation : l'utilisateur peut affiner le titre sans recliquer
      // sur l'icône crayon.
      setEditEvalId(id);
      setDraftLibelle(libelle);
    });
  };

  /**
   * Bascule le type d'une évaluation existante (devoir ⇄ composition).
   * Met à jour Firestore et l'état local ; les moyennes seront recalculées
   * au prochain rendu via buildLignesNotes (mais on relance load() pour
   * garantir un résultat cohérent côté lignes affichées).
   */
  const changerTypeEval = (evalId: string, nouveauType: TypeEvaluation) => {
    if (!feuille) return;
    const evals = feuille.evaluations.map((e) =>
      e.id === evalId ? { ...e, type: nouveauType } : e,
    );
    setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    updateEvaluationsFeuille(feuille.id, evals)
      .then(() => load())
      .catch(console.error);
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

  /**
   * Agrégations « moyenne classe » par catégorie.
   * On ignore les lignes à 0 pour ne pas diluer la moyenne avec des élèves
   * qui n'ont pas encore reçu de note dans la catégorie concernée.
   */
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const moyenneClasseDevoirs = avg(lignes.map((l) => l.moyenneDevoirs).filter((v) => v > 0));
  const moyenneClasseCompo = avg(lignes.map((l) => l.noteComposition).filter((v) => v > 0));
  const moyenneClasse = avg(lignes.map((l) => l.moyenneGenerale).filter((v) => v > 0));

  return (
    <div className="feuille-editor-page">
      <header className="feuille-editor-header">
        {/*
          ✨ Bouton Retour : doit ramener à l'onglet « Notes » du groupe
          d'origine (et NON au tableau de bord). On privilégie :
            1. Le state de navigation (groupeId + fromTab) si présent.
            2. À défaut, on utilise feuille.groupeId qui est toujours connu
               car la feuille est rattachée à un groupe.
          On passe l'info au ProfDashboard via location.state pour qu'il
          ouvre directement le détail du groupe sur le bon onglet.
        */}
        <button
          className="prof-btn prof-btn-secondary"
          onClick={() => {
            const fromState = (location.state ?? {}) as {
              groupeId?: string;
              fromTab?: string;
            };
            const groupeId = fromState.groupeId || feuille.groupeId;
            navigate('/prof/dashboard', {
              state: {
                openGroupeId: groupeId,
                openTab: fromState.fromTab || 'notes',
              },
            });
          }}
        >
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="feuille-editor-titre">
          {/*
            ✨ Titre éditable de la feuille.
            En mode lecture : on affiche `feuille.titre` en grand quand
            il existe (le `groupeNom` reste en sous-ligne pour le contexte).
            Sans titre, on conserve l'affichage historique
            « Feuille de notes — <Groupe> ».
            En mode édition : input + boutons ✓ / ✕. Vider + valider
            supprime le titre (retour à l'affichage historique).
          */}
          {editTitre ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="prof-select"
                autoFocus
                value={draftTitre}
                placeholder={`Feuille de notes — ${feuille.groupeNom}`}
                onChange={(e) => setDraftTitre(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const valeur = draftTitre.trim();
                    setEditTitre(false);
                    if ((feuille.titre || '') !== valeur) {
                      setFeuille((f) => (f ? { ...f, titre: valeur || undefined } : f));
                      try {
                        await updateTitreFeuille(feuille.id, valeur);
                      } catch (err: any) {
                        toast.error(err?.message || 'Impossible de mettre à jour le titre.');
                      }
                    }
                  } else if (e.key === 'Escape') {
                    setEditTitre(false);
                  }
                }}
                maxLength={120}
                style={{ minWidth: 300, fontSize: '1.1rem', fontWeight: 600 }}
              />
              <button
                className="prof-btn prof-btn-primary prof-btn-sm"
                title="Enregistrer le titre"
                onClick={async () => {
                  const valeur = draftTitre.trim();
                  setEditTitre(false);
                  if ((feuille.titre || '') !== valeur) {
                    setFeuille((f) => (f ? { ...f, titre: valeur || undefined } : f));
                    try {
                      await updateTitreFeuille(feuille.id, valeur);
                    } catch (err: any) {
                      toast.error(err?.message || 'Impossible de mettre à jour le titre.');
                    }
                  }
                }}
              >
                <Check size={14} />
              </button>
              <button
                className="prof-btn prof-btn-secondary prof-btn-sm"
                onClick={() => setEditTitre(false)}
                title="Annuler"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <h1
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {feuille.titre || `Feuille de notes — ${feuille.groupeNom}`}
                {/* Crayon discret pour entrer en édition. Toujours dispo,
                    y compris pour les feuilles antérieures (sans titre). */}
                <button
                  className="prof-btn prof-btn-secondary prof-btn-sm"
                  title="Renommer la feuille"
                  onClick={() => {
                    setDraftTitre(feuille.titre || '');
                    setEditTitre(true);
                  }}
                  style={{ padding: '2px 6px' }}
                >
                  <Pencil size={14} />
                </button>
              </h1>
              <p>
                {/* Si un titre custom est posé, on garde le nom du groupe
                    en sous-ligne (contexte). Sinon comportement historique. */}
                {feuille.titre ? `${feuille.groupeNom} • ` : ''}
                {feuille.matiereNom} • {feuille.periodeLabel} • {feuille.anneeScolaire}
              </p>
            </>
          )}
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
        {/*
          Deux boutons distincts pour préciser le type à la création :
          « devoir » ou « composition ». Chaque ajout écrit immédiatement
          le type dans Firestore pour que les exports et la moyenne
          générale soient cohérents sans action supplémentaire du prof.
        */}
        <button className="prof-btn prof-btn-primary prof-btn-sm" onClick={() => ajouterEvaluation('devoir')}>
          <Plus size={14} /> Ajouter un devoir
        </button>
        <button
          className="prof-btn prof-btn-sm"
          onClick={() => ajouterEvaluation('composition')}
          style={{
            marginLeft: 8,
            background: '#7c3aed',
            color: 'white',
            border: '1px solid #6d28d9',
          }}
          title="Composition : entre dans la moyenne générale au même titre que la moyenne des devoirs (moyenne générale = (MoyDevoirs + Composition) / 2)"
        >
          <GraduationCap size={14} /> Ajouter une composition
        </button>
        <button
          className={`prof-btn prof-btn-sm ${showCompPanel ? 'prof-btn-primary' : 'prof-btn-secondary'}`}
          onClick={() => setShowCompPanel((v) => !v)}
          style={{ marginLeft: 8 }}
        >
          <BookOpen size={14} /> Compétences {showCompPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Aide visuelle : rappel concis de la formule PedaClic */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary, #6b7280)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Award size={14} /> Moy. générale = (Moy. devoirs + Composition) / 2
        </span>
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
              {evals.map((e, idx) => {
                const typeEval: TypeEvaluation = e.type ?? 'devoir';
                const isCompo = typeEval === 'composition';
                return (
                  <th
                    key={e.id}
                    className={`col-note${overIdx === idx ? ' eval-drag-over' : ''}${dragIdx === idx ? ' eval-dragging' : ''}${isCompo ? ' col-note--compo' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(ev) => handleDragOver(ev, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    /* Bande colorée différenciante : violet pour composition */
                    style={isCompo ? { background: '#7c3aed' } : undefined}
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
                          {/* Badge type : devoir (D) / composition (C) */}
                          <span
                            className="eval-type-badge"
                            title={`${TYPE_EVAL_LABELS[typeEval]} — cliquer pour basculer`}
                            onClick={() => changerTypeEval(e.id, isCompo ? 'devoir' : 'composition')}
                            style={{
                              display: 'inline-block',
                              padding: '0 5px',
                              borderRadius: 3,
                              background: isCompo ? '#fde68a' : '#bfdbfe',
                              color: isCompo ? '#78350f' : '#1e3a8a',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              marginRight: 4,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            {isCompo ? 'C' : 'D'}
                          </span>
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
                );
              })}
              {/* Colonnes de synthèse : distinctes pour la lisibilité du bulletin */}
              <th className="col-moyenne" title="Moyenne des devoirs (pondérée par coef.)">Moy. Devoirs</th>
              <th className="col-moyenne" title="Note de composition (moyenne pondérée si plusieurs)">Compo</th>
              <th className="col-moyenne" title="Moyenne générale = (Moy. Devoirs + Compo) / 2">Moy. Gén.</th>
              <th className="col-moyenne" title="Rang de classe (1 = meilleur)">Rang</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.eleveId}>
                <td className="col-eleve">
                  {/* Affichage canonique "Prénoms NOM" (cf. src/utils/formatNom.ts) */}
                  <strong>{formatEleveNom(ligne.eleveNom)}</strong>
                </td>
                {evals.map((e) => {
                  const isEdit = editCell?.eleveId === ligne.eleveId && editCell?.evalId === e.id;
                  const val = ligne.notes[e.id];
                  const kCell = cellKey(ligne.eleveId, e.id);
                  return (
                    <td key={e.id} className="col-note">
                      {isEdit ? (
                        <input
                          /*
                            Ref par cellule pour pouvoir refocaliser lors d'une
                            navigation clavier (Enter / Tab / flèches).
                          */
                          ref={(el) => { cellRefs.current[kCell] = el; }}
                          type="text"
                          inputMode="decimal"
                          className="note-input"
                          value={draftNote}
                          onChange={(ev) => setDraftNote(ev.target.value)}
                          onBlur={() => handleNoteChange(ligne.eleveId, e.id, draftNote)}
                          onKeyDown={(ev) => {
                            // ── Navigation clavier ──
                            //   Enter / Tab       → cellule suivante (à droite, wrap en bas)
                            //   Shift+Tab         → cellule précédente
                            //   Flèche ↓ / ↑      → ligne suivante / précédente (même évaluation)
                            //   Flèche → / ←      → cellule droite / gauche (même ligne)
                            //   Escape            → annule l'édition en cours
                            if (ev.key === 'Enter' || ev.key === 'Tab') {
                              ev.preventDefault();
                              handleNoteChange(ligne.eleveId, e.id, draftNote, true);
                              moveFocus(ligne.eleveId, e.id, ev.shiftKey ? 'left' : 'right');
                            } else if (ev.key === 'ArrowDown') {
                              ev.preventDefault();
                              handleNoteChange(ligne.eleveId, e.id, draftNote, true);
                              moveFocus(ligne.eleveId, e.id, 'down');
                            } else if (ev.key === 'ArrowUp') {
                              ev.preventDefault();
                              handleNoteChange(ligne.eleveId, e.id, draftNote, true);
                              moveFocus(ligne.eleveId, e.id, 'up');
                            } else if (ev.key === 'ArrowRight' && ev.currentTarget.selectionStart === draftNote.length) {
                              // Ne capte que si le curseur est à la fin (évite de gêner la saisie)
                              ev.preventDefault();
                              handleNoteChange(ligne.eleveId, e.id, draftNote, true);
                              moveFocus(ligne.eleveId, e.id, 'right');
                            } else if (ev.key === 'ArrowLeft' && ev.currentTarget.selectionStart === 0) {
                              ev.preventDefault();
                              handleNoteChange(ligne.eleveId, e.id, draftNote, true);
                              moveFocus(ligne.eleveId, e.id, 'left');
                            } else if (ev.key === 'Escape') {
                              setEditCell(null);
                            }
                          }}
                        />
                      ) : (
                        <span
                          className="note-cell"
                          tabIndex={0}
                          onClick={() => {
                            setEditCell({ eleveId: ligne.eleveId, evalId: e.id });
                            setDraftNote(val != null ? String(val) : '');
                          }}
                          onKeyDown={(ev) => {
                            // Permet d'entrer en édition via Enter depuis une cellule fermée
                            if (ev.key === 'Enter' || ev.key === 'F2') {
                              ev.preventDefault();
                              setEditCell({ eleveId: ligne.eleveId, evalId: e.id });
                              setDraftNote(val != null ? String(val) : '');
                            }
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
                {/* Colonnes de synthèse : moyennes séparées + rang */}
                <td className={`col-moyenne ${getClasseMoyenne(ligne.moyenneDevoirs)}`}>
                  {ligne.moyenneDevoirs > 0 ? ligne.moyenneDevoirs.toFixed(2) : '—'}
                </td>
                <td className={`col-moyenne ${getClasseMoyenne(ligne.noteComposition)}`}>
                  {ligne.noteComposition > 0 ? ligne.noteComposition.toFixed(2) : '—'}
                </td>
                <td className={`col-moyenne ${getClasseMoyenne(ligne.moyenneGenerale)}`}>
                  <strong>{ligne.moyenneGenerale > 0 ? ligne.moyenneGenerale.toFixed(2) : '—'}</strong>
                </td>
                <td className="col-moyenne">
                  {ligne.rang > 0 ? (
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: 24,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: ligne.rang === 1 ? '#fde68a' : ligne.rang <= 3 ? '#e9d5ff' : '#e5e7eb',
                        color: ligne.rang === 1 ? '#78350f' : '#1f2937',
                        fontWeight: 700,
                      }}
                    >
                      {ligne.rang}
                      {ligne.rang === 1 ? 'er' : 'e'}
                    </span>
                  ) : '—'}
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
              {/* Moyennes de classe calculées sur chaque agrégat */}
              <td className={`col-moyenne ${getClasseMoyenne(moyenneClasseDevoirs)}`}>
                {moyenneClasseDevoirs > 0 ? moyenneClasseDevoirs.toFixed(2) : '—'}
              </td>
              <td className={`col-moyenne ${getClasseMoyenne(moyenneClasseCompo)}`}>
                {moyenneClasseCompo > 0 ? moyenneClasseCompo.toFixed(2) : '—'}
              </td>
              <td className={`col-moyenne ${getClasseMoyenne(moyenneClasse)}`}>
                <strong>{moyenneClasse > 0 ? moyenneClasse.toFixed(2) : '—'}</strong>
              </td>
              <td className="col-moyenne" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeuilleNotesEditorPage;
