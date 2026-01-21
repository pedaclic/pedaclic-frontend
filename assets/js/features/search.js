/**
 * Fonctionnalité de recherche pour Pedaclic
 */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('[data-search-input]');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            console.log('Recherche:', searchTerm);
        });
    }
});
