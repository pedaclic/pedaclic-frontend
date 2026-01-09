// ========================================
// FOOTER DYNAMIQUE PEDACLIC
// Composant réutilisable pour toutes les pages
// ========================================

function createFooter() {
  const footer = document.getElementById('main-footer');
  if (!footer) return;
  
  // Détecter la profondeur du fichier (pour les chemins relatifs)
  const depth = window.location.pathname.split('/').filter(p => p && p !== 'index.html').length;
  const basePath = depth > 0 ? '../'.repeat(depth) : './';
  
  // Année actuelle
  const currentYear = new Date().getFullYear();
  
  footer.innerHTML = `
    <div class="footer-container">
      <!-- Section 1 : Logo et Description -->
      <div class="footer-section">
        <a href="${basePath}index.html" class="footer-logo">
          <img src="${basePath}assets/images/logo/logo-white.svg" 
               alt="Pedaclic" 
               height="35"
               class="footer-logo-img">
        </a>
        <p class="footer-description">
          L'école en un clic. Votre plateforme d'apprentissage interactive 
          pour réussir vos études.
        </p>
        <div class="footer-social">
          <a href="#facebook" class="social-link" aria-label="Facebook">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a href="#twitter" class="social-link" aria-label="Twitter">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>
          <a href="#instagram" class="social-link" aria-label="Instagram">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
            </svg>
          </a>
          <a href="#youtube" class="social-link" aria-label="YouTube">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
        </div>
      </div>
      
      <!-- Section 2 : Liens Rapides -->
      <div class="footer-section">
        <h3 class="footer-title">Liens Rapides</h3>
        <ul class="footer-links">
          <li><a href="${basePath}index.html">🏠 Accueil</a></li>
          <li><a href="${basePath}ressources.html">📚 Ressources</a></li>
          <li><a href="${basePath}outils.html">⚙️ Outils</a></li>
          <li><a href="${basePath}quiz.html">🧠 Quiz</a></li>
        </ul>
      </div>
      
      <!-- Section 3 : Matières -->
      <div class="footer-section">
        <h3 class="footer-title">Matières</h3>
        <ul class="footer-links">
          <li><a href="#maths">Mathématiques</a></li>
          <li><a href="#francais">Français</a></li>
          <li><a href="#sciences">Sciences</a></li>
          <li><a href="#histoire">Histoire-Géo</a></li>
          <li><a href="#langues">Langues</a></li>
        </ul>
      </div>
      
      <!-- Section 4 : Support -->
      <div class="footer-section">
        <h3 class="footer-title">Support</h3>
        <ul class="footer-links">
          <li><a href="#aide">📖 Centre d'aide</a></li>
          <li><a href="#contact">✉️ Contact</a></li>
          <li><a href="#faq">❓ FAQ</a></li>
          <li><a href="${basePath}premium.html">👑 Premium</a></li>
        </ul>
      </div>
    </div>
    
    <!-- Ligne de séparation -->
    <div class="footer-divider"></div>
    
    <!-- Section Bas : Copyright et Légal -->
    <div class="footer-bottom">
      <p class="footer-copyright">
        © ${currentYear} <strong>Pedaclic.sn</strong> - L'école en un clic. Tous droits réservés.
      </p>
      <div class="footer-legal">
        <a href="#mentions">Mentions légales</a>
        <span class="separator">•</span>
        <a href="#confidentialite">Confidentialité</a>
        <span class="separator">•</span>
        <a href="#cgu">CGU</a>
        <span class="separator">•</span>
        <a href="#cookies">Cookies</a>
      </div>
    </div>
  `;
}

// ========================================
// INITIALISATION AU CHARGEMENT
// ========================================
document.addEventListener('DOMContentLoaded', createFooter);
