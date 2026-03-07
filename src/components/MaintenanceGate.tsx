/**
 * ============================================================================
 * MAINTENANCE GATE - PedaClic
 * ============================================================================
 * Vérifie le mode maintenance (Firestore settings/platform).
 * Si activé et que l'utilisateur n'est pas admin → affiche la page maintenance.
 * Les admins conservent l'accès pour pouvoir désactiver le mode.
 *
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Wrench } from 'lucide-react';
import './MaintenancePage.css';

interface PlatformSettings {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
}

const DEFAULT_MESSAGE = 'PedaClic est en maintenance. Nous revenons bientôt !';

const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'platform');
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformSettings;
          setMaintenanceMode(Boolean(data.maintenanceMode));
          setMaintenanceMessage(data.maintenanceMessage || DEFAULT_MESSAGE);
        } else {
          setMaintenanceMode(false);
          setMaintenanceMessage(DEFAULT_MESSAGE);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erreur chargement mode maintenance:', err);
        setMaintenanceMode(false);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <div className="maintenance-gate-loading">
        <div className="maintenance-gate-spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (maintenanceMode && !isAdmin) {
    return (
      <div className="maintenance-page">
        <div className="maintenance-page__container">
          <div className="maintenance-page__icon">
            <Wrench size={48} />
          </div>
          <h1 className="maintenance-page__title">Maintenance en cours</h1>
          <p className="maintenance-page__message">{maintenanceMessage}</p>
          <p className="maintenance-page__subtext">
            Merci de votre patience. Le site sera de nouveau disponible très bientôt.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGate;
