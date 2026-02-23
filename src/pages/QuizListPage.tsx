// ============================================================
// PAGE : QuizListPage
// Liste des quiz disponibles pour les utilisateurs premium
// Route : /quizzes
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAllQuizzes } from '../services/quizAdvancedService';
import type { QuizAvance } from '../types/quiz-advanced';

// ─── Helpers ─────────────────────────────────────────────────

const difficulteLabel = (questions: QuizAvance['questions']) => {
  if (!questions?.length) return { label: '—', color: '#9ca3af' };
  const niveaux = questions.map(q => q.difficulte);
  const score = niveaux.reduce((s, n) =>
    s + (n === 'facile' ? 1 : n === 'moyen' ? 2 : 3), 0) / niveaux.length;
  if (score < 1.5) return { label: 'Facile',   color: '#059669' };
  if (score < 2.5) return { label: 'Moyen',    color: '#d97706' };
  return               { label: 'Difficile', color: '#dc2626' };
};

const scoreTotal = (questions: QuizAvance['questions']) =>
  questions?.reduce((s, q) => s + (q.points ?? 0), 0) ?? 0;

// ─── Composant ───────────────────────────────────────────────

const QuizListPage: React.FC = () => {
  const navigate  = useNavigate();
  const { currentUser } = useAuth();

  const [quizzes,  setQuizzes]  = useState<QuizAvance[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getAllQuizzes();
        setQuizzes(data);
      } catch {
        setError('Impossible de charger les quiz.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const quizzesFiltres = quizzes.filter(q =>
    q.titre.toLowerCase().includes(recherche.toLowerCase()) ||
    (q.description ?? '').toLowerCase().includes(recherche.toLowerCase())
  );

  // ─── Rendu ──────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>

      {/* En-tête */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1f2937', margin: '0 0 0.4rem' }}>
          🧩 Quiz disponibles
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', margin: 0 }}>
          Testez vos connaissances avec nos quiz interactifs
        </p>
      </div>

      {/* Barre de recherche */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Rechercher un quiz..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, padding: '0.6rem 1rem',
            border: '1.5px solid #e5e7eb', borderRadius: 10,
            fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* États */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          Chargement des quiz...
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.9rem 1.2rem', borderRadius: 10, marginBottom: '1.5rem' }}>
          ❌ {error}
        </div>
      )}

      {!loading && !error && quizzesFiltres.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.4 }}>🧩</div>
          <p style={{ margin: 0 }}>
            {recherche ? 'Aucun quiz ne correspond à votre recherche.' : 'Aucun quiz disponible pour le moment.'}
          </p>
        </div>
      )}

      {/* Grille */}
      {!loading && !error && quizzesFiltres.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}>
          {quizzesFiltres.map(quiz => {
            const diff     = difficulteLabel(quiz.questions);
            const total    = scoreTotal(quiz.questions);
            const nbQ      = quiz.questions?.length ?? 0;
            const isPremiumQuiz = quiz.isPremium;
            const canAccess = !isPremiumQuiz || currentUser?.isPremium;

            return (
              <div
                key={quiz.id}
                onClick={() => canAccess && navigate(`/quiz-avance/${quiz.id}`)}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  padding: '1.25rem',
                  cursor: canAccess ? 'pointer' : 'default',
                  opacity: canAccess ? 1 : 0.65,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  border: '1.5px solid #f3f4f6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (canAccess) {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
                }}
              >
                {/* Badge premium */}
                {isPremiumQuiz && (
                  <span style={{
                    position: 'absolute', top: 12, right: 12,
                    background: '#fef3c7', color: '#d97706',
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '0.15rem 0.5rem', borderRadius: 20,
                  }}>
                    👑 Premium
                  </span>
                )}

                {/* Titre */}
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1f2937', margin: 0, lineHeight: 1.3, paddingRight: isPremiumQuiz ? '4rem' : 0 }}>
                  {quiz.titre}
                </h3>

                {/* Description */}
                {quiz.description && (
                  <p
                    style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    dangerouslySetInnerHTML={{ __html: quiz.description }}
                  />
                )}

                {/* Méta-infos */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.55rem', borderRadius: 20, fontWeight: 600 }}>
                    📝 {nbQ} question{nbQ > 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: '#f3f4f6', color: '#374151', padding: '0.2rem 0.55rem', borderRadius: 20, fontWeight: 600 }}>
                    ⏱ {quiz.duree} min
                  </span>
                  {total > 0 && (
                    <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#059669', padding: '0.2rem 0.55rem', borderRadius: 20, fontWeight: 600 }}>
                      🏆 {total} pts
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', background: '#fafafa', color: diff.color, padding: '0.2rem 0.55rem', borderRadius: 20, fontWeight: 700, border: `1px solid ${diff.color}30` }}>
                    {diff.label}
                  </span>
                </div>

                {/* CTA */}
                <button
                  disabled={!canAccess}
                  onClick={e => { e.stopPropagation(); canAccess && navigate(`/quiz-avance/${quiz.id}`); }}
                  style={{
                    marginTop: 'auto', padding: '0.55rem 1rem',
                    background: canAccess ? '#2563eb' : '#e5e7eb',
                    color: canAccess ? 'white' : '#9ca3af',
                    border: 'none', borderRadius: 8,
                    fontWeight: 600, fontSize: '0.85rem',
                    cursor: canAccess ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s',
                  }}
                >
                  {canAccess ? '▶ Commencer le quiz' : '🔒 Premium requis'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      {!loading && quizzesFiltres.length > 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '2rem' }}>
          {quizzesFiltres.length} quiz{quizzesFiltres.length > 1 ? '' : ''} disponible{quizzesFiltres.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default QuizListPage;
