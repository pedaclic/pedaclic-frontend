// ============================================================
// PedaClic — Phase 32 : QuizsDeSeance (vue élève)
// ============================================================
// Affiche, dans la séance consultée par l'élève, la liste des
// quiz rattachés par le prof. Chaque ligne est cliquable et
// redirige vers le player du quiz correspondant (Classic ou
// Avancé — la route dépend de la nature).
//
// Lecture seule : pas d'ajout, pas de suppression, pas de
// modification. C'est de l'affichage pur.
//
// Les résultats de ces quiz (collection `quiz_results` ou
// `quiz_results_v2`) portent déjà `quizId`, `userId` et
// éventuellement `seanceId` : ils remontent dans les stats
// élève/classe existantes sans modification du moteur stats.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuizUnifie } from '../../services/quizUnifiedService';
import { getQuizzesBySeance } from '../../services/quizUnifiedService';

export interface QuizsDeSeanceProps {
  /** Id de la séance affichée. */
  seanceId: string;
  /** Style compact (pour l'affichage dans une carte élève repliable). */
  compact?: boolean;
}

/** Construit la route player selon la nature du quiz. */
function routePourQuiz(q: QuizUnifie): string {
  return q.nature === 'classic'
    ? `/quiz/${q.id}`            // Player Classic (QuizPlayerPage)
    : `/quiz-avance/${q.id}`;    // Player Avancé
}

const QuizsDeSeance: React.FC<QuizsDeSeanceProps> = ({ seanceId, compact = false }) => {
  const [quiz, setQuiz] = useState<QuizUnifie[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    getQuizzesBySeance(seanceId)
      .then((liste) => {
        if (!annule) setQuiz(liste);
      })
      .catch(() => {
        if (!annule) setQuiz([]);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [seanceId]);

  if (chargement) {
    return (
      <div className="quizs-de-seance quizs-de-seance--loading" aria-busy="true">
        <em>Chargement des quiz…</em>
      </div>
    );
  }

  if (quiz.length === 0) {
    // Aucun quiz attaché : on n'affiche rien (évite de polluer la carte)
    return null;
  }

  return (
    <section
      className={`quizs-de-seance${compact ? ' quizs-de-seance--compact' : ''}`}
      aria-label="Quiz liés à cette séance"
    >
      <h4 className="quizs-de-seance__titre">
        🧩 Quiz proposés
        <span className="quizs-de-seance__count">{quiz.length}</span>
      </h4>

      <ul className="quizs-de-seance__liste">
        {quiz.map((q) => (
          <li key={`${q.nature}:${q.id}`} className="quizs-de-seance__item">
            <Link to={routePourQuiz(q)} className="quizs-de-seance__lien">
              <span className="quizs-de-seance__item-icone" aria-hidden="true">
                {q.nature === 'classic' ? '🎯' : '🚀'}
              </span>
              <span className="quizs-de-seance__item-info">
                <span className="quizs-de-seance__item-titre">{q.titre}</span>
                <span className="quizs-de-seance__item-meta">
                  {q.nombreQuestions} question{q.nombreQuestions > 1 ? 's' : ''}
                  {q.duree > 0 && ` • ${q.duree} min`}
                  {q.isPremium && ' • ⭐ Premium'}
                </span>
              </span>
              <span className="quizs-de-seance__item-cta">Commencer →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default QuizsDeSeance;
