/**
 * ============================================================================
 * PROF QUIZ AVANCÉ CREATE — PedaClic
 * ============================================================================
 * Création d'un quiz avancé par un professeur premium pour sa classe.
 * Route : /prof/quiz/avance/nouveau
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizEditor } from '../components/quiz/QuizEditor';
import { getGroupesProf } from '../services/cahierTextesService';
import DisciplineService from '../services/disciplineService';

const ProfQuizAvanceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [disciplines, setDisciplines] = useState<{ id: string; nom: string; classe: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.uid) return;
      try {
        const [discs, grps] = await Promise.all([
          DisciplineService.getAll(),
          getGroupesProf(currentUser.uid),
        ]);
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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.uid]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>⏳ Chargement...</p>
      </div>
    );
  }

  return (
    <QuizEditor
      disciplines={disciplines}
      groupes={groupes}
      auteurId={currentUser?.uid || ''}
      onSave={() => {
        navigate('/prof/quiz');
      }}
      onCancel={() => navigate('/prof/quiz')}
    />
  );
};

export default ProfQuizAvanceCreatePage;
