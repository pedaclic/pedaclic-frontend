/**
 * ============================================
 * HOOK useAuth - Gestion de l'Authentification
 * ============================================
 * 
 * Hook personnalisé pour gérer l'authentification Firebase avec :
 * - Contexte d'authentification partagé
 * - Fonctions login, register, logout
 * - Gestion du profil utilisateur dans Firestore
 * - États de chargement et erreurs
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/* ==================== TYPES ==================== */

/**
 * Rôles utilisateur possibles
 */
export type UserRole = 'admin' | 'prof' | 'eleve' | 'parent';

/**
 * Interface utilisateur PedaClic
 */
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  isPremium: boolean;
  subscriptionEnd: Date | null;
  createdAt: Date;
  lastLogin: Date;
}

/**
 * Données pour l'inscription
 */
export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

/**
 * Interface du contexte d'authentification
 */
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (role?: UserRole) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

/* ==================== CONTEXTE ==================== */

/**
 * Création du contexte d'authentification
 */
const AuthContext = createContext<AuthContextType | null>(null);

/* ==================== PROVIDER ==================== */

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider d'authentification
 * Enveloppe l'application pour fournir le contexte auth
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // États locaux
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ==================== HELPERS ==================== */

  /**
   * Récupère les données utilisateur depuis Firestore
   */
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: data.displayName || firebaseUser.displayName,
          photoURL: data.photoURL || firebaseUser.photoURL,
          role: data.role || 'eleve',
          isPremium: data.isPremium || false,
          subscriptionEnd: data.subscriptionEnd?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date()
        };
      }

      // Si pas de document Firestore, créer un profil par défaut
      const defaultUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        role: 'eleve',
        isPremium: false,
        subscriptionEnd: null,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      // Créer le document dans Firestore
      await setDoc(userDocRef, {
        ...defaultUser,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      return defaultUser;
    } catch (err) {
      console.error('Erreur lors de la récupération des données utilisateur:', err);
      return null;
    }
  };

  /**
   * Traduit les codes d'erreur Firebase en messages français
   */
  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
      'auth/invalid-email': 'Adresse email invalide.',
      'auth/operation-not-allowed': 'Opération non autorisée.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/user-disabled': 'Ce compte a été désactivé.',
      'auth/user-not-found': 'Aucun compte trouvé avec cette adresse email.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/invalid-credential': 'Email ou mot de passe incorrect.',
      'auth/too-many-requests': 'Trop de tentatives. Veuillez réessayer plus tard.',
      'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.'
    };
    return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
  };

  /* ==================== EFFET : ÉCOUTEUR AUTH ==================== */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = await fetchUserData(firebaseUser);
          setCurrentUser(userData);

          // Mettre à jour la date de dernière connexion
          if (userData) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            await updateDoc(userDocRef, {
              lastLogin: serverTimestamp()
            });
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Erreur lors de l\'écoute de l\'authentification:', err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup
    return () => unsubscribe();
  }, []);

  /* ==================== FONCTIONS D'AUTHENTIFICATION ==================== */

  /**
   * Connexion avec email et mot de passe
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = getErrorMessage(err.code);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Connexion / inscription via Google OAuth
   * - Utilisateur existant : mise à jour de lastLogin uniquement
   * - Nouvel utilisateur : document Firestore créé avec le rôle fourni (défaut : 'eleve')
   */
  const loginWithGoogle = async (role: UserRole = 'eleve'): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL,
          role,
          isPremium: false,
          subscriptionEnd: null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
      } else {
        await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
      }
    } catch (err: any) {
      const message = err.code === 'auth/popup-closed-by-user'
        ? 'Connexion annulée.'
        : getErrorMessage(err.code);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Inscription d'un nouvel utilisateur
   */
  const register = async (data: RegisterData): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      // Créer l'utilisateur Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Mettre à jour le profil Firebase
      await updateFirebaseProfile(userCredential.user, {
        displayName: data.displayName
      });

      // Créer le document utilisateur dans Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: null,
        role: data.role,
        isPremium: false,
        subscriptionEnd: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

    } catch (err: any) {
      const message = getErrorMessage(err.code);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Déconnexion
   */
  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      const message = 'Erreur lors de la déconnexion.';
      setError(message);
      throw new Error(message);
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
      setError(null);

      // Mettre à jour Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        ...data,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour le profil Firebase Auth si nécessaire
      if (auth.currentUser && (data.displayName || data.photoURL)) {
        await updateFirebaseProfile(auth.currentUser, {
          displayName: data.displayName || auth.currentUser.displayName,
          photoURL: data.photoURL || auth.currentUser.photoURL
        });
      }

      // Mettre à jour l'état local
      setCurrentUser((prev) =>
        prev ? { ...prev, ...data } : null
      );

    } catch (err: any) {
      const message = 'Erreur lors de la mise à jour du profil.';
      setError(message);
      throw new Error(message);
    }
  };

  /**
   * Effacer les erreurs
   */
  const clearError = () => {
    setError(null);
  };

  /* ==================== VALEUR DU CONTEXTE ==================== */

  const value: AuthContextType = {
    currentUser,
    loading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/* ==================== HOOK useAuth ==================== */

/**
 * Hook pour utiliser le contexte d'authentification
 * @returns Le contexte d'authentification
 * @throws Error si utilisé hors du AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }

  return context;
};

export default useAuth;
