/**
 * ============================================================
 * PEDACLIC — Phase 12 : Éditeur de Quiz Avancé
 * Composant principal pour créer/modifier un quiz multi-types
 * ============================================================
 * Types supportés : QCM Unique | QCM Multiple | Drag & Drop
 *                   Mise en Relation | Essai
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RichTextEditor } from './RichTextEditor';
import {
  QuestionAvancee,
  QuizAvanceFormData,
  TypeQuestion,
  DifficulteQuestion,
  QCMUniqueData,
  QCMMultipleData,
  DragDropData,
  MiseEnRelationData,
  TexteACompleterData,
  VraiFauxData,
  ReponseCourteData,
  OrdreChronologiqueData,
  TexteTrousMenuData,
  EssaiData,
  QCMOption,
  DragDropItem,
  RelationPair,
  MotCleEssai,
  TYPE_QUESTION_LABELS,
  TYPE_QUESTION_ICONS,
  TYPE_QUESTION_COLORS,
  creerQuestionVide,
  generateId,
} from '../../types/quiz-advanced';
import { createQuizAvance, updateQuizAvance } from '../../services/quizAdvancedService';
import '../../styles/quiz-advanced.css';

// ==================== INTERFACES PROPS ====================

interface QuizEditorProps {
  /** Quiz existant à modifier (null pour création) */
  existingQuiz?: QuizAvanceFormData & { id: string };
  /** Liste des disciplines disponibles */
  disciplines: { id: string; nom: string; classe: string }[];
  /** ID de l'auteur (admin ou prof) */
  auteurId: string;
  /** Groupes du prof (pour quiz de classe) — si fourni, affiche sélecteur */
  groupes?: { id: string; nom: string }[];
  /** Callback après sauvegarde réussie (quiz publié) */
  onSave?: (quizId: string) => void;
  /** Callback après enregistrement en brouillon (quizId, isNew) */
  onSaveDraft?: (quizId: string, isNew: boolean) => void;
  /** Callback pour annuler */
  onCancel?: () => void;
}

// ==================== COMPOSANT PRINCIPAL ====================

export const QuizEditor: React.FC<QuizEditorProps> = ({
  existingQuiz,
  disciplines,
  auteurId,
  groupes,
  onSave,
  onSaveDraft,
  onCancel,
}) => {
  // ---- États du formulaire ----
  const [titre, setTitre] = useState(existingQuiz?.titre || '');
  const [description, setDescription] = useState(existingQuiz?.description || '');
  const [disciplineId, setDisciplineId] = useState(existingQuiz?.disciplineId || '');
  const [groupeId, setGroupeId] = useState<string>(existingQuiz?.groupeId ?? '');
  const [duree, setDuree] = useState(existingQuiz?.duree || 30);
  const [isPremium, setIsPremium] = useState(existingQuiz?.isPremium ?? true);
  const [noteMinimale, setNoteMinimale] = useState(existingQuiz?.noteMinimale || 10);
  const [melangerQuestions, setMelangerQuestions] = useState(existingQuiz?.melangerQuestions ?? false);
  const [melangerOptions, setMelangerOptions] = useState(existingQuiz?.melangerOptions ?? false);
  const [afficherCorrection, setAfficherCorrection] = useState(existingQuiz?.afficherCorrection ?? true);
  const [tentativesMax, setTentativesMax] = useState(existingQuiz?.tentativesMax || 0);
  const [questions, setQuestions] = useState<QuestionAvancee[]>(existingQuiz?.questions || []);

  // ---- États UI ----
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ==================== GESTION DES QUESTIONS ====================

  /** Ajouter une nouvelle question du type sélectionné */
  const ajouterQuestion = useCallback((type: TypeQuestion) => {
    const nouvelleQuestion = creerQuestionVide(type, questions.length + 1);
    setQuestions((prev) => [...prev, nouvelleQuestion]);
    setActiveQuestionIndex(questions.length); // Ouvrir la nouvelle question
    setShowAddMenu(false);
  }, [questions.length]);

  /** Supprimer une question */
  const supprimerQuestion = useCallback((index: number) => {
    if (!confirm('Supprimer cette question ?')) return;
    setQuestions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Recalculer l'ordre
      return updated.map((q, i) => ({ ...q, ordre: i + 1 }));
    });
    setActiveQuestionIndex(null);
  }, []);

  /** Dupliquer une question */
  const dupliquerQuestion = useCallback((index: number) => {
    setQuestions((prev) => {
      const original = prev[index];
      const copie: QuestionAvancee = {
        ...JSON.parse(JSON.stringify(original)),
        id: generateId('q'),
        ordre: prev.length + 1,
      };
      return [...prev, copie];
    });
  }, []);

  /** Déplacer une question (haut/bas) */
  const deplacerQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const newArr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
      return newArr.map((q, i) => ({ ...q, ordre: i + 1 }));
    });
    setActiveQuestionIndex(
      direction === 'up' ? (activeQuestionIndex !== null ? activeQuestionIndex - 1 : null)
                         : (activeQuestionIndex !== null ? activeQuestionIndex + 1 : null)
    );
  }, [activeQuestionIndex]);

  /** Mettre à jour une question */
  const updateQuestion = useCallback((index: number, updates: Partial<QuestionAvancee>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  }, []);

  // ==================== SAUVEGARDE ====================

  /** Enregistrer comme brouillon — validation allégée */
  const handleSaveDraft = async () => {
    const titreVal = titre.trim() || 'Brouillon sans titre';
    const discId = disciplineId || disciplines[0]?.id || '';

    if (!discId) {
      setError('Sélectionnez une discipline pour enregistrer le brouillon');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const formData: QuizAvanceFormData = {
        disciplineId: discId,
        titre: titreVal,
        description: description.trim() || undefined,
        questions,
        duree,
        isPremium,
        noteMinimale,
        melangerQuestions,
        melangerOptions,
        afficherCorrection,
        tentativesMax,
        groupeId: groupes && groupes.length > 0 ? (groupeId || null) : undefined,
      };

      let quizId: string;
      if (existingQuiz?.id) {
        await updateQuizAvance(existingQuiz.id, formData, { asDraft: true });
        quizId = existingQuiz.id;
        onSaveDraft?.(quizId, false);
      } else {
        quizId = await createQuizAvance(formData, auteurId, true);
        onSaveDraft?.(quizId, true);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du brouillon');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Validations
    if (!titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!disciplineId) { setError('Sélectionnez une discipline'); return; }
    if (questions.length === 0) { setError('Ajoutez au moins une question'); return; }

    // Vérifier que chaque question a un énoncé
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const enonceTexte = q.enonce.replace(/<[^>]*>/g, '').trim();
      if (!enonceTexte) {
        setError(`La question ${i + 1} n'a pas d'énoncé`);
        setActiveQuestionIndex(i);
        return;
      }
    }

    setError(null);
    setSaving(true);

    try {
      const formData: QuizAvanceFormData = {
        disciplineId,
        titre: titre.trim(),
        description: description.trim() || undefined,
        questions,
        duree,
        isPremium,
        noteMinimale,
        melangerQuestions,
        melangerOptions,
        afficherCorrection,
        tentativesMax,
        groupeId: groupes && groupes.length > 0 ? (groupeId || null) : undefined,
      };

      let quizId: string;
      if (existingQuiz?.id) {
        await updateQuizAvance(existingQuiz.id, formData, { asDraft: false });
        quizId = existingQuiz.id;
      } else {
        quizId = await createQuizAvance(formData, auteurId, false);
      }

      onSave?.(quizId);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ==================== CALCUL SCORE TOTAL ====================

  const scoreTotal = questions.reduce((sum, q) => sum + q.points, 0);

  // ==================== RENDU ====================

  return (
    <div className="quiz-editor">
      {/* ---- En-tête ---- */}
      <div className="quiz-editor__header">
        <h2>{existingQuiz ? '✏️ Modifier le quiz' : '📝 Nouveau quiz avancé'}</h2>
        <div className="quiz-editor__header-actions">
          <span className="quiz-editor__score-badge">
            Score total : {scoreTotal} pts
          </span>
          <span className="quiz-editor__count-badge">
            {questions.length} question{questions.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ---- Message d'erreur ---- */}
      {error && (
        <div className="quiz-editor__error">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ======== SECTION : PARAMÈTRES DU QUIZ ======== */}
      <div className="quiz-editor__section">
        <h3 className="quiz-editor__section-title">⚙️ Paramètres du quiz</h3>

        <div className="quiz-editor__grid">
          {/* Titre */}
          <div className="quiz-editor__field quiz-editor__field--full">
            <label>Titre du quiz *</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Évaluation Chapitre 3 — Les fonctions"
              className="quiz-editor__input"
            />
          </div>

          {/* Discipline */}
          <div className="quiz-editor__field">
            <label>Discipline *</label>
            <select
              value={disciplineId}
              onChange={(e) => setDisciplineId(e.target.value)}
              className="quiz-editor__select"
            >
              <option value="">— Sélectionner —</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} ({d.classe})
                </option>
              ))}
            </select>
          </div>

          {/* Classe (quiz de prof) */}
          {groupes && groupes.length > 0 && (
            <div className="quiz-editor__field">
              <label>Classe cible</label>
              <select
                value={groupeId}
                onChange={(e) => setGroupeId(e.target.value)}
                className="quiz-editor__select"
              >
                <option value="">— Toutes mes classes —</option>
                {groupes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Durée */}
          <div className="quiz-editor__field">
            <label>Durée (minutes)</label>
            <input
              type="number"
              value={duree}
              onChange={(e) => setDuree(Number(e.target.value))}
              min={1}
              max={180}
              className="quiz-editor__input"
            />
          </div>

          {/* Note minimale */}
          <div className="quiz-editor__field">
            <label>Note minimale (/20)</label>
            <input
              type="number"
              value={noteMinimale}
              onChange={(e) => setNoteMinimale(Number(e.target.value))}
              min={0}
              max={20}
              className="quiz-editor__input"
            />
          </div>

          {/* Tentatives max */}
          <div className="quiz-editor__field">
            <label>Tentatives max (0 = illimité)</label>
            <input
              type="number"
              value={tentativesMax}
              onChange={(e) => setTentativesMax(Number(e.target.value))}
              min={0}
              max={10}
              className="quiz-editor__input"
            />
          </div>

          {/* Description */}
          <div className="quiz-editor__field quiz-editor__field--full">
            <label>Description (optionnel)</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Décrivez le contenu et les objectifs de ce quiz..."
              minHeight={80}
              toolbar={['bold', 'italic', 'underline', 'color', 'bulletList']}
            />
          </div>
        </div>

        {/* Checkboxes options */}
        <div className="quiz-editor__options-row">
          <label className="quiz-editor__checkbox">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
            />
            <span>🔒 Premium</span>
          </label>
          <label className="quiz-editor__checkbox">
            <input
              type="checkbox"
              checked={melangerQuestions}
              onChange={(e) => setMelangerQuestions(e.target.checked)}
            />
            <span>🔀 Mélanger les questions</span>
          </label>
          <label className="quiz-editor__checkbox">
            <input
              type="checkbox"
              checked={melangerOptions}
              onChange={(e) => setMelangerOptions(e.target.checked)}
            />
            <span>🔀 Mélanger les options QCM</span>
          </label>
          <label className="quiz-editor__checkbox">
            <input
              type="checkbox"
              checked={afficherCorrection}
              onChange={(e) => setAfficherCorrection(e.target.checked)}
            />
            <span>✅ Afficher la correction</span>
          </label>
        </div>
      </div>

      {/* ======== SECTION : QUESTIONS ======== */}
      <div className="quiz-editor__section">
        <h3 className="quiz-editor__section-title">📋 Questions</h3>

        {/* Liste des questions */}
        <div className="quiz-editor__questions-list">
          {questions.map((question, index) => (
            <QuestionEditorItem
              key={question.id}
              question={question}
              index={index}
              isActive={activeQuestionIndex === index}
              onToggle={() =>
                setActiveQuestionIndex(activeQuestionIndex === index ? null : index)
              }
              onUpdate={(updates) => updateQuestion(index, updates)}
              onDelete={() => supprimerQuestion(index)}
              onDuplicate={() => dupliquerQuestion(index)}
              onMoveUp={() => deplacerQuestion(index, 'up')}
              onMoveDown={() => deplacerQuestion(index, 'down')}
              isFirst={index === 0}
              isLast={index === questions.length - 1}
            />
          ))}
        </div>

        {/* Bouton ajouter une question */}
        <div className="quiz-editor__add-wrapper">
          <button
            type="button"
            className="quiz-editor__add-btn"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            + Ajouter une question
          </button>

          {/* Menu de sélection du type */}
          {showAddMenu && (
            <div className="quiz-editor__add-menu">
              {(Object.keys(TYPE_QUESTION_LABELS) as TypeQuestion[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className="quiz-editor__add-menu-item"
                  onClick={() => ajouterQuestion(type)}
                >
                  <span
                    className="quiz-editor__type-badge"
                    style={{ backgroundColor: TYPE_QUESTION_COLORS[type] }}
                  >
                    {TYPE_QUESTION_ICONS[type]}
                  </span>
                  <span>{TYPE_QUESTION_LABELS[type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ======== BARRE D'ACTIONS (bas) ======== */}
      <div className="quiz-editor__actions">
        <button
          type="button"
          className="quiz-editor__btn quiz-editor__btn--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="button"
          className="quiz-editor__btn quiz-editor__btn--outline"
          onClick={handleSaveDraft}
          disabled={saving || !disciplines.length}
          title="Sauvegarder pour continuer plus tard"
        >
          {saving ? '⏳ Enregistrement...' : '📝 Enregistrer comme brouillon'}
        </button>
        <button
          type="button"
          className="quiz-editor__btn quiz-editor__btn--primary"
          onClick={handleSave}
          disabled={saving || questions.length === 0}
        >
          {saving ? '⏳ Sauvegarde...' : existingQuiz ? '💾 Mettre à jour' : '💾 Créer le quiz'}
        </button>
      </div>
    </div>
  );
};

// ==================== COMPOSANT : ÉDITEUR D'UNE QUESTION ====================

interface QuestionEditorItemProps {
  question: QuestionAvancee;
  index: number;
  isActive: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<QuestionAvancee>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const QuestionEditorItem: React.FC<QuestionEditorItemProps> = ({
  question,
  index,
  isActive,
  onToggle,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const typeColor = TYPE_QUESTION_COLORS[question.type];
  const typeIcon = TYPE_QUESTION_ICONS[question.type];
  const typeLabel = TYPE_QUESTION_LABELS[question.type];

  /** Extraire le texte brut d'un HTML pour l'aperçu */
  const getPreview = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.length > 80 ? text.substring(0, 80) + '...' : text || '(sans énoncé)';
  };

  return (
    <div
      className={`question-editor ${isActive ? 'question-editor--active' : ''}`}
      style={{ borderLeftColor: typeColor }}
    >
      {/* ---- En-tête pliable ---- */}
      <div className="question-editor__header" onClick={onToggle}>
        <div className="question-editor__header-left">
          <span className="question-editor__number">{index + 1}</span>
          <span
            className="question-editor__type-badge"
            style={{ backgroundColor: typeColor }}
          >
            {typeIcon} {typeLabel}
          </span>
          {!isActive && (
            <span className="question-editor__preview">
              {getPreview(question.enonce)}
            </span>
          )}
        </div>
        <div className="question-editor__header-right">
          <span className="question-editor__points">{question.points} pts</span>
          <span className="question-editor__toggle">{isActive ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ---- Contenu déplié ---- */}
      {isActive && (
        <div className="question-editor__body">
          {/* Barre d'outils question */}
          <div className="question-editor__toolbar">
            <button type="button" onClick={onMoveUp} disabled={isFirst} title="Monter">↑</button>
            <button type="button" onClick={onMoveDown} disabled={isLast} title="Descendre">↓</button>
            <button type="button" onClick={onDuplicate} title="Dupliquer">📋</button>
            <button type="button" onClick={onDelete} className="btn-danger" title="Supprimer">🗑️</button>
          </div>

          {/* Énoncé avec éditeur riche */}
          <div className="question-editor__field">
            <label>Énoncé de la question *</label>
            <RichTextEditor
              value={question.enonce}
              onChange={(html) => onUpdate({ enonce: html })}
              placeholder="Saisissez l'énoncé de la question..."
              minHeight={100}
            />
          </div>

          {/* Paramètres communs */}
          <div className="question-editor__params">
            <div className="question-editor__param">
              <label>Difficulté</label>
              <select
                value={question.difficulte}
                onChange={(e) =>
                  onUpdate({ difficulte: e.target.value as DifficulteQuestion })
                }
              >
                <option value="facile">🟢 Facile</option>
                <option value="moyen">🟡 Moyen</option>
                <option value="difficile">🔴 Difficile</option>
              </select>
            </div>
            <div className="question-editor__param">
              <label>Points</label>
              <input
                type="number"
                value={question.points}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                min={1}
                max={20}
              />
            </div>
          </div>

          {/* ---- Éditeur spécifique au type ---- */}
          <div className="question-editor__type-specific">
            {question.type === 'qcm_unique' && (
              <QCMUniqueEditor
                data={question.typeData as QCMUniqueData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'qcm_multiple' && (
              <QCMMultipleEditor
                data={question.typeData as QCMMultipleData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'drag_drop' && (
              <DragDropEditor
                data={question.typeData as DragDropData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'mise_en_relation' && (
              <MiseEnRelationEditor
                data={question.typeData as MiseEnRelationData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'texte_a_completer' && (
              <TexteACompleterEditor
                data={question.typeData as TexteACompleterData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'vrai_faux' && (
              <VraiFauxEditor
                data={question.typeData as VraiFauxData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'reponse_courte' && (
              <ReponseCourteEditor
                data={question.typeData as ReponseCourteData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'ordre_chronologique' && (
              <OrdreChronologiqueEditor
                data={question.typeData as OrdreChronologiqueData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'texte_trous_menu' && (
              <TexteTrousMenuEditor
                data={question.typeData as TexteTrousMenuData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
            {question.type === 'essai' && (
              <EssaiEditor
                data={question.typeData as EssaiData}
                onChange={(typeData) => onUpdate({ typeData })}
              />
            )}
          </div>

          {/* Explication (optionnel) */}
          <div className="question-editor__field">
            <label>Explication (affichée après correction, optionnel)</label>
            <RichTextEditor
              value={question.explication || ''}
              onChange={(html) => onUpdate({ explication: html })}
              placeholder="Expliquez la bonne réponse..."
              minHeight={60}
              toolbar={['bold', 'italic', 'color', 'link']}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== ÉDITEURS PAR TYPE DE QUESTION ====================

// ---- 1. QCM CHOIX UNIQUE ----

interface QCMUniqueEditorProps {
  data: QCMUniqueData;
  onChange: (data: QCMUniqueData) => void;
}

const QCMUniqueEditor: React.FC<QCMUniqueEditorProps> = ({ data, onChange }) => {
  const updateOption = (optIndex: number, updates: Partial<QCMOption>) => {
    const newOptions = data.options.map((opt, i) => {
      if (i === optIndex) return { ...opt, ...updates };
      // Pour QCM unique, s'assurer qu'une seule est correcte
      if (updates.isCorrect === true) return { ...opt, isCorrect: false };
      return opt;
    });
    onChange({ options: newOptions });
  };

  const ajouterOption = () => {
    if (data.options.length >= 6) return;
    onChange({
      options: [...data.options, { id: generateId('opt'), texte: '', isCorrect: false }],
    });
  };

  const supprimerOption = (optIndex: number) => {
    if (data.options.length <= 2) return;
    onChange({ options: data.options.filter((_, i) => i !== optIndex) });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">
        🔘 Options (sélectionnez la bonne réponse)
      </label>
      {data.options.map((opt, i) => (
        <div key={opt.id} className="type-editor__option-row">
          {/* Radio pour sélectionner la bonne réponse */}
          <input
            type="radio"
            name={`qcm_unique_${opt.id}`}
            checked={opt.isCorrect}
            onChange={() => updateOption(i, { isCorrect: true })}
            className="type-editor__radio"
            title="Bonne réponse"
          />
          {/* Texte de l'option avec éditeur riche */}
          <div className="type-editor__option-text">
            <RichTextEditor
              value={opt.texte}
              onChange={(html) => updateOption(i, { texte: html })}
              placeholder={`Option ${i + 1}...`}
              minHeight={40}
              toolbar={['bold', 'italic', 'color', 'subscript', 'superscript']}
            />
          </div>
          {/* Indicateur bonne réponse */}
          {opt.isCorrect && <span className="type-editor__correct-badge">✓</span>}
          {/* Supprimer */}
          <button
            type="button"
            className="type-editor__remove-btn"
            onClick={() => supprimerOption(i)}
            disabled={data.options.length <= 2}
            title="Supprimer cette option"
          >
            ✕
          </button>
        </div>
      ))}
      {data.options.length < 6 && (
        <button type="button" className="type-editor__add-btn" onClick={ajouterOption}>
          + Ajouter une option
        </button>
      )}
    </div>
  );
};

// ---- 2. QCM CHOIX MULTIPLE ----

interface QCMMultipleEditorProps {
  data: QCMMultipleData;
  onChange: (data: QCMMultipleData) => void;
}

const QCMMultipleEditor: React.FC<QCMMultipleEditorProps> = ({ data, onChange }) => {
  const updateOption = (optIndex: number, updates: Partial<QCMOption>) => {
    const newOptions = data.options.map((opt, i) =>
      i === optIndex ? { ...opt, ...updates } : opt
    );
    onChange({ ...data, options: newOptions });
  };

  const ajouterOption = () => {
    if (data.options.length >= 8) return;
    onChange({
      ...data,
      options: [...data.options, { id: generateId('opt'), texte: '', isCorrect: false }],
    });
  };

  const supprimerOption = (optIndex: number) => {
    if (data.options.length <= 2) return;
    onChange({ ...data, options: data.options.filter((_, i) => i !== optIndex) });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">
        ☑️ Options (cochez toutes les bonnes réponses)
      </label>
      {data.options.map((opt, i) => (
        <div key={opt.id} className="type-editor__option-row">
          <input
            type="checkbox"
            checked={opt.isCorrect}
            onChange={(e) => updateOption(i, { isCorrect: e.target.checked })}
            className="type-editor__checkbox"
            title="Bonne réponse"
          />
          <div className="type-editor__option-text">
            <RichTextEditor
              value={opt.texte}
              onChange={(html) => updateOption(i, { texte: html })}
              placeholder={`Option ${i + 1}...`}
              minHeight={40}
              toolbar={['bold', 'italic', 'color', 'subscript', 'superscript']}
            />
          </div>
          {opt.isCorrect && <span className="type-editor__correct-badge">✓</span>}
          <button
            type="button"
            className="type-editor__remove-btn"
            onClick={() => supprimerOption(i)}
            disabled={data.options.length <= 2}
          >
            ✕
          </button>
        </div>
      ))}
      {data.options.length < 8 && (
        <button type="button" className="type-editor__add-btn" onClick={ajouterOption}>
          + Ajouter une option
        </button>
      )}
      {/* Option scoring partiel */}
      <label className="type-editor__sub-option">
        <input
          type="checkbox"
          checked={data.scoringPartiel}
          onChange={(e) => onChange({ ...data, scoringPartiel: e.target.checked })}
        />
        <span>Accorder des points partiels (proportionnel aux bonnes réponses trouvées)</span>
      </label>
    </div>
  );
};

// ---- 3. DRAG & DROP (RÉORDONNER) ----

interface DragDropEditorProps {
  data: DragDropData;
  onChange: (data: DragDropData) => void;
}

const DragDropEditor: React.FC<DragDropEditorProps> = ({ data, onChange }) => {
  const updateItem = (itemIndex: number, updates: Partial<DragDropItem>) => {
    const newItems = data.items.map((item, i) =>
      i === itemIndex ? { ...item, ...updates } : item
    );
    onChange({ ...data, items: newItems });
  };

  const ajouterItem = () => {
    if (data.items.length >= 10) return;
    onChange({
      ...data,
      items: [
        ...data.items,
        {
          id: generateId('item'),
          texte: '',
          ordreCorrect: data.items.length + 1,
        },
      ],
    });
  };

  const supprimerItem = (itemIndex: number) => {
    if (data.items.length <= 2) return;
    const newItems = data.items
      .filter((_, i) => i !== itemIndex)
      .map((item, i) => ({ ...item, ordreCorrect: i + 1 }));
    onChange({ ...data, items: newItems });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">
        ↕️ Éléments à réordonner (dans l'ordre correct)
      </label>
      <p className="type-editor__hint">
        Saisissez les éléments dans l'ordre correct. Ils seront mélangés automatiquement
        pour l'élève.
      </p>

      {/* Consigne */}
      <div className="type-editor__field-inline">
        <label>Consigne :</label>
        <input
          type="text"
          value={data.consigneOrdre}
          onChange={(e) => onChange({ ...data, consigneOrdre: e.target.value })}
          placeholder="Ex: Classez du plus ancien au plus récent"
          className="type-editor__input"
        />
      </div>

      {data.items.map((item, i) => (
        <div key={item.id} className="type-editor__drag-row">
          <span className="type-editor__drag-number">{i + 1}</span>
          <div className="type-editor__option-text">
            <RichTextEditor
              value={item.texte}
              onChange={(html) => updateItem(i, { texte: html })}
              placeholder={`Élément ${i + 1}...`}
              minHeight={40}
              toolbar={['bold', 'italic', 'color']}
            />
          </div>
          <button
            type="button"
            className="type-editor__remove-btn"
            onClick={() => supprimerItem(i)}
            disabled={data.items.length <= 2}
          >
            ✕
          </button>
        </div>
      ))}
      {data.items.length < 10 && (
        <button type="button" className="type-editor__add-btn" onClick={ajouterItem}>
          + Ajouter un élément
        </button>
      )}
    </div>
  );
};

// ---- 4. MISE EN RELATION ----

interface MiseEnRelationEditorProps {
  data: MiseEnRelationData;
  onChange: (data: MiseEnRelationData) => void;
}

const MiseEnRelationEditor: React.FC<MiseEnRelationEditorProps> = ({ data, onChange }) => {
  const updatePaire = (pairIndex: number, updates: Partial<RelationPair>) => {
    const newPaires = data.paires.map((p, i) =>
      i === pairIndex ? { ...p, ...updates } : p
    );
    onChange({ paires: newPaires });
  };

  const ajouterPaire = () => {
    if (data.paires.length >= 8) return;
    onChange({
      paires: [...data.paires, { id: generateId('pair'), gauche: '', droite: '' }],
    });
  };

  const supprimerPaire = (pairIndex: number) => {
    if (data.paires.length <= 2) return;
    onChange({ paires: data.paires.filter((_, i) => i !== pairIndex) });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">
        🔗 Paires à relier (gauche ↔ droite)
      </label>
      <p className="type-editor__hint">
        Saisissez les correspondances correctes. La colonne droite sera mélangée pour l'élève.
      </p>

      <div className="type-editor__relation-header">
        <span>Colonne A (gauche)</span>
        <span></span>
        <span>Colonne B (droite)</span>
        <span></span>
      </div>

      {data.paires.map((paire, i) => (
        <div key={paire.id} className="type-editor__relation-row">
          <div className="type-editor__relation-cell">
            <RichTextEditor
              value={paire.gauche}
              onChange={(html) => updatePaire(i, { gauche: html })}
              placeholder={`Élément A${i + 1}...`}
              minHeight={40}
              toolbar={['bold', 'italic', 'color']}
            />
          </div>
          <span className="type-editor__relation-arrow">↔</span>
          <div className="type-editor__relation-cell">
            <RichTextEditor
              value={paire.droite}
              onChange={(html) => updatePaire(i, { droite: html })}
              placeholder={`Élément B${i + 1}...`}
              minHeight={40}
              toolbar={['bold', 'italic', 'color']}
            />
          </div>
          <button
            type="button"
            className="type-editor__remove-btn"
            onClick={() => supprimerPaire(i)}
            disabled={data.paires.length <= 2}
          >
            ✕
          </button>
        </div>
      ))}
      {data.paires.length < 8 && (
        <button type="button" className="type-editor__add-btn" onClick={ajouterPaire}>
          + Ajouter une paire
        </button>
      )}
    </div>
  );
};

// ---- 5. TEXTE À COMPLÉTER ----

const BLANK_PLACEHOLDER = '_____';

/** Compte le nombre de trous (_____) dans la phrase */
function countBlanks(phrase: string): number {
  const matches = phrase.match(/_{2,}/g);
  return matches ? matches.length : 0;
}

interface TexteACompleterEditorProps {
  data: TexteACompleterData;
  onChange: (data: TexteACompleterData) => void;
}

const TexteACompleterEditor: React.FC<TexteACompleterEditorProps> = ({ data, onChange }) => {
  const syncBlanksFromPhrase = (phrase: string) => {
    const nbBlanks = countBlanks(phrase);
    const currentBlanks = [...data.blanks];

    if (nbBlanks > currentBlanks.length) {
      // Ajouter des trous
      const newBlanks = [...currentBlanks];
      while (newBlanks.length < nbBlanks) {
        newBlanks.push({ reponsesAcceptees: [''] });
      }
      onChange({ phrase, blanks: newBlanks });
    } else if (nbBlanks < currentBlanks.length) {
      // Retirer des trous
      onChange({ phrase, blanks: currentBlanks.slice(0, nbBlanks) });
    } else {
      onChange({ phrase, blanks: currentBlanks });
    }
  };

  const updatePhrase = (phrase: string) => syncBlanksFromPhrase(phrase);

  const updateBlank = (blankIndex: number, reponses: string[]) => {
    const newBlanks = data.blanks.map((b, i) =>
      i === blankIndex ? { reponsesAcceptees: reponses } : b
    );
    onChange({ ...data, blanks: newBlanks });
  };

  const addReponseAcceptee = (blankIndex: number) => {
    const blank = data.blanks[blankIndex];
    updateBlank(blankIndex, [...blank.reponsesAcceptees, '']);
  };

  const updateReponseAcceptee = (blankIndex: number, repIndex: number, value: string) => {
    const blank = data.blanks[blankIndex];
    const newReponses = [...blank.reponsesAcceptees];
    newReponses[repIndex] = value;
    updateBlank(blankIndex, newReponses);
  };

  const supprimerReponseAcceptee = (blankIndex: number, repIndex: number) => {
    const blank = data.blanks[blankIndex];
    if (blank.reponsesAcceptees.length <= 1) return;
    updateBlank(
      blankIndex,
      blank.reponsesAcceptees.filter((_, i) => i !== repIndex)
    );
  };

  const nbBlanks = countBlanks(data.phrase);

  return (
    <div className="type-editor">
      <label className="type-editor__label">✏️ Phrase à compléter</label>
      <p className="type-editor__hint">
        Utilisez <code>{BLANK_PLACEHOLDER}</code> pour chaque trou. Exemple : « La _____ du Sénégal est _____. »
      </p>

      <div className="type-editor__field-block">
        <label>Phrase avec trous</label>
        <input
          type="text"
          value={data.phrase}
          onChange={(e) => updatePhrase(e.target.value)}
          placeholder="La _____ du Sénégal est _____."
          className="type-editor__input-full"
        />
      </div>

      {nbBlanks > 0 && (
        <div className="type-editor__blanks">
          <label className="type-editor__sub-label">Réponses acceptées par trou (dans l&apos;ordre)</label>
          {data.blanks.slice(0, nbBlanks).map((blank, i) => (
            <div key={i} className="type-editor__blank-group">
              <span className="type-editor__blank-label">Trou {i + 1} :</span>
              <div className="type-editor__blank-reponses">
                {blank.reponsesAcceptees.map((rep, j) => (
                  <div key={j} className="type-editor__blank-rep-row">
                    <input
                      type="text"
                      value={rep}
                      onChange={(e) => updateReponseAcceptee(i, j, e.target.value)}
                      placeholder="Réponse acceptée..."
                      className="type-editor__blank-input"
                    />
                    <button
                      type="button"
                      className="type-editor__remove-btn"
                      onClick={() => supprimerReponseAcceptee(i, j)}
                      disabled={blank.reponsesAcceptees.length <= 1}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="type-editor__add-inline-btn"
                  onClick={() => addReponseAcceptee(i)}
                  title="Ajouter une variante acceptée"
                >
                  + Variante
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- 6. VRAI / FAUX ----

interface VraiFauxEditorProps {
  data: VraiFauxData;
  onChange: (data: VraiFauxData) => void;
}

const VraiFauxEditor: React.FC<VraiFauxEditorProps> = ({ data, onChange }) => (
  <div className="type-editor">
    <label className="type-editor__label">✓✗ Affirmation</label>
    <p className="type-editor__hint">L&apos;élève devra indiquer si l&apos;affirmation est Vraie ou Fausse.</p>
    <div className="type-editor__field-block">
      <label>Affirmation</label>
      <RichTextEditor
        value={data.affirmation}
        onChange={(html) => onChange({ ...data, affirmation: html })}
        placeholder="Ex: Le Sénégal est situé en Afrique de l'Ouest."
        minHeight={60}
        toolbar={['bold', 'italic', 'color']}
      />
    </div>
    <div className="type-editor__field-inline">
      <label>Bonne réponse :</label>
      <select
        value={data.bonneReponse ? 'true' : 'false'}
        onChange={(e) => onChange({ ...data, bonneReponse: e.target.value === 'true' })}
      >
        <option value="true">Vrai</option>
        <option value="false">Faux</option>
      </select>
    </div>
  </div>
);

// ---- 7. RÉPONSE COURTE ----

interface ReponseCourteEditorProps {
  data: ReponseCourteData;
  onChange: (data: ReponseCourteData) => void;
}

const ReponseCourteEditor: React.FC<ReponseCourteEditorProps> = ({ data, onChange }) => {
  const addReponse = () => onChange({ ...data, reponsesAcceptees: [...data.reponsesAcceptees, ''] });
  const updateReponse = (i: number, v: string) => {
    const newR = [...data.reponsesAcceptees];
    newR[i] = v;
    onChange({ ...data, reponsesAcceptees: newR });
  };
  const supprimerReponse = (i: number) => {
    if (data.reponsesAcceptees.length <= 1) return;
    onChange({ ...data, reponsesAcceptees: data.reponsesAcceptees.filter((_, j) => j !== i) });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">📝 Réponse courte</label>
      <p className="type-editor__hint">Une ou plusieurs réponses acceptées (variantes, synonymes).</p>
      <div className="type-editor__field-block">
        <label>Question</label>
        <RichTextEditor
          value={data.question}
          onChange={(html) => onChange({ ...data, question: html })}
          placeholder="Ex: Quelle est la capitale du Sénégal ?"
          minHeight={60}
          toolbar={['bold', 'italic', 'color']}
        />
      </div>
      <div className="type-editor__blanks">
        <label className="type-editor__sub-label">Réponses acceptées</label>
        {data.reponsesAcceptees.map((rep, i) => (
          <div key={i} className="type-editor__blank-rep-row">
            <input
              type="text"
              value={rep}
              onChange={(e) => updateReponse(i, e.target.value)}
              placeholder="Réponse acceptée..."
              className="type-editor__blank-input"
            />
            <button
              type="button"
              className="type-editor__remove-btn"
              onClick={() => supprimerReponse(i)}
              disabled={data.reponsesAcceptees.length <= 1}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="type-editor__add-inline-btn" onClick={addReponse}>
          + Ajouter une variante
        </button>
      </div>
    </div>
  );
};

// ---- 8. ORDRE CHRONOLOGIQUE ----

const OrdreChronologiqueEditor: React.FC<{
  data: OrdreChronologiqueData;
  onChange: (data: OrdreChronologiqueData) => void;
}> = ({ data, onChange }) => (
  <DragDropEditor
    data={data}
    onChange={onChange}
  />
);

// ---- 9. TEXTE À TROUS AVEC MENU ----

function countBlanksTrousMenu(phrase: string): number {
  const m = phrase.match(/_{2,}/g);
  return m ? m.length : 0;
}

interface TexteTrousMenuEditorProps {
  data: TexteTrousMenuData;
  onChange: (data: TexteTrousMenuData) => void;
}

const TexteTrousMenuEditor: React.FC<TexteTrousMenuEditorProps> = ({ data, onChange }) => {
  const syncBlanks = (phrase: string) => {
    const nb = countBlanksTrousMenu(phrase);
    let blanks = [...data.blanks];
    if (nb > blanks.length) {
      while (blanks.length < nb) blanks.push({ reponsesAcceptees: [''], distracteurs: [] });
      onChange({ phrase, blanks });
    } else if (nb < blanks.length) {
      onChange({ phrase, blanks: blanks.slice(0, nb) });
    } else {
      onChange({ phrase, blanks });
    }
  };

  const updateBlank = (i: number, updates: Partial<{ reponsesAcceptees: string[]; distracteurs: string[] }>) => {
    const newBlanks = data.blanks.map((b, j) => (j === i ? { ...b, ...updates } : b));
    onChange({ ...data, blanks: newBlanks });
  };

  const addDistracteur = (i: number) => {
    const b = data.blanks[i];
    updateBlank(i, { distracteurs: [...b.distracteurs, ''] });
  };

  const nbBlanks = countBlanksTrousMenu(data.phrase);

  return (
    <div className="type-editor">
      <label className="type-editor__label">📋 Texte à trous avec menu</label>
      <p className="type-editor__hint">
        Utilisez <code>_____</code> pour chaque trou. L&apos;élève choisira dans une liste déroulante.
      </p>
      <div className="type-editor__field-block">
        <label>Phrase avec trous</label>
        <input
          type="text"
          value={data.phrase}
          onChange={(e) => syncBlanks(e.target.value)}
          placeholder="La _____ du Sénégal est _____."
          className="type-editor__input-full"
        />
      </div>
      {nbBlanks > 0 && (
        <div className="type-editor__blanks">
          <label className="type-editor__sub-label">Par trou : réponses correctes + distracteurs</label>
          {data.blanks.slice(0, nbBlanks).map((b, i) => (
            <div key={i} className="type-editor__blank-group">
              <span className="type-editor__blank-label">Trou {i + 1}</span>
              <div className="type-editor__blank-reponses">
                <div className="type-editor__blank-rep-row">
                  <input
                    type="text"
                    value={b.reponsesAcceptees[0] || ''}
                    onChange={(e) => updateBlank(i, { reponsesAcceptees: [e.target.value] })}
                    placeholder="Réponse correcte"
                    className="type-editor__blank-input"
                  />
                </div>
                {b.distracteurs.map((d, j) => (
                  <div key={j} className="type-editor__blank-rep-row">
                    <input
                      type="text"
                      value={d}
                      onChange={(e) => {
                        const nd = [...b.distracteurs];
                        nd[j] = e.target.value;
                        updateBlank(i, { distracteurs: nd });
                      }}
                      placeholder="Distracteur"
                      className="type-editor__blank-input"
                    />
                    <button
                      type="button"
                      className="type-editor__remove-btn"
                      onClick={() => updateBlank(i, { distracteurs: b.distracteurs.filter((_, k) => k !== j) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="type-editor__add-inline-btn" onClick={() => addDistracteur(i)}>
                  + Distracteur
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- 10. ESSAI / RÉDACTION ----

interface EssaiEditorProps {
  data: EssaiData;
  onChange: (data: EssaiData) => void;
}

const EssaiEditor: React.FC<EssaiEditorProps> = ({ data, onChange }) => {
  const ajouterMotCle = () => {
    onChange({
      ...data,
      motsCles: [
        ...data.motsCles,
        { mot: '', poids: 1, obligatoire: false },
      ],
    });
  };

  const updateMotCle = (mcIndex: number, updates: Partial<MotCleEssai>) => {
    const newMC = data.motsCles.map((mc, i) =>
      i === mcIndex ? { ...mc, ...updates } : mc
    );
    onChange({ ...data, motsCles: newMC });
  };

  const supprimerMotCle = (mcIndex: number) => {
    onChange({ ...data, motsCles: data.motsCles.filter((_, i) => i !== mcIndex) });
  };

  return (
    <div className="type-editor">
      <label className="type-editor__label">✍️ Paramètres de l'essai</label>

      {/* Limites de mots */}
      <div className="type-editor__params-row">
        <div className="type-editor__param-inline">
          <label>Mots minimum :</label>
          <input
            type="number"
            value={data.nombreMotsMin || ''}
            onChange={(e) =>
              onChange({ ...data, nombreMotsMin: Number(e.target.value) || undefined })
            }
            min={0}
            placeholder="Ex: 50"
          />
        </div>
        <div className="type-editor__param-inline">
          <label>Mots maximum :</label>
          <input
            type="number"
            value={data.nombreMotsMax || ''}
            onChange={(e) =>
              onChange({ ...data, nombreMotsMax: Number(e.target.value) || undefined })
            }
            min={0}
            placeholder="Ex: 500"
          />
        </div>
      </div>

      {/* Mode de correction */}
      <div className="type-editor__field-inline">
        <label>Mode de correction :</label>
        <select
          value={data.correctionMode}
          onChange={(e) =>
            onChange({
              ...data,
              correctionMode: e.target.value as EssaiData['correctionMode'],
            })
          }
        >
          <option value="manuelle">📝 Manuelle (par le prof)</option>
          <option value="mots_cles">🔑 Par mots-clés (automatique)</option>
          <option value="semi_auto">🤖 Semi-automatique (mots-clés + validation prof)</option>
        </select>
      </div>

      {/* Mots-clés (si mode mots_cles ou semi_auto) */}
      {(data.correctionMode === 'mots_cles' || data.correctionMode === 'semi_auto') && (
        <div className="type-editor__keywords">
          <label className="type-editor__sub-label">Mots-clés attendus</label>
          {data.motsCles.map((mc, i) => (
            <div key={i} className="type-editor__keyword-row">
              <input
                type="text"
                value={mc.mot}
                onChange={(e) => updateMotCle(i, { mot: e.target.value })}
                placeholder="Mot ou expression..."
                className="type-editor__keyword-input"
              />
              <select
                value={mc.poids}
                onChange={(e) => updateMotCle(i, { poids: Number(e.target.value) })}
                className="type-editor__keyword-weight"
              >
                <option value={1}>Poids 1</option>
                <option value={2}>Poids 2</option>
                <option value={3}>Poids 3</option>
                <option value={4}>Poids 4</option>
                <option value={5}>Poids 5</option>
              </select>
              <label className="type-editor__keyword-required">
                <input
                  type="checkbox"
                  checked={mc.obligatoire}
                  onChange={(e) => updateMotCle(i, { obligatoire: e.target.checked })}
                />
                <span>Obligatoire</span>
              </label>
              <button
                type="button"
                className="type-editor__remove-btn"
                onClick={() => supprimerMotCle(i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="type-editor__add-btn" onClick={ajouterMotCle}>
            + Ajouter un mot-clé
          </button>
        </div>
      )}

      {/* Réponse modèle */}
      <div className="type-editor__field-block">
        <label>Réponse modèle (optionnel — pour le prof)</label>
        <RichTextEditor
          value={data.reponseModele || ''}
          onChange={(html) => onChange({ ...data, reponseModele: html })}
          placeholder="Saisissez une réponse modèle..."
          minHeight={80}
        />
      </div>
    </div>
  );
};

export default QuizEditor;
