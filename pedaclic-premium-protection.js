// premium/js/premium-auth-check.js
// Script de vérification d'authentification Premium

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

// Initialiser Firebase si pas déjà fait
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Afficher un loader pendant la vérification
document.body.innerHTML = `
  <div style="
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 99999;
  " id="auth-loader">
    <div style="
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    "></div>
    <p style="font-size: 18px; font-weight: 600;">Vérification de l'accès Premium...</p>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </div>
`;

// Vérifier l'authentification
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Utilisateur non connecté -> Rediriger vers la page de connexion
    alert('🔒 Accès Premium requis\n\nVeuillez vous connecter pour accéder à cette fonctionnalité.');
    window.location.href = '../auth.html';
    return;
  }
  
  try {
    // Récupérer le document utilisateur
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      // Créer le document utilisateur s'il n'existe pas
      await db.collection('users').doc(user.uid).set({
        email: user.email,
        isPremium: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Rediriger vers la page d'abonnement
      alert('🌟 Passez à Premium\n\nCette fonctionnalité est réservée aux membres Premium.');
      window.location.href = '../premium.html';
      return;
    }
    
    const userData = userDoc.data();
    
    if (userData.isPremium !== true) {
      // Utilisateur non-Premium -> Rediriger vers la page d'abonnement
      alert('🌟 Passez à Premium\n\nCette fonctionnalité est réservée aux membres Premium.\n\nAbonnez-vous pour seulement 2000 FCFA/mois.');
      window.location.href = '../premium.html';
      return;
    }
    
    // Utilisateur Premium vérifié -> Supprimer le loader et afficher le contenu
    const loader = document.getElementById('auth-loader');
    if (loader) {
      loader.remove();
    }
    
    // Restaurer le contenu de la page
    document.body.style.display = 'block';
    
    console.log('✅ Accès Premium autorisé pour:', user.email);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification Premium:', error);
    alert('Erreur de vérification. Veuillez réessayer.');
    window.location.href = '../index.html';
  }
});