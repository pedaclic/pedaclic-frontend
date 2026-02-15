// ============================================
// HOOK — Détection du statut réseau
// Retourne true si connecté, false si hors-ligne
// ============================================

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  // --- État initial basé sur navigator.onLine ---
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // --- Handlers pour les événements réseau ---
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // --- Écouter les changements de connexion ---
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // --- Nettoyage ---
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
