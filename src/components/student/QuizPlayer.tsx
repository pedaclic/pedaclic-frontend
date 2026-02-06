/**
 * ============================================================
 * PedaClic - Phase 7 : QuizPlayer.tsx
 * ============================================================
 * Composant pour que les élèves passent les quiz.
 * Fonctionnalités :
 *  - Écran d'accueil avec infos du quiz
 *  - Timer avec compte à rebours
 *  - Navigation entre questions
 *  - Correction détaillée avec explications
 *  - Sauvegarde automatique dans Firestore
 *  - Vérification du statut Premium
 *
 * Placement : src/components/student/QuizPlayer.tsx
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Award,
  BookOpen,
  Star,
  Lock,
  Play,
  RotateCcw,
  Home,
  ChevronRight,
  Timer,
} from 'lucide-react';

/* ── Imports services ── */
import { getQuizById, Quiz, Question } from '../../services/quizService';
import { saveQuizResult, QuizSubmission, formatTemps, getScoreColor, getScoreLabel } from '../../services/progressionService';
import DisciplineService from '../../services/disciplineService';
import { useAuth } from '../../contexts/AuthContext';

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

type QuizPhase = 'intro' | 'playing' | 'review';

/* ══════════════════════════════════════════════
   COMPOSANT PRINCIPAL : QuizPlayer
   ══════════════════════════════════════════════ */
const QuizPlayer: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  /* ── États du quiz ── */
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [disciplineNom, setDisciplineNom] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Phase du quiz ── */
  const [phase, setPhase] = useState<QuizPhase>('intro');

  /* ── Jeu ── */
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);       // en secondes
  const [timeElapsed, setTimeElapsed] = useState(0);  // en secondes
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Résultats ── */
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [bonnesReponses, setBonnesReponses] = useState(0);
  const [saving, setSaving] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);

  /* ══════════════════════════════════════════════
     CHARGEMENT DU QUIZ
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) {
        setError('ID du quiz manquant.');
        setLoading(false);
        return;
      }

      try {
        const quizData = await getQuizById(quizId);
        if (!quizData) {
          setError('Quiz introuvable.');
          setLoading(false);
          return;
        }

        setQuiz(quizData);
        setTimeLeft(quizData.duree * 60); // convertir minutes → secondes

        /* Charger le nom de la discipline */
        try {
          const disciplines = await DisciplineService.getAll();
          const disc = disciplines.find((d: any) => d.id === quizData.disciplineId);
          setDisciplineNom(disc?.nom || quizData.disciplineId);
        } catch {
          setDisciplineNom(quizData.disciplineId);
        }
      } catch (err) {
        setError('Erreur lors du chargement du quiz.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId]);

  /* ══════════════════════════════════════════════
     TIMER
     ══════════════════════════════════════════════ */
  useEffect(() => {
    if (phase !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          /* Temps écoulé → soumission automatique */
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  /* ══════════════════════════════════════════════
     HANDLERS
     ══════════════════════════════════════════════ */

  /** Démarrer le quiz */
  const startQuiz = () => {
    setPhase('playing');
    setCurrentQuestion(0);
    setAnswers({});
    setTimeElapsed(0);
    if (quiz) setTimeLeft(quiz.duree * 60);
  };

  /** Sélectionner une réponse */
  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  /** Navigation entre questions */
  const goToQuestion = (index: number) => {
    if (quiz && index >= 0 && index < quiz.questions.length) {
      setCurrentQuestion(index);
    }
  };

  /** Soumettre le quiz */
  const handleSubmit = useCallback(async () => {
    if (!quiz || !currentUser || phase === 'review') return;

    /* Arrêter le timer */
    if (timerRef.current) clearInterval(timerRef.current);

    /* Calcul du score */
    let scoreTotal = 0;
    let pointsMax = 0;
    let correctCount = 0;

    quiz.questions.forEach((q) => {
      const points = q.points || 1;
      pointsMax += points;
      if (answers[q.id] === q.reponseCorrecte) {
        scoreTotal += points;
        correctCount++;
      }
    });

    const pourcentage = pointsMax > 0 ? Math.round((scoreTotal / pointsMax) * 100) : 0;
    const reussi = pourcentage >= (quiz.noteMinimale || 50);

    setScore(scoreTotal);
    setTotalPoints(pointsMax);
    setBonnesReponses(correctCount);
    setPhase('review');

    /* Sauvegarder dans Firestore */
    setSaving(true);
    try {
      const submission: QuizSubmission = {
        quizId: quiz.id,
        quizTitre: quiz.titre,
        disciplineId: quiz.disciplineId,
        disciplineNom: disciplineNom,
        userId: currentUser.uid,
        reponses: quiz.questions.map((q) => answers[q.id] ?? -1),
        tempsEcoule: timeElapsed,
        score: scoreTotal,
        totalPoints: pointsMax,
        pourcentage,
        reussi,
        nombreQuestions: quiz.questions.length,
        bonnesReponses: correctCount,
      };

      await saveQuizResult(submission);
      setResultSaved(true);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde :', err);
    } finally {
      setSaving(false);
    }
  }, [quiz, currentUser, answers, timeElapsed, disciplineNom, phase]);

  /* ══════════════════════════════════════════════
     UTILITAIRES D'AFFICHAGE
     ══════════════════════════════════════════════ */

  /** Formate le timer en MM:SS */
  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /** Classe CSS du timer selon le temps restant */
  const getTimerClass = (): string => {
    if (!quiz) return '';
    const totalSeconds = quiz.duree * 60;
    const ratio = timeLeft / totalSeconds;
    if (ratio <= 0.1) return 'timer-critical';  /* < 10% → rouge clignotant */
    if (ratio <= 0.25) return 'timer-warning';  /* < 25% → orange */
    return '';
  };

  /** Nombre de questions répondues */
  const answeredCount = Object.keys(answers).length;

  /* ══════════════════════════════════════════════
     RENDU : CHARGEMENT / ERREUR
     ══════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="quiz-player-loading">
        <div className="admin-spinner" />
        <p>Chargement du quiz...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="quiz-player-error">
        <AlertCircle size={48} />
        <h3>{error || 'Quiz introuvable'}</h3>
        <button className="qp-btn qp-btn-primary" onClick={() => navigate('/eleve/dashboard')}>
          <Home size={18} /> Retour au tableau de bord
        </button>
      </div>
    );
  }

  /* ── Vérification Premium ── */
  if (quiz.isPremium && !currentUser?.isPremium) {
    return (
      <div className="quiz-player-locked">
        <div className="qp-locked-card">
          <Lock size={48} />
          <h3>Quiz Premium</h3>
          <p>Ce quiz est réservé aux abonnés Premium.</p>
          <p className="qp-locked-price">À partir de <strong>2 000 FCFA/mois</strong></p>
          <div className="qp-locked-actions">
            <button className="qp-btn qp-btn-primary" onClick={() => navigate('/premium')}>
              <Star size={18} /> Devenir Premium
            </button>
            <button className="qp-btn qp-btn-outline" onClick={() => navigate('/eleve/dashboard')}>
              <ArrowLeft size={18} /> Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     RENDU : ÉCRAN D'INTRODUCTION
     ══════════════════════════════════════════════ */
  if (phase === 'intro') {
    return (
      <div className="quiz-player-intro">
        <div className="qp-intro-card">
          {/* En-tête */}
          <div className="qp-intro-header">
            <button className="qp-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} /> Retour
            </button>
            {quiz.isPremium && (
              <span className="qp-badge qp-badge-premium"><Star size={12} /> Premium</span>
            )}
          </div>

          {/* Informations du quiz */}
          <div className="qp-intro-content">
            <h1 className="qp-intro-title">{quiz.titre}</h1>
            <span className="qp-intro-discipline">{disciplineNom}</span>

            {/* Stats du quiz */}
            <div className="qp-intro-stats">
              <div className="qp-intro-stat">
                <BookOpen size={20} />
                <div>
                  <span className="qp-intro-stat-value">{quiz.questions.length}</span>
                  <span className="qp-intro-stat-label">Questions</span>
                </div>
              </div>
              <div className="qp-intro-stat">
                <Clock size={20} />
                <div>
                  <span className="qp-intro-stat-value">{quiz.duree} min</span>
                  <span className="qp-intro-stat-label">Durée</span>
                </div>
              </div>
              <div className="qp-intro-stat">
                <Award size={20} />
                <div>
                  <span className="qp-intro-stat-value">{quiz.noteMinimale || 50}%</span>
                  <span className="qp-intro-stat-label">Note min.</span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="qp-intro-instructions">
              <h3>Instructions</h3>
              <ul>
                <li>Répondez à toutes les questions dans le temps imparti</li>
                <li>Chaque question a une seule bonne réponse</li>
                <li>Vous pouvez naviguer entre les questions</li>
                <li>Le quiz est soumis automatiquement quand le temps est écoulé</li>
                <li>Il faut obtenir au moins {quiz.noteMinimale || 50}% pour réussir</li>
              </ul>
            </div>
          </div>

          {/* Bouton démarrer */}
          <button className="qp-btn qp-btn-start" onClick={startQuiz}>
            <Play size={20} /> Commencer le quiz
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     RENDU : PHASE DE JEU
     ══════════════════════════════════════════════ */
  if (phase === 'playing') {
    const question = quiz.questions[currentQuestion];

    return (
      <div className="quiz-player-game">
        {/* ── Barre supérieure : Timer + Progression ── */}
        <div className="qp-game-header">
          <div className="qp-game-info">
            <span className="qp-game-title">{quiz.titre}</span>
            <span className="qp-game-discipline">{disciplineNom}</span>
          </div>
          <div className={`qp-timer ${getTimerClass()}`}>
            <Timer size={18} />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* ── Barre de progression ── */}
        <div className="qp-progress-bar">
          <div
            className="qp-progress-fill"
            style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>

        {/* ── Contenu de la question ── */}
        <div className="qp-game-content">
          <div className="qp-question-header">
            <span className="qp-question-number">
              Question {currentQuestion + 1}/{quiz.questions.length}
            </span>
            <span className="qp-question-points">{question.points || 1} pt(s)</span>
          </div>

          <h2 className="qp-question-text">{question.question}</h2>

          <div className="qp-options-list">
            {question.options.map((option, index) => (
              <button
                key={index}
                className={`qp-option ${answers[question.id] === index ? 'selected' : ''}`}
                onClick={() => selectAnswer(question.id, index)}
              >
                <span className="qp-option-letter">{String.fromCharCode(65 + index)}</span>
                <span className="qp-option-text">{option}</span>
                {answers[question.id] === index && <CheckCircle size={18} className="qp-option-check" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Navigation questions ── */}
        <div className="qp-game-footer">
          {/* Indicateurs de questions */}
          <div className="qp-question-indicators">
            {quiz.questions.map((q, i) => (
              <button
                key={q.id}
                className={`qp-indicator ${i === currentQuestion ? 'active' : ''} ${answers[q.id] !== undefined ? 'answered' : ''}`}
                onClick={() => goToQuestion(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Boutons précédent / suivant / soumettre */}
          <div className="qp-nav-buttons">
            <button
              className="qp-btn qp-btn-outline"
              onClick={() => goToQuestion(currentQuestion - 1)}
              disabled={currentQuestion === 0}
            >
              <ArrowLeft size={16} /> Précédent
            </button>

            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                className="qp-btn qp-btn-primary"
                onClick={() => goToQuestion(currentQuestion + 1)}
              >
                Suivant <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="qp-btn qp-btn-submit"
                onClick={handleSubmit}
                disabled={answeredCount < quiz.questions.length}
              >
                <CheckCircle size={16} />
                Soumettre ({answeredCount}/{quiz.questions.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     RENDU : PHASE DE RÉVISION (RÉSULTATS)
     ══════════════════════════════════════════════ */
  const pourcentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const reussi = pourcentage >= (quiz.noteMinimale || 50);

  return (
    <div className="quiz-player-review">
      {/* ── Carte de score ── */}
      <div className={`qp-score-card ${reussi ? 'success' : 'fail'}`}>
        <div className="qp-score-icon">
          {reussi ? <Award size={48} /> : <AlertCircle size={48} />}
        </div>
        <h2 className="qp-score-title">
          {reussi ? 'Félicitations ! 🎉' : 'Continuez vos efforts ! 💪'}
        </h2>
        <div className="qp-score-circle" style={{ borderColor: getScoreColor(pourcentage) }}>
          <span className="qp-score-value">{pourcentage}%</span>
          <span className="qp-score-label">{getScoreLabel(pourcentage)}</span>
        </div>
        <div className="qp-score-details">
          <div className="qp-score-detail">
            <span>{bonnesReponses}/{quiz.questions.length}</span>
            <small>Bonnes réponses</small>
          </div>
          <div className="qp-score-detail">
            <span>{score}/{totalPoints}</span>
            <small>Points</small>
          </div>
          <div className="qp-score-detail">
            <span>{formatTemps(timeElapsed)}</span>
            <small>Temps</small>
          </div>
        </div>
        {saving && <p className="qp-saving">Sauvegarde en cours...</p>}
        {resultSaved && <p className="qp-saved">✅ Résultat sauvegardé</p>}
      </div>

      {/* ── Actions post-quiz ── */}
      <div className="qp-review-actions">
        <button className="qp-btn qp-btn-primary" onClick={() => navigate('/eleve/dashboard')}>
          <Home size={18} /> Tableau de bord
        </button>
        <button className="qp-btn qp-btn-outline" onClick={startQuiz}>
          <RotateCcw size={18} /> Recommencer
        </button>
      </div>

      {/* ── Correction détaillée ── */}
      <div className="qp-review-questions">
        <h3 className="qp-review-title">Correction détaillée</h3>
        {quiz.questions.map((question, index) => {
          const userAnswer = answers[question.id];
          const isCorrect = userAnswer === question.reponseCorrecte;

          return (
            <div key={question.id} className={`qp-review-question ${isCorrect ? 'correct' : 'incorrect'}`}>
              {/* En-tête question */}
              <div className="qp-review-question-header">
                <span className="qp-review-q-number">Q{index + 1}</span>
                {isCorrect ? (
                  <span className="qp-review-badge correct"><CheckCircle size={14} /> Correct</span>
                ) : (
                  <span className="qp-review-badge incorrect"><XCircle size={14} /> Incorrect</span>
                )}
                <span className="qp-review-q-points">
                  {isCorrect ? question.points || 1 : 0}/{question.points || 1} pt(s)
                </span>
              </div>

              {/* Énoncé */}
              <p className="qp-review-q-text">{question.question}</p>

              {/* Options avec correction */}
              <div className="qp-review-options">
                {question.options.map((option, optIndex) => {
                  let optClass = 'qp-review-option';
                  if (optIndex === question.reponseCorrecte) optClass += ' correct-answer';
                  if (optIndex === userAnswer && !isCorrect) optClass += ' wrong-answer';

                  return (
                    <div key={optIndex} className={optClass}>
                      <span className="qp-review-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                      <span>{option}</span>
                      {optIndex === question.reponseCorrecte && <CheckCircle size={14} className="qp-review-check" />}
                      {optIndex === userAnswer && !isCorrect && <XCircle size={14} className="qp-review-x" />}
                    </div>
                  );
                })}
              </div>

              {/* Explication */}
              {question.explication && (
                <div className="qp-review-explication">
                  <strong>💡 Explication :</strong> {question.explication}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizPlayer;
