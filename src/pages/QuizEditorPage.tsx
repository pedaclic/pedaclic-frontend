/**
 * ============================================================
 * PEDACLIC — Phase 12 : Page Éditeur de Quiz
 * Wrapper pour le composant QuizEditor (Quiz Avancé)
 * Route: /admin/quiz-avance/nouveau | /admin/quiz-avance/modifier/:quizId
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizEditor } from '../components/quiz/QuizEditor';
import { getQuizAvance } from '../services/quizAdvancedService';
import DisciplineService from '../services/disciplineService';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { QuizAvance } from '../types/quiz-advanced';
import { useToast } from '../contexts/ToastContext';

const QuizEditorPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [disciplines, setDisciplines] = useState<{ id: string; nom: string; classe: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [existingQuiz, setExistingQuiz] = useState<(QuizAvance) | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Charger disciplines + groupes en parallèle
        const [allDisciplines, groupesSnap] = await Promise.all([
          DisciplineService.getAll(),
          getDocs(query(collection(db, 'groupes_prof'), orderBy('dateCreation', 'desc'))),
        ]);
        setDisciplines(
          allDisciplines.map((d: any) => ({
            id: d.id,
            nom: d.nom,
            classe: d.classe || '',
          }))
        );
        setGroupes(
          groupesSnap.docs
            .filter((d) => !d.data().statut || d.data().statut === 'actif')
            .map((d) => ({ id: d.id, nom: d.data().nom }))
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
      groupes={groupes}
      auteurId={currentUser?.uid || ''}
      onSave={(savedId) => {
        toast.success('Quiz avancé sauvegardé avec succès !');
        navigate('/admin/quiz-avance');
      }}
      onSaveDraft={(savedId, isNew) => {
        if (isNew) {
          navigate(`/admin/quiz-avance/modifier/${savedId}`);
        }
        toast.success('Brouillon enregistré. Vous pouvez continuer plus tard.');
      }}
      onCancel={() => navigate('/admin/quiz-avance')}
    />
  );
};

export default QuizEditorPage;
