/**
 * ============================================================
 * PEDACLIC — Phase 12 : Page Lecteur de Quiz (Élève)
 * Wrapper pour le composant QuizPlayer
 * Route: /quiz/:quizId
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizPlayer } from '../components/quiz/QuizPlayer';
import { getQuizAvance } from '../services/quizAdvancedService';
import type { QuizAvance } from '../types/quiz-advanced';

const QuizPlayerPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [quiz, setQuiz] = useState<QuizAvance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) {
        setError('ID du quiz manquant');
        setLoading(false);
        return;
      }

      try {
        const data = await getQuizAvance(quizId);
        if (!data) {
          setError('Quiz introuvable');
          return;
        }

        // Vérifier accès Premium
        if (data.isPremium && !currentUser?.isPremium) {
          setError('Ce quiz est réservé aux abonnés Premium');
          return;
        }

        setQuiz(data);
      } catch (err: any) {
        console.error('Erreur chargement quiz:', err);
        setError(err.message || 'Impossible de charger le quiz');
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [quizId, currentUser]);

  // ---- Chargement ----
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
        <p>Chargement du quiz...</p>
      </div>
    );
  }

  // ---- Erreur ----
  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem', 
        maxWidth: '500px', 
        margin: '2rem auto' 
      }}>
        <div style={{ 
          padding: '2rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😕</div>
          <p style={{ color: '#991b1b', fontWeight: 600, marginBottom: '1rem' }}>
            {error}
          </p>
          {error.includes('Premium') && (
            <button
              onClick={() => navigate('/premium')}
              style={{
                padding: '0.6rem 1.5rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginRight: '0.5rem',
                fontWeight: 600,
              }}
            >
              🔒 Devenir Premium
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  // ---- Quiz introuvable ----
  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Quiz introuvable</p>
        <button onClick={() => navigate(-1)}>← Retour</button>
      </div>
    );
  }

  // ---- Rendu du player ----
  return (
    <QuizPlayer
      quiz={quiz}
      userId={currentUser?.uid || ''}
      onComplete={(result) => {
        console.log('✅ Quiz terminé — Note:', result.note20, '/20');
      }}
      onQuit={() => navigate('/dashboard')}
    />
  );
};

export default QuizPlayerPage;
