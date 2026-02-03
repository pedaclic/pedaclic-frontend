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

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

interface DisciplineOption {
  id: string;
  nom: string;
}

type ViewMode = 'list' | 'form' | 'preview';

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
      const [quizData, discData] = await Promise.all([
        getQuizzes(),
        DisciplineService.getAll(),
      ]);
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
    setFormData({
      disciplineId: '',
      titre: '',
      questions: [createEmptyQuestion()],
      duree: 15,
      isPremium: false,
      noteMinimale: 50,
    });
    setExpandedQuestion(null);
    setViewMode('form');
  };

  const handleEdit = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setFormData({
      disciplineId: quiz.disciplineId,
      titre: quiz.titre,
      questions: quiz.questions || [],
      duree: quiz.duree || 15,
      isPremium: quiz.isPremium || false,
      noteMinimale: quiz.noteMinimale || 50,
    });
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
    if (formData.questions.length === 0) {
      setError('Le quiz doit contenir au moins une question.');
      return;
    }

    for (let i = 0; i < formData.questions.length; i++) {
      const q = formData.questions[i];
      if (!q.question.trim()) {
        setError(`La question ${i + 1} n'a pas d'énoncé.`);
        return;
      }
      const emptyOptions = q.options.filter((o) => !o.trim());
      if (emptyOptions.length > 0) {
        setError(`La question ${i + 1} a des options vides.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (editingQuiz) {
        await updateQuiz(editingQuiz.id, formData);
        setSuccessMessage('Quiz mis à jour avec succès !');
      } else {
        await createQuiz(formData);
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
     ══════════════════════════════════════════════ */

  const addQuestion = () => {
    const newQuestion = createEmptyQuestion();
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setExpandedQuestion(newQuestion.id);
  };

  const duplicateQuestion = (questionId: string) => {
    const source = formData.questions.find((q) => q.id === questionId);
    if (!source) return;
    const duplicate: Question = {
      ...source,
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      question: `${source.question} (copie)`,
    };
    const index = formData.questions.findIndex((q) => q.id === questionId);
    const updated = [...formData.questions];
    updated.splice(index + 1, 0, duplicate);
    setFormData((prev) => ({ ...prev, questions: updated }));
    setExpandedQuestion(duplicate.id);
  };

  const removeQuestion = (questionId: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }));
    if (expandedQuestion === questionId) setExpandedQuestion(null);
  };

  const updateQuestion = (questionId: string, field: keyof Question, value: any) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q
      ),
    }));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? value : o)) }
          : q
      ),
    }));
  };

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
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setFilterDiscipline('');
              setFilterPremium('');
              setFilterDifficulte('');
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
          <button className="admin-btn admin-btn-ghost" onClick={() => setViewMode('list')}>
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
        </div>
      </div>

      {/* ── Section des questions ── */}
      <div className="admin-card quiz-form-section">
        <div className="quiz-questions-header">
          <h3 className="quiz-form-section-title">
            Questions ({formData.questions.length})
          </h3>
          <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={addQuestion}>
            <Plus size={14} /> Ajouter une question
          </button>
        </div>

        {formData.questions.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: '2rem' }}>
            <HelpCircle size={36} />
            <p>Aucune question. Cliquez sur "Ajouter une question" pour commencer.</p>
          </div>
        ) : (
          <div className="quiz-questions-list">
            {formData.questions.map((question, index) => (
              <div
                key={question.id}
                className={`quiz-question-item ${expandedQuestion === question.id ? 'expanded' : ''}`}
              >
                {/* En-tête cliquable */}
                <div
                  className="quiz-question-header"
                  onClick={() =>
                    setExpandedQuestion(expandedQuestion === question.id ? null : question.id)
                  }
                >
                  <div className="quiz-question-header-left">
                    <GripVertical size={16} className="quiz-grip-icon" />
                    <span className="quiz-question-number">Q{index + 1}</span>
                    <span className="quiz-question-preview">
                      {question.question || 'Question sans énoncé...'}
                    </span>
                  </div>
                  <div className="quiz-question-header-right">
                    <DifficultyBadge level={question.difficulte || 'moyen'} />
                    <span className="quiz-question-points">{question.points} pt(s)</span>
                    {expandedQuestion === question.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Corps dépliable */}
                {expandedQuestion === question.id && (
                  <div className="quiz-question-body">
                    <div className="admin-form-group">
                      <label className="admin-label">Énoncé de la question *</label>
                      <textarea
                        className="admin-textarea"
                        rows={2}
                        placeholder="Ex : Quel est le personnage principal du roman ?"
                        value={question.question}
                        onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      />
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-label">Options de réponse (cliquez sur la bonne réponse)</label>
                      <div className="quiz-options-grid">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`quiz-option-item ${question.reponseCorrecte === optIndex ? 'quiz-option-correct' : ''}`}
                          >
                            <button
                              type="button"
                              className={`quiz-option-radio ${question.reponseCorrecte === optIndex ? 'active' : ''}`}
                              onClick={() => updateQuestion(question.id, 'reponseCorrecte', optIndex)}
                              title={question.reponseCorrecte === optIndex ? 'Bonne réponse' : 'Marquer comme bonne réponse'}
                            >
                              {question.reponseCorrecte === optIndex ? (
                                <CheckCircle size={16} />
                              ) : (
                                <span className="quiz-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                              )}
                            </button>
                            <input
                              type="text"
                              className="admin-input"
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              value={option}
                              onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-label">Explication (affichée après réponse)</label>
                      <textarea
                        className="admin-textarea"
                        rows={2}
                        placeholder="Ex : Jean Valjean est le protagoniste du roman de Victor Hugo..."
                        value={question.explication}
                        onChange={(e) => updateQuestion(question.id, 'explication', e.target.value)}
                      />
                    </div>

                    <div className="quiz-question-meta">
                      <div className="admin-form-group">
                        <label className="admin-label">Difficulté</label>
                        <select
                          className="admin-select"
                          value={question.difficulte}
                          onChange={(e) => updateQuestion(question.id, 'difficulte', e.target.value)}
                        >
                          <option value="facile">Facile</option>
                          <option value="moyen">Moyen</option>
                          <option value="difficile">Difficile</option>
                        </select>
                      </div>
                      <div className="admin-form-group">
                        <label className="admin-label">Points</label>
                        <input
                          type="number"
                          className="admin-input"
                          min={1}
                          max={10}
                          value={question.points}
                          onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    <div className="quiz-question-actions">
                      <button
                        className="admin-btn admin-btn-sm admin-btn-outline"
                        onClick={() => duplicateQuestion(question.id)}
                      >
                        <Copy size={14} /> Dupliquer
                      </button>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-danger-outline"
                        onClick={() => removeQuestion(question.id)}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {formData.questions.length > 0 && (
          <div className="quiz-add-question-bottom">
            <button className="admin-btn admin-btn-outline" onClick={addQuestion}>
              <Plus size={16} /> Ajouter une question
            </button>
          </div>
        )}
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
