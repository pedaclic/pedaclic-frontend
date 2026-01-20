// Déclarer les globals du navigateur
declare global {
  interface Window {
    React: any;
    ReactDOM: any;
    firebase: any;
  }
}

// Utiliser les globals au lieu d'importer
const React = window.React;
const ReactDOM = window.ReactDOM;

// Importer le composant AdminPanel
import AdminPanelComponent from './pedaclic-admin-panel';

// Monter automatiquement quand le DOM est prêt
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation du panneau admin...');
    console.log('React:', typeof React);
    console.log('ReactDOM:', typeof ReactDOM);
    console.log('AdminPanel:', typeof AdminPanelComponent);
    
    try {
      const rootElement = document.getElementById('root');
      
      if (!rootElement) {
        throw new Error('Element #root non trouvé');
      }
      
      if (!React || !ReactDOM) {
        throw new Error('React ou ReactDOM non chargé');
      }
      
      const root = ReactDOM.createRoot(rootElement);
      root.render(React.createElement(AdminPanelComponent));
      
      console.log('✅ Panneau admin monté avec succès !');
    } catch (error) {
      console.error('❌ Erreur lors du montage:', error);
      
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.innerHTML = `
          <div style="padding: 50px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #e74c3c;">Erreur de chargement</h1>
            <p>${error.message}</p>
          </div>
        `;
      }
    }
  });
}

export {};
