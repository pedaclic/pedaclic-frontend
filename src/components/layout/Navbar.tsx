/**
 * NAVBAR - Barre de navigation principale PedaClic
 * 
 * Fonctionnalités :
 * - Logo et nom de la plateforme
 * - Liens de navigation (Accueil, Disciplines, Premium)
 * - Bouton Connexion ou Avatar utilisateur si connecté
 * - Menu hamburger responsive pour mobile
 * - Sticky en haut de page
 */

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Navbar.css';

/**
 * Composant Navbar principal
 * Gère l'affichage de la navigation et l'état de connexion
 */
const Navbar: React.FC = () => {
  // ==================== HOOKS ====================
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // État pour le menu mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  
  // État pour le menu dropdown utilisateur
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // ==================== EFFETS ====================
  
  // Fermer le menu mobile lors du changement de route
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  // Fermer les menus au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.navbar__user-menu') && !target.closest('.navbar__user-button')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ==================== HANDLERS ====================
  
  /**
   * Gère la déconnexion de l'utilisateur
   */
  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  /**
   * Toggle du menu mobile
   */
  const toggleMobileMenu = (): void => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  /**
   * Toggle du menu utilisateur
   */
  const toggleUserMenu = (): void => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  /**
   * Vérifie si un lien est actif
   */
  const isActiveLink = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // ==================== RENDU ====================
  return (
    // <!-- Conteneur principal de la navbar - sticky en haut --> 
    <nav className="navbar">
      {/* <!-- Container pour centrer le contenu --> */}
      <div className="navbar__container">
        
        {/* <!-- LOGO ET NOM --> */}
        <Link to="/" className="navbar__brand">
          {/* Icône livre stylisée */}
          <div className="navbar__logo">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="navbar__logo-icon"
            >
              <path 
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="navbar__brand-name">PedaClic</span>
        </Link>

        {/* <!-- NAVIGATION DESKTOP --> */}
        <ul className="navbar__nav">
          {/* Lien Accueil */}
          <li className="navbar__nav-item">
            <Link 
              to="/" 
              className={`navbar__nav-link ${isActiveLink('/') ? 'navbar__nav-link--active' : ''}`}
            >
              Accueil
            </Link>
          </li>
          
          {/* Lien Disciplines */}
          <li className="navbar__nav-item">
            <Link 
              to="/disciplines" 
              className={`navbar__nav-link ${isActiveLink('/disciplines') ? 'navbar__nav-link--active' : ''}`}
            >
              Disciplines
            </Link>
          </li>
          
          {/* Lien Premium - visible pour tous */}
          <li className="navbar__nav-item">
            <Link 
              to="/premium" 
              className={`navbar__nav-link navbar__nav-link--premium ${isActiveLink('/premium') ? 'navbar__nav-link--active' : ''}`}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="navbar__premium-icon"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Premium
            </Link>
          </li>
        </ul>

        {/* <!-- SECTION UTILISATEUR (Desktop) --> */}
        <div className="navbar__auth">
          {currentUser ? (
            // Utilisateur connecté - Afficher avatar et menu
            <div className="navbar__user">
              <button 
                className="navbar__user-button"
                onClick={toggleUserMenu}
                aria-expanded={isUserMenuOpen}
                aria-label="Menu utilisateur"
              >
                {/* Avatar ou initiale */}
                <div className="navbar__avatar">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'Avatar'} 
                      className="navbar__avatar-img"
                    />
                  ) : (
                    <span className="navbar__avatar-initial">
                      {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                
                {/* Nom et rôle */}
                <div className="navbar__user-info">
                  <span className="navbar__user-name">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="navbar__user-role">
                    {currentUser.role === 'admin' && 'Administrateur'}
                    {currentUser.role === 'prof' && 'Professeur'}
                    {currentUser.role === 'eleve' && 'Élève'}
                    {currentUser.isPremium && (
                      <span className="navbar__premium-badge">Premium</span>
                    )}
                  </span>
                </div>
                
                {/* Icône chevron */}
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  className={`navbar__chevron ${isUserMenuOpen ? 'navbar__chevron--open' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Menu dropdown utilisateur */}
              {isUserMenuOpen && (
                <div className="navbar__user-menu">
                  {/* Lien vers profil */}
                  <Link to="/profil" className="navbar__menu-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Mon Profil
                  </Link>
                  
                  {/* Lien vers tableau de bord (si admin ou prof) */}
                  {(currentUser.role === 'admin' || currentUser.role === 'prof') && (
                    <Link to="/dashboard" className="navbar__menu-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Tableau de bord
                    </Link>
                  )}
                  
                  {/* Lien Admin (si admin) */}
                  {currentUser.role === 'admin' && (
                    <Link to="/admin" className="navbar__menu-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Administration
                    </Link>
                  )}
                  
                  {/* Séparateur */}
                  <div className="navbar__menu-divider"></div>
                  
                  {/* Bouton déconnexion */}
                  <button onClick={handleLogout} className="navbar__menu-item navbar__menu-item--danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Utilisateur non connecté - Boutons Connexion/Inscription
            <div className="navbar__auth-buttons">
              <Link to="/connexion" className="navbar__btn navbar__btn--outline">
                Connexion
              </Link>
              <Link to="/inscription" className="navbar__btn navbar__btn--primary">
                S'inscrire
              </Link>
            </div>
          )}
        </div>

        {/* <!-- BOUTON HAMBURGER MOBILE --> */}
        <button 
          className={`navbar__hamburger ${isMobileMenuOpen ? 'navbar__hamburger--open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Menu de navigation"
          aria-expanded={isMobileMenuOpen}
        >
          <span className="navbar__hamburger-line"></span>
          <span className="navbar__hamburger-line"></span>
          <span className="navbar__hamburger-line"></span>
        </button>
      </div>

      {/* <!-- MENU MOBILE --> */}
      <div className={`navbar__mobile-menu ${isMobileMenuOpen ? 'navbar__mobile-menu--open' : ''}`}>
        {/* Navigation mobile */}
        <ul className="navbar__mobile-nav">
          <li>
            <Link 
              to="/" 
              className={`navbar__mobile-link ${isActiveLink('/') ? 'navbar__mobile-link--active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Accueil
            </Link>
          </li>
          <li>
            <Link 
              to="/disciplines" 
              className={`navbar__mobile-link ${isActiveLink('/disciplines') ? 'navbar__mobile-link--active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              Disciplines
            </Link>
          </li>
          <li>
            <Link 
              to="/premium" 
              className={`navbar__mobile-link navbar__mobile-link--premium ${isActiveLink('/premium') ? 'navbar__mobile-link--active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Premium
            </Link>
          </li>
        </ul>

        {/* Séparateur mobile */}
        <div className="navbar__mobile-divider"></div>

        {/* Auth mobile */}
        {currentUser ? (
          <div className="navbar__mobile-user">
            {/* Info utilisateur */}
            <div className="navbar__mobile-user-info">
              <div className="navbar__avatar navbar__avatar--large">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="navbar__avatar-img" />
                ) : (
                  <span className="navbar__avatar-initial">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="navbar__mobile-user-name">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </p>
                <p className="navbar__mobile-user-role">
                  {currentUser.role === 'admin' && 'Administrateur'}
                  {currentUser.role === 'prof' && 'Professeur'}
                  {currentUser.role === 'eleve' && 'Élève'}
                </p>
              </div>
            </div>

            {/* Liens utilisateur mobile */}
            <Link to="/profil" className="navbar__mobile-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Mon Profil
            </Link>

            {(currentUser.role === 'admin' || currentUser.role === 'prof') && (
              <Link to="/dashboard" className="navbar__mobile-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                </svg>
                Tableau de bord
              </Link>
            )}

            {currentUser.role === 'admin' && (
              <Link to="/admin" className="navbar__mobile-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Administration
              </Link>
            )}

            <button onClick={handleLogout} className="navbar__mobile-link navbar__mobile-link--danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="navbar__mobile-auth">
            <Link to="/connexion" className="navbar__btn navbar__btn--outline navbar__btn--full">
              Connexion
            </Link>
            <Link to="/inscription" className="navbar__btn navbar__btn--primary navbar__btn--full">
              S'inscrire gratuitement
            </Link>
          </div>
        )}
      </div>

      {/* Overlay pour fermer le menu mobile */}
      {isMobileMenuOpen && (
        <div 
          className="navbar__overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </nav>
  );
};

export default Navbar;
