/**
 * ============================================================================
 * PROF QUIZ AVANCÉ CREATE — PedaClic
 * ============================================================================
 * Création d'un quiz avancé par un professeur premium pour sa classe.
 * Route : /prof/quiz/avance/nouveau
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { QuizEditor } from '../components/quiz/QuizEditor';
import { getGroupesProf, attacherQuizASeance } from '../services/cahierTextesService';
import DisciplineService from '../services/disciplineService';
import { useToast } from '../contexts/ToastContext';

/**
 * Phase 32 — Contexte d'auto-rattachement passé par OngletQuizSeance
 * via `navigate(..., { state: { attachement } })`.
 */
interface AttachementContext {
  cahierId: string;
  seanceId: string;
  nature: 'classic' | 'avance';
  groupeId?: string | null;
  disciplineId?: string | null;
  titreSeance?: string | null;
}

const ProfQuizAvanceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [disciplines, setDisciplines] = useState<{ id: string; nom: string; classe: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Phase 32 — contexte d'auto-rattachement (optionnel)
  const attachement = (location.state as { attachement?: AttachementContext } | null)?.attachement
    ?? null;
  const hasAttachement = Boolean(attachement?.cahierId && attachement?.seanceId);

  /**
   * Phase 32 — Rattache le quiz nouvellement créé à la séance d'origine
   * puis redirige vers l'éditeur de séance. Retourne true si la navigation
   * a été prise en charge ici, false sinon (le caller applique son fallback).
   */
  const rattacherEtRetourner = async (quizId: string): Promise<boolean> => {
    if (!hasAttachement || !attachement) return false;
    try {
      await attacherQuizASeance({
        cahierId: attachement.cahierId,
        seanceId: attachement.seanceId,
        quizId,
        nature: 'avance',
      });
      toast.success('Quiz créé et rattaché à la séance.');
      navigate(
        `/prof/cahiers/${attachement.cahierId}/modifier/${attachement.seanceId}`,
        { replace: true }
      );
      return true;
    } catch (err) {
      console.error('[ProfQuizAvanceCreate] Rattachement échoué :', err);
      toast.warning(
        'Quiz créé, mais le rattachement à la séance a échoué. Vous pouvez le rattacher manuellement.'
      );
      return false;
    }
  };

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
      onSave={async (quizId) => {
        // Phase 32 — auto-rattachement si contexte séance
        const rattache = await rattacherEtRetourner(quizId);
        if (!rattache) navigate('/prof/quiz');
      }}
      onSaveDraft={async (savedId, isNew) => {
        toast.success('Brouillon enregistré. Vous pouvez continuer plus tard.');
        if (!isNew) return;
        // Phase 32 — auto-rattachement si contexte séance (uniquement à la création)
        const rattache = await rattacherEtRetourner(savedId);
        if (!rattache) navigate(`/prof/quiz/avance/${savedId}/modifier`);
      }}
      onCancel={() => navigate('/prof/quiz')}
    />
  );
};

export default ProfQuizAvanceCreatePage;
