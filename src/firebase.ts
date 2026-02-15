// ============================================
// CONFIGURATION FIREBASE — PedaClic
// Phase 17 : Persistance hors-ligne activée
// ============================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// --- Configuration Firebase (variables d'environnement) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// --- Initialisation de l'app Firebase ---
const app = initializeApp(firebaseConfig);

// --- Auth (inchangé) ---
export const auth = getAuth(app);

// --- Firestore AVEC persistance IndexedDB ---
// Les données consultées sont automatiquement stockées localement.
// Multi-tab : plusieurs onglets peuvent accéder au cache simultanément.
// En cas de perte de connexion, Firestore sert les données depuis IndexedDB.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// --- Storage (inchangé) ---
export const storage = getStorage(app);
