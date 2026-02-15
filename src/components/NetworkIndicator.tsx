/**
 * ============================================
 * NETWORK INDICATOR — Barre de statut réseau
 * ============================================
 * 
 * Affiche une fine barre au-dessus du Header quand
 * l'utilisateur perd sa connexion internet.
 * Disparaît automatiquement quand la connexion revient.
 * 
 * Ne modifie PAS le Header existant.
 * 
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './NetworkIndicator.css';

const NetworkIndicator: React.FC = () => {
  // ===== STATUT RÉSEAU =====
  const isOnline = useOnlineStatus();

  // ===== ÉTAT POUR L'ANIMATION DE RETOUR EN LIGNE =====
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      // --- L'utilisateur vient de perdre la connexion ---
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      // --- La connexion est revenue ---
      setShowReconnected(true);
      // Masquer le message "reconnecté" après 3 secondes
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // --- Ne rien afficher si tout va bien ---
  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`network-indicator ${
        isOnline
          ? 'network-indicator--online'
          : 'network-indicator--offline'
      }`}
    >
      <div className="network-indicator__content">
        {isOnline ? (
          <>
            <Wifi size={14} />
            <span>Connexion rétablie</span>
          </>
        ) : (
          <>
            <WifiOff size={14} />
            <span>Pas de connexion — mode hors-ligne</span>
          </>
        )}
      </div>
    </div>
  );
};

export default NetworkIndicator;
