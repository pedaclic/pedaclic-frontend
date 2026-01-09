/* ========================================
   ANIMATIONS AU SCROLL
   ======================================== */

// Configuration
const scrollAnimConfig = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px',
    animateOnce: true
};

// Observer
let scrollObserver = null;

// ========================================
// INITIALISATION
// ========================================
function initScrollAnimations() {
    // Créer l'observer
    scrollObserver = new IntersectionObserver(handleIntersection, {
        threshold: scrollAnimConfig.threshold,
        rootMargin: scrollAnimConfig.rootMargin
    });
    
    // Observer tous les éléments avec data-scroll
    const elements = document.querySelectorAll('[data-scroll]');
    elements.forEach(el => scrollObserver.observe(el));
    
    // Auto-détecter certains éléments
    autoDetectElements();
}

// ========================================
// AUTO-DÉTECTION D'ÉLÉMENTS À ANIMER
// ========================================
function autoDetectElements() {
    const selectors = [
        '.resource-card',
        '.tool-card',
        '.quiz-card',
        '.stat-card-modern',
        '.feature',
        '.step-card',
        '.testimonial-card',
        '.news-item'
    ];
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            if (!el.hasAttribute('data-scroll')) {
                el.setAttribute('data-scroll', 'fade-up');
                el.setAttribute('data-scroll-delay', index * 100);
                scrollObserver.observe(el);
            }
        });
    });
}

// ========================================
// GÉRER L'INTERSECTION
// ========================================
function handleIntersection(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            const animation = element.getAttribute('data-scroll') || 'fade-up';
            const delay = element.getAttribute('data-scroll-delay') || 0;
            
            // Appliquer l'animation avec délai
            setTimeout(() => {
                element.classList.add('scroll-animated', `scroll-${animation}`);
            }, delay);
            
            // Arrêter d'observer si animateOnce est true
            if (scrollAnimConfig.animateOnce) {
                scrollObserver.unobserve(element);
            }
        } else if (!scrollAnimConfig.animateOnce) {
            // Retirer l'animation si on sort de la vue
            entry.target.classList.remove('scroll-animated');
        }
    });
}

// ========================================
// AJOUTER MANUELLEMENT UNE ANIMATION
// ========================================
function addScrollAnimation(selector, animation = 'fade-up', delay = 0) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, index) => {
        el.setAttribute('data-scroll', animation);
        el.setAttribute('data-scroll-delay', delay + (index * 100));
        scrollObserver.observe(el);
    });
}

// ========================================
// INITIALISER
// ========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
} else {
    initScrollAnimations();
}

// Exposer globalement
window.addScrollAnimation = addScrollAnimation;
