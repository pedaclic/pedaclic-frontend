/**
 * ============================================================================
 * COMPOSANT ADMIN DASHBOARD - PedaClic
 * ============================================================================
 * Tableau de bord principal de l'interface d'administration
 * Affiche les statistiques et l'accès rapide aux fonctionnalités
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
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
  const [stats, setStats] = useState<DashboardStats>({
    totalDisciplines: 0,
    totalChapitres: 0,
    totalRessources: 0,
    ressourcesPremium: 0,
    ressourcesGratuites: 0,
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

        // Chargement parallèle des données
        const [disciplines, chapitres, resourceStats] = await Promise.all([
          DisciplineService.getAll(),
          ChapitreService.getAll(),
          ResourceService.getStats()
        ]);

        setStats({
          totalDisciplines: disciplines.length,
          totalChapitres: chapitres.length,
          totalRessources: resourceStats.total,
          ressourcesPremium: resourceStats.premium,
          ressourcesGratuites: resourceStats.gratuit,
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
          {/* Grille des statistiques principales */}
          <section className="stats-grid">
            {/* Carte: Total Disciplines */}
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--primary">
                📚
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalDisciplines}</div>
                <div className="stat-card__label">Disciplines</div>
              </div>
            </div>

            {/* Carte: Total Chapitres */}
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--secondary">
                📖
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalChapitres}</div>
                <div className="stat-card__label">Chapitres</div>
              </div>
            </div>

            {/* Carte: Total Ressources */}
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--info">
                📝
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.totalRessources}</div>
                <div className="stat-card__label">Ressources</div>
              </div>
            </div>

            {/* Carte: Ressources Premium */}
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--warning">
                ⭐
              </div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.ressourcesPremium}</div>
                <div className="stat-card__label">Ressources Premium</div>
              </div>
            </div>
          </section>

          {/* Section: Répartition par type */}
          <section className="content-card">
            <div className="content-card__header">
              <h2>Répartition des ressources par type</h2>
            </div>
            <div className="content-card__body">
              <div className="resource-type-grid">
                {/* Cours */}
                <div className="resource-type-item">
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
                <div className="resource-type-item">
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
                <div className="resource-type-item">
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
                <div className="resource-type-item">
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

                {/* Quiz */}
                <div className="resource-type-item">
                  <div className="resource-item__icon resource-item__icon--quiz">
                    🧩
                  </div>
                  <div className="resource-type-info">
                    <span className="resource-type-value">
                      {stats.ressourcesParType.quiz}
                    </span>
                    <span className="resource-type-label">Quiz</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Actions rapides */}
          <section className="content-card" style={{ marginTop: 'var(--spacing-xl)' }}>
            <div className="content-card__header">
              <h2>Actions rapides</h2>
            </div>
            <div className="content-card__body">
              <div className="quick-actions-grid">
                {/* Ajouter une discipline */}
                <a href="/admin/disciplines" className="quick-action-card">
                  <div className="quick-action-icon">📚</div>
                  <div className="quick-action-content">
                    <h3>Gérer les disciplines</h3>
                    <p>Ajouter, modifier ou supprimer des matières</p>
                  </div>
                </a>

                {/* Ajouter un chapitre */}
                <a href="/admin/chapitres" className="quick-action-card">
                  <div className="quick-action-icon">📖</div>
                  <div className="quick-action-content">
                    <h3>Gérer les chapitres</h3>
                    <p>Organiser le contenu par chapitres</p>
                  </div>
                </a>

                {/* Ajouter une ressource */}
                <a href="/admin/ressources" className="quick-action-card">
                  <div className="quick-action-icon">📝</div>
                  <div className="quick-action-content">
                    <h3>Gérer les ressources</h3>
                    <p>Cours, exercices, vidéos et documents</p>
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
              </div>
            </div>
          </section>
        </>
      )}

      {/* Styles spécifiques au dashboard */}
      <style>{`
        /* Grille des types de ressources */
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

        /* Actions rapides */
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
