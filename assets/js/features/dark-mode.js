/**
 * Mode sombre basé sur la préférence système
 */

(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', () => {
        const darkModeToggle = document.querySelector('[data-dark-mode-toggle]');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Fonction pour appliquer le thème
        function applyTheme(isDark) {
            if (isDark) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
            localStorage.setItem('pedaclic-theme', isDark ? 'dark' : 'light');
        }
        
        // Charger la préférence sauvegardée ou système
        const savedTheme = localStorage.getItem('pedaclic-theme');
        
        if (savedTheme) {
            applyTheme(savedTheme === 'dark');
        } else {
            applyTheme(prefersDark.matches);
        }
        
        // Écouter les changements de préférence système
        prefersDark.addEventListener('change', (e) => {
            if (!localStorage.getItem('pedaclic-theme')) {
                applyTheme(e.matches);
            }
        });
        
        // Toggle manuel
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                const isDark = !document.documentElement.classList.contains('dark-mode');
                applyTheme(isDark);
            });
        }
    });
})();
