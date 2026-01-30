import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';

// ============================================
// CONFIGURATION FIREBASE
// ============================================
// Remplacez ces valeurs par celles de votre projet Firebase
// Pour les obtenir : Firebase Console > Project Settings > Your apps

const firebaseConfig = {
  apiKey: "AIzaSyDgk_1graNBFkIURTJnyLZTZ1nyxi7slUo",
  authDomain: "pedaclic.firebaseapp.com",
  projectId: "pedaclic",
  storageBucket: "pedaclic.firebasestorage.app",
  messagingSenderId: "863649621890",
  appId: "1:863649621890:web:6ab56a8c8db111e3a9119b",
  measurementId: "G-20EGFVEM5M"
};

// ============================================
// INITIALISATION DE FIREBASE
// ============================================
// Cette ligne initialise Firebase avec votre configuration
const app: FirebaseApp = initializeApp(firebaseConfig);

// ============================================
// EXPORTS DES SERVICES FIREBASE
// ============================================
// Ces exports permettent d'utiliser Firebase dans tout votre projet

// Firestore Database - Pour stocker les données (niveaux, classes, matières, etc.)
export const db: Firestore = getFirestore(app);

// Firebase Storage - Pour stocker les fichiers (PDF, vidéos, etc.)
export const storage: FirebaseStorage = getStorage(app);

// Firebase Auth - Pour l'authentification des utilisateurs
export const auth: Auth = getAuth(app);

// Export de l'app Firebase (rarement utilisé directement, mais disponible)
export default app;
