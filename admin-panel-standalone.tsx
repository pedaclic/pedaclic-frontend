import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminPanel from './pedaclic-admin-panel';

// Attendre que le DOM soit prêt
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage du panneau admin PedaClic');
    
    try {
      const rootElement = document.getElementById('root');
      
      if (!rootElement) {
        throw new Error('Element #root non trouvé dans le DOM');
      }
      
      console.log('✅ Element root trouvé, création du composant...');
      
      const root = ReactDOM.createRoot(rootElement);
      root.render(React.createElement(AdminPanel));
      
      console.log('✅ Panneau admin monté avec succès !');
    } catch (error) {
      console.error('❌ Erreur:', error);
      
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.innerHTML = `
          <div style="padding: 50px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #e74c3c;">Erreur de chargement</h1>
            <p>${error.message}</p>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 20px;">
              Vérifiez la console (F12) pour plus de détails
            </p>
          </div>
        `;
      }
    }
  });
}
