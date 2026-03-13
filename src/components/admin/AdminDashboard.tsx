/**
 * ============================================================================
 * COMPOSANT ADMIN DASHBOARD - PedaClic
 * ============================================================================
 * Tableau de bord principal de l'interface d'administration
 * Affiche les statistiques et l'accès rapide aux fonctionnalités
 * 
 * ✅ Correctifs :
 *   - Compteur Quiz : interroge les collections quizzes + quizzes_v2
 *   - Stat cards : rendues cliquables (liens vers les pages admin)
 *   - Répartition par type : cartes cliquables
 *   - Actions rapides : ajout Quiz et Quiz Avancés
 * 
 * @author PedaClic Team
 * @version 1.1.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import DisciplineService from '../../services/disciplineService';
import { ChapitreService } from '../../services/chapitreService';
import ResourceService from '../../services/ResourceService';

// ==================== INTERFACES ====================

interface DashboardStats {
  totalDisciplines: number;
  totalChapitres: number;
  totalRessources: number;
  ressourcesPremium: number;
  ressourcesGratuites: number;
  totalCours: number;       // Cours en ligne (collection cours_en_ligne)
  totalQuiz: number;         // Quiz classiques (collection quizzes)
  totalQuizAvances: number;  // Quiz avancés (collection quizzes_v2)
  totalLiveSessions: number;  // Sessions Live (collection live_sessions)
  ressourcesParType: {
    cours: number;
    exercice: number;
    video: number;
    document: number;
    quiz: number;
  };
}

// ==================== COMPOSANT PRINCIPAL ====================

const AdminDashboard: React.FC = () => {
  // ==================== ÉTAT ====================
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDisciplines: 0,
    totalChapitres: 0,
    totalRessources: 0,
    ressourcesPremium: 0,
    ressourcesGratuites: 0,
    totalCours: 0,
    totalQuiz: 0,
    totalQuizAvances: 0,
    totalLiveSessions: 0,
    ressourcesParType: {
      cours: 0,
      exercice: 0,
      video: 0,
      document: 0,
      quiz: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==================== CHARGEMENT DES STATISTIQUES ====================

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Chargement parallèle : disciplines, chapitres, ressources,
        // + comptage des quiz depuis leurs collections Firestore dédiées
        const [disciplines, chapitres, resourceStats, quizzesSnap, quizzesV2Snap, coursSnap, liveSnap] = await Promise.all([
          DisciplineService.getAll(),
          ChapitreService.getAll(),
          ResourceService.getStats(),
          getDocs(collection(db, 'quizzes')),
          getDocs(collection(db, 'quizzes_v2')),
          getDocs(collection(db, 'cours_en_ligne')),
          getDocs(collection(db, 'live_sessions'))
        ]);

        setStats({
          totalDisciplines: disciplines.length,
          totalChapitres: chapitres.length,
          totalRessources: resourceStats.total,
          ressourcesPremium: resourceStats.premium,
          ressourcesGratuites: resourceStats.gratuit,
          totalCours: coursSnap.size,
          totalQuiz: quizzesSnap.size,
          totalQuizAvances: quizzesV2Snap.size,
          totalLiveSessions: liveSnap.size,
          ressourcesParType: resourceStats.parType
        });
      } catch (err) {
        console.error('Erreur lors du chargement des statistiques:', err);
        setError('Impossible de charger les statistiques');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  // ==================== RENDU ====================

  return (
    <div className="admin-dashboard">
      {/* En-tête de la page */}
      <header className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">
            Tableau de bord
          </h1>
          <p className="admin-page-header__subtitle">
            Bienvenue, {currentUser?.displayName || 'Administrateur'} ! 
            Gérez votre contenu pédagogique depuis cette interface.
          </p>
        </div>
      </header>

      {/* Message d'erreur */}
      {error && (
        <div className="alert alert--error">
          <span className="alert__icon">⚠️</span>
          <div className="alert__content">
            <p className="alert__message">{error}</p>
          </div>
        </div>
      )}

      {/* État de chargement */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des statistiques...</p>
        </div>
      ) : (
        <>
          {/* ====== Grille des statistiques principales ====== */}
          {/* Toutes les cartes sont cliquables et redirigent vers la page admin correspondante */}
          <section className="stats-grid">
            {/* Carte: Total Disciplines → /admin/disciplines */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/disciplines')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/disciplines')}
            >
              <div className="stat-card__icon stat-card__icon--primary">
                📚
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalDisciplines}</div>
                <div className="stat-card__label">Disciplines</div>
              </div>
            </div>

            {/* Carte: Total Chapitres → /admin/chapitres */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/chapitres')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/chapitres')}
            >
              <div className="stat-card__icon stat-card__icon--secondary">
                📖
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalChapitres}</div>
                <div className="stat-card__label">Chapitres</div>
              </div>
            </div>

            {/* Carte: Total Ressources → /admin/ressources */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/ressources')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/ressources')}
            >
              <div className="stat-card__icon stat-card__icon--info">
                📝
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalRessources}</div>
                <div className="stat-card__label">Ressources</div>
              </div>
            </div>

            {/* Carte: Ressources Premium → /admin/ressources */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/ressources')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/ressources')}
            >
              <div className="stat-card__icon stat-card__icon--warning">
                ⭐
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.ressourcesPremium}</div>
                <div className="stat-card__label">Ressources Premium</div>
              </div>
            </div>

            {/* Carte: Cours en ligne → /prof/cours */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/prof/cours')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/prof/cours')}
            >
              <div className="stat-card__icon stat-card__icon--primary">
                📘
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalCours}</div>
                <div className="stat-card__label">Cours en ligne</div>
              </div>
            </div>

            {/* Carte: Quiz classiques → /admin/quiz */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/quiz')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/quiz')}
            >
              <div className="stat-card__icon stat-card__icon--quiz">
                🧩
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalQuiz}</div>
                <div className="stat-card__label">Quiz</div>
              </div>
            </div>

            {/* Carte: Quiz Avancés → /admin/quiz-avance */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/admin/quiz-avance')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/quiz-avance')}
            >
              <div className="stat-card__icon stat-card__icon--advanced">
                🧠
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalQuizAvances}</div>
                <div className="stat-card__label">Quiz Avancés</div>
              </div>
            </div>

            {/* Carte: Sessions Live → /prof/live */}
            <div
              className="stat-card stat-card--clickable"
              onClick={() => navigate('/prof/live')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/prof/live')}
            >
              <div className="stat-card__icon stat-card__icon--live">
                📺
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalLiveSessions}</div>
                <div className="stat-card__label">Sessions Live</div>
              </div>
            </div>
          </section>

          {/* ====== Section: Répartition par type ====== */}
          {/* Chaque carte de type redirige vers /admin/ressources */}
          <section className="content-card">
            <div className="content-card__header">
              <h2>Répartition des ressources par type</h2>
            </div>
            <div className="content-card__body">
              <div className="resource-type-grid">
                {/* Cours */}
                <div
                  className="resource-type-item resource-type-item--clickable"
                  onClick={() => navigate('/admin/ressources')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="resource-item__icon resource-item__icon--cours">
                    📘
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.ressourcesParType.cours}
                    </span>
                    <span className="resource-type-label">Cours</span>
                  </div>
                </div>

                {/* Exercices */}
                <div
                  className="resource-type-item resource-type-item--clickable"
                  onClick={() => navigate('/admin/ressources')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="resource-item__icon resource-item__icon--exercice">
                    ✏️
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.ressourcesParType.exercice}
                    </span>
                    <span className="resource-type-label">Exercices</span>
                  </div>
                </div>

                {/* Vidéos */}
                <div
                  className="resource-type-item resource-type-item--clickable"
                  onClick={() => navigate('/admin/ressources')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="resource-item__icon resource-item__icon--video">
                    🎬
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.ressourcesParType.video}
                    </span>
                    <span className="resource-type-label">Vidéos</span>
                  </div>
                </div>

                {/* Documents */}
                <div
                  className="resource-type-item resource-type-item--clickable"
                  onClick={() => navigate('/admin/ressources')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="resource-item__icon resource-item__icon--document">
                    📄
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.ressourcesParType.document}
                    </span>
                    <span className="resource-type-label">Documents</span>
                  </div>
                </div>

                {/* Quiz (depuis la collection ressources) */}
                <div
                  className="resource-type-item resource-type-item--clickable"
                  onClick={() => navigate('/admin/quiz')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="resource-item__icon resource-item__icon--quiz">
                    🧩
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.totalQuiz + stats.totalQuizAvances}
                    </span>
                    <span className="resource-type-label">Quiz (tous)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ====== Section: Actions rapides ====== */}
          <section className="content-card" style={{ marginTop: 'var(--spacing-xl)' }}>
            <div className="content-card__header">
              <h2>Actions rapides</h2>
            </div>
            <div className="content-card__body">
              <div className="quick-actions-grid">
                {/* Gérer les disciplines */}
                <a href="/admin/disciplines" className="quick-action-card">
                  <div className="quick-action-icon">📚</div>
                  <div className="quick-action-content">
                    <h3>Gérer les disciplines</h3>
                    <p>Ajouter, modifier ou supprimer des matières</p>
                  </div>
                </a>

                {/* Gérer les chapitres */}
                <a href="/admin/chapitres" className="quick-action-card">
                  <div className="quick-action-icon">📖</div>
                  <div className="quick-action-content">
                    <h3>Gérer les chapitres</h3>
                    <p>Organiser le contenu par chapitres</p>
                  </div>
                </a>

                {/* Gérer les ressources */}
                <a href="/admin/ressources" className="quick-action-card">
                  <div className="quick-action-icon">📝</div>
                  <div className="quick-action-content">
                    <h3>Gérer les ressources</h3>
                    <p>Cours, exercices, vidéos et documents</p>
                  </div>
                </a>

                {/* Gérer les quiz */}
                <a href="/admin/quiz" className="quick-action-card">
                  <div className="quick-action-icon">🧩</div>
                  <div className="quick-action-content">
                    <h3>Gérer les quiz</h3>
                    <p>Créer et modifier des quiz pour les élèves</p>
                  </div>
                </a>

                {/* Gérer les quiz avancés */}
                <a href="/admin/quiz-avance" className="quick-action-card">
                  <div className="quick-action-icon">🧠</div>
                  <div className="quick-action-content">
                    <h3>Quiz avancés</h3>
                    <p>Quiz interactifs avec niveaux de difficulté</p>
                  </div>
                </a>

                {/* Gérer les utilisateurs */}
                <a href="/admin/utilisateurs" className="quick-action-card">
                  <div className="quick-action-icon">👥</div>
                  <div className="quick-action-content">
                    <h3>Gérer les utilisateurs</h3>
                    <p>Élèves, professeurs et administrateurs</p>
                  </div>
                </a>

                {/* Cahier de Textes */}
                <a href="/prof/cahiers" className="quick-action-card">
                  <div className="quick-action-icon">📒</div>
                  <div className="quick-action-content">
                    <h3>Cahier de Textes</h3>
                    <p>Planifier et suivre l'enseignement</p>
                  </div>
                </a>

                {/* Séquences Pédagogiques */}
                <a href="/prof/sequences" className="quick-action-card">
                  <div className="quick-action-icon">📋</div>
                  <div className="quick-action-content">
                    <h3>Séquences Pédagogiques</h3>
                    <p>Créer et organiser des séquences de cours</p>
                  </div>
                </a>

                {/* Cours en ligne */}
                <a href="/prof/cours" className="quick-action-card">
                  <div className="quick-action-icon">📘</div>
                  <div className="quick-action-content">
                    <h3>Cours en ligne</h3>
                    <p>Créer et gérer les cours en ligne</p>
                  </div>
                </a>

                {/* Médiathèque */}
                <a href="/mediatheque" className="quick-action-card">
                  <div className="quick-action-icon">🎬</div>
                  <div className="quick-action-content">
                    <h3>Médiathèque</h3>
                    <p>Vidéos, podcasts et webinaires pédagogiques</p>
                  </div>
                </a>

                {/* Sessions Live */}
                <a href="/prof/live" className="quick-action-card">
                  <div className="quick-action-icon">📺</div>
                  <div className="quick-action-content">
                    <h3>Sessions Live</h3>
                    <p>Créer et gérer les sessions YouTube Live. Catalogue public et replays.</p>
                  </div>
                </a>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Styles spécifiques au dashboard */}
      <style>{`
        /* ====== Stat cards cliquables ====== */
        /* Curseur pointer + effet hover sur les cartes de statistiques */
        .stat-card--clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .stat-card--clickable:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12));
          border-color: var(--color-primary, #3182ce);
        }
        .stat-card--clickable:active {
          transform: translateY(-1px);
        }

        /* Icône quiz (violet) */
        .stat-card__icon--quiz {
          background: #f3e8ff;
          color: #7c3aed;
        }
        /* Icône quiz avancé (rose) */
        .stat-card__icon--advanced {
          background: #fce7f3;
          color: #db2777;
        }
        /* Icône Sessions Live (rouge/direct) */
        .stat-card__icon--live {
          background: #fee2e2;
          color: #dc2626;
        }

        /* ====== Grille des types de ressources ====== */
        .resource-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--spacing-lg);
        }

        .resource-type-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
        }

        /* Cartes de répartition cliquables */
        .resource-type-item--clickable {
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .resource-type-item--clickable:hover {
          border-color: var(--color-primary, #3182ce);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }

        .resource-type-info {
          display: flex;
          flex-direction: column;
        }

        .resource-type-value {
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--color-text);
        }

        .resource-type-label {
          font-size: var(--text-sm);
          color: var(--color-text-light);
        }

        /* ====== Actions rapides ====== */
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
        }

        .quick-action-card {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: all var(--transition-base);
        }

        .quick-action-card:hover {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .quick-action-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .quick-action-content h3 {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          margin-bottom: var(--spacing-xs);
          color: var(--color-text);
        }

        .quick-action-content p {
          font-size: var(--text-sm);
          color: var(--color-text-light);
          margin: 0;
        }

        @media (max-width: 768px) {
          .resource-type-grid,
          .quick-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
