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

import { useState, useRef, useEffect, useCallback } from 'react';
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
  Sparkles,
  Download,
  Star,
  Film,
  Radio,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import './Header.css';
import NotificationBell from './NotificationBell';

/* ==================== INTERFACES ==================== */

/**
 * Lien de navigation simple (entrée cliquable)
 */
interface NavLink {
  kind?: 'link';
  path: string;
  label: string;
  icon: React.ReactNode;
  requireAuth?: boolean;      // Nécessite connexion
  requirePremium?: boolean;   // Visible uniquement aux membres Premium
  hideIfPremium?: boolean;    // Masqué si déjà Premium (CTA d'abonnement)
  requireRole?: ('admin' | 'prof' | 'eleve' | 'parent')[]; // Rôles autorisés
}

/**
 * Groupe de liens regroupés sous un menu déroulant.
 *
 * Évolution (avril 2026) : introduit pour regrouper Bibliothèque,
 * Médiathèque, Sessions Live, Quiz, Quiz Avancés et Générateur IA
 * sous un menu « Apprendre » unique, sans casser les permissions
 * (chaque enfant conserve ses flags requireAuth / requirePremium / etc.).
 */
interface NavGroup {
  kind: 'group';
  id: string;                 // Identifiant unique (utilisé pour l'état open/close)
  label: string;              // Libellé affiché sur le bouton
  icon: React.ReactNode;
  children: NavLink[];        // Liens enfants
}

/** Union : une entrée de navigation est soit un lien, soit un groupe */
type NavEntry = NavLink | NavGroup;

/** Type guard : vrai si l'entrée est un groupe déroulant */
function isNavGroup(entry: NavEntry): entry is NavGroup {
  return (entry as NavGroup).kind === 'group';
}

/* ==================== COMPOSANT HEADER ==================== */

const Header: React.FC = () => {
  // ===== HOOKS =====
  const { currentUser, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  // ===== ÉTATS LOCAUX =====
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  /* ID du groupe de navigation actuellement ouvert (desktop) ; null si aucun.
     Un seul dropdown ouvert à la fois, à la manière du menu utilisateur. */
  const [openNavGroupId, setOpenNavGroupId] = useState<string | null>(null);
  /* Position absolue (viewport) du dropdown de groupe ouvert.
     Recalculée à l'ouverture et lors de resize/scroll pour suivre le bouton. */
  const [navGroupPos, setNavGroupPos] = useState<{ top: number; left: number } | null>(null);

  // ===== REFS =====
  const dropdownRef = useRef<HTMLDivElement>(null);
  /* Ref sur chaque dropdown de groupe de navigation, pour le click-outside */
  const navGroupRefs = useRef<Record<string, HTMLLIElement | null>>({});
  /* Ref sur le bouton qui déclenche chaque dropdown de groupe.
     Utilisé pour calculer la position fixed du panneau déroulant
     (indispensable car le parent .header__nav--desktop a overflow
     clippant qui masquerait un dropdown en position:absolute). */
  const navGroupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /* ==================== CONFIGURATION DES LIENS ==================== */
  
  /**
   * Liens de navigation principale
   * Configurés avec les permissions requises
   */
  /*
   * NAVIGATION PRINCIPALE
   *
   * Évolution (avril 2026) : les 6 liens Bibliothèque, Médiathèque,
   * Sessions Live, Quiz, Quiz Avancés et Générateur IA sont désormais
   * regroupés sous un menu déroulant « Apprendre » unique pour alléger
   * la barre de navigation. Les permissions (requireAuth, requirePremium)
   * de chaque lien sont strictement préservées — chaque enfant est filtré
   * individuellement par `shouldShowLink()` avant d'être affiché.
   */
  const navEntries: NavEntry[] = [
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

    // ==================== GROUPE « APPRENDRE » ====================
    // Regroupe tous les contenus et outils pédagogiques accessibles.
    // Le bouton d'ouverture du menu est rendu côté desktop avec un
    // chevron ; côté mobile, les enfants sont listés à plat sous le
    // libellé du groupe (pas d'accordion pour minimiser les frictions).
    {
      kind: 'group',
      id: 'apprendre',
      label: 'Apprendre',
      icon: <GraduationCap size={18} />,
      children: [
        {
          path: '/ebooks',
          label: 'Bibliothèque',
          icon: <BookOpen size={18} />
        },
        {
          path: '/mediatheque',
          label: 'Médiathèque',
          icon: <Film size={18} />
        },
        {
          path: '/live',
          label: 'Sessions Live',
          icon: <Radio size={18} />,
          requireAuth: true,
        },
        // Quiz gratuits — accessibles sans connexion
        {
          path: '/quiz-gratuits',
          label: 'Quiz',
          icon: <GraduationCap size={18} />,
          requireAuth: false,
        },
        // Quiz avancés — Premium seulement
        {
          path: '/quizzes',
          label: 'Quiz Avancés',
          icon: <GraduationCap size={18} />,
          requireAuth: true,
          requirePremium: true,
        },
        {
          path: '/generateur',
          label: 'Générateur IA',
          icon: <Sparkles size={18} />,
          requireAuth: true,
          requirePremium: true
        },
      ],
    },
    // =============================================================

    {
      path: '/premium',
      label: 'Premium',
      icon: <Star size={18} />,
      hideIfPremium: true,   // Masqué dès que l'utilisateur est Premium ou admin
    },
    {
     path: currentUser?.role === 'eleve' ? '/eleve/dashboard' : currentUser?.role === 'prof' ? '/prof/dashboard' : currentUser?.role === 'parent' ? '/parent/dashboard' : '/admin',
      label: 'Tableau de bord',
      icon: <LayoutDashboard size={18} />,
      requireAuth: true
    },
    {
      path: '/eleve/cahiers',
      label: 'Cahier de textes',
      icon: <BookOpen size={18} />,
      requireAuth: true,
      requireRole: ['eleve']
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
   * Calcule la position fixed du dropdown de groupe ouvert à partir
   * du bounding rect de son bouton déclencheur. Recalcule également
   * sur resize et scroll pour que le panneau suive le bouton.
   *
   * Ce mécanisme contourne le clip vertical imposé par le parent
   * .header__nav--desktop qui combine overflow-x:auto et overflow-y:hidden.
   */
  useEffect(() => {
    if (!openNavGroupId) {
      setNavGroupPos(null);
      return;
    }

    const updatePosition = () => {
      const btn = navGroupButtonRefs.current[openNavGroupId];
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setNavGroupPos({
        top: rect.bottom + 8,    // 8px de marge sous le bouton
        left: rect.left,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // capture pour attraper tous les scrolls parents
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openNavGroupId]);

  /**
   * Fermer les dropdowns quand on clique à l'extérieur :
   *  - dropdown utilisateur (dropdownRef)
   *  - dropdowns de navigation (navGroupRefs : une ref par groupe)
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Dropdown utilisateur
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsUserDropdownOpen(false);
      }

      // Dropdown groupe de navigation : on ferme si le clic est hors
      // du <li> contenant le groupe actuellement ouvert.
      if (openNavGroupId) {
        const currentEl = navGroupRefs.current[openNavGroupId];
        if (currentEl && !currentEl.contains(target)) {
          setOpenNavGroupId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openNavGroupId]);

  /** Capture l'événement d'installation PWA */
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  /** Lance l'installation PWA depuis le Header */
  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }, [installPrompt]);

  /**
   * Fermer le menu mobile lors du changement de route
   */
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
    setOpenNavGroupId(null);
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

    // CTA Premium : masqué si l'utilisateur est déjà Premium ou s'il est admin
    if (link.hideIfPremium) {
      if (currentUser?.isPremium) return false;
      if (currentUser?.role === 'admin') return false;
    }

    // Si le lien nécessite un rôle spécifique
    if (link.requireRole && currentUser) {
      if (!link.requireRole.includes(currentUser.role)) return false;
    }

    return true;
  };

  /**
   * Vérifie si un lien est actif (route courante)
   *
   * CORRECTION : on exige que le préfixe soit suivi de la fin de chaîne
   * ou d'un « / » pour éviter qu'un lien avec un nom partiel commun
   * (ex : /quiz vs /quiz-avance) ne soit faussement marqué actif.
   */
  const isActiveLink = (path: string): boolean => {
    if (path === '/') return location.pathname === '/';
    const pathname = location.pathname;
    return pathname === path || pathname.startsWith(path + '/');
  };

  /**
   * Filtre les enfants visibles d'un groupe selon les permissions de
   * l'utilisateur courant (réutilise shouldShowLink sur chaque enfant).
   */
  const visibleChildren = (group: NavGroup): NavLink[] =>
    group.children.filter(shouldShowLink);

  /**
   * Un groupe est affiché uniquement s'il a AU MOINS un enfant visible.
   * (Si l'utilisateur ne peut accéder à aucun lien du groupe, le groupe
   * entier est masqué — évite un dropdown vide dans la sidebar.)
   */
  const shouldShowGroup = (group: NavGroup): boolean =>
    visibleChildren(group).length > 0;

  /**
   * Un groupe est considéré « actif » (libellé mis en évidence) si la
   * route courante correspond à l'un quelconque de ses enfants.
   */
  const isGroupActive = (group: NavGroup): boolean =>
    group.children.some(child => isActiveLink(child.path));

  /** Toggle de l'ouverture d'un groupe donné (desktop). */
  const toggleNavGroup = (groupId: string) => {
    setOpenNavGroupId(current => (current === groupId ? null : groupId));
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
            {navEntries.map((entry) => {
              /* ===== Cas 1 : entrée = GROUPE déroulant (ex : Apprendre) ===== */
              if (isNavGroup(entry)) {
                if (!shouldShowGroup(entry)) return null;
                const isOpen = openNavGroupId === entry.id;
                const active = isGroupActive(entry);
                const children = visibleChildren(entry);

                return (
                  <li
                    key={entry.id}
                    className="header__nav-item header__nav-item--group"
                    ref={el => { navGroupRefs.current[entry.id] = el; }}
                  >
                    {/* Bouton déclencheur du dropdown */}
                    <button
                      type="button"
                      ref={el => { navGroupButtonRefs.current[entry.id] = el; }}
                      className={`header__nav-link header__nav-link--group ${active ? 'header__nav-link--active' : ''}`}
                      onClick={() => toggleNavGroup(entry.id)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      {entry.icon}
                      <span>{entry.label}</span>
                      <ChevronDown
                        size={16}
                        className={`header__nav-chevron ${isOpen ? 'header__nav-chevron--open' : ''}`}
                      />
                    </button>

                    {/*
                      Panneau dropdown (visible si isOpen).
                      Position : fixed calculée à partir du bouton (voir useEffect
                      qui met à jour navGroupPos). Cela permet au panneau de
                      s'afficher hors du conteneur .header__nav--desktop qui a
                      overflow clippant — sinon le dropdown serait invisible.
                      Tant que navGroupPos n'est pas calculé (premier render),
                      on ne rend rien pour éviter un flash en haut à gauche.
                    */}
                    {isOpen && navGroupPos && (
                      <div
                        className="header__nav-dropdown"
                        role="menu"
                        style={{
                          position: 'fixed',
                          top: `${navGroupPos.top}px`,
                          left: `${navGroupPos.left}px`,
                        }}
                      >
                        {children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            role="menuitem"
                            className={`header__nav-dropdown-link ${isActiveLink(child.path) ? 'header__nav-dropdown-link--active' : ''}`}
                          >
                            {child.icon}
                            <span>{child.label}</span>
                            {child.requirePremium && (
                              <Crown size={14} className="header__premium-badge" />
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              }

              /* ===== Cas 2 : entrée = LIEN SIMPLE (comportement historique) ===== */
              const link = entry;
              if (!shouldShowLink(link)) return null;
              return (
                <li key={link.path} className="header__nav-item">
                  <Link
                    to={link.path}
                    className={`header__nav-link ${isActiveLink(link.path) ? 'header__nav-link--active' : ''} ${link.hideIfPremium ? 'header__nav-link--premium-cta' : ''}`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {/* Badge couronne pour les liens réservés aux Premium */}
                    {link.requirePremium && (
                      <Crown size={14} className="header__premium-badge" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ----- ACTIONS UTILISATEUR ----- */}
        <div className="header__actions">

          {/* Bouton dark mode */}
          <button
            className="header__theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Bouton d'installation PWA — visible quand le navigateur le permet */}
          {installPrompt && (
            <button
              className="header__install-btn"
              onClick={handleInstall}
              title="Installer PedaClic sur cet appareil"
            >
              <Download size={16} />
              <span>Installer</span>
            </button>
          )}

          {/* État de chargement */}
          {loading ? (
            <div className="header__loading">
              <div className="header__spinner"></div>
            </div>
          ) : currentUser ? (
            <>
              {/* ─── Phase 26 : Cloche notifications temps réel ─── */}
              <NotificationBell />

              {/* ----- UTILISATEUR CONNECTÉ ----- */}
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
		    <Link to={currentUser.role === 'eleve' ? '/eleve/dashboard' : currentUser.role === 'prof' ? '/prof/dashboard' : currentUser.role === 'parent' ? '/parent/dashboard' : '/admin'} className="header__dropdown-link">
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
		    {/* Lien Cahier de textes (élèves uniquement) */}
		    {currentUser.role === 'eleve' && (
		      <Link to="/eleve/cahiers" className="header__dropdown-link">
		        <BookOpen size={18} />
		        <span>Cahier de textes</span>
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
            </>
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
          {/* Navigation mobile
              Pour les groupes (ex : Apprendre), on affiche un titre de
              section + la liste des enfants visibles en dessous. Aucun
              accordion : tout reste accessible en un seul scroll, ce qui
              évite toute régression d'accessibilité sur mobile. */}
          <nav className="header__mobile-nav">
            <ul className="header__mobile-list">
              {navEntries.map((entry) => {
                /* Groupe (ex : Apprendre) */
                if (isNavGroup(entry)) {
                  if (!shouldShowGroup(entry)) return null;
                  const children = visibleChildren(entry);
                  return (
                    <li key={entry.id} className="header__mobile-item header__mobile-item--group">
                      {/* Titre de section non cliquable */}
                      <div className="header__mobile-group-title">
                        {entry.icon}
                        <span>{entry.label}</span>
                      </div>
                      {/* Liens enfants du groupe */}
                      <ul className="header__mobile-sublist">
                        {children.map((child) => (
                          <li key={child.path} className="header__mobile-item">
                            <Link
                              to={child.path}
                              className={`header__mobile-link header__mobile-link--sub ${isActiveLink(child.path) ? 'header__mobile-link--active' : ''}`}
                            >
                              {child.icon}
                              <span>{child.label}</span>
                              {child.requirePremium && (
                                <Crown size={14} className="header__premium-badge" />
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                }

                /* Lien simple (comportement mobile historique) */
                const link = entry;
                if (!shouldShowLink(link)) return null;
                return (
                  <li key={link.path} className="header__mobile-item">
                    <Link
                      to={link.path}
                      className={`header__mobile-link ${isActiveLink(link.path) ? 'header__mobile-link--active' : ''} ${link.hideIfPremium ? 'header__mobile-link--premium-cta' : ''}`}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                      {link.requirePremium && (
                        <Crown size={14} className="header__premium-badge" />
                      )}
                    </Link>
                  </li>
                );
              })}
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
