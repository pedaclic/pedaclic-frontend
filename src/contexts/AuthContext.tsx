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

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
// Phase 56 — redirection directe vers la page de connexion (ProtectedRoute)
import { Navigate, useLocation } from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { User, UserRole, RegisterFormData, AuthContextType } from '../types';
import { estAbonnementPremiumActif } from '../types/premiumPlans';

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
  // Phase 60 — email non confirmé. NB : LoginPage détecte la sous-chaîne
  // « Vérifiez votre adresse email » pour afficher le lien vers
  // /verification-email : ne pas modifier ce début de phrase.
  'pedaclic/email-non-verifie':
    'Vérifiez votre adresse email : votre compte n\'est pas encore activé. ' +
    'Cliquez sur le lien de confirmation reçu par email (pensez au dossier spam), puis reconnectez-vous.',
  'pedaclic/email-non-verifie-renvoye':
    'Vérifiez votre adresse email : votre compte n\'est pas encore activé. ' +
    'Un nouveau lien de confirmation vient de vous être envoyé (pensez au dossier spam).',
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

  /**
   * Phase 60 — vrai pendant login()/register() : ces fonctions gèrent
   * elles-mêmes la déconnexion d'un compte non vérifié (après avoir, le cas
   * échéant, renvoyé l'email). L'écouteur onAuthStateChanged ne doit donc
   * pas déconnecter l'utilisateur sous leurs pieds.
   */
  const operationAuthEnCoursRef = useRef<boolean>(false);

  // ==================== VÉRIFICATION EMAIL (Phase 60) ====================

  /**
   * Indique si ce compte doit encore confirmer son adresse email avant
   * d'accéder à l'application.
   *
   * Politique (n'affecte AUCUN compte existant) :
   *  - email déjà vérifié (dont tous les comptes Google)  → accès autorisé ;
   *  - compte non « mot de passe » (Google, etc.)          → accès autorisé ;
   *  - compte sans drapeau `emailVerificationRequired`
   *    (comptes anciens, comptes créés par l'admin)         → accès autorisé ;
   *  - inscription autonome (drapeau = true) non vérifiée   → accès REFUSÉ.
   *
   * @param user             Utilisateur Firebase connecté
   * @param bloquerSiErreur  Comportement si le profil est illisible :
   *                         true  = refuser (connexion explicite, en ligne) ;
   *                         false = tolérer (restauration de session, mode hors ligne PWA).
   */
  const verificationEmailEnAttente = async (
    user: FirebaseUser,
    bloquerSiErreur: boolean
  ): Promise<boolean> => {
    if (user.emailVerified) return false;

    // Seuls les comptes email/mot de passe sont concernés
    const estCompteMotDePasse = user.providerData.some(p => p.providerId === 'password');
    if (!estCompteMotDePasse) return false;

    // La valeur `emailVerified` mise en cache peut être périmée (lien cliqué
    // depuis un autre appareil) : on la rafraîchit auprès de Firebase.
    try {
      await user.reload();
      if (user.emailVerified) return false;
    } catch {
      /* hors ligne : on garde la valeur en cache */
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      return snap.exists() && snap.data().emailVerificationRequired === true;
    } catch {
      return bloquerSiErreur;
    }
  };

  /**
   * Renvoie l'email de vérification (au mieux : Firebase limite la fréquence
   * des envois → `auth/too-many-requests`, que l'on ignore silencieusement).
   * @returns true si un nouvel email est bien parti
   */
  const renvoyerEmailVerification = async (user: FirebaseUser): Promise<boolean> => {
    try {
      await sendEmailVerification(user);
      return true;
    } catch {
      return false;
    }
  };

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
        // ── Premium : on évalue l'ACTIVITÉ réelle de l'abonnement ──────────
        // `isPremium` exposé à l'app = booléen stocké ET abonnement non expiré.
        // C'est la correction de fond : la date de fin (`subscriptionEnd`)
        // était écrite mais jamais comparée à « maintenant », d'où un accès
        // Premium permanent. On dérive ici l'état effectif une bonne fois pour
        // toutes, ce qui corrige automatiquement TOUS les points de garde
        // (PremiumRoute, CoursDetailPage, tableaux de bord…).
        const subscriptionEnd = data.subscriptionEnd?.toDate() || null;
        const premiumActif = estAbonnementPremiumActif(data.isPremium, subscriptionEnd);
        return {
          uid,
          email: data.email,
          displayName: data.displayName,
          role: data.role as UserRole,
          // Sexe (M/F/autre) — peut être absent sur les comptes antérieurs
          // à l'introduction du champ : on remonte alors `undefined` plutôt
          // qu'une valeur arbitraire.
          sexe: data.sexe || undefined,
          sexeAutre: data.sexeAutre || undefined,
          isPremium: premiumActif,
          subscriptionEnd,
          subscriptionPlan: data.subscriptionPlan || undefined,
          coursChoisis: data.coursChoisis || [],
          usageRessources: data.usageRessourcesTotal ?? data.usageRessources ?? 0,
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
   * @param additionalData - Données supplémentaires optionnelles (displayName, role, emailVerificationRequired)
   */
  const createOrUpdateUserDoc = async (
    user: FirebaseUser,
    additionalData?: Partial<User> & { emailVerificationRequired?: boolean }
  ): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // ── Phase 57 : compte supprimé par l'admin ? ──────────────────
      //    Sans ce garde-fou, le profil serait recréé automatiquement à la
      //    reconnexion. Lecture tolérante : en cas d'erreur (règles non
      //    encore déployées, réseau), on ne bloque pas l'inscription.
      let compteSupprime = false;
      try {
        const tombe = await getDoc(doc(db, 'comptes_supprimes', user.uid));
        compteSupprime = tombe.exists();
      } catch {
        compteSupprime = false;
      }
      if (compteSupprime) {
        await signOut(auth);
        // Code reconnu par getErrorMessage → « Ce compte a été désactivé. »
        throw Object.assign(new Error('Ce compte a été supprimé par l\'administrateur.'), {
          code: 'auth/user-disabled',
        });
      }

      // Création du document utilisateur
      const baseData: Record<string, unknown> = {
        email: user.email,
        displayName: user.displayName || additionalData?.displayName || '',
        role: additionalData?.role || 'eleve',
        isPremium: false,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      // Persistance OPTIONNELLE du sexe : on n'écrit le champ que s'il a
      // été fourni (cas des inscriptions email/mdp avec rôle élève/parent).
      // Lors d'un login Google de tout compte, le champ peut rester vide ;
      // l'utilisateur le complétera depuis son profil.
      if (additionalData?.sexe) {
        baseData.sexe = additionalData.sexe;
        if (additionalData.sexe === 'autre' && additionalData.sexeAutre) {
          baseData.sexeAutre = additionalData.sexeAutre;
        }
      }
      if (additionalData?.emailVerificationRequired === true) {
        baseData.emailVerificationRequired = true;
      }
      await setDoc(userRef, baseData);
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
    operationAuthEnCoursRef.current = true;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // ── Phase 60 : email non confirmé → pas d'accès ─────────────────
      //    On renvoie un lien (comme promis sur /verification-email),
      //    puis on referme immédiatement la session.
      if (await verificationEmailEnAttente(userCredential.user, true)) {
        const renvoye = await renvoyerEmailVerification(userCredential.user);
        await signOut(auth);
        setCurrentUser(null);
        throw Object.assign(new Error('Email non vérifié'), {
          code: renvoye ? 'pedaclic/email-non-verifie-renvoye' : 'pedaclic/email-non-verifie',
        });
      }

      await createOrUpdateUserDoc(userCredential.user);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    } finally {
      operationAuthEnCoursRef.current = false;
    }
  };

  /**
   * Inscription d'un nouvel utilisateur
   * Envoie un email de vérification et exige sa validation avant la première connexion.
   * @param data - Données du formulaire d'inscription
   * @returns { needsVerification: true } si l'utilisateur doit vérifier son email
   */
  const register = async (data: RegisterFormData): Promise<{ needsVerification: true } | void> => {
    // Phase 60 : createUserWithEmailAndPassword connecte automatiquement le
    // nouveau compte ; l'écouteur ne doit pas interférer pendant l'inscription.
    operationAuthEnCoursRef.current = true;
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

      const { user } = userCredential;

      // Mise à jour du profil Firebase Auth
      await updateAuthProfile(user, {
        displayName: data.displayName
      });

      // Envoi de l'email de vérification
      await sendEmailVerification(user);

      // Création du document utilisateur Firestore avec flag de vérification requise
      await createOrUpdateUserDoc(user, {
        displayName: data.displayName,
        role: data.role,
        // Champs sexe transmis si saisis (cf. RegisterPage : recommandé pour
        // les rôles élève / parent, optionnel pour les autres).
        sexe: data.sexe,
        sexeAutre: data.sexeAutre,
        emailVerificationRequired: true
      });

      // Déconnexion immédiate : l'utilisateur ne peut accéder à l'app qu'après vérification
      await signOut(auth);

      return { needsVerification: true };
    } catch (error: any) {
      if (error.message) {
        throw error;
      }
      throw new Error(getErrorMessage(error.code));
    } finally {
      operationAuthEnCoursRef.current = false;
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
        // Phase 60 — session ouverte mais email non confirmé (session
        // antérieure au correctif, onglet resté ouvert, inscription…) :
        // on n'expose jamais ce compte à l'application.
        if (await verificationEmailEnAttente(firebaseUser, false)) {
          setCurrentUser(null);
          if (!operationAuthEnCoursRef.current) {
            await signOut(auth).catch(() => undefined);
          }
        } else {
          // Utilisateur connecté - récupérer ses données
          const userData = await fetchUserData(firebaseUser.uid);
          setCurrentUser(userData);
        }
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
  // Phase 56 — page demandée, transmise à /connexion pour y revenir
  // automatiquement après une connexion réussie (LoginPage lit `state.from`).
  const location = useLocation();
  const from = `${location.pathname}${location.search}${location.hash}`;

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Vérification des autorisations...</p>
      </div>
    );
  }

  // Non connecté → page de connexion, directement
  //   Phase 56 : remplace l'écran intermédiaire « Accès refusé ».
  //   `replace` : la page protégée ne reste pas dans l'historique
  //   (le bouton « Précédent » ne ramène pas sur une page interdite).
  if (!currentUser) {
    return <Navigate to="/connexion" replace state={{ from }} />;
  }

  // Connecté, mais avec un rôle qui n'ouvre pas cette page
  //   Phase 56 : remplace l'écran « Accès non autorisé ». La protection est
  //   inchangée (la page n'est jamais rendue) ; on affiche la page de
  //   connexion avec un message (`motif: 'role'`) pour changer de compte.
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/connexion" replace state={{ from, motif: 'role' }} />;
  }

  // Vérification du statut Premium
  if (requirePremium && !currentUser.isPremium) {
    return (
      <div className="error-container premium-required">
        <h2>Contenu Premium</h2>
        <p>Cette ressource est réservée aux abonnés Premium.</p>
        <div className="premium-cta">
          <p><strong>Dès 10 000 FCFA / 3 mois</strong> — Accès illimité</p>
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

/**
 * Composant de protection Élève
 * Raccourci pour les routes réservées aux élèves et admins
 */
export const EleveRoute: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['eleve', 'admin']}>
    {children}
  </ProtectedRoute>
);

export default AuthContext;
