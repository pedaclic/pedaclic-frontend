/**
 * ============================================================================
 * CONTEXTE D'AUTHENTIFICATION - PedaClic
 * ============================================================================
 * Gestion centralisée de l'authentification Firebase
 * Fournit l'état utilisateur et les fonctions auth à toute l'application
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { User, UserRole, RegisterFormData, AuthContextType } from '../types';

// ==================== MESSAGES D'ERREUR EN FRANÇAIS ====================

const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/operation-not-allowed': 'Opération non autorisée.',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'auth/user-not-found': 'Aucun compte associé à cette adresse email.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
  'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.',
  'default': 'Une erreur est survenue. Veuillez réessayer.'
};

/**
 * Traduit le code d'erreur Firebase en message français
 * @param errorCode - Code d'erreur Firebase
 * @returns Message d'erreur en français
 */
const getErrorMessage = (errorCode: string): string => {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['default'];
};

// ==================== CONTEXTE ====================

/** Contexte d'authentification avec valeur par défaut null */
const AuthContext = createContext<AuthContextType | null>(null);

// ==================== PROVIDER ====================

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider d'authentification
 * Enveloppe l'application et fournit l'état d'authentification
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // ==================== ÉTAT ====================

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ==================== FONCTIONS UTILITAIRES ====================

  /**
   * Récupère les données utilisateur depuis Firestore
   * @param uid - ID utilisateur Firebase
   * @returns Données utilisateur ou null
   */
  const fetchUserData = async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid,
          email: data.email,
          displayName: data.displayName,
          role: data.role as UserRole,
          isPremium: data.isPremium || false,
          subscriptionEnd: data.subscriptionEnd?.toDate() || null,
          photoURL: data.photoURL,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate()
        };
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération des données utilisateur:', error);
      return null;
    }
  };

  /**
   * Crée ou met à jour le document utilisateur dans Firestore
   * @param user - Utilisateur Firebase
   * @param additionalData - Données supplémentaires optionnelles
   */
  const createOrUpdateUserDoc = async (
    user: FirebaseUser,
    additionalData?: Partial<User>
  ): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // Création du document utilisateur
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || additionalData?.displayName || '',
        role: additionalData?.role || 'eleve',
        isPremium: false,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    } else {
      // Mise à jour de la dernière connexion
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
    }
  };

  // ==================== FONCTIONS D'AUTHENTIFICATION ====================

  /**
   * Connexion avec email et mot de passe
   * @param email - Adresse email
   * @param password - Mot de passe
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await createOrUpdateUserDoc(userCredential.user);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  };

  /**
   * Inscription d'un nouvel utilisateur
   * @param data - Données du formulaire d'inscription
   */
  const register = async (data: RegisterFormData): Promise<void> => {
    try {
      // Vérification des mots de passe
      if (data.password !== data.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas.');
      }

      // Création du compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Mise à jour du profil Firebase Auth
      await updateAuthProfile(userCredential.user, {
        displayName: data.displayName
      });

      // Création du document utilisateur Firestore
      await createOrUpdateUserDoc(userCredential.user, {
        displayName: data.displayName,
        role: data.role
      });
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(getErrorMessage(error.code));
    }
  };

  /**
   * Connexion / inscription via Google OAuth
   * - Si l'utilisateur existe déjà : met à jour lastLogin
   * - Si c'est un nouvel utilisateur : crée le document Firestore avec le rôle fourni (défaut : 'eleve')
   */
  const loginWithGoogle = async (role?: import('../types').UserRole): Promise<void> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await createOrUpdateUserDoc(result.user, { role: role ?? 'eleve' });
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  };

  /**
   * Déconnexion de l'utilisateur
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setCurrentUser(null);
    } catch (error: any) {
      throw new Error('Erreur lors de la déconnexion.');
    }
  };

  /**
   * Met à jour le profil utilisateur
   * @param data - Données à mettre à jour
   */
  const updateProfile = async (data: Partial<User>): Promise<void> => {
    if (!currentUser) {
      throw new Error('Aucun utilisateur connecté.');
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      });

      // Mise à jour de l'état local
      setCurrentUser(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      throw new Error('Erreur lors de la mise à jour du profil.');
    }
  };

  // ==================== EFFET D'ÉCOUTE AUTH ====================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Utilisateur connecté - récupérer ses données
        const userData = await fetchUserData(firebaseUser.uid);
        setCurrentUser(userData);
      } else {
        // Utilisateur déconnecté
        setCurrentUser(null);
      }
      setLoading(false);
    });

    // Nettoyage de l'écouteur
    return () => unsubscribe();
  }, []);

  // ==================== VALEUR DU CONTEXTE ====================

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile
  };

  // ==================== RENDU ====================

  return (
    <AuthContext.Provider value={value}>
      {/* Afficher un loader pendant le chargement initial */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

// ==================== HOOK PERSONNALISÉ ====================

/**
 * Hook pour accéder au contexte d'authentification
 * @returns Contexte d'authentification
 * @throws Error si utilisé hors du Provider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  
  return context;
};

// ==================== COMPOSANTS DE PROTECTION ====================

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requirePremium?: boolean;
}

/**
 * Composant de protection des routes
 * Vérifie l'authentification et les autorisations
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requirePremium = false
}) => {
  const { currentUser, loading } = useAuth();

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Vérification des autorisations...</p>
      </div>
    );
  }

  // Redirection si non connecté
  if (!currentUser) {
    return (
      <div className="error-container">
        <h2>Accès refusé</h2>
        <p>Vous devez être connecté pour accéder à cette page.</p>
        <a href="/connexion" className="btn btn-primary">Se connecter</a>
      </div>
    );
  }

  // Vérification des rôles autorisés
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="error-container">
        <h2>Accès non autorisé</h2>
        <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        <a href="/" className="btn btn-primary">Retour à l'accueil</a>
      </div>
    );
  }

  // Vérification du statut Premium
  if (requirePremium && !currentUser.isPremium) {
    return (
      <div className="error-container premium-required">
        <h2>Contenu Premium</h2>
        <p>Cette ressource est réservée aux abonnés Premium.</p>
        <div className="premium-cta">
          <p><strong>2 000 FCFA/mois</strong> ou <strong>20 000 FCFA/an</strong></p>
          <a href="/premium" className="btn btn-premium">Devenir Premium</a>
        </div>
      </div>
    );
  }

  // Accès autorisé
  return <>{children}</>;
};

/**
 * Composant de protection Admin
 * Raccourci pour les routes réservées aux administrateurs
 */
export const AdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin']}>
    {children}
  </ProtectedRoute>
);

/**
 * Composant de protection Professeur
 * Raccourci pour les routes réservées aux professeurs et admins
 */
export const ProfRoute: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin', 'prof']}>
    {children}
  </ProtectedRoute>
);

export default AuthContext;
