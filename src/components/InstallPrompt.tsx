/**
 * ============================================
 * INSTALL PROMPT — Bannière d'installation PWA
 * ============================================
 * 
 * Affiche une bannière élégante pour installer PedaClic :
 * - Intercepte l'événement beforeinstallprompt (Android/Chrome)
 * - Affiche des instructions manuelles pour iOS (Safari)
 * - Apparaît après 2 visites (pas au premier chargement)
 * - Se ferme définitivement si l'utilisateur refuse
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import './InstallPrompt.css';

/* ==================== INTERFACES ==================== */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/* ==================== COMPOSANT ==================== */

const InstallPrompt: React.FC = () => {
  // ===== ÉTATS =====
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  /* ==================== DÉTECTION PLATEFORME ==================== */

  /**
   * Vérifie si l'appareil est iOS (iPhone/iPad)
   */
  const isIOS = (): boolean => {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && 
           !(window as any).MSStream;
  };

  /**
   * Vérifie si l'app est déjà installée (mode standalone)
   */
  const isStandalone = (): boolean => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (navigator as any).standalone === true;
  };

  /* ==================== GESTION DES VISITES ==================== */

  /**
   * Incrémente le compteur de visites et retourne le total
   * La bannière s'affiche après 2 visites pour ne pas être intrusive
   */
  const getVisitCount = useCallback((): number => {
    try {
      const count = parseInt(localStorage.getItem('pedaclic_visit_count') || '0', 10);
      return count;
    } catch {
      return 0;
    }
  }, []);

  const incrementVisitCount = useCallback((): void => {
    try {
      const count = getVisitCount() + 1;
      localStorage.setItem('pedaclic_visit_count', count.toString());
    } catch {
      // localStorage indisponible — on ignore silencieusement
    }
  }, [getVisitCount]);

  /**
   * Vérifie si la bannière a été refusée il y a moins de 30 jours.
   * Après 30 jours, elle est proposée à nouveau.
   */
  const wasDismissed = (): boolean => {
    try {
      const ts = localStorage.getItem('pedaclic_install_dismissed_at');
      if (!ts) return false;
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      return Date.now() - parseInt(ts, 10) < THIRTY_DAYS;
    } catch {
      return false;
    }
  };

  /* ==================== EFFETS ==================== */

  useEffect(() => {
    // --- Ne rien faire si déjà installée ou bannière refusée ---
    if (isStandalone() || wasDismissed()) return;

    // --- Incrémenter le compteur de visites ---
    incrementVisitCount();

    // --- Cas Android/Chrome : intercepter beforeinstallprompt ---
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Afficher la bannière dès la 1ère visite
      if (getVisitCount() >= 1) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // --- Cas iOS : afficher les instructions manuelles ---
    if (isIOS() && getVisitCount() >= 1) {
      setShowIOSInstructions(true);
      setShowBanner(true);
    }

    // --- Détecter quand l'app est installée ---
    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // --- Nettoyage ---
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [getVisitCount, incrementVisitCount]);

  /* ==================== HANDLERS ==================== */

  /**
   * Lance l'installation (Android/Chrome)
   */
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);

    try {
      // Afficher le prompt natif du navigateur
      await deferredPrompt.prompt();

      // Attendre la réponse de l'utilisateur
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Erreur installation PWA:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  /**
   * Ferme la bannière et mémorise le refus
   */
  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('pedaclic_install_dismissed_at', Date.now().toString());
      localStorage.removeItem('pedaclic_install_dismissed');
    } catch {
      // Ignore
    }
  };

  /* ==================== RENDU ==================== */

  // --- Ne rien afficher si la bannière n'est pas visible ---
  if (!showBanner) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt__container">
        
        {/* ----- Icône et texte ----- */}
        <div className="install-prompt__content">
          <div className="install-prompt__icon">
            <Download size={24} />
          </div>
          <div className="install-prompt__text">
            <h3 className="install-prompt__title">
              Installer PedaClic
            </h3>
            <p className="install-prompt__description">
              {showIOSInstructions 
                ? "Accède à tes cours même sans connexion !"
                : "Installe l'app pour un accès rapide, même hors-ligne !"
              }
            </p>
          </div>
        </div>

        {/* ----- Actions ----- */}
        <div className="install-prompt__actions">
          
          {/* --- Cas Android/Chrome : bouton d'installation --- */}
          {!showIOSInstructions && deferredPrompt && (
            <button 
              className="install-prompt__btn install-prompt__btn--primary"
              onClick={handleInstallClick}
              disabled={isInstalling}
            >
              {isInstalling ? 'Installation...' : 'Installer'}
            </button>
          )}

          {/* --- Cas iOS : instructions manuelles --- */}
          {showIOSInstructions && (
            <div className="install-prompt__ios">
              <p className="install-prompt__ios-text">
                Appuie sur <Share size={16} className="install-prompt__ios-icon" /> puis 
                <span className="install-prompt__ios-highlight">
                  <Plus size={14} /> Sur l'écran d'accueil
                </span>
              </p>
            </div>
          )}

          {/* --- Bouton fermer --- */}
          <button 
            className="install-prompt__btn install-prompt__btn--close"
            onClick={handleDismiss}
            aria-label="Fermer la bannière d'installation"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
