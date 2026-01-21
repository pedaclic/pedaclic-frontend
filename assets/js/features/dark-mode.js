/**
 * Mode sombre pour Pedaclic
 */

document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.querySelector('[data-dark-mode-toggle]');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    const savedTheme = localStorage.getItem('pedaclic-theme');
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
        document.documentElement.classList.add('dark-mode');
    }
    
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            const isDark = document.documentElement.classList.contains('dark-mode');
            localStorage.setItem('pedaclic-theme', isDark ? 'dark' : 'light');
        });
    }
});
