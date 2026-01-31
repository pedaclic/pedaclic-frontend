/**
 * ============================================
 * PAGE DASHBOARD - Tableau de Bord PedaClic
 * ============================================
 */

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Trophy,
  Clock,
  Star,
  ChevronRight,
  Crown,
  Settings,
  User
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  // Labels des rôles
  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    prof: 'Professeur',
    eleve: 'Élève'
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__container">
        {/* ===== EN-TÊTE ===== */}
        <header className="dashboard-page__header">
          <div className="dashboard-page__welcome">
            <h1>
              Bienvenue, {currentUser.displayName || 'Utilisateur'} ! 👋
            </h1>
            <p>
              <span className={`dashboard-page__role dashboard-page__role--${currentUser.role}`}>
                {roleLabels[currentUser.role]}
              </span>
              {currentUser.isPremium && (
                <span className="dashboard-page__premium-badge">
                  <Crown size={14} />
                  Premium
                </span>
              )}
            </p>
          </div>
          
          {/* Actions rapides */}
          <div className="dashboard-page__actions">
            <Link to="/profil" className="dashboard-page__action-btn">
              <User size={18} />
              Mon profil
            </Link>
            {currentUser.role === 'admin' && (
              <Link to="/admin" className="dashboard-page__action-btn">
                <Settings size={18} />
                Administration
              </Link>
            )}
          </div>
        </header>

        {/* ===== STATS RAPIDES ===== */}
        <section className="dashboard-page__stats">
          <div className="dashboard-page__stat-card">
            <div className="dashboard-page__stat-icon dashboard-page__stat-icon--primary">
              <BookOpen size={24} />
            </div>
            <div className="dashboard-page__stat-info">
              <span className="dashboard-page__stat-value">0</span>
              <span className="dashboard-page__stat-label">Cours suivis</span>
            </div>
          </div>

          <div className="dashboard-page__stat-card">
            <div className="dashboard-page__stat-icon dashboard-page__stat-icon--success">
              <Trophy size={24} />
            </div>
            <div className="dashboard-page__stat-info">
              <span className="dashboard-page__stat-value">0</span>
              <span className="dashboard-page__stat-label">Quiz réussis</span>
            </div>
          </div>

          <div className="dashboard-page__stat-card">
            <div className="dashboard-page__stat-icon dashboard-page__stat-icon--warning">
              <Clock size={24} />
            </div>
            <div className="dashboard-page__stat-info">
              <span className="dashboard-page__stat-value">0h</span>
              <span className="dashboard-page__stat-label">Temps d'étude</span>
            </div>
          </div>

          <div className="dashboard-page__stat-card">
            <div className="dashboard-page__stat-icon dashboard-page__stat-icon--info">
              <Star size={24} />
            </div>
            <div className="dashboard-page__stat-info">
              <span className="dashboard-page__stat-value">--</span>
              <span className="dashboard-page__stat-label">Moyenne</span>
            </div>
          </div>
        </section>

        {/* ===== CONTENU PRINCIPAL ===== */}
        <div className="dashboard-page__content">
          {/* Accès rapide */}
          <section className="dashboard-page__section">
            <h2>Accès rapide</h2>
            <div className="dashboard-page__quick-links">
              <Link to="/disciplines" className="dashboard-page__quick-link">
                <BookOpen size={32} />
                <span>Disciplines</span>
                <ChevronRight size={18} />
              </Link>
              
              {currentUser.isPremium ? (
                <Link to="/quiz" className="dashboard-page__quick-link">
                  <Trophy size={32} />
                  <span>Quiz Premium</span>
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <Link to="/premium" className="dashboard-page__quick-link dashboard-page__quick-link--premium">
                  <Crown size={32} />
                  <span>Passer Premium</span>
                  <ChevronRight size={18} />
                </Link>
              )}
            </div>
          </section>

          {/* Message si non Premium */}
          {!currentUser.isPremium && (
            <section className="dashboard-page__premium-cta">
              <div className="dashboard-page__premium-cta-content">
                <Crown size={40} />
                <div>
                  <h3>Débloquez tout le potentiel de PedaClic</h3>
                  <p>
                    Accédez aux quiz illimités, aux corrections détaillées 
                    et aux annales d'examens pour seulement 2 000 FCFA/mois.
                  </p>
                </div>
                <Link to="/premium" className="dashboard-page__premium-cta-btn">
                  Découvrir Premium
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
