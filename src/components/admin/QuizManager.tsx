/**
 * ============================================================
 * PedaClic - Phase 6 : QuizManager.tsx - CORRIGÉ
 * ============================================================
 * Composant admin pour la gestion complète des quiz.
 * 
 * Corrections :
 * - Types importés depuis quizService (pas depuis index)
 * - DisciplineService en default import (pas named)
 *
 * Placement : src/components/admin/QuizManager.tsx
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Eye,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Award,
  BookOpen,
  HelpCircle,
  GripVertical,
  Copy,
  Star,
  Users,
  FileText,
} from 'lucide-react';

/* ── Imports internes (corrigés) ── */
import {
  Quiz,
  Question,
  getQuizzes,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createEmptyQuestion,
  getQuizStats,
  QuizFilters,
} from '../../services/quizService';
import DisciplineService from '../../services/disciplineService';
/* ★ Phase 60 — ciblage classe/groupe + éditeur de questions étendu */
import EditeurQuestionsClassiques, {
  validerQuestionsClassiques,
} from '../quiz/EditeurQuestionsClassiques';
import { getCiblesQuiz, libelleCible } from '../../services/quizCibleService';
import type { CibleQuiz } from '../../services/quizCibleService';
import { useConfirm } from '../../contexts/ConfirmContext';

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

interface DisciplineOption {
  id: string;
  nom: string;
}

type ViewMode = 'list' | 'form' | 'preview';

/**
 * ★ Phase 60 — Valeurs par défaut d'un nouveau quiz.
 * Nouveaux champs gérés par le formulaire admin (tous optionnels dans
 * le type `Quiz`, donc 100 % compatibles avec les quiz existants) :
 *   - status      : 'published' (visible) | 'draft' (masqué aux élèves)
 *   - groupeId    : null = quiz global ; sinon ID d'une classe / d'un groupe
 *   - afficherCorpus / corpusText : texte support affiché pendant le quiz
 */
const FORMULAIRE_VIDE: Omit<Quiz, 'id'> = {
  disciplineId: '',
  titre: '',
  questions: [],
  duree: 15,
  isPremium: false,
  noteMinimale: 50,
  status: 'published',
  groupeId: null,
  afficherCorpus: false,
  corpusText: '',
};

/* ══════════════════════════════════════════════
   COMPOSANT PRINCIPAL : QuizManager
   ══════════════════════════════════════════════ */
const QuizManager: React.FC = () => {
  /* ── États de la liste ── */
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* ── États des filtres ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterPremium, setFilterPremium] = useState<string>('');
  const [filterDifficulte, setFilterDifficulte] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  /* ── États du formulaire ── */
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [formData, setFormData] = useState<Omit<Quiz, 'id'>>({
    disciplineId: '',
    titre: '',
    questions: [],
    duree: 15,
    isPremium: false,
    noteMinimale: 50,
  });
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* ── Confirmation de suppression ── */
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── ★ Phase 60 : ciblage classe / groupe ── */
  const [cibles, setCibles] = useState<CibleQuiz[]>([]);
  const [filterCible, setFilterCible] = useState(''); // '' | '__global__' | <groupeId>
  /* ── ★ Phase 60 : instantané du formulaire à l'ouverture (détection des modifications non enregistrées) ── */
  const [formInitial, setFormInitial] = useState('');
  const confirmer = useConfirm();

  /* ── Prévisualisation ── */
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, number>>({});
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  /* ══════════════════════════════════════════════
     CHARGEMENT INITIAL DES DONNÉES
     ══════════════════════════════════════════════ */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /* Chargement parallèle des quiz et disciplines */
      const [quizData, discData, ciblesData] = await Promise.all([
        getQuizzes(),
        DisciplineService.getAll(),
        // ★ Phase 60 — un échec de lecture des groupes ne doit jamais
        // empêcher l'affichage des quiz : on retombe sur une liste vide.
        getCiblesQuiz().catch((err) => {
          console.warn('[QuizManager] Groupes indisponibles :', err);
          return [] as CibleQuiz[];
        }),
      ]);
      setCibles(ciblesData);
      setQuizzes(quizData);
      setDisciplines(
        discData.map((d: any) => ({ id: d.id, nom: d.nom || d.name || d.id }))
      );
    } catch (err) {
      setError('Erreur lors du chargement des données.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Auto-dismiss des messages de succès ── */
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /* ══════════════════════════════════════════════
     FILTRAGE DES QUIZ (côté client)
     ══════════════════════════════════════════════ */
  const filteredQuizzes = quizzes.filter((quiz) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!quiz.titre.toLowerCase().includes(search)) return false;
    }
    if (filterDiscipline && quiz.disciplineId !== filterDiscipline) return false;
    if (filterPremium === 'true' && !quiz.isPremium) return false;
    if (filterPremium === 'false' && quiz.isPremium) return false;
    // ★ Phase 60 — filtre par cible
    if (filterCible === '__global__' && quiz.groupeId) return false;
    if (filterCible && filterCible !== '__global__' && quiz.groupeId !== filterCible) return false;
    if (filterDifficulte) {
      const hasLevel = quiz.questions?.some((q) => q.difficulte === filterDifficulte);
      if (!hasLevel) return false;
    }
    return true;
  });

  /* ══════════════════════════════════════════════
     HANDLERS DU FORMULAIRE
     ══════════════════════════════════════════════ */

  const handleCreate = () => {
    setEditingQuiz(null);
    const initial = { ...FORMULAIRE_VIDE, questions: [createEmptyQuestion()] };
    setFormData(initial);
    setFormInitial(JSON.stringify(initial)); // ★ Phase 60
    setExpandedQuestion(null);
    setViewMode('form');
  };

  const handleEdit = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    const initial: Omit<Quiz, 'id'> = {
      disciplineId: quiz.disciplineId,
      titre: quiz.titre,
      questions: quiz.questions || [],
      duree: quiz.duree || 15,
      isPremium: quiz.isPremium || false,
      noteMinimale: quiz.noteMinimale || 50,
      // ★ Phase 60 — champs désormais modifiables (absents = valeurs historiques)
      status: quiz.status === 'draft' ? 'draft' : 'published',
      groupeId: quiz.groupeId || null,
      afficherCorpus: quiz.afficherCorpus === true,
      corpusText: quiz.corpusText || '',
    };
    setFormData(initial);
    setFormInitial(JSON.stringify(initial));
    // Groupe lié mais archivé (donc absent de la liste) : on l'ajoute pour
    // l'afficher correctement au lieu de le délier silencieusement.
    if (quiz.groupeId && !cibles.some((c) => c.id === quiz.groupeId)) {
      getCiblesQuiz({ inclureIds: [quiz.groupeId] })
        .then(setCibles)
        .catch(() => undefined);
    }
    setExpandedQuestion(null);
    setViewMode('form');
  };

  const handleSave = async () => {
    if (!formData.titre.trim()) {
      setError('Le titre du quiz est obligatoire.');
      return;
    }
    if (!formData.disciplineId) {
      setError('Veuillez sélectionner une discipline.');
      return;
    }
    // ★ Phase 60 — validation complète pour un quiz PUBLIÉ (énoncés,
    // options non vides, 2 à 6 options, bonne réponse définie). Un
    // BROUILLON (invisible des élèves) peut être enregistré incomplet.
    if (formData.status !== 'draft') {
      const erreurQuestions = validerQuestionsClassiques(formData.questions);
      if (erreurQuestions) {
        setError(erreurQuestions);
        return;
      }
    }
    if (formData.afficherCorpus && !formData.corpusText?.trim()) {
      setError('Saisissez le texte support, ou désactivez son affichage.');
      return;
    }

    // ★ Phase 60 — charge utile normalisée. `profId` n'est jamais envoyé :
    // un quiz de professeur modifié par l'admin reste la propriété du prof.
    const payload: Omit<Quiz, 'id'> = {
      ...formData,
      titre: formData.titre.trim(),
      groupeId: formData.groupeId || null,
      corpusText: formData.corpusText?.trim() || '',
    };

    setSaving(true);
    setError(null);
    try {
      if (editingQuiz) {
        await updateQuiz(editingQuiz.id, payload);
        setSuccessMessage('Quiz mis à jour avec succès !');
      } else {
        await createQuiz(payload);
        setSuccessMessage('Quiz créé avec succès !');
      }
      await loadData();
      setViewMode('list');
    } catch (err) {
      setError('Erreur lors de la sauvegarde du quiz.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * ★ Phase 60 — Fermeture du formulaire : demande confirmation si des
   * modifications n'ont pas été enregistrées (évite les pertes accidentelles).
   */
  const handleCancelForm = async () => {
    if (JSON.stringify(formData) !== formInitial) {
      const ok = await confirmer({
        title: 'Abandonner les modifications ?',
        message: 'Les changements apportés à ce quiz ne seront pas enregistrés.',
        confirmLabel: 'Abandonner',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setError(null);
    setViewMode('list');
  };

  /** ★ Phase 60 — libellé de la cible d'un quiz (cartes de la liste). */
  const getCibleLabel = (groupeId?: string | null): string | null => {
    if (!groupeId) return null;
    const c = cibles.find((x) => x.id === groupeId);
    return c ? libelleCible(c) : 'Classe archivée ou supprimée';
  };

  const handleDelete = async (quizId: string) => {
    try {
      await deleteQuiz(quizId);
      setSuccessMessage('Quiz supprimé avec succès.');
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      setError('Erreur lors de la suppression du quiz.');
      console.error(err);
    }
  };

  /* ══════════════════════════════════════════════
     HANDLERS DES QUESTIONS
     ★ Phase 60 : ajout, duplication, suppression, réordonnancement et
     options sont désormais gérés par <EditeurQuestionsClassiques />.
     ══════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════
     HANDLERS DE PRÉVISUALISATION
     ══════════════════════════════════════════════ */

  const handlePreview = (quiz: Quiz) => {
    setPreviewQuiz(quiz);
    setPreviewAnswers({});
    setPreviewSubmitted(false);
    setViewMode('preview');
  };

  const selectPreviewAnswer = (questionId: string, optionIndex: number) => {
    if (previewSubmitted) return;
    setPreviewAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const submitPreview = () => {
    setPreviewSubmitted(true);
  };

  /* ══════════════════════════════════════════════
     UTILITAIRES D'AFFICHAGE
     ══════════════════════════════════════════════ */

  const getDisciplineName = (discId: string): string => {
    return disciplines.find((d) => d.id === discId)?.nom || discId;
  };

  const DifficultyBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors: Record<string, string> = {
      facile: 'quiz-badge-facile',
      moyen: 'quiz-badge-moyen',
      difficile: 'quiz-badge-difficile',
    };
    return (
      <span className={`quiz-badge ${colors[level] || 'quiz-badge-moyen'}`}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  /* ══════════════════════════════════════════════
     RENDU : MESSAGES D'ÉTAT
     ══════════════════════════════════════════════ */
  const renderMessages = () => (
    <>
      {error && (
        <div className="admin-message admin-message-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="admin-message-close">
            <X size={16} />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="admin-message admin-message-success">
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );

  /* ══════════════════════════════════════════════
     RENDU : VUE LISTE DES QUIZ
     ══════════════════════════════════════════════ */
  const renderList = () => (
    <div className="quiz-manager">
      {/* ── En-tête avec bouton de création ── */}
      <div className="admin-header">
        <div>
          <h2 className="admin-title">
            <BookOpen size={24} /> Gestion des Quiz
          </h2>
          <p className="admin-subtitle">
            {quizzes.length} quiz au total · {filteredQuizzes.length} affiché(s)
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={handleCreate}>
          <Plus size={18} /> Nouveau Quiz
        </button>
      </div>

      {/* ── Barre de recherche et filtres ── */}
      <div className="admin-toolbar">
        <div className="admin-search-wrapper">
          <Search size={18} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Rechercher un quiz..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          className={`admin-btn admin-btn-outline ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filtres
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Panneau de filtres ── */}
      {showFilters && (
        <div className="admin-filters-panel">
          <div className="admin-filter-group">
            <label className="admin-filter-label">Discipline</label>
            <select
              className="admin-select"
              value={filterDiscipline}
              onChange={(e) => setFilterDiscipline(e.target.value)}
            >
              <option value="">Toutes les disciplines</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label">Accès</label>
            <select
              className="admin-select"
              value={filterPremium}
              onChange={(e) => setFilterPremium(e.target.value)}
            >
              <option value="">Tous</option>
              <option value="false">Gratuit</option>
              <option value="true">Premium</option>
            </select>
          </div>
          <div className="admin-filter-group">
            <label className="admin-filter-label">Difficulté</label>
            <select
              className="admin-select"
              value={filterDifficulte}
              onChange={(e) => setFilterDifficulte(e.target.value)}
            >
              <option value="">Toutes</option>
              <option value="facile">Facile</option>
              <option value="moyen">Moyen</option>
              <option value="difficile">Difficile</option>
            </select>
          </div>
          {/* ★ Phase 60 — filtre par classe / groupe */}
          <div className="admin-filter-group">
            <label className="admin-filter-label">Classe / groupe</label>
            <select
              className="admin-select"
              value={filterCible}
              onChange={(e) => setFilterCible(e.target.value)}
            >
              <option value="">Tous les quiz</option>
              <option value="__global__">Quiz globaux (sans classe)</option>
              {cibles.map((c) => (
                <option key={c.id} value={c.id}>{libelleCible(c, true)}</option>
              ))}
            </select>
          </div>
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setFilterDiscipline('');
              setFilterPremium('');
              setFilterDifficulte('');
              setFilterCible('');
              setSearchTerm('');
            }}
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* ── Liste des quiz ── */}
      {loading ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <p>Chargement des quiz...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="admin-empty-state">
          <HelpCircle size={48} />
          <h3>Aucun quiz trouvé</h3>
          <p>
            {quizzes.length === 0
              ? 'Créez votre premier quiz pour vos élèves.'
              : 'Aucun quiz ne correspond à vos filtres.'}
          </p>
          {quizzes.length === 0 && (
            <button className="admin-btn admin-btn-primary" onClick={handleCreate}>
              <Plus size={18} /> Créer un quiz
            </button>
          )}
        </div>
      ) : (
        <div className="quiz-grid">
          {filteredQuizzes.map((quiz) => {
            const stats = getQuizStats(quiz);
            return (
              <div key={quiz.id} className="quiz-card">
                <div className="quiz-card-header">
                  <div className="quiz-card-title-row">
                    <h3 className="quiz-card-title">{quiz.titre}</h3>
                    {quiz.isPremium && (
                      <span className="quiz-badge quiz-badge-premium">
                        <Star size={12} /> Premium
                      </span>
                    )}
                  </div>
                  <span className="quiz-card-discipline">
                    {getDisciplineName(quiz.disciplineId)}
                  </span>
                  {/* ★ Phase 60 — statut et cible visibles d'un coup d'œil */}
                  {(quiz.status === 'draft' || quiz.groupeId) && (
                    <div className="quiz-card-cible">
                      {quiz.status === 'draft' && (
                        <span className="quiz-badge quiz-badge-brouillon">Brouillon</span>
                      )}
                      {quiz.groupeId && (
                        <span className="quiz-badge quiz-badge-cible" title="Réservé aux élèves de ce groupe">
                          <Users size={12} /> {getCibleLabel(quiz.groupeId)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="quiz-card-stats">
                  <div className="quiz-stat">
                    <HelpCircle size={14} />
                    <span>{stats.nombreQuestions} question(s)</span>
                  </div>
                  <div className="quiz-stat">
                    <Award size={14} />
                    <span>{stats.totalPoints} pts</span>
                  </div>
                  <div className="quiz-stat">
                    <Clock size={14} />
                    <span>{stats.duree} min</span>
                  </div>
                </div>
                <div className="quiz-card-difficulty">
                  {stats.parDifficulte.facile > 0 && <DifficultyBadge level="facile" />}
                  {stats.parDifficulte.moyen > 0 && <DifficultyBadge level="moyen" />}
                  {stats.parDifficulte.difficile > 0 && <DifficultyBadge level="difficile" />}
                </div>
                <div className="quiz-card-actions">
                  <button
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    onClick={() => handlePreview(quiz)}
                    title="Prévisualiser"
                  >
                    <Eye size={14} /> Aperçu
                  </button>
                  <button
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    onClick={() => handleEdit(quiz)}
                    title="Modifier"
                  >
                    <Edit3 size={14} /> Modifier
                  </button>
                  {deleteConfirm === quiz.id ? (
                    <div className="quiz-delete-confirm">
                      <button
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDelete(quiz.id)}
                      >
                        Confirmer
                      </button>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-ghost"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      className="admin-btn admin-btn-sm admin-btn-danger-outline"
                      onClick={() => setDeleteConfirm(quiz.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════
     RENDU : FORMULAIRE DE CRÉATION / ÉDITION
     ══════════════════════════════════════════════ */
  const renderForm = () => (
    <div className="quiz-manager">
      <div className="admin-header">
        <div>
          <h2 className="admin-title">
            <BookOpen size={24} />
            {editingQuiz ? 'Modifier le quiz' : 'Nouveau quiz'}
          </h2>
          <p className="admin-subtitle">
            {formData.questions.length} question(s) ajoutée(s)
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-btn admin-btn-ghost" onClick={handleCancelForm}>
            <X size={18} /> Annuler
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={18} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* ── Informations générales ── */}
      <div className="admin-card quiz-form-section">
        <h3 className="quiz-form-section-title">Informations générales</h3>
        <div className="quiz-form-grid">
          <div className="admin-form-group quiz-form-full">
            <label className="admin-label">Titre du quiz *</label>
            <input
              type="text"
              className="admin-input"
              placeholder="Ex : Quiz - Les Misérables, Chapitre 1"
              value={formData.titre}
              onChange={(e) => setFormData((prev) => ({ ...prev, titre: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Discipline *</label>
            <select
              className="admin-select"
              value={formData.disciplineId}
              onChange={(e) => setFormData((prev) => ({ ...prev, disciplineId: e.target.value }))}
            >
              <option value="">-- Sélectionner --</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Durée (minutes)</label>
            <input
              type="number"
              className="admin-input"
              min={1}
              max={180}
              value={formData.duree}
              onChange={(e) => setFormData((prev) => ({ ...prev, duree: parseInt(e.target.value) || 15 }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Note minimale (%)</label>
            <input
              type="number"
              className="admin-input"
              min={0}
              max={100}
              value={formData.noteMinimale}
              onChange={(e) => setFormData((prev) => ({ ...prev, noteMinimale: parseInt(e.target.value) || 50 }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Accès</label>
            <div
              className={`quiz-toggle ${formData.isPremium ? 'quiz-toggle-active' : ''}`}
              onClick={() => setFormData((prev) => ({ ...prev, isPremium: !prev.isPremium }))}
            >
              <Star size={16} />
              <span>{formData.isPremium ? 'Premium (2 000 FCFA/mois)' : 'Gratuit'}</span>
            </div>
          </div>

          {/* ★ Phase 60 — Statut de publication */}
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="quiz-statut">Statut</label>
            <select
              id="quiz-statut"
              className="admin-select"
              value={formData.status === 'draft' ? 'draft' : 'published'}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value as 'draft' | 'published' }))
              }
            >
              <option value="published">Publié (visible par les élèves)</option>
              <option value="draft">Brouillon (masqué aux élèves)</option>
            </select>
          </div>

          {/* ★ Phase 60 — Lien avec une classe / un groupe */}
          <div className="admin-form-group quiz-form-full">
            <label className="admin-label" htmlFor="quiz-cible">
              <Users size={14} style={{ verticalAlign: '-2px' }} /> Classe / groupe ciblé
            </label>
            <select
              id="quiz-cible"
              className="admin-select"
              value={formData.groupeId || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, groupeId: e.target.value || null }))}
            >
              <option value="">Tous les élèves (quiz global)</option>
              {cibles.map((c) => (
                <option key={c.id} value={c.id}>{libelleCible(c, true)}</option>
              ))}
            </select>
            <p className="quiz-form-aide">
              {formData.groupeId
                ? 'Seuls les élèves inscrits à ce groupe verront le quiz dans leur espace ; il n’apparaît plus dans la page publique « Quiz gratuits ».'
                : 'Le quiz est proposé à tous les élèves (selon son accès Gratuit / Premium).'}
            </p>
          </div>
        </div>
      </div>

      {/* ★ Phase 60 — Texte support (corpus) affiché pendant le quiz */}
      <div className="admin-card quiz-form-section">
        <h3 className="quiz-form-section-title">
          <FileText size={18} style={{ verticalAlign: '-3px' }} /> Texte support (optionnel)
        </h3>
        <label className="quiz-form-check">
          <input
            type="checkbox"
            checked={formData.afficherCorpus === true}
            onChange={(e) => setFormData((prev) => ({ ...prev, afficherCorpus: e.target.checked }))}
          />
          <span>Afficher ce texte à l’élève pendant le quiz</span>
        </label>
        {(formData.afficherCorpus || formData.corpusText) && (
          <textarea
            className="admin-textarea"
            rows={6}
            placeholder="Collez ici l'extrait, le document ou l'énoncé commun aux questions…"
            value={formData.corpusText || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, corpusText: e.target.value }))}
          />
        )}
      </div>

      {/* ── Section des questions ── */}
      {/* ★ Phase 60 — éditeur partagé : réordonner (↑ ↓ / glisser), insérer,
          dupliquer, 2 à 6 options, actions groupées, questions incomplètes signalées */}
      <div className="admin-card quiz-form-section">
        <h3 className="quiz-form-section-title">Questions ({formData.questions.length})</h3>
        <EditeurQuestionsClassiques
          questions={formData.questions}
          onChange={(questions) => setFormData((prev) => ({ ...prev, questions }))}
          minQuestions={1}
        />
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════
     RENDU : VUE PRÉVISUALISATION
     ══════════════════════════════════════════════ */
  const renderPreview = () => {
    if (!previewQuiz) return null;
    const stats = getQuizStats(previewQuiz);

    let score = 0;
    let totalPoints = 0;
    if (previewSubmitted) {
      previewQuiz.questions.forEach((q) => {
        totalPoints += q.points || 1;
        if (previewAnswers[q.id] === q.reponseCorrecte) {
          score += q.points || 1;
        }
      });
    }

    return (
      <div className="quiz-manager">
        <div className="admin-header">
          <div>
            <h2 className="admin-title">
              <Eye size={24} /> Prévisualisation : {previewQuiz.titre}
            </h2>
            <p className="admin-subtitle">
              {getDisciplineName(previewQuiz.disciplineId)} · {stats.nombreQuestions} questions · {stats.duree} min
            </p>
          </div>
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => { setViewMode('list'); setPreviewQuiz(null); }}
          >
            <X size={18} /> Fermer
          </button>
        </div>

        {previewSubmitted && (
          <div className={`quiz-preview-score ${score / totalPoints >= (previewQuiz.noteMinimale || 50) / 100 ? 'success' : 'fail'}`}>
            <Award size={32} />
            <div>
              <h3>Score : {score}/{totalPoints} ({Math.round((score / totalPoints) * 100)}%)</h3>
              <p>
                Note minimale : {previewQuiz.noteMinimale || 50}% —{' '}
                {score / totalPoints >= (previewQuiz.noteMinimale || 50) / 100 ? '✅ Réussi !' : '❌ Non réussi'}
              </p>
            </div>
          </div>
        )}

        <div className="quiz-preview-questions">
          {previewQuiz.questions.map((question, index) => {
            const userAnswer = previewAnswers[question.id];
            const isCorrect = userAnswer === question.reponseCorrecte;

            return (
              <div key={question.id} className="admin-card quiz-preview-question">
                <div className="quiz-preview-question-header">
                  <span className="quiz-question-number">Q{index + 1}</span>
                  <DifficultyBadge level={question.difficulte || 'moyen'} />
                  <span className="quiz-question-points">{question.points} pt(s)</span>
                </div>
                <p className="quiz-preview-question-text">{question.question}</p>

                <div className="quiz-preview-options">
                  {question.options.map((option, optIndex) => {
                    let optionClass = 'quiz-preview-option';
                    if (previewSubmitted) {
                      if (optIndex === question.reponseCorrecte) optionClass += ' correct';
                      else if (optIndex === userAnswer && !isCorrect) optionClass += ' incorrect';
                    } else if (userAnswer === optIndex) {
                      optionClass += ' selected';
                    }

                    return (
                      <button
                        key={optIndex}
                        className={optionClass}
                        onClick={() => selectPreviewAnswer(question.id, optIndex)}
                        disabled={previewSubmitted}
                      >
                        <span className="quiz-preview-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                        <span>{option}</span>
                        {previewSubmitted && optIndex === question.reponseCorrecte && (
                          <CheckCircle size={16} className="quiz-preview-check" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {previewSubmitted && question.explication && (
                  <div className="quiz-preview-explication">
                    <strong>Explication :</strong> {question.explication}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!previewSubmitted && (
          <div className="quiz-preview-submit">
            <button
              className="admin-btn admin-btn-primary admin-btn-lg"
              onClick={submitPreview}
              disabled={Object.keys(previewAnswers).length < previewQuiz.questions.length}
            >
              <CheckCircle size={18} /> Soumettre ({Object.keys(previewAnswers).length}/{previewQuiz.questions.length})
            </button>
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     RENDU PRINCIPAL
     ══════════════════════════════════════════════ */
  return (
    <div className="admin-container">
      {renderMessages()}
      {viewMode === 'list' && renderList()}
      {viewMode === 'form' && renderForm()}
      {viewMode === 'preview' && renderPreview()}
    </div>
  );
};

export default QuizManager;
