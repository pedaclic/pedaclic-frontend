/**
 * ============================================================================
 * COMPOSANT ADMIN LAYOUT - PedaClic
 * ============================================================================
 * Layout principal de l'interface d'administration avec sidebar de navigation.
 * Utilise React Router <Link> pour la navigation client-side (SPA).
 * 
 * CORRECTION : Remplacement de <a href> par <Link to> pour éviter
 * le rechargement complet de la page sur GitHub Pages.
 * 
 * @author PedaClic Team
 * @version 2.0.0 (corrigé navigation sidebar)
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// ==================== INTERFACES ====================

interface AdminLayoutProps {
  children: React.ReactNode;
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
      { id: 'cours', label: 'Cours en ligne', icon: '📘', href: '/prof/cours' },
      { id: 'ebooks', label: 'Bibliothèque Ebooks', icon: '📚', href: '/admin/ebooks' },
      { id: 'mediatheque', label: 'Médiathèque', icon: '🎬', href: '/mediatheque' },
      { id: 'live', label: 'Sessions Live', icon: '📺', href: '/prof/live' },
    ]
  },
 
{
    title: 'Évaluation',
    items: [
      { id: 'quiz', label: 'Quiz', icon: '🧩', href: '/admin/quiz' },
      { id: 'quiz-avance', label: 'Quiz Avancés', icon: '🧠', href: '/admin/quiz-avance' },
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
    title: 'Outils IA',
    items: [
      { id: 'generateur', label: 'Générateur IA', icon: '🤖', href: '/generateur' },
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
  
  /* useLocation pour détecter automatiquement la page active
     (alternative au prop currentPage, plus fiable) */
  const location = useLocation();

  // ==================== HANDLERS ====================

  /**
   * Gère la déconnexion de l'utilisateur
   * CORRIGÉ : Utilise navigate au lieu de window.location.href
   */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      /* Redirection vers la page de connexion.
         On utilise window.location.href ici car après logout,
         le contexte Auth est détruit, donc navigate() ne fonctionnerait
         pas de manière fiable. */
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

  /**
   * Détermine si un lien de navigation est actif
   * Utilise le pathname actuel pour une détection automatique
   * Le prop currentPage est utilisé comme fallback
   */
  const isLinkActive = (item: NavItem): boolean => {
    /* Détection automatique via l'URL */
    if (item.href === '/admin') {
      /* Pour le dashboard, on vérifie que le path est exactement /admin */
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    /* Pour les autres liens, on vérifie si le path commence par le href */
    return location.pathname.startsWith(item.href);
  };

  // ==================== RENDU ====================

  return (
    <div className="admin-layout">
      {/* ==================== SIDEBAR ==================== */}
      <aside className={`admin-sidebar ${!sidebarOpen ? 'admin-sidebar--collapsed' : ''}`}>
        
        {/* En-tête avec logo */}
        <header className="admin-sidebar__header">
          {/* CORRIGÉ : <Link> au lieu de <a href> pour le logo */}
          <Link to="/" className="admin-sidebar__logo">
            <div className="admin-sidebar__logo-icon">📖</div>
            <span>PedaClic</span>
          </Link>
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
                    {/* ============================================
                        CORRECTION PRINCIPALE : <Link> au lieu de <a>
                        ============================================
                        <a href> provoquait un rechargement complet
                        de la page, ce qui causait une page blanche
                        sur GitHub Pages car :
                        1. La requête HTTP vers /admin/xxx retournait 404
                        2. Le 404.html redirigeait vers index.html
                        3. L'app se réinitialisait complètement
                        4. Firebase Auth perdait le contexte → redirection
                        
                        <Link to> fait une navigation client-side
                        sans rechargement → pas de perte de contexte.
                        ============================================ */}
                    <Link
                      to={item.href}
                      className={`admin-nav__link ${
                        isLinkActive(item) ? 'admin-nav__link--active' : ''
                      }`}
                    >
                      <span className="admin-nav__icon">{item.icon}</span>
                      <span className="admin-nav__label">{item.label}</span>
                    </Link>
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

      {/* ==================== STYLES SPÉCIFIQUES AU LAYOUT ==================== */}
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

        /* Animation de la sidebar réduite */
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
