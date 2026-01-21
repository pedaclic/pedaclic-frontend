/**
 * Animations au scroll pour Pedaclic
 */

document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    const animatedElements = document.querySelectorAll('[data-animate]');
    animatedElements.forEach(el => observer.observe(el));
    
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.setAttribute('data-animate', 'true');
        observer.observe(section);
    });
});

const style = document.createElement('style');
style.textContent = '[data-animate] { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; } [data-animate].animate-in { opacity: 1; transform: translateY(0); }';
document.head.appendChild(style);
