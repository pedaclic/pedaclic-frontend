/**
 * PRIVATE ROUTE - Protection des routes PedaClic
 * 
 * Fonctionnalités :
 * - Redirection vers login si non authentifié
 * - Vérification des rôles (admin, prof, eleve)
 * - Vérification du statut Premium
 * - Affichage d'un loader pendant la vérification
 * 
 * Utilisation :
 * <PrivateRoute>
 *   <MaPageProtegee />
 * </PrivateRoute>
 * 
 * <PrivateRoute roles={['admin', 'prof']}>
 *   <PageAdminOuProf />
 * </PrivateRoute>
 * 
 * <PrivateRoute requirePremium>
 *   <ContenuPremium />
 * </PrivateRoute>
 */

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../index';

// ==================== TYPES ====================

/**
 * Props du composant PrivateRoute
 */
interface PrivateRouteProps {
  children: ReactNode;
  roles?: UserRole[];        // Rôles autorisés (optionnel)
  requirePremium?: boolean;  // Nécessite un compte Premium
  redirectTo?: string;       // URL de redirection personnalisée
}

// ==================== COMPOSANT LOADER ====================

/**
 * Composant Loader affiché pendant la vérification d'authentification
 */
const AuthLoader: React.FC = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p className="text-muted">Vérification de l'authentification...</p>
  </div>
);

// ==================== COMPOSANT ACCÈS REFUSÉ ====================

/**
 * Composant affiché quand l'accès est refusé
 */
interface AccessDeniedProps {
  message: string;
  redirectPath: string;
  redirectLabel: string;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ 
  message, 
  redirectPath, 
  redirectLabel 
}) => (
  <div className="access-denied">
    <div className="access-denied__container">
      {/* Icône de verrou */}
      <div className="access-denied__icon">
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      
      {/* Message */}
      <h2 className="access-denied__title">Accès refusé</h2>
      <p className="access-denied__message">{message}</p>
      
      {/* Bouton de redirection */}
      <a href={redirectPath} className="access-denied__button">
        {redirectLabel}
      </a>
    </div>
    
    {/* Styles inline pour le composant */}
    <style>{`
      .access-denied {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
      }
      
      .access-denied__container {
        text-align: center;
        max-width: 400px;
      }
      
      .access-denied__icon {
        width: 80px;
        height: 80px;
        margin: 0 auto var(--spacing-lg);
        background: #fef2f2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .access-denied__icon svg {
        width: 40px;
        height: 40px;
        color: #ef4444;
      }
      
      .access-denied__title {
        color: var(--color-text);
        font-size: var(--text-2xl);
        margin-bottom: var(--spacing-sm);
      }
      
      .access-denied__message {
        color: var(--color-text-light);
        margin-bottom: var(--spacing-xl);
      }
      
      .access-denied__button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-sm) var(--spacing-xl);
        background: var(--color-primary);
        color: white;
        font-weight: var(--font-medium);
        text-decoration: none;
        border-radius: var(--radius-md);
        transition: all var(--transition-base);
      }
      
      .access-denied__button:hover {
        background: var(--color-primary-dark);
        text-decoration: none;
      }
    `}</style>
  </div>
);

// ==================== COMPOSANT PRINCIPAL ====================

/**
 * PrivateRoute - Protège les routes selon l'authentification et les permissions
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  roles,
  requirePremium = false,
  redirectTo = '/connexion'
}) => {
  // Récupérer l'utilisateur et l'état de chargement
  const { currentUser, loading } = useAuth();
  
  // Récupérer l'URL actuelle pour la redirection après login
  const location = useLocation();

  // ==================== VÉRIFICATIONS ====================

  // 1. Afficher le loader pendant la vérification
  if (loading) {
    return <AuthLoader />;
  }

  // 2. Vérifier si l'utilisateur est connecté
  if (!currentUser) {
    // Rediriger vers la page de connexion avec l'URL de retour
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // 3. Vérifier les rôles si spécifiés
  if (roles && roles.length > 0) {
    if (!roles.includes(currentUser.role)) {
      return (
        <AccessDenied
          message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
          redirectPath="/"
          redirectLabel="Retour à l'accueil"
        />
      );
    }
  }

  // 4. Vérifier le statut Premium si requis
  if (requirePremium && !currentUser.isPremium) {
    return (
      <AccessDenied
        message="Ce contenu est réservé aux membres Premium. Abonnez-vous pour y accéder."
        redirectPath="/premium"
        redirectLabel="Devenir Premium"
      />
    );
  }

  // ==================== RENDU ====================

  // Toutes les vérifications passées - afficher le contenu
  return <>{children}</>;
};

// ==================== EXPORTS ====================

export default PrivateRoute;

// Export du composant AccessDenied pour usage externe
export { AccessDenied };
