/**
 * ============================================================================
 * PROF QUIZ CLASSIQUE EDIT — PedaClic
 * ============================================================================
 * Édition d'un quiz classique (QCM) par un professeur premium.
 * Route : /prof/quiz/classique/:quizId/modifier
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getQuizById,
  updateQuiz,
  createEmptyQuestion,
} from '../services/quizService';
import type { Question } from '../services/quizService';
import DisciplineService from '../services/disciplineService';
import { getGroupesProf } from '../services/cahierTextesService';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
/* ★ Phase 60 — éditeur de questions étendu, partagé avec l'admin */
import EditeurQuestionsClassiques, {
  validerQuestionsClassiques,
} from '../components/quiz/EditeurQuestionsClassiques';

const ProfQuizClassicEditPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [disciplines, setDisciplines] = useState<{ id: string; nom: string }[]>([]);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [titre, setTitre] = useState('');
  const [disciplineId, setDisciplineId] = useState('');
  const [groupeId, setGroupeId] = useState('');
  const [duree, setDuree] = useState(15);
  const [noteMinimale, setNoteMinimale] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([createEmptyQuestion()]);
  const [isDraft, setIsDraft] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.uid || !quizId) return;
      try {
        setLoading(true);
        const [quiz, discs, grps] = await Promise.all([
          getQuizById(quizId),
          DisciplineService.getAll(),
          getGroupesProf(currentUser.uid),
        ]);
        if (!quiz) {
          setError('Quiz introuvable');
          setLoading(false);
          return;
        }
        if (quiz.profId && quiz.profId !== currentUser.uid) {
          setError('Vous n\'êtes pas autorisé à modifier ce quiz');
          setLoading(false);
          return;
        }
        setDisciplines(discs.map((d: any) => ({ id: d.id, nom: d.nom || d.name })));
        // ★ Phase 60 — la classe déjà liée reste proposée même archivée
        // (sinon le prof devait la remplacer pour pouvoir enregistrer).
        setGroupes(
          grps
            .filter((g) => !g.statut || g.statut === 'actif' || g.id === quiz.groupeId)
            .map((g) => ({
              id: g.id,
              nom: g.statut && g.statut !== 'actif' ? `${g.nom} (archivée)` : g.nom,
            }))
        );
        setTitre(quiz.titre);
        setDisciplineId(quiz.disciplineId || '');
        setGroupeId(quiz.groupeId || '');
        setDuree(quiz.duree || 15);
        setNoteMinimale(quiz.noteMinimale ?? 10);
        setQuestions(quiz.questions?.length ? quiz.questions : [createEmptyQuestion()]);
        setIsDraft(quiz.status === 'draft');
      } catch (err) {
        console.error('Erreur chargement:', err);
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.uid, quizId]);

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: keyof Question, value: any) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === idx
          ? { ...q, options: q.options.map((o, j) => (j === optIdx ? value : o)) }
          : q
      )
    );
  };

  /** Enregistrer comme brouillon (validation complète) — reste en brouillon */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizId) return;
    if (!titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!disciplineId) { setError('Sélectionnez une discipline'); return; }
    if (groupes.length > 0 && !groupeId) { setError('Sélectionnez une classe'); return; }
    if (questions.some((q) => !q.question.trim())) {
      setError('Chaque question doit avoir un énoncé');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateQuiz(
        quizId,
        {
          disciplineId,
          titre: titre.trim(),
          questions,
          duree,
          isPremium: false,
          noteMinimale,
          groupeId: groupeId || undefined,
        },
        { asDraft: true }
      );
      setIsDraft(true);
      toast.success('Brouillon enregistré. Vous pouvez continuer ou publier quand vous serez prêt.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  /** Publier le quiz — visible aux élèves */
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizId) return;
    if (!titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!disciplineId) { setError('Sélectionnez une discipline'); return; }
    if (groupes.length > 0 && !groupeId) { setError('Sélectionnez une classe'); return; }
    // ★ Phase 60 — avant publication : énoncés, options non vides, bonne réponse
    const erreurQuestions = validerQuestionsClassiques(questions);
    if (erreurQuestions) {
      setError(erreurQuestions);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateQuiz(
        quizId,
        {
          disciplineId,
          titre: titre.trim(),
          questions,
          duree,
          isPremium: false,
          noteMinimale,
          groupeId: groupeId || undefined,
        },
        { asDraft: false }
      );
      setIsDraft(false);
      toast.success('Quiz publié ! Il est maintenant visible par vos élèves.');
      navigate('/prof/quiz');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la publication');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!quizId) return;
    const titreVal = titre.trim() || 'Brouillon sans titre';
    const discId = disciplineId || disciplines[0]?.id;
    if (!discId) {
      setError('Sélectionnez une discipline pour enregistrer le brouillon');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateQuiz(
        quizId,
        {
          disciplineId: discId,
          titre: titreVal,
          questions,
          duree,
          isPremium: false,
          noteMinimale,
          groupeId: groupes.length > 0 ? (groupeId || undefined) : undefined,
        },
        { asDraft: true }
      );
      toast.success('Brouillon enregistré. Vous pouvez continuer plus tard.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du brouillon');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>⏳ Chargement...</p>
      </div>
    );
  }

  if (error && !titre) {
    return (
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>❌ {error}</p>
        <button onClick={() => navigate('/prof/quiz')} style={{ padding: '0.6rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <button
        onClick={() => navigate('/prof/quiz')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '1rem', background: 'none', border: 'none',
          cursor: 'pointer', color: '#6b7280', fontSize: '0.9rem',
        }}
      >
        <ArrowLeft size={18} /> Retour
      </button>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
        ✏️ Modifier le quiz classique
        {isDraft && (
          <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: 4, marginLeft: '0.5rem', fontWeight: 500 }}>
            Brouillon
          </span>
        )}
      </h1>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Titre *</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Évaluation Chapitre 3"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 10 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Discipline *</label>
              <select
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 10 }}
              >
                <option value="">— Sélectionner —</option>
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>{d.nom}</option>
                ))}
              </select>
            </div>

            {groupes.length > 0 && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Classe *</label>
                <select
                  value={groupeId}
                  onChange={(e) => setGroupeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 10 }}
                >
                  <option value="">— Sélectionner —</option>
                  {groupes.map((g) => (
                    <option key={g.id} value={g.id}>{g.nom}</option>
                  ))}
                </select>
                {/* ★ Phase 60 — rappel de la portée du lien */}
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Seuls les élèves inscrits à cette classe verront le quiz.
                </p>
              </div>
            )}
          </div>

          {/* ★ Phase 60 — sans classe, le quiz publié est visible par tous les élèves
              de la plateforme (comportement historique) : on le signale clairement. */}
          {groupes.length === 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.65rem 0.8rem', borderRadius: 8, fontSize: '0.85rem' }}>
              ⚠️ Vous n'avez pas encore de classe. Une fois publié, ce quiz sera visible par
              <strong> tous les élèves</strong> de PedaClic. Pour le réserver à vos élèves,
              créez d'abord une classe depuis votre tableau de bord (« 📚 Mes groupes-classes »).
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Durée (min)</label>
              <input
                type="number"
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                min={1}
                max={120}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 10 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Note minimale (/20)</label>
              <input
                type="number"
                value={noteMinimale}
                onChange={(e) => setNoteMinimale(Number(e.target.value))}
                min={0}
                max={20}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 10 }}
              />
            </div>
          </div>
        </div>

        {/* ★ Phase 60 — questions : réordonner, insérer, dupliquer, 2 à 6 options,
            explication, difficulté, points, actions groupées */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Questions</h2>
          <EditeurQuestionsClassiques
            questions={questions}
            onChange={setQuestions}
            minQuestions={1}
            deplierParDefaut
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/prof/quiz')} style={{ padding: '0.6rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Annuler
          </button>
          <button type="button" onClick={handleSaveDraft} disabled={saving || !disciplines.length} style={{ padding: '0.6rem 1rem', background: '#fff', color: '#2563eb', border: '2px solid #2563eb', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Enregistrement...' : '📝 Enregistrer comme brouillon'}
          </button>
          <button type="submit" disabled={saving} style={{ padding: '0.6rem 1rem', background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={handlePublish} disabled={saving} style={{ padding: '0.6rem 1.2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Publication...' : '📤 Publier'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfQuizClassicEditPage;
