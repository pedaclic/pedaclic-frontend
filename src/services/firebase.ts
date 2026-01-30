/**
 * Configuration Firebase pour PedaClic
 * Ce fichier centralise toute la configuration Firebase (Auth, Firestore, Storage)
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Interface pour la configuration Firebase
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Configuration Firebase - À REMPLACER PAR VOS VRAIES VALEURS
// Ces valeurs doivent être stockées dans un fichier .env pour la sécurité
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pedaclic-xxxx.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pedaclic-xxxx",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pedaclic-xxxx.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:xxxxx",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialisation de Firebase App
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialisation des services Firebase
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Export de l'app pour usage avancé si nécessaire
export default app;

// Configuration de la persistance pour l'authentification (optionnel)
// import { setPersistence, browserLocalPersistence } from 'firebase/auth';
// setPersistence(auth, browserLocalPersistence);
