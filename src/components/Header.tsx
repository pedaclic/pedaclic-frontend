/**
 * ============================================
 * HEADER PEDACLIC - Composant de Navigation
 * ============================================
 * 
 * Header responsive avec :
 * - Logo et navigation principale
 * - Menu burger pour mobile
 * - Gestion des états connecté/non connecté
 * - Dropdown utilisateur avec rôle et statut Premium
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings, 
  BookOpen,
  GraduationCap,
  Crown,
  ChevronDown,
  Home,
  LayoutDashboard,
  BarChart3,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Header.css';

/* ==================== INTERFACE ==================== */

/**
 * Interface pour les liens de navigation
 */
interface NavLink {
  path: string;
  label: string;
  icon: React.ReactNode;
  requireAuth?: boolean;      // Nécessite connexion
  requirePremium?: boolean;   // Nécessite Premium
  requireRole?: ('admin' | 'prof' | 'eleve' | 'parent')[]; // Rôles autorisés
}

/* ==================== COMPOSANT HEADER ==================== */

const Header: React.FC = () => {
  // ===== HOOKS =====
  const { currentUser, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // ===== ÉTATS LOCAUX =====
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // ===== REFS =====
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ==================== CONFIGURATION DES LIENS ==================== */
  
  /**
   * Liens de navigation principale
   * Configurés avec les permissions requises
   */
  const navLinks: NavLink[] = [
    {
      path: '/',
      label: 'Accueil',
      icon: <Home size={18} />
    },
    {
      path: '/disciplines',
      label: 'Disciplines',
      icon: <BookOpen size={18} />
    },
   {
      path: '/ebooks',
      label: 'Bibliothèque',
      icon: <BookOpen size={18} />
    },
    {
      path: '/quizzes',
      label: 'Quiz',
      icon: <GraduationCap size={18} />,
      requireAuth: true,
    },
    {
     path: currentUser?.role === 'eleve' ? '/eleve/dashboard' : currentUser?.role === 'prof' ? '/prof/dashboard' : '/admin',
      label: 'Tableau de bord',
      icon: <LayoutDashboard size={18} />,
      requireAuth: true
    },
    {
      path: '/generateur',
      label: 'Générateur IA',
      icon: <Sparkles size={18} />,
      requireAuth: true,
      requirePremium: true
    },
    {
      path: '/parent/dashboard',
      label: 'Espace Parent',
      icon: <BarChart3 size={18} />,
      requireAuth: true,
      requireRole: ['parent']
    }
  ];

  /* ==================== EFFETS ==================== */

  /**
   * Fermer le dropdown quand on clique à l'extérieur
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Fermer le menu mobile lors du changement de route
   */
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
  }, [location.pathname]);

  /**
   * Empêcher le scroll du body quand le menu mobile est ouvert
   */
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  /* ==================== HANDLERS ==================== */

  /**
   * Déconnexion de l'utilisateur
   */
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setIsUserDropdownOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Toggle du menu mobile
   */
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  /**
   * Toggle du dropdown utilisateur
   */
  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
  };

  /* ==================== HELPERS ==================== */

  /**
   * Vérifie si un lien doit être affiché selon les permissions
   */
  const shouldShowLink = (link: NavLink): boolean => {
    // Si le lien nécessite une connexion et l'utilisateur n'est pas connecté
    if (link.requireAuth && !currentUser) return false;
    
    // Si le lien nécessite Premium et l'utilisateur n'est pas Premium
    if (link.requirePremium && currentUser && !currentUser.isPremium) return false;
    
    // Si le lien nécessite un rôle spécifique
    if (link.requireRole && currentUser) {
      if (!link.requireRole.includes(currentUser.role)) return false;
    }
    
    return true;
  };

  /**
   * Vérifie si un lien est actif (route courante)
   */
  const isActiveLink = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  /**
   * Obtient le label du rôle en français
   */
  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      prof: 'Professeur',
      eleve: 'Élève',
      parent: 'Parent'
    };
    return labels[role] || role;
  };

  /**
   * Obtient les initiales de l'utilisateur pour l'avatar
   */
  const getUserInitials = (): string => {
    if (!currentUser) return '?';
    if (currentUser.displayName) {
      const names = currentUser.displayName.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return currentUser.email[0].toUpperCase();
  };

  /* ==================== RENDU ==================== */

  return (
    <header className="header">
      {/* ===== CONTENEUR PRINCIPAL ===== */}
      <div className="header__container">
        
        {/* ----- LOGO ----- */}
        <Link to="/" className="header__logo">
          <GraduationCap className="header__logo-icon" size={32} />
          <div className="header__logo-text">
            <span className="header__logo-name">PedaClic</span>
            <span className="header__logo-tagline">L'école en un clic</span>
          </div>
        </Link>

        {/* ----- NAVIGATION DESKTOP ----- */}
        <nav className="header__nav header__nav--desktop">
          <ul className="header__nav-list">
            {navLinks.map((link) => (
              shouldShowLink(link) && (
                <li key={link.path} className="header__nav-item">
                  <Link 
                    to={link.path}
                    className={`header__nav-link ${isActiveLink(link.path) ? 'header__nav-link--active' : ''}`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {/* Badge Premium pour les liens Premium */}
                    {link.requirePremium && (
                      <Crown size={14} className="header__premium-badge" />
                    )}
                  </Link>
                </li>
              )
            ))}
          </ul>
        </nav>

        {/* ----- ACTIONS UTILISATEUR ----- */}
        <div className="header__actions">
          
          {/* État de chargement */}
          {loading ? (
            <div className="header__loading">
              <div className="header__spinner"></div>
            </div>
          ) : currentUser ? (
            /* ----- UTILISATEUR CONNECTÉ ----- */
            <div className="header__user" ref={dropdownRef}>
              {/* Badge Premium */}
              {currentUser.isPremium && (
                <span className="header__premium-tag">
                  <Crown size={14} />
                  Premium
                </span>
              )}
              
              {/* Bouton dropdown utilisateur */}
              <button 
                className="header__user-button"
                onClick={toggleUserDropdown}
                aria-expanded={isUserDropdownOpen}
                aria-haspopup="true"
              >
                {/* Avatar */}
                <div className="header__avatar">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'Avatar'} 
                      className="header__avatar-img"
                    />
                  ) : (
                    <span className="header__avatar-initials">
                      {getUserInitials()}
                    </span>
                  )}
                </div>
                
                {/* Nom (desktop uniquement) */}
                <span className="header__user-name">
                  {currentUser.displayName || currentUser.email.split('@')[0]}
                </span>
                
                {/* Chevron */}
                <ChevronDown 
                  size={16} 
                  className={`header__chevron ${isUserDropdownOpen ? 'header__chevron--open' : ''}`}
                />
              </button>

              {/* ----- DROPDOWN MENU ----- */}
              {isUserDropdownOpen && (
                <div className="header__dropdown">
                  {/* En-tête du dropdown */}
                  <div className="header__dropdown-header">
                    <p className="header__dropdown-email">{currentUser.email}</p>
                    <span className={`header__dropdown-role header__dropdown-role--${currentUser.role}`}>
                      {getRoleLabel(currentUser.role)}
                    </span>
                  </div>
                  
                  {/* Séparateur */}
                  <div className="header__dropdown-divider"></div>
                  
                  {/* Liens du dropdown */}
                  <nav className="header__dropdown-nav">
		    <Link to={currentUser.role === 'eleve' ? '/eleve/dashboard' : currentUser.role === 'prof' ? '/prof/dashboard' : '/admin'} className="header__dropdown-link">
                      <LayoutDashboard size={18} />
                      <span>Tableau de bord</span>
                    </Link>
                    
		  {/* Lien Suivi (élèves uniquement) */}
			{currentUser.role === 'eleve' && (
  		    <Link to="/eleve/suivi" className="header__dropdown-link">
    			<BarChart3 size={18} />
    			<span>Mes points à améliorer</span>
  		    </Link>
)}

		    {/* Lien Espace Parent (parents uniquement) */}
		    {currentUser.role === 'parent' && (
		      <Link to="/parent/dashboard" className="header__dropdown-link">
                        <BarChart3 size={18} />


		        <span>Espace Parent</span>
		      </Link>
		    )}

                    <Link to="/profil" className="header__dropdown-link">
                      <User size={18} />
                      <span>Mon profil</span>
                    </Link>
                    
                    {/* Lien Admin (admin uniquement) */}
                    {currentUser.role === 'admin' && (
                      <Link to="/admin" className="header__dropdown-link">
                        <Settings size={18} />
                        <span>Administration</span>
                      </Link>
                    )}
                    
                    {/* Lien Premium (si non Premium) */}
                    {!currentUser.isPremium && (
                      <Link to="/premium" className="header__dropdown-link header__dropdown-link--premium">
                        <Crown size={18} />
                        <span>Passer Premium</span>
                      </Link>
                    )}
                  </nav>
                  
                  {/* Séparateur */}
                  <div className="header__dropdown-divider"></div>
                  
                  {/* Bouton déconnexion */}
                  <button 
                    className="header__dropdown-logout"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    <LogOut size={18} />
                    <span>{isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ----- UTILISATEUR NON CONNECTÉ ----- */
            <div className="header__auth-buttons">
              <Link to="/connexion" className="header__btn header__btn--outline">
                Connexion
              </Link>
              <Link to="/inscription" className="header__btn header__btn--primary">
                S'inscrire
              </Link>
            </div>
          )}

          {/* ----- BOUTON MENU MOBILE ----- */}
          <button 
            className="header__mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* ===== MENU MOBILE ===== */}
      <div className={`header__mobile-menu ${isMobileMenuOpen ? 'header__mobile-menu--open' : ''}`}>
        {/* Overlay */}
        <div 
          className="header__mobile-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
        
        {/* Contenu du menu */}
        <div className="header__mobile-content">
          {/* Navigation mobile */}
          <nav className="header__mobile-nav">
            <ul className="header__mobile-list">
              {navLinks.map((link) => (
                shouldShowLink(link) && (
                  <li key={link.path} className="header__mobile-item">
                    <Link 
                      to={link.path}
                      className={`header__mobile-link ${isActiveLink(link.path) ? 'header__mobile-link--active' : ''}`}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                      {link.requirePremium && (
                        <Crown size={14} className="header__premium-badge" />
                      )}
                    </Link>
                  </li>
                )
              ))}
            </ul>
          </nav>

          {/* Actions mobile */}
          {!currentUser && (
            <div className="header__mobile-auth">
              <Link 
                to="/connexion" 
                className="header__btn header__btn--outline header__btn--block"
              >
                Connexion
              </Link>
              <Link 
                to="/inscription" 
                className="header__btn header__btn--primary header__btn--block"
              >
                S'inscrire
              </Link>
            </div>
          )}

          {/* Info utilisateur mobile */}
          {currentUser && (
            <div className="header__mobile-user">
              <div className="header__mobile-user-info">
                <div className="header__avatar header__avatar--large">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'Avatar'} 
                      className="header__avatar-img"
                    />
                  ) : (
                    <span className="header__avatar-initials">
                      {getUserInitials()}
                    </span>
                  )}
                </div>
                <div className="header__mobile-user-details">
                  <p className="header__mobile-user-name">
                    {currentUser.displayName || currentUser.email.split('@')[0]}
                  </p>
                  <p className="header__mobile-user-email">{currentUser.email}</p>
                </div>
              </div>
              
              <button 
                className="header__mobile-logout"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut size={18} />
                <span>{isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
