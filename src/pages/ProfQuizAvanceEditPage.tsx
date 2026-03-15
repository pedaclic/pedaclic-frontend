/**
 * ============================================================================
 * PROF QUIZ AVANCÉ EDIT — PedaClic
 * ============================================================================
 * Édition d'un quiz avancé par un professeur premium.
 * Route : /prof/quiz/avance/:quizId/modifier
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizEditor } from '../components/quiz/QuizEditor';
import { getQuizAvance } from '../services/quizAdvancedService';
import DisciplineService from '../services/disciplineService';
import { getGroupesProf } from '../services/cahierTextesService';
import type { QuizAvance } from '../types/quiz-advanced';

const ProfQuizAvanceEditPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [disciplines, setDisciplines] = useState<{ id: string; nom: string; classe: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [existingQuiz, setExistingQuiz] = useState<QuizAvance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.uid || !quizId) return;
      try {
        setLoading(true);
        const [quiz, discs, grps] = await Promise.all([
          getQuizAvance(quizId),
          DisciplineService.getAll(),
          getGroupesProf(currentUser.uid),
        ]);
        if (!quiz) {
          setError('Quiz introuvable');
          setLoading(false);
          return;
        }
        if (quiz.auteurId !== currentUser.uid) {
          setError('Vous n\'êtes pas autorisé à modifier ce quiz');
          setLoading(false);
          return;
        }
        setExistingQuiz(quiz);
        setDisciplines(
          discs.map((d: any) => ({
            id: d.id,
            nom: d.nom || d.name,
            classe: d.classe || '',
          }))
        );
        setGroupes(grps.filter((g) => !g.statut || g.statut === 'actif').map((g) => ({ id: g.id, nom: g.nom })));
      } catch (err) {
        console.error('Erreur chargement:', err);
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.uid, quizId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>⏳ Chargement...</p>
      </div>
    );
  }

  if (error || !existingQuiz) {
    return (
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>❌ {error || 'Quiz introuvable'}</p>
        <button onClick={() => navigate('/prof/quiz')} style={{ padding: '0.6rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <QuizEditor
      existingQuiz={{
        ...existingQuiz,
        id: existingQuiz.id,
        groupeId: existingQuiz.groupeId ?? undefined,
      }}
      disciplines={disciplines}
      groupes={groupes}
      auteurId={currentUser?.uid || ''}
      onSave={() => navigate('/prof/quiz')}
      onSaveDraft={() => {
        alert('📝 Brouillon enregistré. Vous pouvez continuer plus tard.');
      }}
      onCancel={() => navigate('/prof/quiz')}
    />
  );
};

export default ProfQuizAvanceEditPage;
