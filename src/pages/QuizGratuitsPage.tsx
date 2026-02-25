// ============================================================
// PAGE : QuizGratuitsPage
// Liste des quiz gratuits accessibles à tous
// - Visiteurs non connectés : aperçu 3 quiz + CTA inscription
// - Connectés non-premium  : tous les quiz gratuits + CTA premium
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
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import '../styles/QuizGratuitsPage.css';
// ─── Constantes ───────────────────────────────────────────────

const DIFFICULTE_CONFIG = {
  facile:    { label: 'Facile',    color: '#059669', bg: '#d1fae5' },
  moyen:     { label: 'Moyen',     color: '#d97706', bg: '#fef3c7' },
  difficile: { label: 'Difficile', color: '#dc2626', bg: '#fee2e2' },
};

// ─── Composants locaux ────────────────────────────────────────

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
        <strong>2 000 FCFA/mois</strong> · <strong>20 000 FCFA/an</strong>
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
  const [quizzes, setQuizzes]           = useState<QuizGratuit[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [filtreMatiere, setFiltreMatiere] = useState('');
  const [filtreNiveau, setFiltreNiveau]   = useState('');
  const [recherche, setRecherche]         = useState('');

  // ── Disciplines dynamiques depuis Firestore ─────────────────
  const { matieres: matieresDispos } = useDisciplinesOptions();

  const estConnecte = !!currentUser;
  const estPremium  = currentUser?.isPremium ?? false;
  const estProf     = currentUser?.role === 'prof' || currentUser?.role === 'admin';

  // ── Chargement des quiz ─────────────────────────────────────
  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      setError('');
      try {
        // Visiteur non connecté → aperçu 3 quiz seulement
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

  // ── Filtrage côté client ────────────────────────────────────
  const quizzesFiltres = quizzes.filter(q => {
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

  // ── Navigation vers le quiz ─────────────────────────────────
  const handleJouer = (quiz: QuizGratuit) => {
    if (!estConnecte) {
      navigate('/connexion');
      return;
    }
    // Quiz avancé → QuizPlayerPage, quiz simple → QuizPlayer
    if (quiz.source === 'quizzes_v2') {
      navigate(`/quiz-avance/${quiz.id}`);
    } else {
      navigate(`/quiz/${quiz.id}`);
    }
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
              <strong>{quizzes.length}</strong>
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
        {!loading && !error && (
          <>
            {/* Compteur résultats */}
            <p className="qg-compteur">
              {quizzesFiltres.length} quiz{quizzesFiltres.length > 1 ? 's' : ''}
              {filtreMatiere ? ` en ${filtreMatiere}` : ''}
              {!estConnecte ? ' (aperçu — connectez-vous pour tout voir)' : ''}
            </p>

            {/* Grille de cartes */}
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
                <p>😕 Aucun quiz trouvé pour ces critères.</p>
                <button
                  onClick={() => { setFiltreMatiere(''); setRecherche(''); }}
                  className="btn btn-secondary"
                >
                  Voir tous les quiz
                </button>
              </div>
            )}

            {/* Bannière inscription pour visiteurs */}
            {!estConnecte && <BanniereInscription />}

            {/* Bannière premium pour connectés non-premium */}
            {estConnecte && !estPremium && !estProf && <BannierePremium />}
          </>
        )}
      </div>
    </div>
  );
};

export default QuizGratuitsPage;
