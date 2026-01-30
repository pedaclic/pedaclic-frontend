// Configuration Firebase

const firebaseConfig = {
  apiKey: "AIzaSyDgk_1graNBFkIURTJnyLZTZ1nyxi7slUo",
  authDomain: "pedaclic.firebaseapp.com",
  projectId: "pedaclic",
  storageBucket: "pedaclic.firebasestorage.app",
  messagingSenderId: "863649621890",
  appId: "1:863649621890:web:6ab56a8c8db111e3a9119b",
  measurementId: "G-20EGFVEM5M"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('Firebase initialisé avec succès');
