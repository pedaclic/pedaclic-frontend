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
  updateAbsenceBulk,
  updateEvaluationsFeuille,
  updateCompetencesDefFeuille,
  updateCompetenceEleve,
  updateTitreFeuille,
  buildLignesNotes,
} from '../services/feuillesNotesService';
import { getElevesGroupe } from '../services/profGroupeService';
// 🆕 Récupération des cahiers de textes liés au groupe (lien Feuille ↔ Cahier)
import { getCahiersForGroupe } from '../services/cahierTextesService';
import type { CahierTextes } from '../types/cahierTextes.types';
import { exportFeuilleExcel, exportFeuillePDF, exportFeuilleWord } from '../utils/feuillesNotesExport';
import type { FeuilleDeNotes, LigneNotes, CompetenceDef, CompetenceStatus, TypeEvaluation, StatutAbsenceDevoir } from '../types/feuillesNotes.types';
import {
  COMPETENCES_PAR_DEFAUT,
  COMPETENCE_STATUS_LABELS,
  COMPETENCE_STATUS_COLORS,
  TYPE_EVAL_LABELS,
  STATUT_ABSENCE_LABELS,
  STATUT_ABSENCE_BADGES,
  STATUT_ABSENCE_COLORS,
} from '../types/feuillesNotes.types';
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
  // 🆕 Map eleveId → sexe ('M' | 'F' | 'autre') alimentée depuis les
  //    inscriptions du groupe lors du chargement de la feuille. Permet
  //    d'afficher le pictogramme ♂/♀ devant chaque nom dans la colonne
  //    « Élève » (cohérent avec l'onglet Élèves du dashboard).
  const [sexeMap, setSexeMap] = useState<Record<string, 'M' | 'F' | 'autre' | undefined>>({});
  // 🆕 Cahiers de textes liés au groupe de cette feuille — pour le bouton de
  //    navigation rapide « Cahier de textes » dans l'en-tête.
  //    Initialisé à `null` (= en cours de chargement / non encore chargé)
  //    pour éviter d'afficher « Aucun cahier » avant la requête.
  const [cahiersLies, setCahiersLies] = useState<CahierTextes[] | null>(null);
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
      // 🆕 Construction de la map des sexes (eleveId → sexe) à partir des
      //    inscriptions, pour affichage du pictogramme dans la colonne Élève.
      //    Les inscriptions où `eleveSexe` est absent restent à `undefined`.
      const sxMap: Record<string, 'M' | 'F' | 'autre' | undefined> = {};
      inscriptions.forEach((i) => {
        sxMap[i.eleveId] = i.eleveSexe;
      });
      setSexeMap(sxMap);
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
   * 🆕 Récupère les cahiers de textes du prof rattachés au groupe de la
   *    feuille courante. Sert à proposer le bouton « Cahier de textes »
   *    dans l'en-tête (1 seul cahier → navigation directe ; plusieurs →
   *    petit sélecteur). Pas bloquant pour l'éditeur : si la requête
   *    échoue, le bouton est simplement masqué.
   */
  useEffect(() => {
    if (!feuille?.groupeId || !currentUser?.uid) return;
    let annulee = false;
    getCahiersForGroupe(feuille.groupeId, currentUser.uid)
      .then((liste) => { if (!annulee) setCahiersLies(liste); })
      .catch((err) => { console.error('Erreur chargement cahiers liés:', err); if (!annulee) setCahiersLies([]); });
    return () => { annulee = true; };
  }, [feuille?.groupeId, currentUser?.uid]);

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

  /**
   * 🆕 Bascule l'inclusion / exclusion d'une évaluation dans le calcul
   *    de la moyenne (devoirs ou composition).
   *
   *   Cycle : incluse (défaut) ⇄ exclue.
   *
   *   - Mise à jour optimiste de l'état local pour rafraîchir
   *     immédiatement les colonnes Moy. Devoirs / Compo / Moy. Gén / Rang.
   *   - Persistance Firestore via `updateEvaluationsFeuille`.
   *   - L'évaluation reste visible dans le tableau (les notes ne sont
   *     pas effacées) — seul son poids dans la moyenne change.
   */
  const toggleExclusionEval = (evalId: string) => {
    if (!feuille) return;
    const evals = feuille.evaluations.map((e) =>
      e.id === evalId ? { ...e, exclueDeMoyenne: !(e.exclueDeMoyenne === true) } : e,
    );
    setFeuille((f) => (f ? { ...f, evaluations: evals } : null));
    updateEvaluationsFeuille(feuille.id, evals)
      .then(() => load())
      .catch(console.error);
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

  /**
   * 🆕 Bascule le statut d'absence d'un élève à une évaluation.
   *
   *   Cycle : Présent → Absent justifié → Absent non justifié → Présent…
   *
   *   - Met à jour optimistiquement l'état local de la feuille
   *     (champ `feuille.absences[eleveId][evalId]`).
   *   - Recalcule les lignes (moyennes + rang) immédiatement via
   *     `buildLignesNotes` pour que l'UI reflète la règle
   *     « justifiée = ignore / non justifiée = 0 ».
   *   - Persiste en parallèle via `updateAbsenceBulk` (Firestore).
   *
   *   En cas de passage à une absence, la note saisie est aussi effacée
   *   localement (cohérence : un élève absent n'a pas pu composer).
   */
  const cycleAbsenceStatut = (eleveId: string, evalId: string) => {
    if (!feuille || !feuilleId) return;

    // Cycle de 3 états : Présent → AJ → ANJ → Présent…
    const order: (StatutAbsenceDevoir | 'present')[] = ['present', 'absent_justifie', 'absent_non_justifie'];
    const current = feuille.absences?.[eleveId]?.[evalId] ?? 'present';
    const next = order[(order.indexOf(current) + 1) % order.length];

    // Clone défensif puis mise à jour optimiste
    const absencesUpdated = JSON.parse(JSON.stringify(feuille.absences || {}));
    if (!absencesUpdated[eleveId]) absencesUpdated[eleveId] = {};
    if (next === 'present') {
      delete absencesUpdated[eleveId][evalId];
    } else {
      absencesUpdated[eleveId][evalId] = next;
    }

    // Si on passe en absence, on retire la note (cohérence pédagogique)
    const notesUpdated = JSON.parse(JSON.stringify(feuille.notes || {}));
    if (next !== 'present' && notesUpdated[eleveId]) {
      delete notesUpdated[eleveId][evalId];
    }

    // 🔁 Mise à jour state + recalcul des lignes (moyennes / rang)
    const feuilleNouvelle: FeuilleDeNotes = { ...feuille, absences: absencesUpdated, notes: notesUpdated };
    setFeuille(feuilleNouvelle);
    setLignes((prev) => {
      // Reconstruction propre via buildLignesNotes (source de vérité unique)
      const inscriptions = prev.map((l) => ({
        eleveId: l.eleveId,
        eleveNom: l.eleveNom,
        eleveEmail: l.eleveEmail,
      }));
      return buildLignesNotes(feuilleNouvelle, inscriptions);
    });

    // Persistance Firestore (toast.error en cas d'échec, mais on ne casse pas l'UI)
    updateAbsenceBulk(feuilleId, [
      { eleveId, evaluationId: evalId, statut: next === 'present' ? null : next },
    ]).catch((err) => {
      console.error('Erreur enregistrement absence :', err);
      toast.error('Impossible d\'enregistrer le statut d\'absence');
    });
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

  // ── Compteurs d'absences cumulés (toute la feuille / toute la classe) ──
  //   Affichés en pied de tableau pour donner au prof une vue synthétique :
  //   combien d'absences justifiées vs non justifiées sur cette feuille,
  //   et combien d'élèves sont concernés.
  const totalAbsJ = lignes.reduce((s, l) => s + l.nbAbsencesJustifiees, 0);
  const totalAbsNJ = lignes.reduce((s, l) => s + l.nbAbsencesNonJustifiees, 0);
  const nbElevesAvecAbsence = lignes.filter(
    (l) => l.nbAbsencesJustifiees > 0 || l.nbAbsencesNonJustifiees > 0,
  ).length;

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
          {/* ──────────────────────────────────────────────────────────
              🆕 Bouton « Cahier de textes » : ouvre le cahier lié au
              groupe (si un seul) ou propose un menu de sélection (si
              plusieurs cahiers du prof sont rattachés au même groupe,
              ex. plusieurs matières / co-animation).

              Comportement :
                • cahiersLies === null   → en cours de chargement (rien)
                • aucun cahier           → bouton désactivé (informatif)
                • 1 cahier               → navigation directe
                • plusieurs              → <select> stylé en bouton
             ────────────────────────────────────────────────────────── */}
          {cahiersLies !== null && (
            cahiersLies.length === 0 ? (
              <button
                className="prof-btn prof-btn-secondary"
                disabled
                title="Aucun cahier de textes du prof n'est rattaché à ce groupe."
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              >
                <BookOpen size={18} /> Cahier de textes
              </button>
            ) : cahiersLies.length === 1 ? (
              <button
                className="prof-btn prof-btn-secondary"
                title={`Ouvrir le cahier « ${cahiersLies[0].titre} »`}
                onClick={() => navigate(`/prof/cahiers/${cahiersLies[0].id}`)}
              >
                <BookOpen size={18} /> Cahier de textes
              </button>
            ) : (
              <select
                className="prof-btn prof-btn-secondary"
                title="Choisir le cahier de textes à ouvrir"
                defaultValue=""
                onChange={(e) => {
                  const cId = e.target.value;
                  if (cId) navigate(`/prof/cahiers/${cId}`);
                }}
                style={{ cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="" disabled>📒 Cahier de textes…</option>
                {cahiersLies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre} — {c.matiere}
                  </option>
                ))}
              </select>
            )
          )}
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

      {/* ─────────────────────────────────────────────────────────────
           LÉGENDE ABSENCES — affichée sous la barre d'outils
           ─────────────────────────────────────────────────────────────
           Explique les 3 badges A/AJ/ANJ visibles dans chaque cellule
           de note, et précise la règle de calcul appliquée par PedaClic.
           Discrète mais informative ; alignée à droite pour rester
           cohérente avec la formule moyenne ci-dessus. */}
      <div
        className="feuille-absence-legende"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: '6px 4px',
          marginBottom: 4,
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary, #6b7280)',
        }}
      >
        <strong style={{ color: 'var(--color-text-primary, #1f2937)' }}>Absences :</strong>
        <span title="Cliquer le badge en haut-droite d'une cellule pour basculer le statut">
          <span
            style={{
              display: 'inline-block', padding: '0 5px', minWidth: 22,
              border: '1px solid #d1d5db', borderRadius: 4,
              color: '#9ca3af', fontWeight: 700, marginRight: 4, textAlign: 'center',
            }}
          >P</span>
          Présent (note saisie)
        </span>
        <span>
          <span
            style={{
              display: 'inline-block', padding: '0 5px', minWidth: 22,
              background: '#f59e0b', color: '#fff',
              borderRadius: 4, fontWeight: 700, marginRight: 4, textAlign: 'center',
            }}
          >AJ</span>
          Absent justifié — devoir <em>ignoré</em> dans la moyenne
        </span>
        <span>
          <span
            style={{
              display: 'inline-block', padding: '0 5px', minWidth: 22,
              background: '#ef4444', color: '#fff',
              borderRadius: 4, fontWeight: 700, marginRight: 4, textAlign: 'center',
            }}
          >ANJ</span>
          Absent non justifié — compte <strong>0&nbsp;/&nbsp;20</strong>
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
                // 🆕 Indicateur d'exclusion du calcul de moyenne pour CETTE éval.
                //    On combine la classe « eval-excluded » avec un style discret
                //    (opacité réduite + fond rayé) pour que le prof voie d'un
                //    coup d'œil les colonnes qui ne pèsent plus dans la moyenne.
                const isExcluse = e.exclueDeMoyenne === true;
                return (
                  <th
                    key={e.id}
                    className={`col-note${overIdx === idx ? ' eval-drag-over' : ''}${dragIdx === idx ? ' eval-dragging' : ''}${isCompo ? ' col-note--compo' : ''}${isExcluse ? ' col-note--excluse' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(ev) => handleDragOver(ev, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    /* Bande colorée différenciante : violet pour composition,
                       rayée + dépolie pour les évaluations exclues du calcul. */
                    style={{
                      ...(isCompo ? { background: '#7c3aed' } : {}),
                      ...(isExcluse
                        ? {
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(255,255,255,0.0) 0 6px, rgba(0,0,0,0.06) 6px 12px)',
                          }
                        : {}),
                    }}
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
                          {/* 🆕 Badge « hors moyenne » : signal visible à côté
                              du libellé pour distinguer immédiatement les
                              évaluations qui ne pèsent plus dans le calcul. */}
                          {isExcluse && (
                            <span
                              title="Évaluation exclue du calcul de la moyenne"
                              style={{
                                marginLeft: 6,
                                padding: '0 5px',
                                borderRadius: 3,
                                background: '#fef3c7',
                                color: '#92400e',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Hors moyenne
                            </span>
                          )}
                        </span>
                      )}
                      {editEvalId !== e.id && (
                        <span className="eval-actions">
                          {/* 🆕 Bouton bascule INCLURE / EXCLURE l'évaluation
                              du calcul de la moyenne. Le tooltip décrit
                              l'action qui sera réalisée au clic, et l'icône
                              (✓ vert / ⊘ orange) reflète l'état actuel. */}
                          <button
                            type="button"
                            className={`eval-action-btn eval-toggle-moyenne${isExcluse ? ' is-excluse' : ''}`}
                            title={
                              isExcluse
                                ? 'Cette évaluation est EXCLUE du calcul de la moyenne — cliquer pour l\'inclure à nouveau'
                                : 'Cette évaluation est INCLUSE dans le calcul de la moyenne — cliquer pour l\'exclure'
                            }
                            aria-label={
                              isExcluse
                                ? 'Inclure cette évaluation dans le calcul de la moyenne'
                                : 'Exclure cette évaluation du calcul de la moyenne'
                            }
                            onClick={(ev) => { ev.stopPropagation(); toggleExclusionEval(e.id); }}
                            style={{
                              color: isExcluse ? '#f59e0b' : '#16a34a',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              lineHeight: 1,
                            }}
                          >
                            {isExcluse ? '⊘' : '✓'}
                          </button>
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
                  {/* 🆕 Pictogramme ♂ / ♀ / ✱ AVANT le nom — invisible
                      si non renseigné. Cohérent avec l'onglet Élèves
                      (mêmes couleurs : bleu / rose / gris). Pour modifier
                      le sexe, le prof retourne sur l'onglet « Élèves »
                      du tableau de bord (bouton ⚧ par ligne). */}
                  {(() => {
                    const sx = sexeMap[ligne.eleveId];
                    if (!sx) return null;
                    const couleur = sx === 'F' ? '#ec4899' : sx === 'M' ? '#3b82f6' : '#9ca3af';
                    const picto = sx === 'F' ? '♀' : sx === 'M' ? '♂' : '✱';
                    const label =
                      sx === 'M' ? 'Masculin' : sx === 'F' ? 'Féminin' : 'Autre';
                    return (
                      <span
                        title={label}
                        aria-label={label}
                        style={{
                          color: couleur,
                          fontWeight: 700,
                          marginRight: 6,
                        }}
                      >
                        {picto}
                      </span>
                    );
                  })()}
                  {/* Affichage canonique "Prénoms NOM" (cf. src/utils/formatNom.ts) */}
                  <strong>{formatEleveNom(ligne.eleveNom)}</strong>
                </td>
                {evals.map((e) => {
                  const isEdit = editCell?.eleveId === ligne.eleveId && editCell?.evalId === e.id;
                  const val = ligne.notes[e.id];
                  const kCell = cellKey(ligne.eleveId, e.id);
                  // ── Statut d'absence pour cette cellule ──
                  //   Lu directement depuis la feuille (source de vérité après
                  //   chaque mise à jour optimiste). Implicite = 'present'.
                  const statutAbs: StatutAbsenceDevoir | 'present' =
                    feuille.absences?.[ligne.eleveId]?.[e.id] ?? 'present';
                  const estAbsent = statutAbs !== 'present';
                  // 🆕 Marquage visuel des cellules dont l'évaluation est exclue
                  //    du calcul de la moyenne (la note reste éditable).
                  const cellExcluse = e.exclueDeMoyenne === true;
                  return (
                    <td key={e.id} className={`col-note${cellExcluse ? ' col-note--excluse' : ''}`}>
                      {/* ────────────────────────────────────────────────
                          Bouton de BASCULE STATUT D'ABSENCE
                          ────────────────────────────────────────────────
                          - Toujours visible en haut à droite de la cellule.
                          - 'P' = Présent (gris discret) ; 'AJ' = orange ;
                            'ANJ' = rouge.
                          - Tooltip = libellé long pour la lisibilité.
                          - Clic = passage à l'état suivant (cycle de 3).
                       */}
                      <button
                        type="button"
                        className={`absence-toggle absence-toggle--${statutAbs}`}
                        title={`${STATUT_ABSENCE_LABELS[statutAbs]} — cliquer pour changer`}
                        aria-label={`Statut absence : ${STATUT_ABSENCE_LABELS[statutAbs]}`}
                        onClick={(ev) => { ev.stopPropagation(); cycleAbsenceStatut(ligne.eleveId, e.id); }}
                        style={{
                          // Surcharge inline : la couleur dépend du statut
                          background: estAbsent ? STATUT_ABSENCE_COLORS[statutAbs] : 'transparent',
                          color: estAbsent ? '#fff' : '#9ca3af',
                          borderColor: estAbsent ? STATUT_ABSENCE_COLORS[statutAbs] : '#d1d5db',
                        }}
                      >
                        {estAbsent ? STATUT_ABSENCE_BADGES[statutAbs] : 'P'}
                      </button>

                      {/* ────────────────────────────────────────────────
                          Affichage / saisie de la note OU badge absence
                          ────────────────────────────────────────────────
                          - Si élève absent → on désactive la saisie et on
                            affiche le libellé long du statut.
                          - Sinon → comportement habituel (clic = édition).
                       */}
                      {estAbsent ? (
                        <span
                          className="note-cell note-cell--absent"
                          title={STATUT_ABSENCE_LABELS[statutAbs]}
                          style={{
                            color: STATUT_ABSENCE_COLORS[statutAbs],
                            fontWeight: 700,
                            fontStyle: 'italic',
                          }}
                        >
                          {STATUT_ABSENCE_BADGES[statutAbs]}
                        </span>
                      ) : isEdit ? (
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

            {/* ─────────────────────────────────────────────────────────
                LIGNE « TOTAL ABSENCES »
                ─────────────────────────────────────────────────────────
                On affiche le compteur cumulé d'absences justifiées /
                non justifiées sur l'ensemble de la classe et de la feuille.
                Visible uniquement si au moins une absence a été saisie,
                pour éviter de surcharger l'UI quand le système n'est pas utilisé.
            */}
            {(totalAbsJ > 0 || totalAbsNJ > 0) && (
              <tr className="feuille-moyenne-classe" title={`${nbElevesAvecAbsence} élève(s) concerné(s) par au moins une absence`}>
                <td className="col-eleve">
                  <strong>Total absences</strong>
                  <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: 6 }}>
                    ({nbElevesAvecAbsence} élève{nbElevesAvecAbsence > 1 ? 's' : ''})
                  </span>
                </td>
                {/* Pour chaque évaluation : nombre d'absences sur cette colonne */}
                {evals.map((e) => {
                  let cntJ = 0, cntNJ = 0;
                  lignes.forEach((l) => {
                    const st = l.absences?.[e.id];
                    if (st === 'absent_justifie') cntJ++;
                    if (st === 'absent_non_justifie') cntNJ++;
                  });
                  return (
                    <td key={e.id} className="col-note" style={{ fontSize: '0.75rem' }}>
                      {cntJ > 0 && (
                        <span style={{ color: '#f59e0b', fontWeight: 700 }} title="Absences justifiées">
                          AJ:{cntJ}
                        </span>
                      )}
                      {cntJ > 0 && cntNJ > 0 && ' · '}
                      {cntNJ > 0 && (
                        <span style={{ color: '#ef4444', fontWeight: 700 }} title="Absences non justifiées (compte 0/20)">
                          ANJ:{cntNJ}
                        </span>
                      )}
                      {cntJ === 0 && cntNJ === 0 && <span className="text-muted">—</span>}
                    </td>
                  );
                })}
                {/* 4 cellules synthèse vides (Moy. Devoirs / Compo / Moy. Gén. / Rang) */}
                <td className="col-moyenne" colSpan={4} style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }} title="Total absences justifiées sur la feuille">
                    AJ : {totalAbsJ}
                  </span>
                  {' · '}
                  <span style={{ color: '#ef4444', fontWeight: 700 }} title="Total absences non justifiées (chacune compte 0/20)">
                    ANJ : {totalAbsNJ}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeuilleNotesEditorPage;
