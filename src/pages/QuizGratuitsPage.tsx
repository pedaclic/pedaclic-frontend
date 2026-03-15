// ============================================================
// PAGE : QuizGratuitsPage
// Liste des quiz gratuits accessibles à tous
// - Onglets : Quiz classique | Quiz avancé (liés à la classe)
// - Visiteurs non connectés : aperçu 3 quiz + CTA inscription
// - Connectés non-premium  : quiz classiques + quiz avancés de leur classe
// - Premium / Prof / Admin : tous les quiz + lien quiz avancés
// Route : /quiz-gratuits
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getQuizGratuits,
  getQuizGratuitsApercu,
  type QuizGratuit,
} from '../services/quizGratuitService';
import { getQuizzesAvanceForEleve } from '../services/quizAdvancedService';
import type { QuizAvance } from '../types/quiz-advanced';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import '../styles/QuizGratuitsPage.css';

type TabQuiz = 'classique' | 'avance';
// ─── Constantes ───────────────────────────────────────────────

const DIFFICULTE_CONFIG = {
  facile:    { label: 'Facile',    color: '#059669', bg: '#d1fae5' },
  moyen:     { label: 'Moyen',     color: '#d97706', bg: '#fef3c7' },
  difficile: { label: 'Difficile', color: '#dc2626', bg: '#fee2e2' },
};

// ─── Composants locaux ────────────────────────────────────────

/** Carte d'un quiz avancé (onglet Quiz avancé) */
const CarteQuizAvance: React.FC<{
  quiz: QuizAvance;
  onJouer: (quiz: QuizAvance) => void;
}> = ({ quiz, onJouer }) => {
  const nbQ = quiz.questions?.length ?? 0;
  const diff = quiz.questions?.length
    ? (() => {
        const niveaux = quiz.questions.map(q => q.difficulte);
        const score = niveaux.reduce((s, n) =>
          s + (n === 'facile' ? 1 : n === 'moyen' ? 2 : 3), 0) / niveaux.length;
        if (score < 1.5) return { label: 'Facile', color: '#059669', bg: '#d1fae5' };
        if (score < 2.5) return { label: 'Moyen', color: '#d97706', bg: '#fef3c7' };
        return { label: 'Difficile', color: '#dc2626', bg: '#fee2e2' };
      })()
    : { label: 'Moyen', color: '#d97706', bg: '#fef3c7' };

  return (
    <div className="qg-card" onClick={() => onJouer(quiz)}>
      <div className="qg-card__header">
        <span className="qg-card__source qg-card__source--quizzes_v2">⭐ Quiz avancé</span>
        <span className="qg-card__difficulte" style={{ color: diff.color, background: diff.bg }}>
          {diff.label}
        </span>
      </div>
      <h3 className="qg-card__titre">{quiz.titre}</h3>
      {quiz.description && (
        <p className="qg-card__description" dangerouslySetInnerHTML={{ __html: quiz.description }} />
      )}
      <div className="qg-card__meta">
        {((quiz as Record<string, unknown>).disciplineNom ?? (quiz as Record<string, unknown>).matiere) && (
          <span className="qg-card__meta-item">
            📚 {String((quiz as Record<string, unknown>).disciplineNom ?? (quiz as Record<string, unknown>).matiere)}
          </span>
        )}
        <span className="qg-card__meta-item">❓ {nbQ} question{nbQ > 1 ? 's' : ''}</span>
        <span className="qg-card__meta-item">⏱ {quiz.duree} min</span>
      </div>
      <button className="qg-card__btn">🚀 Commencer</button>
    </div>
  );
};

/** Carte d'un quiz gratuit */
const CarteQuizGratuit: React.FC<{
  quiz: QuizGratuit;
  onJouer: (quiz: QuizGratuit) => void;
  estConnecte: boolean;
}> = ({ quiz, onJouer, estConnecte }) => {
  const diff = DIFFICULTE_CONFIG[quiz.difficulte ?? 'moyen'];

  return (
    /* Carte quiz gratuit */
    <div className="qg-card" onClick={() => onJouer(quiz)}>

      {/* En-tête de la carte */}
      <div className="qg-card__header">
        {/* Badge source */}
        <span className={`qg-card__source qg-card__source--${quiz.source}`}>
          {quiz.source === 'quizzes_v2' ? '⭐ Quiz avancé' : '📝 Quiz'}
        </span>
        {/* Badge difficulté */}
        <span
          className="qg-card__difficulte"
          style={{ color: diff.color, background: diff.bg }}
        >
          {diff.label}
        </span>
      </div>

      {/* Titre et description */}
      <h3 className="qg-card__titre">{quiz.titre}</h3>
      {quiz.description && (
        <p className="qg-card__description">{quiz.description}</p>
      )}

      {/* Métadonnées */}
      <div className="qg-card__meta">
        {quiz.matiere && (
          <span className="qg-card__meta-item">
            📚 {quiz.matiere}
          </span>
        )}
        {quiz.classe && (
          <span className="qg-card__meta-item">
            🎓 {quiz.classe}
          </span>
        )}
        <span className="qg-card__meta-item">
          ❓ {quiz.nombreQuestions} question{quiz.nombreQuestions > 1 ? 's' : ''}
        </span>
        {quiz.duree && (
          <span className="qg-card__meta-item">
            ⏱ {quiz.duree} min
          </span>
        )}
      </div>

      {/* Bouton action */}
      <button className="qg-card__btn">
        {estConnecte ? '🚀 Commencer' : '👀 Aperçu'}
      </button>
    </div>
  );
};

/** Bannière CTA pour visiteurs non connectés */
const BanniereInscription: React.FC = () => (
  <div className="qg-banniere qg-banniere--inscription">
    <div className="qg-banniere__icone">🔒</div>
    <div className="qg-banniere__texte">
      <h3>Connectez-vous pour accéder à tous les quiz gratuits</h3>
      <p>Créez un compte gratuitement et commencez à vous entraîner dès maintenant.</p>
    </div>
    <div className="qg-banniere__actions">
      <Link to="/inscription" className="btn btn-primary">
        Créer un compte gratuit
      </Link>
      <Link to="/connexion" className="btn btn-secondary">
        Se connecter
      </Link>
    </div>
  </div>
);

/** Bannière CTA pour utilisateurs non-premium */
const BannierePremium: React.FC = () => (
  <div className="qg-banniere qg-banniere--premium">
    <div className="qg-banniere__icone">👑</div>
    <div className="qg-banniere__texte">
      <h3>Débloquez les Quiz Avancés Premium</h3>
      <p>
        Accédez à des centaines de quiz avancés avec corrections détaillées,
        suivi de progression et bien plus encore.
      </p>
      <p className="qg-banniere__prix">
        <strong>Dès 10 000 FCFA / 3 mois</strong> — Accès illimité
      </p>
    </div>
    <Link to="/premium" className="btn btn-premium">
      👑 Devenir Premium
    </Link>
  </div>
);

// ─── Composant principal ──────────────────────────────────────

const QuizGratuitsPage: React.FC = () => {
  const navigate   = useNavigate();
  const { currentUser } = useAuth();

  // ── État ────────────────────────────────────────────────────
  const [tabActif, setTabActif]         = useState<TabQuiz>('classique');
  const [quizzes, setQuizzes]           = useState<QuizGratuit[]>([]);
  const [quizzesAvances, setQuizzesAvances] = useState<QuizAvance[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingAvance, setLoadingAvance] = useState(false);
  const [error, setError]               = useState('');
  const [filtreMatiere, setFiltreMatiere] = useState('');
  const [filtreNiveau, setFiltreNiveau]   = useState('');
  const [recherche, setRecherche]         = useState('');

  // ── Disciplines dynamiques depuis Firestore ─────────────────
  const { matieres: matieresDispos } = useDisciplinesOptions();

  const estConnecte = !!currentUser;
  const estPremium  = currentUser?.isPremium ?? false;
  const estProf     = currentUser?.role === 'prof' || currentUser?.role === 'admin';

  // ── Chargement des quiz classiques ───────────────────────────
  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      setError('');
      try {
        const data = estConnecte
          ? await getQuizGratuits()
          : await getQuizGratuitsApercu();
        setQuizzes(data);
      } catch (err) {
        console.error('Erreur chargement quiz gratuits:', err);
        setError('Impossible de charger les quiz. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [estConnecte]);

  // ── Chargement des quiz avancés (élève connecté, liés à sa classe) ──
  useEffect(() => {
    if (!estConnecte || !currentUser?.uid) return;
    const charger = async () => {
      setLoadingAvance(true);
      try {
        const data = await getQuizzesAvanceForEleve(
          currentUser.uid,
          currentUser?.isPremium ?? false
        );
        setQuizzesAvances(data);
      } catch (err) {
        console.error('Erreur chargement quiz avancés:', err);
      } finally {
        setLoadingAvance(false);
      }
    };
    charger();
  }, [estConnecte, currentUser?.uid, currentUser?.isPremium]);

  // ── Filtrage côté client (quiz classiques) ───────────────────
  const quizzesClassiques = quizzes.filter(q => q.source === 'quizzes');
  const quizzesFiltres = quizzesClassiques.filter(q => {
    const matchRecherche = !recherche ||
      q.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      q.matiere.toLowerCase().includes(recherche.toLowerCase());
    const matchMatiere = !filtreMatiere ||
      q.matiere.toLowerCase().includes(filtreMatiere.toLowerCase());
    const matchNiveau = !filtreNiveau ||
      (q.niveau ?? '').toLowerCase().includes(filtreNiveau.toLowerCase()) ||
      (q.classe ?? '').toLowerCase().includes(filtreNiveau.toLowerCase());
    return matchRecherche && matchMatiere && matchNiveau;
  });

  // ── Filtrage quiz avancés ───────────────────────────────────
  const getMatiereQuiz = (q: QuizAvance) =>
    String((q as Record<string, unknown>).disciplineNom ?? (q as Record<string, unknown>).matiere ?? '');
  const quizzesAvancesFiltres = quizzesAvances.filter(q => {
    const matiere = getMatiereQuiz(q);
    const matchRecherche = !recherche ||
      q.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      (q.description ?? '').toLowerCase().includes(recherche.toLowerCase()) ||
      matiere.toLowerCase().includes(recherche.toLowerCase());
    const matchMatiere = !filtreMatiere || matiere.toLowerCase().includes(filtreMatiere.toLowerCase());
    return matchRecherche && matchMatiere;
  });

  // ── Navigation vers le quiz ─────────────────────────────────
  const handleJouer = (quiz: QuizGratuit) => {
    if (!estConnecte) {
      navigate('/connexion');
      return;
    }
    navigate(`/quiz/${quiz.id}`);
  };

  const handleJouerAvance = (quiz: QuizAvance) => {
    if (!estConnecte) {
      navigate('/connexion');
      return;
    }
    navigate(`/quiz-avance/${quiz.id}`);
  };

  // ─── Rendu ──────────────────────────────────────────────────
  return (
    <div className="qg-page">

      {/* ===== EN-TÊTE DE LA PAGE ===== */}
      <div className="qg-hero">
        <div className="qg-hero__content">
          <h1 className="qg-hero__titre">
            📝 Quiz Gratuits
          </h1>
          <p className="qg-hero__sous-titre">
            Entraînez-vous gratuitement avec nos quiz de révision
            pour tous les niveaux du collège au lycée.
          </p>
          {/* Stats rapides */}
          <div className="qg-hero__stats">
            <span className="qg-hero__stat">
              <strong>{quizzesClassiques.length + (estConnecte ? quizzesAvances.length : 0)}</strong>
              {!estConnecte ? '+ quiz' : ' quiz disponibles'}
            </span>
            <span className="qg-hero__stat">
              <strong>100%</strong> gratuit
            </span>
            <span className="qg-hero__stat">
              <strong>6ème</strong> → <strong>Terminale</strong>
            </span>
          </div>
        </div>

        {/* Lien vers quiz premium pour prof/admin/premium */}
        {(estPremium || estProf) && (
          <Link to="/quizzes" className="qg-hero__lien-premium">
            👑 Voir les Quiz Premium →
          </Link>
        )}
      </div>

      {/* ===== FILTRES ===== */}
      <div className="qg-filtres">
        {/* Recherche */}
        <div className="qg-filtres__recherche">
          <input
            type="text"
            placeholder="🔍 Rechercher un quiz..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="qg-filtres__input"
          />
        </div>

        {/* Filtre matière */}
        <select
          value={filtreMatiere}
          onChange={e => setFiltreMatiere(e.target.value)}
          className="qg-filtres__select"
        >
          <option value="">Toutes les matières</option>
          {matieresDispos.map(m => (
            <option key={m.valeur} value={m.valeur}>{m.label}</option>
          ))}
        </select>

        {/* Bouton réinitialiser */}
        {(filtreMatiere || filtreNiveau || recherche) && (
          <button
            className="qg-filtres__reset"
            onClick={() => {
              setFiltreMatiere('');
              setFiltreNiveau('');
              setRecherche('');
            }}
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* ===== ONGLETS Quiz classique | Quiz avancé ===== */}
      <div className="qg-onglets">
        <button
          className={`qg-onglet ${tabActif === 'classique' ? 'active' : ''}`}
          onClick={() => setTabActif('classique')}
        >
          📝 Quiz classique
        </button>
        <button
          className={`qg-onglet ${tabActif === 'avance' ? 'active' : ''}`}
          onClick={() => setTabActif('avance')}
        >
          ⭐ Quiz avancé
        </button>
      </div>

      {/* ===== CONTENU PRINCIPAL ===== */}
      <div className="qg-contenu">

        {/* État de chargement */}
        {loading && (
          <div className="qg-loading">
            <div className="spinner"></div>
            <p>Chargement des quiz...</p>
          </div>
        )}

        {/* Erreur */}
        {!loading && error && (
          <div className="qg-erreur">
            <p>⚠️ {error}</p>
            <button onClick={() => window.location.reload()} className="btn btn-secondary">
              Réessayer
            </button>
          </div>
        )}

        {/* Liste des quiz */}
        {!loading && !error && tabActif === 'classique' && (
          <>
            <p className="qg-compteur">
              {quizzesFiltres.length} quiz{quizzesFiltres.length > 1 ? 's' : ''}
              {filtreMatiere ? ` en ${filtreMatiere}` : ''}
              {!estConnecte ? ' (aperçu — connectez-vous pour tout voir)' : ''}
            </p>

            {quizzesFiltres.length > 0 ? (
              <div className="qg-grille">
                {quizzesFiltres.map(quiz => (
                  <CarteQuizGratuit
                    key={`${quiz.source}-${quiz.id}`}
                    quiz={quiz}
                    onJouer={handleJouer}
                    estConnecte={estConnecte}
                  />
                ))}
              </div>
            ) : (
              <div className="qg-vide">
                <p>😕 Aucun quiz classique trouvé pour ces critères.</p>
                <button
                  onClick={() => { setFiltreMatiere(''); setRecherche(''); }}
                  className="btn btn-secondary"
                >
                  Voir tous les quiz
                </button>
              </div>
            )}

            {!estConnecte && <BanniereInscription />}
            {estConnecte && !estPremium && !estProf && <BannierePremium />}
          </>
        )}

        {/* Onglet Quiz avancé — liés à la classe de l'élève */}
        {!loading && !error && tabActif === 'avance' && (
          <>
            {loadingAvance ? (
              <div className="qg-loading">
                <div className="spinner"></div>
                <p>Chargement des quiz avancés...</p>
              </div>
            ) : !estConnecte ? (
              <div className="qg-vide">
                <p>🔐 Connectez-vous pour accéder aux quiz avancés de votre classe.</p>
                <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
              </div>
            ) : (
              <>
                <p className="qg-compteur">
                  {quizzesAvancesFiltres.length} quiz avancé{quizzesAvancesFiltres.length > 1 ? 's' : ''}
                  {filtreMatiere ? ` en ${filtreMatiere}` : ''}
                </p>

                {quizzesAvancesFiltres.length > 0 ? (
                  <div className="qg-grille">
                    {quizzesAvancesFiltres.map(quiz => (
                      <CarteQuizAvance
                        key={quiz.id}
                        quiz={quiz}
                        onJouer={handleJouerAvance}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="qg-vide">
                    <p>📚 Aucun quiz avancé disponible pour votre classe pour le moment.</p>
                    <p>
                      Votre professeur peut créer des quiz avancés et les partager avec votre classe.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default QuizGratuitsPage;
