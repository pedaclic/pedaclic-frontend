/**
 * Gestion de l'affichage des outils Premium et Admin
 */

// Fonction pour vérifier le statut de l'utilisateur
async function checkUserStatus() {
  try {
    // Attendre que Firebase soit initialisé
    if (typeof firebase === 'undefined') {
      console.log('Firebase non chargé');
      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const db = firebase.firestore();
          const userDoc = await db.collection('users').doc(user.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const isPremium = userData.isPremium === true;
            const isAdmin = userData.role === 'admin';
            
            console.log('👤 Statut utilisateur:', { 
              email: user.email, 
              isPremium, 
              isAdmin 
            });
            
            // Afficher les outils Premium (sauf admin-only)
            if (isPremium) {
              document.querySelectorAll('.premium-tool-card:not(.admin-only)').forEach(card => {
                card.style.display = 'flex';
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                
                // Animation d'apparition
                setTimeout(() => {
                  card.style.transition = 'all 0.5s ease';
                  card.style.opacity = '1';
                  card.style.transform = 'translateY(0)';
                }, 100);
              });
            }
            
            // Afficher les outils Admin
            if (isAdmin) {
              document.querySelectorAll('.admin-only').forEach(card => {
                card.style.display = 'flex';
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                
                // Animation d'apparition
                setTimeout(() => {
                  card.style.transition = 'all 0.5s ease';
                  card.style.opacity = '1';
                  card.style.transform = 'translateY(0)';
                }, 200);
              });
            }
            
            console.log('✅ Outils Premium/Admin affichés');
          } else {
            console.log('ℹ️ Aucune donnée utilisateur trouvée');
          }
        } catch (error) {
          console.error('❌ Erreur lors de la vérification du statut:', error);
        }
      } else {
        console.log('ℹ️ Utilisateur non connecté - outils masqués');
        // Masquer tous les outils Premium
        document.querySelectorAll('.premium-tool-card').forEach(card => {
          card.style.display = 'none';
        });
      }
    });
  } catch (error) {
    console.error('❌ Erreur checkUserStatus:', error);
  }
}

// Lancer la vérification quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkUserStatus);
} else {
  checkUserStatus();
}
