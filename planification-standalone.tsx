import React from 'react';
import ReactDOM from 'react-dom/client';
import PlanificationContenus from './PlanificationContenus';

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(React.createElement(PlanificationContenus));
    console.log('✅ Planification chargée');
  }
});
