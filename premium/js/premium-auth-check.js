const firebaseConfig = {
  apiKey: "AIzaSyDgk_1graNBFkIURTJnyLZTZ1nyxi7slUo",
  authDomain: "pedaclic.firebaseapp.com",
  projectId: "pedaclic",
  storageBucket: "pedaclic.firebasestorage.app",
  messagingSenderId: "863649621890",
  appId: "1:863649621890:web:6ab56a8c8db111e3a9119b"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

document.body.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;color:white;font-family:sans-serif;" id="loader"><div style="text-align:center"><div style="border:4px solid rgba(255,255,255,0.3);border-top:4px solid white;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px;"></div><p>Vérification Premium...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></div>';

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('🔒 Accès Premium requis\n\nConnectez-vous pour accéder à cette fonctionnalité.');
    window.location.href = '../auth.html';
    return;
  }
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      await db.collection('users').doc(user.uid).set({
        email: user.email,
        isPremium: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('🌟 Passez à Premium\n\nFonctionnalité réservée aux membres Premium.');
      window.location.href = '../premium.html';
      return;
    }
    
    if (userDoc.data().isPremium !== true) {
      alert('🌟 Passez à Premium\n\nAbonnez-vous pour 2000 FCFA/mois.');
      window.location.href = '../premium.html';
      return;
    }
    
    document.getElementById('loader').remove();
    document.body.style.display = 'block';
    console.log('✅ Accès Premium autorisé');
    
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur de vérification');
    window.location.href = '../index.html';
  }
});
