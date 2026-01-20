import React from 'react';
import ReactDOM from 'react-dom/client';
import PlanificationConsultation from './PlanificationConsultation';

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de la consultation des planifications');
    
    try {
      const rootElement = document.getElementById('root');
      
      if (!rootElement) {
        throw new Error('Element #root non trouvé');
      }
      
      const root = ReactDOM.createRoot(rootElement);
      root.render(React.createElement(PlanificationConsultation));
      
      console.log('✅ Page de consultation montée avec succès');
    } catch (error) {
      console.error('❌ Erreur:', error);
    }
  });
}
