/**
 * ============================================================================
 * PROF QUIZ PAGE — PedaClic
 * ============================================================================
 * Liste des quiz créés par le professeur premium (classiques + avancés).
 * Permet de créer des quiz pour ses classes.
 * Route : /prof/quiz
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getQuizzesByProf, deleteQuiz } from '../services/quizService';
import { getQuizzesAvanceByProf, deleteQuizAvance } from '../services/quizAdvancedService';
import type { Quiz } from '../services/quizService';
import type { QuizAvance } from '../types/quiz-advanced';
import { Plus, FileQuestion, Layers, Lock, Pencil, Trash2, Play } from 'lucide-react';

const ProfQuizPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [quizzesClassiques, setQuizzesClassiques] = useState<Quiz[]>([]);
  const [quizzesAvances, setQuizzesAvances] = useState<QuizAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'classique' | 'avance'; id: string } | null>(null);

  const isPremium = currentUser?.isPremium ?? false;

  const handleDeleteClassique = async (quizId: string) => {
    try {
      await deleteQuiz(quizId);
      setQuizzesClassiques((prev) => prev.filter((q) => q.id !== quizId));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  const handleDeleteAvance = async (quizId: string) => {
    try {
      await deleteQuizAvance(quizId);
      setQuizzesAvances((prev) => prev.filter((q) => q.id !== quizId));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser?.uid) return;
    const load = async () => {
      try {
        setLoading(true);
        const [classiques, avances] = await Promise.all([
          getQuizzesByProf(currentUser.uid),
          getQuizzesAvanceByProf(currentUser.uid),
        ]);
        setQuizzesClassiques(classiques);
        setQuizzesAvances(avances);
      } catch (err) {
        console.error('Erreur chargement quiz prof:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.uid]);

  if (!isPremium && !isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <Lock size={48} style={{ color: '#d97706', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Fonctionnalité Premium</h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          La création de quiz pour vos classes est réservée aux professeurs Premium.
        </p>
        <Link to="/premium" style={{ color: '#2563eb', fontWeight: 600 }}>
          Découvrir l'abonnement Premium →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            📝 Mes quiz
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
            Créez des quiz pour vos classes. Les élèves y accèdent depuis leur espace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/prof/quiz/classique/nouveau')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1rem', background: '#2563eb', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <FileQuestion size={18} />
            Quiz classique
          </button>
          <button
            onClick={() => navigate('/prof/quiz/avance/nouveau')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1rem', background: '#059669', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Layers size={18} />
            Quiz avancé
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          Chargement...
        </div>
      )}

      {!loading && quizzesClassiques.length === 0 && quizzesAvances.length === 0 && (
        <div style={{
          background: '#f8fafc', borderRadius: 12, padding: '2rem',
          textAlign: 'center', color: '#64748b',
        }}>
          <Plus size={40} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <p style={{ margin: '0 0 1rem' }}>Vous n'avez pas encore créé de quiz.</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Créez un quiz classique (QCM) ou un quiz avancé (multi-types) pour votre classe.
          </p>
        </div>
      )}

      {!loading && (quizzesClassiques.length > 0 || quizzesAvances.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {quizzesClassiques.length > 0 && (
            <section>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
                Quiz classiques ({quizzesClassiques.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {quizzesClassiques.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem 1rem', background: 'white', borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div
                      onClick={() => navigate(q.status === 'draft' ? `/prof/quiz/classique/${q.id}/modifier` : `/quiz/${q.id}`)}
                      style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    >
                      <span style={{ fontWeight: 500 }}>{q.titre}</span>
                      {q.status === 'draft' && (
                        <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.4rem', borderRadius: 4, marginLeft: '0.5rem' }}>
                          Brouillon
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        {q.questions?.length ?? 0} questions • {q.duree} min
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(q.status === 'draft' ? `/prof/quiz/classique/${q.id}/modifier` : `/quiz/${q.id}`)}
                        title={q.status === 'draft' ? 'Continuer le brouillon' : 'Tester'}
                        style={{ padding: '0.4rem', background: q.status === 'draft' ? '#fef3c7' : '#f0fdf4', color: q.status === 'draft' ? '#92400e' : '#166534', border: q.status === 'draft' ? '1px solid #fde68a' : '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => navigate(`/prof/quiz/classique/${q.id}/modifier`)}
                        title="Modifier"
                        style={{ padding: '0.4rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}
                      >
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm?.type === 'classique' && deleteConfirm?.id === q.id ? (
                        <span style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => handleDeleteClassique(q.id)} style={{ padding: '0.3rem 0.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>Oui</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.3rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>Non</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm({ type: 'classique', id: q.id })}
                          title="Supprimer"
                          style={{ padding: '0.4rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {quizzesAvances.length > 0 && (
            <section>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
                Quiz avancés ({quizzesAvances.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {quizzesAvances.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem 1rem', background: 'white', borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div
                      onClick={() => navigate(q.status === 'draft' ? `/prof/quiz/avance/${q.id}/modifier` : `/quiz-avance/${q.id}`)}
                      style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    >
                      <span style={{ fontWeight: 500 }}>{q.titre}</span>
                      {q.status === 'draft' && (
                        <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.4rem', borderRadius: 4, marginLeft: '0.5rem' }}>
                          Brouillon
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        {q.questions?.length ?? 0} questions • {q.duree} min
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(q.status === 'draft' ? `/prof/quiz/avance/${q.id}/modifier` : `/quiz-avance/${q.id}`)}
                        title={q.status === 'draft' ? 'Continuer le brouillon' : 'Tester'}
                        style={{ padding: '0.4rem', background: q.status === 'draft' ? '#fef3c7' : '#f0fdf4', color: q.status === 'draft' ? '#92400e' : '#166534', border: q.status === 'draft' ? '1px solid #fde68a' : '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => navigate(`/prof/quiz/avance/${q.id}/modifier`)}
                        title="Modifier"
                        style={{ padding: '0.4rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}
                      >
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm?.type === 'avance' && deleteConfirm?.id === q.id ? (
                        <span style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => handleDeleteAvance(q.id)} style={{ padding: '0.3rem 0.5rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>Oui</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ padding: '0.3rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>Non</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm({ type: 'avance', id: q.id })}
                          title="Supprimer"
                          style={{ padding: '0.4rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfQuizPage;
