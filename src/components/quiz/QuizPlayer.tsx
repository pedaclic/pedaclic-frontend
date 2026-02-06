/**
 * ============================================================
 * PEDACLIC — Phase 12 : Player de Quiz Avancé (Élève)
 * Composant pour passer un quiz multi-types
 * ============================================================
 * Gère : Navigation entre questions, Timer, Soumission,
 *         Correction avec affichage des résultats
 * ============================================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  QuizAvance,
  QuestionAvancee,
  ReponseEleve,
  QuizAvanceResult,
  QCMUniqueData,
  QCMMultipleData,
  DragDropData,
  MiseEnRelationData,
  EssaiData,
  TYPE_QUESTION_ICONS,
  TYPE_QUESTION_LABELS,
  TYPE_QUESTION_COLORS,
} from '../../types/quiz-advanced';
import { soumettreQuiz } from '../../services/quizAdvancedService';
import '../../styles/quiz-advanced.css';

// ==================== INTERFACES ====================

interface QuizPlayerProps {
  /** Le quiz à passer */
  quiz: QuizAvance;
  /** ID de l'élève */
  userId: string;
  /** Callback après soumission */
  onComplete?: (result: QuizAvanceResult) => void;
  /** Callback pour quitter */
  onQuit?: () => void;
}

// ==================== COMPOSANT PRINCIPAL ====================

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  quiz,
  userId,
  onComplete,
  onQuit,
}) => {
  // ---- Préparer les questions (mélanger si demandé) ----
  const questionsFinales = useMemo(() => {
    let qs = [...quiz.questions];
    if (quiz.melangerQuestions) {
      qs = qs.sort(() => Math.random() - 0.5);
    }
    return qs;
  }, [quiz]);

  // ---- États ----
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reponses, setReponses] = useState<Map<string, ReponseEleve>>(new Map());
  const [tempsRestant, setTempsRestant] = useState(quiz.duree * 60); // en secondes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAvanceResult | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const startTime = useRef(Date.now());

  // ---- Timer ----
  useEffect(() => {
    if (result) return; // Arrêter si quiz terminé
    const timer = setInterval(() => {
      setTempsRestant((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(); // Soumettre automatiquement
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [result]);

  // ---- Formatage du temps ----
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---- Question courante ----
  const currentQuestion = questionsFinales[currentIndex];

  // ---- Mettre à jour la réponse de l'élève ----
  const updateReponse = useCallback(
    (questionId: string, data: Partial<ReponseEleve>) => {
      setReponses((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId) || {
          questionId,
          type: currentQuestion.type,
        };
        newMap.set(questionId, { ...existing, ...data });
        return newMap;
      });
    },
    [currentQuestion]
  );

  // ---- Navigation ----
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questionsFinales.length) {
      setCurrentIndex(index);
    }
  };

  // ---- Soumission ----
  const handleSubmit = async () => {
    setShowConfirmSubmit(false);
    setIsSubmitting(true);

    try {
      const reponsesArray = Array.from(reponses.values());
      const tempsEcoule = Math.round((Date.now() - startTime.current) / 1000);

      const resultat = await soumettreQuiz(quiz, userId, reponsesArray, tempsEcoule);
      setResult(resultat);
      onComplete?.(resultat);
    } catch (error: any) {
      alert('Erreur lors de la soumission : ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Nombre de questions répondues ----
  const nbRepondues = reponses.size;

  // ==================== AFFICHAGE DES RÉSULTATS ====================

  if (result) {
    return (
      <div className="quiz-player quiz-player--results">
        <div className="quiz-results">
          {/* ---- En-tête résultat ---- */}
          <div className={`quiz-results__header ${result.reussi ? 'quiz-results__header--success' : 'quiz-results__header--fail'}`}>
            <div className="quiz-results__emoji">
              {result.reussi ? '🎉' : '😕'}
            </div>
            <h2>{result.reussi ? 'Félicitations !' : 'Quiz terminé'}</h2>
            <div className="quiz-results__score">
              <span className="quiz-results__note">{result.note20}/20</span>
              <span className="quiz-results__detail">
                {result.score}/{result.scoreMax} points
              </span>
            </div>
            <div className="quiz-results__time">
              ⏱️ Temps : {formatTime(result.tempsEcoule)}
            </div>
            {result.correctionManuelle && (
              <p className="quiz-results__pending">
                ⚠️ Ce quiz contient des questions à correction manuelle.
                Votre note finale pourra être ajustée par le professeur.
              </p>
            )}
          </div>

          {/* ---- Détail par question (si correction affichée) ---- */}
          {quiz.afficherCorrection && (
            <div className="quiz-results__details">
              <h3>📋 Détail des réponses</h3>
              {questionsFinales.map((question, i) => {
                const detail = result.detailsParQuestion.find(
                  (d) => d.questionId === question.id
                );
                return (
                  <div
                    key={question.id}
                    className={`quiz-results__question ${
                      detail?.isCorrect
                        ? 'quiz-results__question--correct'
                        : detail?.isPartiel
                        ? 'quiz-results__question--partial'
                        : 'quiz-results__question--wrong'
                    }`}
                  >
                    <div className="quiz-results__q-header">
                      <span>
                        Q{i + 1} —{' '}
                        <span style={{ color: TYPE_QUESTION_COLORS[question.type] }}>
                          {TYPE_QUESTION_ICONS[question.type]} {TYPE_QUESTION_LABELS[question.type]}
                        </span>
                      </span>
                      <span className="quiz-results__q-score">
                        {detail?.pointsObtenus || 0}/{detail?.pointsMax || question.points} pts
                        {detail?.isCorrect && ' ✅'}
                        {detail?.isPartiel && ' 🟡'}
                        {!detail?.isCorrect && !detail?.isPartiel && ' ❌'}
                      </span>
                    </div>
                    <div
                      className="quiz-results__q-enonce"
                      dangerouslySetInnerHTML={{ __html: question.enonce }}
                    />
                    {question.explication && (
                      <div className="quiz-results__q-explanation">
                        <strong>💡 Explication :</strong>
                        <div dangerouslySetInnerHTML={{ __html: question.explication }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Bouton retour ---- */}
          <div className="quiz-results__actions">
            <button
              className="quiz-player__btn quiz-player__btn--primary"
              onClick={onQuit}
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== INTERFACE DE QUIZ EN COURS ====================

  return (
    <div className="quiz-player">
      {/* ---- Barre supérieure (timer + progression) ---- */}
      <div className="quiz-player__topbar">
        <div className="quiz-player__info">
          <span className="quiz-player__title">{quiz.titre}</span>
          <span className="quiz-player__progress">
            Question {currentIndex + 1}/{questionsFinales.length}
          </span>
        </div>
        <div className="quiz-player__topbar-right">
          <span className={`quiz-player__timer ${tempsRestant < 60 ? 'quiz-player__timer--danger' : tempsRestant < 300 ? 'quiz-player__timer--warning' : ''}`}>
            ⏱️ {formatTime(tempsRestant)}
          </span>
          <span className="quiz-player__answered">
            {nbRepondues}/{questionsFinales.length} répondue{nbRepondues > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ---- Barre de progression visuelle ---- */}
      <div className="quiz-player__progress-bar">
        <div
          className="quiz-player__progress-fill"
          style={{ width: `${((currentIndex + 1) / questionsFinales.length) * 100}%` }}
        />
      </div>

      {/* ---- Zone de la question ---- */}
      <div className="quiz-player__question-area">
        {/* Badge type */}
        <div className="quiz-player__question-meta">
          <span
            className="quiz-player__type-badge"
            style={{ backgroundColor: TYPE_QUESTION_COLORS[currentQuestion.type] }}
          >
            {TYPE_QUESTION_ICONS[currentQuestion.type]} {TYPE_QUESTION_LABELS[currentQuestion.type]}
          </span>
          <span className="quiz-player__points">
            {currentQuestion.points} point{currentQuestion.points > 1 ? 's' : ''}
          </span>
        </div>

        {/* Énoncé */}
        <div
          className="quiz-player__enonce"
          dangerouslySetInnerHTML={{ __html: currentQuestion.enonce }}
        />

        {/* ---- Composant de réponse selon le type ---- */}
        <div className="quiz-player__answer-area">
          {currentQuestion.type === 'qcm_unique' && (
            <QCMUniquePlayer
              question={currentQuestion}
              reponse={reponses.get(currentQuestion.id)}
              onUpdate={(data) => updateReponse(currentQuestion.id, data)}
              melangerOptions={quiz.melangerOptions}
            />
          )}
          {currentQuestion.type === 'qcm_multiple' && (
            <QCMMultiplePlayer
              question={currentQuestion}
              reponse={reponses.get(currentQuestion.id)}
              onUpdate={(data) => updateReponse(currentQuestion.id, data)}
              melangerOptions={quiz.melangerOptions}
            />
          )}
          {currentQuestion.type === 'drag_drop' && (
            <DragDropPlayer
              question={currentQuestion}
              reponse={reponses.get(currentQuestion.id)}
              onUpdate={(data) => updateReponse(currentQuestion.id, data)}
            />
          )}
          {currentQuestion.type === 'mise_en_relation' && (
            <MiseEnRelationPlayer
              question={currentQuestion}
              reponse={reponses.get(currentQuestion.id)}
              onUpdate={(data) => updateReponse(currentQuestion.id, data)}
            />
          )}
          {currentQuestion.type === 'essai' && (
            <EssaiPlayer
              question={currentQuestion}
              reponse={reponses.get(currentQuestion.id)}
              onUpdate={(data) => updateReponse(currentQuestion.id, data)}
            />
          )}
        </div>
      </div>

      {/* ---- Navigation entre questions ---- */}
      <div className="quiz-player__nav">
        <button
          className="quiz-player__btn quiz-player__btn--secondary"
          onClick={() => goToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          ← Précédent
        </button>

        {/* Pagination rapide */}
        <div className="quiz-player__pagination">
          {questionsFinales.map((q, i) => (
            <button
              key={q.id}
              className={`quiz-player__page-dot ${
                i === currentIndex ? 'quiz-player__page-dot--current' : ''
              } ${reponses.has(q.id) ? 'quiz-player__page-dot--answered' : ''}`}
              onClick={() => goToQuestion(i)}
              title={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentIndex < questionsFinales.length - 1 ? (
          <button
            className="quiz-player__btn quiz-player__btn--primary"
            onClick={() => goToQuestion(currentIndex + 1)}
          >
            Suivant →
          </button>
        ) : (
          <button
            className="quiz-player__btn quiz-player__btn--submit"
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? '⏳ Envoi...' : '✅ Soumettre le quiz'}
          </button>
        )}
      </div>

      {/* ---- Modal de confirmation ---- */}
      {showConfirmSubmit && (
        <div className="quiz-player__modal-overlay">
          <div className="quiz-player__modal">
            <h3>Soumettre le quiz ?</h3>
            <p>
              Vous avez répondu à <strong>{nbRepondues}</strong> question{nbRepondues > 1 ? 's' : ''} sur{' '}
              <strong>{questionsFinales.length}</strong>.
            </p>
            {nbRepondues < questionsFinales.length && (
              <p className="quiz-player__modal-warning">
                ⚠️ {questionsFinales.length - nbRepondues} question{questionsFinales.length - nbRepondues > 1 ? 's' : ''} sans réponse !
              </p>
            )}
            <div className="quiz-player__modal-actions">
              <button
                className="quiz-player__btn quiz-player__btn--secondary"
                onClick={() => setShowConfirmSubmit(false)}
              >
                Continuer le quiz
              </button>
              <button
                className="quiz-player__btn quiz-player__btn--submit"
                onClick={handleSubmit}
              >
                Confirmer la soumission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PLAYERS PAR TYPE DE QUESTION ====================

// ---- 1. QCM CHOIX UNIQUE (Radio) ----

const QCMUniquePlayer: React.FC<{
  question: QuestionAvancee;
  reponse?: ReponseEleve;
  onUpdate: (data: Partial<ReponseEleve>) => void;
  melangerOptions: boolean;
}> = ({ question, reponse, onUpdate, melangerOptions }) => {
  const data = question.typeData as QCMUniqueData;
  const options = useMemo(() => {
    if (melangerOptions) return [...data.options].sort(() => Math.random() - 0.5);
    return data.options;
  }, [data.options, melangerOptions]);

  return (
    <div className="player-qcm">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`player-qcm__option ${
            reponse?.selectedOptionId === opt.id ? 'player-qcm__option--selected' : ''
          }`}
        >
          <input
            type="radio"
            name={`q_${question.id}`}
            checked={reponse?.selectedOptionId === opt.id}
            onChange={() => onUpdate({ selectedOptionId: opt.id })}
          />
          <div
            className="player-qcm__text"
            dangerouslySetInnerHTML={{ __html: opt.texte }}
          />
        </label>
      ))}
    </div>
  );
};

// ---- 2. QCM CHOIX MULTIPLE (Checkboxes) ----

const QCMMultiplePlayer: React.FC<{
  question: QuestionAvancee;
  reponse?: ReponseEleve;
  onUpdate: (data: Partial<ReponseEleve>) => void;
  melangerOptions: boolean;
}> = ({ question, reponse, onUpdate, melangerOptions }) => {
  const data = question.typeData as QCMMultipleData;
  const options = useMemo(() => {
    if (melangerOptions) return [...data.options].sort(() => Math.random() - 0.5);
    return data.options;
  }, [data.options, melangerOptions]);

  const selectedIds = reponse?.selectedOptionIds || [];

  const toggleOption = (optId: string) => {
    const newIds = selectedIds.includes(optId)
      ? selectedIds.filter((id) => id !== optId)
      : [...selectedIds, optId];
    onUpdate({ selectedOptionIds: newIds });
  };

  return (
    <div className="player-qcm">
      <p className="player-qcm__hint">Plusieurs réponses possibles</p>
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`player-qcm__option ${
            selectedIds.includes(opt.id) ? 'player-qcm__option--selected' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(opt.id)}
            onChange={() => toggleOption(opt.id)}
          />
          <div
            className="player-qcm__text"
            dangerouslySetInnerHTML={{ __html: opt.texte }}
          />
        </label>
      ))}
    </div>
  );
};

// ---- 3. DRAG & DROP (Réordonner) ----

const DragDropPlayer: React.FC<{
  question: QuestionAvancee;
  reponse?: ReponseEleve;
  onUpdate: (data: Partial<ReponseEleve>) => void;
}> = ({ question, reponse, onUpdate }) => {
  const data = question.typeData as DragDropData;

  // Initialiser l'ordre mélangé
  const [items, setItems] = useState(() => {
    if (reponse?.ordrePropose) {
      return reponse.ordrePropose.map(
        (id) => data.items.find((item) => item.id === id)!
      ).filter(Boolean);
    }
    return [...data.items].sort(() => Math.random() - 0.5);
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Mettre à jour la réponse quand l'ordre change
  useEffect(() => {
    onUpdate({ ordrePropose: items.map((item) => item.id) });
  }, [items]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const newItems = [...items];
    const [dragged] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, dragged);
    setItems(newItems);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // Déplacer avec boutons (mobile-friendly)
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setItems(newItems);
  };

  return (
    <div className="player-dragdrop">
      <p className="player-dragdrop__consigne">{data.consigneOrdre}</p>
      <div className="player-dragdrop__list">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`player-dragdrop__item ${dragIndex === i ? 'player-dragdrop__item--dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
          >
            <span className="player-dragdrop__handle">⠿</span>
            <span className="player-dragdrop__number">{i + 1}</span>
            <div
              className="player-dragdrop__text"
              dangerouslySetInnerHTML={{ __html: item.texte }}
            />
            <div className="player-dragdrop__mobile-btns">
              <button
                type="button"
                onClick={() => moveItem(i, 'up')}
                disabled={i === 0}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveItem(i, 'down')}
                disabled={i === items.length - 1}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- 4. MISE EN RELATION ----

const MiseEnRelationPlayer: React.FC<{
  question: QuestionAvancee;
  reponse?: ReponseEleve;
  onUpdate: (data: Partial<ReponseEleve>) => void;
}> = ({ question, reponse, onUpdate }) => {
  const data = question.typeData as MiseEnRelationData;

  // Mélanger la colonne droite
  const droiteMelangee = useMemo(
    () => [...data.paires].sort(() => Math.random() - 0.5),
    [data.paires]
  );

  const [relations, setRelations] = useState<{ [gaucheId: string]: string }>(
    reponse?.relationsProposees || {}
  );
  const [selectedGauche, setSelectedGauche] = useState<string | null>(null);

  // Mettre à jour la réponse
  useEffect(() => {
    onUpdate({ relationsProposees: relations });
  }, [relations]);

  const handleSelectGauche = (paireId: string) => {
    setSelectedGauche(paireId);
  };

  const handleSelectDroite = (paireId: string) => {
    if (selectedGauche) {
      setRelations((prev) => ({ ...prev, [selectedGauche]: paireId }));
      setSelectedGauche(null);
    }
  };

  const removeRelation = (gaucheId: string) => {
    setRelations((prev) => {
      const newR = { ...prev };
      delete newR[gaucheId];
      return newR;
    });
  };

  // Trouver quel élément droite est déjà pris
  const droitePrise = new Set(Object.values(relations));

  return (
    <div className="player-relation">
      <p className="player-relation__hint">
        Cliquez sur un élément à gauche puis sur son correspondant à droite
      </p>
      <div className="player-relation__columns">
        {/* Colonne Gauche */}
        <div className="player-relation__col">
          <h4 className="player-relation__col-title">Colonne A</h4>
          {data.paires.map((paire) => (
            <div
              key={paire.id}
              className={`player-relation__item player-relation__item--left ${
                selectedGauche === paire.id ? 'player-relation__item--selected' : ''
              } ${relations[paire.id] ? 'player-relation__item--matched' : ''}`}
              onClick={() => {
                if (relations[paire.id]) {
                  removeRelation(paire.id);
                } else {
                  handleSelectGauche(paire.id);
                }
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: paire.gauche }} />
              {relations[paire.id] && (
                <span className="player-relation__linked">🔗</span>
              )}
            </div>
          ))}
        </div>

        {/* Colonne Droite */}
        <div className="player-relation__col">
          <h4 className="player-relation__col-title">Colonne B</h4>
          {droiteMelangee.map((paire) => (
            <div
              key={paire.id}
              className={`player-relation__item player-relation__item--right ${
                droitePrise.has(paire.id) ? 'player-relation__item--matched' : ''
              } ${selectedGauche && !droitePrise.has(paire.id) ? 'player-relation__item--clickable' : ''}`}
              onClick={() => {
                if (selectedGauche && !droitePrise.has(paire.id)) {
                  handleSelectDroite(paire.id);
                }
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: paire.droite }} />
              {droitePrise.has(paire.id) && (
                <span className="player-relation__linked">🔗</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---- 5. ESSAI ----

const EssaiPlayer: React.FC<{
  question: QuestionAvancee;
  reponse?: ReponseEleve;
  onUpdate: (data: Partial<ReponseEleve>) => void;
}> = ({ question, reponse, onUpdate }) => {
  const data = question.typeData as EssaiData;
  const [texte, setTexte] = useState(reponse?.texteReponse || '');

  // Compter les mots
  const nbMots = texte.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    onUpdate({ texteReponse: texte });
  }, [texte]);

  return (
    <div className="player-essai">
      {/* Limites */}
      <div className="player-essai__info">
        {data.nombreMotsMin && (
          <span className={nbMots < data.nombreMotsMin ? 'player-essai__warning' : ''}>
            Minimum : {data.nombreMotsMin} mots
          </span>
        )}
        {data.nombreMotsMax && (
          <span className={nbMots > data.nombreMotsMax ? 'player-essai__warning' : ''}>
            Maximum : {data.nombreMotsMax} mots
          </span>
        )}
        <span className="player-essai__count">
          {nbMots} mot{nbMots > 1 ? 's' : ''}
        </span>
      </div>

      {/* Zone de rédaction */}
      <textarea
        className="player-essai__textarea"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Rédigez votre réponse ici..."
        rows={10}
      />
    </div>
  );
};

export default QuizPlayer;
