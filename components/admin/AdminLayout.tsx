/**
 * ============================================================================
 * COMPOSANT ADMIN LAYOUT - PedaClic
 * ============================================================================
 * Layout principal de l'interface d'administration
 * Inclut la sidebar de navigation et le conteneur de contenu
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// ==================== INTERFACES ====================

interface AdminLayoutProps {
  children: ReactNode;
  currentPage?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ==================== DONNÉES DE NAVIGATION ====================

const navigationSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '📊', href: '/admin' },
      { id: 'disciplines', label: 'Disciplines', icon: '📚', href: '/admin/disciplines' },
      { id: 'chapitres', label: 'Chapitres', icon: '📖', href: '/admin/chapitres' },
      { id: 'ressources', label: 'Ressources', icon: '📝', href: '/admin/ressources' },
    ]
  },
  {
    title: 'Évaluation',
    items: [
      { id: 'quiz', label: 'Quiz', icon: '🧩', href: '/admin/quiz' },
      { id: 'resultats', label: 'Résultats', icon: '📈', href: '/admin/resultats' },
    ]
  },
  {
    title: 'Utilisateurs',
    items: [
      { id: 'utilisateurs', label: 'Tous les utilisateurs', icon: '👥', href: '/admin/utilisateurs' },
      { id: 'premium', label: 'Abonnés Premium', icon: '⭐', href: '/admin/premium' },
    ]
  },
  {
    title: 'Paramètres',
    items: [
      { id: 'settings', label: 'Configuration', icon: '⚙️', href: '/admin/settings' },
    ]
  }
];

// ==================== COMPOSANT PRINCIPAL ====================

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage = 'dashboard' }) => {
  // ==================== ÉTAT ====================
  
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // ==================== HANDLERS ====================

  /**
   * Gère la déconnexion de l'utilisateur
   */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      window.location.href = '/connexion';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setLoggingOut(false);
    }
  };

  /**
   * Obtient les initiales de l'utilisateur pour l'avatar
   */
  const getUserInitials = (): string => {
    if (currentUser?.displayName) {
      return currentUser.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'AD';
  };

  /**
   * Obtient le label du rôle en français
   */
  const getRoleLabel = (): string => {
    switch (currentUser?.role) {
      case 'admin':
        return 'Administrateur';
      case 'prof':
        return 'Professeur';
      case 'eleve':
        return 'Élève';
      default:
        return 'Utilisateur';
    }
  };

  // ==================== RENDU ====================

  return (
    <div className="admin-layout">
      {/* ==================== SIDEBAR ==================== */}
      <aside className={`admin-sidebar ${!sidebarOpen ? 'admin-sidebar--collapsed' : ''}`}>
        {/* En-tête avec logo */}
        <header className="admin-sidebar__header">
          <a href="/" className="admin-sidebar__logo">
            <div className="admin-sidebar__logo-icon">📖</div>
            <span>PedaClic</span>
          </a>
        </header>

        {/* Navigation principale */}
        <nav className="admin-sidebar__nav">
          {navigationSections.map((section, index) => (
            <div key={index} className="admin-nav__section">
              {/* Titre de la section */}
              <h3 className="admin-nav__title">{section.title}</h3>
              
              {/* Liste des liens */}
              <ul className="admin-nav__list">
                {section.items.map((item) => (
                  <li key={item.id} className="admin-nav__item">
                    <a
                      href={item.href}
                      className={`admin-nav__link ${
                        currentPage === item.id ? 'admin-nav__link--active' : ''
                      }`}
                    >
                      <span className="admin-nav__icon">{item.icon}</span>
                      <span className="admin-nav__label">{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer avec infos utilisateur */}
        <footer className="admin-sidebar__footer">
          <div className="admin-user">
            {/* Avatar */}
            <div className="admin-user__avatar">
              {getUserInitials()}
            </div>
            
            {/* Infos utilisateur */}
            <div className="admin-user__info">
              <div className="admin-user__name">
                {currentUser?.displayName || 'Administrateur'}
              </div>
              <div className="admin-user__role">
                {getRoleLabel()}
              </div>
            </div>

            {/* Bouton de déconnexion */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="admin-logout-btn"
              title="Se déconnecter"
            >
              {loggingOut ? '...' : '🚪'}
            </button>
          </div>
        </footer>
      </aside>

      {/* ==================== CONTENU PRINCIPAL ==================== */}
      <main className="admin-content">
        {/* Bouton toggle sidebar (mobile) */}
        <button
          className="admin-sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>

        {/* Contenu de la page */}
        {children}
      </main>

      {/* Styles spécifiques au layout */}
      <style>{`
        /* Bouton de déconnexion */
        .admin-logout-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-base);
          font-size: var(--text-lg);
        }

        .admin-logout-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .admin-logout-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Bouton toggle sidebar (mobile) */
        .admin-sidebar-toggle {
          display: none;
          position: fixed;
          top: var(--spacing-md);
          left: var(--spacing-md);
          z-index: var(--z-fixed);
          width: 44px;
          height: 44px;
          border: none;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--text-xl);
        }

        @media (max-width: 768px) {
          .admin-sidebar-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .admin-sidebar {
            transform: translateX(-100%);
            transition: transform var(--transition-base);
          }

          .admin-sidebar:not(.admin-sidebar--collapsed) {
            transform: translateX(0);
          }

          .admin-content {
            padding-top: calc(var(--spacing-xl) + 44px);
          }
        }

        /* Animation de la sidebar */
        .admin-sidebar--collapsed {
          width: 80px;
        }

        .admin-sidebar--collapsed .admin-nav__label,
        .admin-sidebar--collapsed .admin-nav__title,
        .admin-sidebar--collapsed .admin-sidebar__logo span,
        .admin-sidebar--collapsed .admin-user__info {
          display: none;
        }

        .admin-sidebar--collapsed .admin-sidebar__logo {
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;
