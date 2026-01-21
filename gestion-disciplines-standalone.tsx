import React from 'react';
import ReactDOM from 'react-dom/client';
import GestionDisciplines from './GestionDisciplines';

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(React.createElement(GestionDisciplines));
    console.log('✅ Gestion des disciplines chargée');
  }
});
