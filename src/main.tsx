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
// PHASE 28 — Désinstallation forcée du SW
// Le service worker précédent mettait en cache
// l'index.html source au lieu du bundle compilé.
// On désinstalle tous les SW enregistrés et on
// vide tous les caches avant de rendre l'appli.
// ============================================
async function clearServiceWorkers() {
  if ('serviceWorker' in navigator) {
    // Désinscrire tous les service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));

    // Vider tous les caches Workbox
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Recharger uniquement si des SW ont été supprimés
    if (registrations.length > 0) {
      window.location.reload();
      return true; // indique qu'on va recharger
    }
  }
  return false;
}

async function main() {
  const willReload = await clearServiceWorkers();
  if (willReload) return; // on attend le rechargement

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
}

main();