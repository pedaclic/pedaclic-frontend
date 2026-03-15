import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Import des styles
import './globals.css';
import './styles/admin.css';
import './Notifications.css';
import './Live.css';

// ============================================
// PHASE 28 — Forcer la mise à jour du SW
// Désinstalle l'ancien service worker si son
// script a changé (nouveau build App Check).
// Ce code peut être retiré après 1 semaine.
// ============================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.update();
    }
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("L'élément #root n'existe pas");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
