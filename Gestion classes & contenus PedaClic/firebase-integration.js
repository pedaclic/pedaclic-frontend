// firebase-integration.js
// Exemple d'intégration Firebase pour la sauvegarde automatique des contenus

import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './config/firebase';

/**
 * SAUVEGARDE AUTOMATIQUE AVEC DEBOUNCE
 * Évite de sauvegarder à chaque frappe clavier
 */
export const useSauvegardeAutomatique = (contenus) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    // Fonction de sauvegarde
    const sauvegarder = async () => {
      try {
        setIsSaving(true);
        
        await setDoc(doc(db, 'planifications', 'contenus'), {
          contenus,
          derniereMiseAJour: new Date().toISOString(),
          version: '1.0'
        });
        
        setLastSaved(new Date());
        console.log('✅ Sauvegarde réussie');
      } catch (error) {
        console.error('❌ Erreur de sauvegarde:', error);
        // Afficher une notification d'erreur à l'utilisateur
      } finally {
        setIsSaving(false);
      }
    };

    // Débounce : sauvegarde 2 secondes après la dernière modification
    const timer = setTimeout(sauvegarder, 2000);
    
    // Nettoyer le timer si contenus change à nouveau
    return () => clearTimeout(timer);
  }, [contenus]);

  return { isSaving, lastSaved };
};

/**
 * CHARGEMENT DES DONNÉES AU MONTAGE
 * Charge les contenus depuis Firestore au démarrage
 */
export const chargerContenus = async () => {
  try {
    const docRef = doc(db, 'planifications', 'contenus');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('✅ Données chargées depuis Firebase');
      return docSnap.data().contenus;
    } else {
      console.log('ℹ️ Aucune donnée trouvée, initialisation');
      return null; // Retourner null pour initialiser les données
    }
  } catch (error) {
    console.error('❌ Erreur de chargement:', error);
    return null;
  }
};

/**
 * ÉCOUTE EN TEMPS RÉEL (optionnel)
 * Synchronise les modifications en temps réel (pour collaboration)
 */
export const ecouterModifications = (callback) => {
  const docRef = doc(db, 'planifications', 'contenus');
  
  // Créer un listener
  const unsubscribe = onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      console.log('🔄 Mise à jour en temps réel');
      callback(doc.data().contenus);
    }
  }, (error) => {
    console.error('❌ Erreur du listener:', error);
  });
  
  // Retourner la fonction de désabonnement
  return unsubscribe;
};

/**
 * SAUVEGARDE MANUELLE
 * Pour un bouton "Enregistrer" explicite
 */
export const sauvegarderManuellement = async (contenus) => {
  try {
    await setDoc(doc(db, 'planifications', 'contenus'), {
      contenus,
      derniereMiseAJour: new Date().toISOString(),
      version: '1.0'
    });
    
    return { success: true, message: 'Sauvegarde réussie' };
  } catch (error) {
    console.error('❌ Erreur de sauvegarde:', error);
    return { success: false, message: error.message };
  }
};

/**
 * HISTORIQUE DES VERSIONS (avancé)
 * Sauvegarder l'historique des modifications
 */
export const sauvegarderVersion = async (contenus, userId, description) => {
  try {
    const timestamp = new Date().toISOString();
    const versionId = `version_${Date.now()}`;
    
    await setDoc(doc(db, 'planifications', 'historique', versionId), {
      contenus,
      userId,
      description,
      timestamp,
      version: '1.0'
    });
    
    console.log('✅ Version sauvegardée');
    return { success: true, versionId };
  } catch (error) {
    console.error('❌ Erreur de sauvegarde de version:', error);
    return { success: false, error: error.message };
  }
};

/**
 * RESTAURER UNE VERSION
 * Récupérer une version précédente
 */
export const restaurerVersion = async (versionId) => {
  try {
    const docRef = doc(db, 'planifications', 'historique', versionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, contenus: docSnap.data().contenus };
    } else {
      return { success: false, message: 'Version introuvable' };
    }
  } catch (error) {
    console.error('❌ Erreur de restauration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * EXPORT VERS FIREBASE STORAGE (pour fichiers Excel/PDF)
 * Sauvegarder les exports dans Firebase Storage
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config/firebase';

export const sauvegarderExportDansStorage = async (csvContent, filename) => {
  try {
    const blob = new Blob(['\ufeff' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const storageRef = ref(storage, `exports/${filename}`);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Export sauvegardé dans Storage');
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error('❌ Erreur de sauvegarde dans Storage:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EXEMPLE D'UTILISATION DANS LE COMPOSANT
// ============================================

/*
import React, { useState, useEffect } from 'react';
import {
  useSauvegardeAutomatique,
  chargerContenus,
  ecouterModifications,
  sauvegarderManuellement
} from './firebase-integration';

const PlanificationContenus = () => {
  const [contenus, setContenus] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Utiliser le hook de sauvegarde automatique
  const { isSaving, lastSaved } = useSauvegardeAutomatique(contenus);

  // Charger les données au montage
  useEffect(() => {
    const init = async () => {
      const data = await chargerContenus();
      
      if (data) {
        setContenus(data);
      } else {
        // Initialiser avec des données vides
        initializerContenus();
      }
      
      setIsLoading(false);
    };

    init();
  }, []);

  // Écouter les modifications en temps réel (optionnel)
  useEffect(() => {
    const unsubscribe = ecouterModifications((newContenus) => {
      setContenus(newContenus);
    });

    // Se désabonner au démontage
    return () => unsubscribe();
  }, []);

  // Bouton de sauvegarde manuelle
  const handleSauvegarderManuellement = async () => {
    const result = await sauvegarderManuellement(contenus);
    
    if (result.success) {
      alert('✅ Sauvegarde réussie !');
    } else {
      alert('❌ Erreur de sauvegarde : ' + result.message);
    }
  };

  if (isLoading) {
    return <div>Chargement des données...</div>;
  }

  return (
    <div>
      {/* Interface */}
      
      {/* Indicateur de sauvegarde */}
      {isSaving && (
        <div style={{ position: 'fixed', top: 20, right: 20 }}>
          💾 Sauvegarde en cours...
        </div>
      )}
      
      {lastSaved && (
        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          Dernière sauvegarde : {lastSaved.toLocaleTimeString()}
        </div>
      )}
      
      {/* Bouton de sauvegarde manuelle */}
      <button onClick={handleSauvegarderManuellement}>
        💾 Sauvegarder
      </button>
    </div>
  );
};
*/

// ============================================
// RÈGLES DE SÉCURITÉ FIRESTORE
// ============================================

/*
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Collection des planifications
    match /planifications/{document} {
      // Lecture : tous les utilisateurs authentifiés
      allow read: if request.auth != null;
      
      // Écriture : seulement les administrateurs
      allow write: if request.auth != null 
                   && request.auth.token.role == 'admin';
    }
    
    // Collection de l'historique
    match /planifications/historique/{versionId} {
      // Lecture : tous les utilisateurs authentifiés
      allow read: if request.auth != null;
      
      // Écriture : seulement les administrateurs
      allow create: if request.auth != null 
                    && request.auth.token.role == 'admin';
      
      // Interdire la modification et suppression
      allow update, delete: if false;
    }
  }
}
*/

// ============================================
// RÈGLES DE SÉCURITÉ STORAGE
// ============================================

/*
// storage.rules

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Dossier des exports
    match /exports/{filename} {
      // Lecture : tous les utilisateurs authentifiés
      allow read: if request.auth != null;
      
      // Écriture : seulement les administrateurs
      allow write: if request.auth != null 
                   && request.auth.token.role == 'admin';
    }
  }
}
*/

// ============================================
// CONFIGURATION FIREBASE (firebase.js)
// ============================================

/*
// config/firebase.js

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
*/

// ============================================
// VARIABLES D'ENVIRONNEMENT (.env)
// ============================================

/*
# .env

REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
REACT_APP_FIREBASE_PROJECT_ID=your_project_id_here
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
REACT_APP_FIREBASE_APP_ID=your_app_id_here
*/
