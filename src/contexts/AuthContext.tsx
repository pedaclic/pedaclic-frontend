/**
 * AUTH CONTEXT - Contexte d'authentification PedaClic
 * 
 * Fonctionnalités :
 * - Connexion / Déconnexion
 * - Inscription avec création de profil Firestore
 * - Récupération de mot de passe
 * - Persistance de session
 * - Gestion des rôles (admin, prof, eleve)
 * - Hook useAuth pour accès facile
 * 
 * Messages d'erreur en français
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, RegisterFormData, AuthContextType } from '../../index';

// ==================== TYPES ÉTENDUS ====================

/**
 * Type étendu pour le contexte d'authentification
 * Inclut des méthodes supplémentaires
 */
interface ExtendedAuthContextType extends AuthContextType {
  resetPassword: (email: string) => Promise<void>;
  isAdmin: boolean;
  isProf: boolean;
  isEleve: boolean;
  isPremium: boolean;
}

// ==================== CRÉATION DU CONTEXTE ====================

/**
 * Contexte React pour l'authentification
 * undefined par défaut, vérifié dans le hook
 */
const AuthContext = createContext<ExtendedAuthContextType | undefined>(undefined);

// ==================== MESSAGES D'ERREUR EN FRANÇAIS ====================

/**
 * Traduit les codes d'erreur Firebase en messages français
 */
const getFirebaseErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    // Erreurs d'authentification
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'auth/user-not-found': 'Aucun compte associé à cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/operation-not-allowed': 'Opération non autorisée.',
    'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
    
    // Erreurs réseau
    'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.',
    'auth/timeout': 'La requête a expiré. Veuillez réessayer.',
    
    // Erreurs générales
    'auth/internal-error': 'Une erreur interne est survenue.',
    'auth/invalid-api-key': 'Configuration incorrecte de l\'application.',
  };

  return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
};

// ==================== PROVIDER ====================

/**
 * Props du Provider
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Fournit le contexte d'authentification
 * Gère l'état de l'utilisateur et les opérations d'auth
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // État de l'utilisateur courant (avec données Firestore)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // État de chargement initial
  const [loading, setLoading] = useState<boolean>(true);

  // ==================== EFFETS ====================

  /**
   * Écoute les changements d'état d'authentification Firebase
   * Récupère les données utilisateur depuis Firestore
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Récupérer les données utilisateur depuis Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Construire l'objet User complet
            const user: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: userData.displayName || firebaseUser.displayName || undefined,
              role: userData.role as UserRole || 'eleve',
              isPremium: userData.isPremium || false,
              subscriptionEnd: userData.subscriptionEnd 
                ? (userData.subscriptionEnd as Timestamp).toDate() 
                : null,
              photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
              createdAt: userData.createdAt 
                ? (userData.createdAt as Timestamp).toDate() 
                : new Date(),
              lastLogin: new Date()
            };

            // Mettre à jour la dernière connexion
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastLogin: serverTimestamp()
            });

            setCurrentUser(user);
          } else {
            // Document utilisateur non trouvé - cas anormal
            console.error('Document utilisateur non trouvé dans Firestore');
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des données utilisateur:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      
      setLoading(false);
    });

    // Cleanup de l'écouteur
    return () => unsubscribe();
  }, []);

  // ==================== MÉTHODES D'AUTHENTIFICATION ====================

  /**
   * Connexion avec email et mot de passe
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      throw new Error(getFirebaseErrorMessage(firebaseError.code || ''));
    }
  };

  /**
   * Inscription avec création du profil Firestore
   */
  const register = async (data: RegisterFormData): Promise<void> => {
    try {
      // Validation des mots de passe
      if (data.password !== data.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas.');
      }

      // Validation du mot de passe
      if (data.password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
      }

      // Créer l'utilisateur Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        data.email, 
        data.password
      );

      // Mettre à jour le profil Firebase avec le nom d'affichage
      if (data.displayName) {
        await firebaseUpdateProfile(userCredential.user, {
          displayName: data.displayName
        });
      }

      // Créer le document utilisateur dans Firestore
      const userData: Omit<User, 'uid'> = {
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        isPremium: false,
        subscriptionEnd: null,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

    } catch (error: unknown) {
      if (error instanceof Error) {
        // Erreur personnalisée (validation)
        if (!error.message.includes('auth/')) {
          throw error;
        }
      }
      const firebaseError = error as { code?: string };
      throw new Error(getFirebaseErrorMessage(firebaseError.code || ''));
    }
  };

  /**
   * Déconnexion
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setCurrentUser(null);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      throw new Error(getFirebaseErrorMessage(firebaseError.code || ''));
    }
  };

  /**
   * Réinitialisation du mot de passe
   */
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      throw new Error(getFirebaseErrorMessage(firebaseError.code || ''));
    }
  };

  /**
   * Mise à jour du profil utilisateur
   */
  const updateProfile = async (data: Partial<User>): Promise<void> => {
    if (!currentUser) {
      throw new Error('Aucun utilisateur connecté.');
    }

    try {
      // Mettre à jour Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...data,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour l'état local
      setCurrentUser(prev => prev ? { ...prev, ...data } : null);

      // Mettre à jour Firebase Auth si nécessaire
      if (data.displayName && auth.currentUser) {
        await firebaseUpdateProfile(auth.currentUser, {
          displayName: data.displayName
        });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw new Error('Impossible de mettre à jour le profil.');
    }
  };

  // ==================== PROPRIÉTÉS DÉRIVÉES ====================

  const isAdmin = currentUser?.role === 'admin';
  const isProf = currentUser?.role === 'prof';
  const isEleve = currentUser?.role === 'eleve';
  const isPremium = currentUser?.isPremium || false;

  // ==================== VALEUR DU CONTEXTE ====================

  const value: ExtendedAuthContextType = {
    currentUser,
    loading,
    login,
    register,
    logout,
    updateProfile,
    resetPassword,
    isAdmin,
    isProf,
    isEleve,
    isPremium
  };

  // ==================== RENDU ====================

  return (
    <AuthContext.Provider value={value}>
      {/* Ne rendre les enfants qu'après le chargement initial */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// ==================== HOOK PERSONNALISÉ ====================

/**
 * Hook useAuth - Accède au contexte d'authentification
 * Lève une erreur si utilisé hors du Provider
 */
export const useAuth = (): ExtendedAuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  
  return context;
};

// Export par défaut du contexte
export default AuthContext;
