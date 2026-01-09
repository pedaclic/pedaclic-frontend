// ========================================
// HEADER DYNAMIQUE PEDACLIC
// Composant réutilisable pour toutes les pages
// ========================================

function createHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;
  
  // Détecter la profondeur du fichier (pour les chemins relatifs)
  const depth = window.location.pathname.split('/').filter(p => p && p !== 'index.html').length;
  const basePath = depth > 0 ? '../'.repeat(depth) : './';
  
  header.innerHTML = `
    <div class="header-container">
      <!-- Logo -->
      <a href="${basePath}index.html" class="header-logo">
        <img src="${basePath}assets/images/logo/logo-horizontal.svg" 
             alt="Pedaclic" 
             height="40"
             class="logo-image">
      </a>
      
      <!-- Navigation Desktop -->
      <nav class="header-nav">
        <a href="${basePath}index.html" class="nav-link">Accueil</a>
        <a href="${basePath}ressources.html" class="nav-link">Ressources</a>
        <a href="${basePath}outils.html" class="nav-link">Outils</a>
        <a href="${basePath}quiz.html" class="nav-link">Quiz</a>
      </nav>
      
      <!-- CTA Premium -->
      <a href="${basePath}premium.html" class="header-cta">
        <span class="cta-icon">👑</span>
        <span class="cta-text">Premium</span>
      </a>
      
      <!-- Menu Burger Mobile -->
      <button class="burger-menu" id="burgerMenu" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
    
    <!-- Menu Mobile -->
    <div class="mobile-menu" id="mobileMenu">
      <a href="${basePath}index.html" class="mobile-link">🏠 Accueil</a>
      <a href="${basePath}ressources.html" class="mobile-link">📚 Ressources</a>
      <a href="${basePath}outils.html" class="mobile-link">⚙️ Outils</a>
      <a href="${basePath}quiz.html" class="mobile-link">🧠 Quiz</a>
      <a href="${basePath}premium.html" class="mobile-link premium">👑 Premium</a>
    </div>
  `;
  
  // Activer le menu burger
  setupBurgerMenu();
  
  // Mettre en surbrillance le lien actif
  highlightActiveLink();
}

// ========================================
// MENU BURGER (Mobile)
// ========================================
function setupBurgerMenu() {
  const burgerMenu = document.getElementById('burgerMenu');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (!burgerMenu || !mobileMenu) return;
  
  burgerMenu.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  });
  
  // Fermer le menu en cliquant sur un lien
  const mobileLinks = mobileMenu.querySelectorAll('.mobile-link');
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      burgerMenu.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.classList.remove('menu-open');
    });
  });
  
  // Fermer le menu en cliquant en dehors
  document.addEventListener('click', (e) => {
    if (!burgerMenu.contains(e.target) && !mobileMenu.contains(e.target)) {
      burgerMenu.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.classList.remove('menu-open');
    }
  });
}

// ========================================
// METTRE EN SURBRILLANCE LE LIEN ACTIF
// ========================================
function highlightActiveLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link, .mobile-link');
  
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('href').split('/').pop();
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });
}

// ========================================
// INITIALISATION AU CHARGEMENT
// ========================================
document.addEventListener('DOMContentLoaded', createHeader);
