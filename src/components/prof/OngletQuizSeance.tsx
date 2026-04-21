// ============================================================
// PedaClic — Phase 32 : OngletQuizSeance
// ============================================================
// 3ᵉ onglet du bloc "Cahier de textes — contenu à saisir" dans
// l'éditeur de séance (EntreeEditorPage).
//
// Fonctions :
//   1. Lister les Quiz déjà rattachés à la séance en cours
//   2. Permettre de rattacher un Quiz existant (Classic ou Avancé)
//      pris parmi "Mes Quiz" du prof
//   3. Permettre de créer un nouveau Quiz et l'attacher directement
//      (bouton "Créer un quiz pour cette séance" — navigation vers
//      ProfQuizClassicCreatePage / ProfQuizAvanceCreatePage en
//      passant cahierId + seanceId + groupeId en state de route)
//
// Contrat :
//   - La création effective du lien (attacherQuizASeance) se fait
//     au moment du choix de l'utilisateur (select + bouton Attacher)
//     via les helpers du cahierTextesService.
//   - Si la séance n'est pas encore créée (mode nouveau), on
//     désactive l'onglet et on demande d'enregistrer d'abord.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuizUnifie } from '../../services/quizUnifiedService';
import {
  getQuizzesBySeance,
  getQuizzesDuProf,
} from '../../services/quizUnifiedService';
import {
  attacherQuizASeance,
  detacherQuizDeSeance,
} from '../../services/cahierTextesService';
import { useToast } from '../../contexts/ToastContext';

export interface OngletQuizSeanceProps {
  /** Id de la séance en cours d'édition. null si création non sauvegardée. */
  seanceId: string | null;
  /** Id du cahier parent (requis pour la navigation création quiz). */
  cahierId: string;
  /** Id du prof courant. */
  profId: string;
  /** Premier groupe-classe lié au cahier (pour pré-remplir le quiz). */
  groupeIdParDefaut?: string | null;
  /** Nom de la discipline du cahier (pour pré-remplir le quiz). */
  disciplineId?: string;
  /** Titre de la séance (contexte affiché à l'utilisateur). */
  titreSeance?: string;
}

/**
 * Composant principal.
 * Gère son état de chargement interne ; ne remonte rien au parent
 * (la source de vérité est Firestore + le listener du parent).
 */
const OngletQuizSeance: React.FC<OngletQuizSeanceProps> = ({
  seanceId,
  cahierId,
  profId,
  groupeIdParDefaut = null,
  disciplineId,
  titreSeance,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Quiz déjà attachés à cette séance ──
  const [attaches, setAttaches] = useState<QuizUnifie[]>([]);
  // ── "Mes Quiz" (du prof) — pour le sélecteur de rattachement ──
  const [mesQuiz, setMesQuiz] = useState<QuizUnifie[]>([]);
  const [chargement, setChargement] = useState(false);
  const [quizSelectionne, setQuizSelectionne] = useState<string>('');
  const [filtreNature, setFiltreNature] = useState<'tous' | 'classic' | 'avance'>('tous');

  // Recharge les deux listes
  const recharger = async () => {
    if (!seanceId) return;
    setChargement(true);
    try {
      const [lAttaches, lMiens] = await Promise.all([
        getQuizzesBySeance(seanceId),
        getQuizzesDuProf(profId),
      ]);
      setAttaches(lAttaches);
      setMesQuiz(lMiens);
    } catch (err) {
      console.error('[OngletQuizSeance] Erreur chargement :', err);
      toast.error('Impossible de charger les quiz.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    void recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seanceId, profId]);

  // Quiz disponibles au rattachement : "Mes Quiz" privés d'éléments
  // déjà attachés à la séance (évite les doublons dans le select).
  const quizDisponibles = useMemo(() => {
    const dejaAttachesIds = new Set(attaches.map((q) => `${q.nature}:${q.id}`));
    return mesQuiz
      .filter((q) => !dejaAttachesIds.has(`${q.nature}:${q.id}`))
      .filter((q) => filtreNature === 'tous' || q.nature === filtreNature);
  }, [mesQuiz, attaches, filtreNature]);

  // ── Actions ──

  /** Attache le quiz sélectionné à la séance courante. */
  const handleAttacher = async () => {
    if (!seanceId || !quizSelectionne) return;
    // Le id sélectionné est au format "nature:quizId" pour ne pas
    // confondre un quiz Classic et un Avancé avec le même id.
    const [nature, quizId] = quizSelectionne.split(':') as [
      'classic' | 'avance',
      string,
    ];
    try {
      await attacherQuizASeance({
        cahierId,
        seanceId,
        quizId,
        nature,
      });
      toast.success('Quiz rattaché à la séance.');
      setQuizSelectionne('');
      await recharger();
    } catch (err) {
      console.error('[OngletQuizSeance] Erreur rattachement :', err);
      toast.error('Erreur lors du rattachement.');
    }
  };

  /** Retire un quiz de la séance (sans le supprimer). */
  const handleDetacher = async (q: QuizUnifie) => {
    if (!seanceId) return;
    try {
      await detacherQuizDeSeance({
        cahierId,
        seanceId,
        quizId: q.id,
        nature: q.nature,
      });
      toast.info('Quiz détaché de la séance.');
      await recharger();
    } catch (err) {
      console.error('[OngletQuizSeance] Erreur détachement :', err);
      toast.error('Erreur lors du détachement.');
    }
  };

  /**
   * Redirige vers la création d'un Quiz (Classic ou Avancé).
   * Passe le contexte (cahierId, seanceId, groupeId, disciplineId) en
   * state de route pour pré-remplissage et rattachement automatique.
   */
  const handleCreerQuiz = (nature: 'classic' | 'avance') => {
    if (!seanceId) {
      toast.warning('Enregistrez d\'abord la séance avant de créer un quiz.');
      return;
    }
    const route =
      nature === 'classic'
        ? '/prof/quiz/classique/nouveau'
        : '/prof/quiz/avance/nouveau';
    navigate(route, {
      state: {
        // Contexte pour auto-rattachement après création
        attachement: {
          cahierId,
          seanceId,
          nature,
          groupeId: groupeIdParDefaut ?? null,
          disciplineId: disciplineId ?? null,
          titreSeance: titreSeance ?? null,
        },
      },
    });
  };

  // ── Rendu ──

  // Cas spécial : séance pas encore enregistrée
  if (!seanceId) {
    return (
      <div className="onglet-quiz-seance onglet-quiz-seance--bloque" role="tabpanel">
        <div className="onglet-quiz-seance__empty">
          <span className="onglet-quiz-seance__empty-icon">🔒</span>
          <p>
            Enregistrez d'abord la séance (bouton <strong>✅ Enregistrer la séance</strong>)
            pour pouvoir y rattacher un quiz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="onglet-quiz-seance" role="tabpanel" aria-label="Quiz liés à la séance">
      {/* ══ Section 1 : Quiz déjà attachés ══ */}
      <section className="onglet-quiz-seance__section">
        <h4 className="onglet-quiz-seance__titre">
          🎯 Quiz rattachés à cette séance
          <span className="onglet-quiz-seance__count">{attaches.length}</span>
        </h4>

        {chargement ? (
          <p className="onglet-quiz-seance__loading">Chargement…</p>
        ) : attaches.length === 0 ? (
          <p className="onglet-quiz-seance__empty-text">
            Aucun quiz rattaché pour le moment. Rattachez un quiz existant ou créez-en un ci-dessous.
          </p>
        ) : (
          <ul className="onglet-quiz-seance__liste">
            {attaches.map((q) => (
              <li key={`${q.nature}:${q.id}`} className="onglet-quiz-seance__item">
                <div className="onglet-quiz-seance__item-info">
                  <span
                    className={`onglet-quiz-seance__badge onglet-quiz-seance__badge--${q.nature}`}
                    title={q.nature === 'classic' ? 'Quiz Classique' : 'Quiz Avancé'}
                  >
                    {q.nature === 'classic' ? '🎯 Classique' : '🚀 Avancé'}
                  </span>
                  <span className="onglet-quiz-seance__item-titre">{q.titre}</span>
                  <span className="onglet-quiz-seance__item-meta">
                    {q.nombreQuestions} question{q.nombreQuestions > 1 ? 's' : ''}
                    {q.duree > 0 && ` • ${q.duree} min`}
                  </span>
                </div>
                <button
                  type="button"
                  className="onglet-quiz-seance__btn-detach"
                  onClick={() => handleDetacher(q)}
                  title="Détacher ce quiz (le quiz ne sera pas supprimé)"
                >
                  ✕ Détacher
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ══ Section 2 : Rattacher un quiz existant ══ */}
      <section className="onglet-quiz-seance__section">
        <h4 className="onglet-quiz-seance__titre">🔗 Rattacher un quiz existant</h4>

        <div className="onglet-quiz-seance__ligne">
          <select
            className="form-select"
            value={filtreNature}
            onChange={(e) => setFiltreNature(e.target.value as typeof filtreNature)}
            aria-label="Filtrer par type de quiz"
          >
            <option value="tous">Tous types</option>
            <option value="classic">🎯 Classique uniquement</option>
            <option value="avance">🚀 Avancé uniquement</option>
          </select>

          <select
            className="form-select onglet-quiz-seance__select"
            value={quizSelectionne}
            onChange={(e) => setQuizSelectionne(e.target.value)}
            disabled={quizDisponibles.length === 0}
          >
            <option value="">
              {quizDisponibles.length === 0
                ? '— Aucun quiz disponible —'
                : '— Choisir un quiz —'}
            </option>
            {quizDisponibles.map((q) => (
              <option key={`${q.nature}:${q.id}`} value={`${q.nature}:${q.id}`}>
                {q.nature === 'classic' ? '🎯 ' : '🚀 '}
                {q.titre} ({q.nombreQuestions} q.)
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-primary"
            disabled={!quizSelectionne}
            onClick={handleAttacher}
          >
            + Rattacher
          </button>
        </div>
      </section>

      {/* ══ Section 3 : Créer un quiz pour cette séance ══ */}
      <section className="onglet-quiz-seance__section">
        <h4 className="onglet-quiz-seance__titre">➕ Créer un nouveau quiz</h4>
        <p className="onglet-quiz-seance__aide">
          Le nouveau quiz sera automatiquement rattaché à cette séance et à la classe du
          cahier. Les élèves le verront dans leur liste « Mes Quiz ».
        </p>
        <div className="onglet-quiz-seance__ligne">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleCreerQuiz('classic')}
          >
            🎯 Créer un Quiz Classique
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleCreerQuiz('avance')}
          >
            🚀 Créer un Quiz Avancé
          </button>
        </div>
      </section>
    </div>
  );
};

export default OngletQuizSeance;
