// assets/js/components/header.js
// Header PedaClic avec système d'authentification amélioré

(function() {
  'use strict';

  // Configuration Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDgk_1graNBFkIURTJnyLZTZ1nyxi7slUo",
    authDomain: "pedaclic.firebaseapp.com",
    projectId: "pedaclic",
    storageBucket: "pedaclic.firebasestorage.app",
    messagingSenderId: "863649621890",
    appId: "1:863649621890:web:6ab56a8c8db111e3a9119b"
  };

  // Initialiser Firebase si pas déjà fait
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // HTML du header
  const headerHTML = `
    <style>
      /* Reset et base */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      /* Header principal */
      .pedaclic-header {
        background: white;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 1000;
        padding: 15px 0;
      }

      .header-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      /* Logo */
      .header-logo {
        font-size: 28px;
        font-weight: 800;
        color: #667eea;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.3s ease;
      }

      .header-logo:hover {
        transform: scale(1.05);
      }

      /* Navigation principale */
      .header-nav {
        display: flex;
        align-items: center;
        gap: 30px;
      }

      .nav-link {
        color: #334155;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        transition: color 0.3s ease;
        position: relative;
      }

      .nav-link::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 0;
        height: 2px;
        background: #667eea;
        transition: width 0.3s ease;
      }

      .nav-link:hover {
        color: #667eea;
      }

      .nav-link:hover::after {
        width: 100%;
      }

      .nav-link.active {
        color: #667eea;
      }

      /* Actions (boutons à droite) */
      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* Bouton Premium - VISIBLE ET ATTRACTIF */
      .btn-premium {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: white;
        padding: 10px 24px;
        border-radius: 25px;
        font-weight: 700;
        font-size: 15px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 15px rgba(251, 191, 36, 0.4);
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
      }

      .btn-premium:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(251, 191, 36, 0.6);
      }

      /* Bouton Connexion - DISCRET (pour non-connectés) */
      .btn-connexion {
        background: transparent;
        color: #667eea;
        padding: 8px 20px;
        border: 2px solid #667eea;
        border-radius: 20px;
        font-weight: 600;
        font-size: 14px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s ease;
        cursor: pointer;
      }

      .btn-connexion:hover {
        background: #667eea;
        color: white;
      }

      /* Menu utilisateur (pour connectés) */
      .user-menu {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
        cursor: pointer;
        transition: transform 0.3s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }

      .user-avatar:hover {
        transform: scale(1.1);
      }

      .user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .user-email {
        font-size: 13px;
        color: #64748b;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .premium-badge {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: white;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
      }

      /* Dropdown menu utilisateur */
      .user-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 10px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        min-width: 200px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        z-index: 1001;
      }

      .user-menu:hover .user-dropdown {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .dropdown-item {
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #334155;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.2s ease;
        border-bottom: 1px solid #f1f5f9;
      }

      .dropdown-item:first-child {
        border-radius: 12px 12px 0 0;
      }

      .dropdown-item:last-child {
        border-bottom: none;
        border-radius: 0 0 12px 12px;
      }

      .dropdown-item:hover {
        background: #f8fafc;
      }

      .dropdown-item.logout {
        color: #ef4444;
      }

      /* Bouton mobile menu */
      .mobile-menu-btn {
        display: none;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #334155;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .header-nav {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          flex-direction: column;
          padding: 20px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          gap: 15px;
        }

        .header-nav.active {
          display: flex;
        }

        .mobile-menu-btn {
          display: block;
        }

        .header-actions {
          gap: 8px;
        }

        .btn-premium,
        .btn-connexion {
          padding: 8px 16px;
          font-size: 13px;
        }

        .user-info {
          display: none;
        }
      }
    </style>

    <header class="pedaclic-header">
      <div class="header-container">
        <!-- Logo -->
        <a href="index.html" class="header-logo">
          🎓 Pedaclic
        </a>

        <!-- Navigation principale -->
        <nav class="header-nav" id="mainNav">
          <a href="index.html" class="nav-link">Accueil</a>
          <a href="ressources.html" class="nav-link">Ressources</a>
          <a href="outils.html" class="nav-link">Outils</a>
          <a href="quiz.html" class="nav-link">Quiz</a>
          <a href="contact.html" class="nav-link">Contact</a>
        </nav>

        <!-- Actions (droite) -->
        <div class="header-actions">
          <!-- Bouton Premium (toujours visible) -->
          <a href="premium.html" class="btn-premium">
            👑 Premium
          </a>

          <!-- Si non connecté : Bouton Connexion -->
          <div id="auth-logged-out" style="display: none;">
            <a href="auth.html" class="btn-connexion">
              🔐 Connexion
            </a>
          </div>

          <!-- Si connecté : Menu utilisateur -->
          <div id="auth-logged-in" class="user-menu" style="display: none;">
            <div class="user-info">
              <span id="user-email" class="user-email"></span>
              <span id="premium-badge" class="premium-badge" style="display: none;">⭐ Premium</span>
            </div>
            <div class="user-avatar" id="user-avatar">👤</div>
            
            <!-- Dropdown -->
            <div class="user-dropdown">
              <a href="profile.html" class="dropdown-item">
                👤 Mon profil
              </a>
              <a href="premium.html" class="dropdown-item" id="upgrade-link">
                👑 Passer à Premium
              </a>
              <a href="premium/generateur-contenus.html" class="dropdown-item premium-only" style="display: none;">
                📝 Générateur de contenus
              </a>
              <a href="premium/cahier-textes.html" class="dropdown-item premium-only" style="display: none;">
                📚 Cahier de textes
              </a>
              <a href="#" class="dropdown-item logout" id="logout-btn">
                🚪 Déconnexion
              </a>
            </div>
          </div>

          <!-- Bouton menu mobile -->
          <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu">
            ☰
          </button>
        </div>
      </div>
    </header>
  `;

  // Insérer le header dans la page
  const headerElement = document.getElementById('main-header');
  if (headerElement) {
    headerElement.innerHTML = headerHTML;
  }

  // Gestion de l'authentification
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const auth = firebase.auth();
    const db = firebase.firestore ? firebase.firestore() : null;

    auth.onAuthStateChanged(async (user) => {
      const loggedOut = document.getElementById('auth-logged-out');
      const loggedIn = document.getElementById('auth-logged-in');
      const userEmail = document.getElementById('user-email');
      const userAvatar = document.getElementById('user-avatar');
      const premiumBadge = document.getElementById('premium-badge');
      const premiumOnlyItems = document.querySelectorAll('.premium-only');
      const upgradeLink = document.getElementById('upgrade-link');

      if (user) {
        // Utilisateur connecté
        loggedOut.style.display = 'none';
        loggedIn.style.display = 'flex';
        
        // Afficher l'email
        userEmail.textContent = user.email;
        
        // Afficher l'initiale
        const initial = user.email.charAt(0).toUpperCase();
        userAvatar.textContent = initial;

        // Vérifier le statut Premium
        if (db) {
          try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().isPremium) {
              // Utilisateur Premium
              premiumBadge.style.display = 'inline-block';
              premiumOnlyItems.forEach(item => item.style.display = 'flex');
              upgradeLink.style.display = 'none';
            }
          } catch (error) {
            console.error('Erreur vérification Premium:', error);
          }
        }
      } else {
        // Utilisateur non connecté
        loggedOut.style.display = 'block';
        loggedIn.style.display = 'none';
      }
    });

    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
          auth.signOut().then(() => {
            window.location.href = 'index.html';
          }).catch((error) => {
            console.error('Erreur déconnexion:', error);
            alert('Erreur lors de la déconnexion');
          });
        }
      });
    }
  }

  // Gestion du menu mobile
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      mobileMenuBtn.textContent = mainNav.classList.contains('active') ? '✕' : '☰';
    });
  }

  // Marquer le lien actif
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

})();
