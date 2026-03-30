// ============================================
// CONFIGURATION FIREBASE — PedaClic
// Phase 17 : Persistance hors-ligne activée
// Phase 28 : Firebase App Check (reCAPTCHA v3)
// ============================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// --- Configuration Firebase (variables d'environnement) ---
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// --- Initialisation de l'app Firebase ---
// IMPORTANT : doit être appelé avant tout autre service Firebase
const app = initializeApp(firebaseConfig);

// ============================================
// PHASE 28 — Firebase App Check (reCAPTCHA v3)
// Vérifie que les requêtes proviennent uniquement
// de l'application PedaClic (pedaclic.sn)
// ============================================

// En développement local : affiche le token de debug dans la console
// Ce token doit être ajouté dans Firebase Console > App Check > Applications
if (import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// La clé de site reCAPTCHA est publique par conception (liée au domaine pedaclic.sn)
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (!recaptchaKey) {
  console.error('[App Check] VITE_RECAPTCHA_SITE_KEY manquante — App Check désactivé.');
} else {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true, // Renouvelle le token automatiquement
    });
    console.info('[App Check] Initialisé avec reCAPTCHA v3.');
  } catch (err) {
    console.error('[App Check] Échec d\'initialisation :', err);
  }
}

// --- Auth (inchangé) ---
export const auth = getAuth(app);

// --- Firestore AVEC persistance IndexedDB ---
// Les données consultées sont automatiquement stockées localement.
// Multi-tab : plusieurs onglets peuvent accéder au cache simultanément.
// En cas de perte de connexion, Firestore sert les données depuis IndexedDB.
export const db = initializeFirestore(app, {
  // Réduit les erreurs WebChannel / QUIC sur certains réseaux (proxy, antivirus…)
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// --- Storage (inchangé) ---
export const storage = getStorage(app);