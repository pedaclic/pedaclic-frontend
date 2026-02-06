/**
 * ============================================================
 * PEDACLIC — Phase 12 : Page Éditeur de Quiz
 * Wrapper pour le composant QuizEditor
 * Route: /admin/quiz/nouveau | /admin/quiz/modifier/:quizId
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizEditor } from '../components/quiz/QuizEditor';
import { getQuizAvance } from '../services/quizAdvancedService';
import DisciplineService from '../services/disciplineService';
import type { QuizAvance } from '../types/quiz-advanced';

const QuizEditorPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [disciplines, setDisciplines] = useState<{ id: string; nom: string; classe: string }[]>([]);
  const [existingQuiz, setExistingQuiz] = useState<(QuizAvance) | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Charger les disciplines
        const allDisciplines = await DisciplineService.getAll();
        setDisciplines(
          allDisciplines.map((d: any) => ({
            id: d.id,
            nom: d.nom,
            classe: d.classe || '',
          }))
        );

        // Si modification, charger le quiz existant
        if (quizId) {
          const quiz = await getQuizAvance(quizId);
          if (quiz) {
            setExistingQuiz(quiz);
          } else {
            setError('Quiz introuvable');
          }
        }
      } catch (err: any) {
        console.error('Erreur chargement données:', err);
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [quizId]);

  // ---- États de chargement / erreur ----
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>⏳ Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#dc2626' }}>❌ {error}</p>
        <button onClick={() => navigate(-1)}>← Retour</button>
      </div>
    );
  }

  // ---- Rendu ----
  return (
    <QuizEditor
      existingQuiz={existingQuiz ? { ...existingQuiz, id: existingQuiz.id } : undefined}
      disciplines={disciplines}
      auteurId={currentUser?.uid || ''}
      onSave={(savedId) => {
        alert('✅ Quiz sauvegardé avec succès !');
        navigate('/admin/quiz');
      }}
      onCancel={() => navigate(-1)}
    />
  );
};

export default QuizEditorPage;
