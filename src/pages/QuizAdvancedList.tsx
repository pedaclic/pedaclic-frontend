/**
 * ============================================================
 * PEDACLIC — Phase 12 : Liste des Quiz Avancés (Admin/Prof)
 * Affiche tous les quiz v2 avec actions : modifier, tester, supprimer
 * Route: /admin/quiz-avance
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllQuizzes, deleteQuizAvance } from '../services/quizAdvancedService';
import type { QuizAvance } from '../types/quiz-advanced';
import { TYPE_QUESTION_LABELS } from '../types/quiz-advanced';

const QuizAdvancedList: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ==================== CHARGEMENT ====================

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllQuizzes();
      setQuizzes(data);
    } catch (err: any) {
      console.error('Erreur chargement quiz:', err);
      setError('Impossible de charger les quiz');
    } finally {
      setLoading(false);
    }
  };

  // ==================== SUPPRESSION ====================

  const handleDelete = async (quizId: string) => {
    try {
      await deleteQuizAvance(quizId);
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression : ' + err.message);
    }
  };

  // ==================== HELPERS ====================

  /** Compte les types de questions dans un quiz */
  const getTypesResume = (quiz: QuizAvance): string => {
    const counts: Record<string, number> = {};
    quiz.questions.forEach(q => {
      counts[q.type] = (counts[q.type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => `${count} ${TYPE_QUESTION_LABELS[type as keyof typeof TYPE_QUESTION_LABELS] || type}`)
      .join(', ');
  };

  /** Formater la date */
  const formatDate = (date: any): string => {
    if (!date) return '—';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /** Calcul du score total */
  const getScoreTotal = (quiz: QuizAvance): number => {
    return quiz.questions.reduce((sum, q) => sum + q.points, 0);
  };

  // ==================== RENDU ====================

  return (
    <div style={{ padding: '1.5rem' }}>

      {/* ---- En-tête ---- */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            📝 Quiz Avancés (Multi-types)
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {quizzes.length} quiz créé{quizzes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/quiz/nouveau')}
          style={{
            padding: '0.7rem 1.5rem', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          ➕ Nouveau quiz avancé
        </button>
      </div>

      {/* ---- Erreur ---- */}
      {error && (
        <div style={{
          padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '8px', color: '#991b1b', marginBottom: '1rem'
        }}>
          ⚠️ {error}
          <button onClick={loadQuizzes} style={{
            marginLeft: '1rem', padding: '0.3rem 0.8rem', background: '#fff',
            border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer'
          }}>
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* ---- Chargement ---- */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          ⏳ Chargement des quiz...
        </div>
      )}

      {/* ---- Liste vide ---- */}
      {!loading && quizzes.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '3rem', background: '#f9fafb',
          borderRadius: '12px', border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h3 style={{ color: '#374151', marginBottom: '0.5rem' }}>Aucun quiz avancé</h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Créez votre premier quiz multi-types avec l'éditeur riche !
          </p>
          <button
            onClick={() => navigate('/admin/quiz/nouveau')}
            style={{
              padding: '0.7rem 1.5rem', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            ➕ Créer un quiz
          </button>
        </div>
      )}

      {/* ---- Liste des quiz ---- */}
      {!loading && quizzes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {quizzes.map(quiz => (
            <div
              key={quiz.id}
              style={{
                background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
                padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s',
              }}
            >
              {/* ---- Ligne principale ---- */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                flexWrap: 'wrap', gap: '1rem'
              }}>
                {/* Info quiz */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                      {quiz.titre}
                    </h3>
                    {quiz.isPremium && (
                      <span style={{
                        padding: '0.15rem 0.5rem', background: '#fef3c7', color: '#92400e',
                        borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                        border: '1px solid #fde68a'
                      }}>
                        🔒 Premium
                      </span>
                    )}
                  </div>

                  {/* Badges info */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', background: '#eff6ff', color: '#1d4ed8',
                      borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500
                    }}>
                      📝 {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{
                      padding: '0.2rem 0.6rem', background: '#f0fdf4', color: '#166534',
                      borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500
                    }}>
                      🏆 {getScoreTotal(quiz)} pts
                    </span>
                    <span style={{
                      padding: '0.2rem 0.6rem', background: '#fdf4ff', color: '#86198f',
                      borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500
                    }}>
                      ⏱️ {quiz.duree} min
                    </span>
                  </div>

                  {/* Types de questions */}
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
                    Types : {getTypesResume(quiz)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                    Créé le {formatDate(quiz.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* Tester le quiz (comme élève) */}
                  <button
                    onClick={() => navigate(`/quiz-avance/${quiz.id}`)}
                    title="Tester le quiz"
                    style={{
                      padding: '0.5rem 0.9rem', background: '#f0fdf4', color: '#166534',
                      border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.8rem'
                    }}
                  >
                    ▶️ Tester
                  </button>

                  {/* Modifier */}
                  <button
                    onClick={() => navigate(`/admin/quiz/modifier/${quiz.id}`)}
                    title="Modifier le quiz"
                    style={{
                      padding: '0.5rem 0.9rem', background: '#eff6ff', color: '#1d4ed8',
                      border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.8rem'
                    }}
                  >
                    ✏️ Modifier
                  </button>

                  {/* Copier le lien élève */}
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/quiz-avance/${quiz.id}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert('✅ Lien copié !\n\n' + url + '\n\nPartagez ce lien aux élèves.');
                      });
                    }}
                    title="Copier le lien pour les élèves"
                    style={{
                      padding: '0.5rem 0.9rem', background: '#fdf4ff', color: '#86198f',
                      border: '1px solid #e9d5ff', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.8rem'
                    }}
                  >
                    🔗 Lien
                  </button>

                  {/* Supprimer */}
                  {deleteConfirm === quiz.id ? (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        style={{
                          padding: '0.5rem 0.7rem', background: '#dc2626', color: '#fff',
                          border: 'none', borderRadius: '8px', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.8rem'
                        }}
                      >
                        ✅ Confirmer
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          padding: '0.5rem 0.7rem', background: '#f3f4f6', color: '#374151',
                          border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(quiz.id)}
                      title="Supprimer le quiz"
                      style={{
                        padding: '0.5rem 0.9rem', background: '#fef2f2', color: '#991b1b',
                        border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.8rem'
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizAdvancedList;
