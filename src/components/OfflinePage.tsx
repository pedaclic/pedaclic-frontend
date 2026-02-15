/**
 * ============================================
 * OFFLINE PAGE — Page hors-ligne
 * ============================================
 * 
 * Affichée quand l'utilisateur est hors-ligne et
 * tente d'accéder à du contenu non mis en cache.
 * 
 * Rassure l'utilisateur et liste les contenus
 * disponibles en cache.
 * 
 * @version 1.0.0
 */

import { WifiOff, BookOpen, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './OfflinePage.css';

const OfflinePage: React.FC = () => {
  const isOnline = useOnlineStatus();

  // --- Si la connexion revient, recharger la page ---
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="offline-page">
      <div className="offline-page__container">
        
        {/* --- Icône animée --- */}
        <div className="offline-page__icon">
          <WifiOff size={48} />
        </div>

        {/* --- Titre --- */}
        <h1 className="offline-page__title">
          Pas de connexion internet
        </h1>

        {/* --- Message rassurant --- */}
        <p className="offline-page__message">
          Pas de panique ! Les cours et exercices que tu as déjà consultés 
          sont disponibles hors-ligne. La plateforme se reconnectera 
          automatiquement dès que ta connexion sera rétablie.
        </p>

        {/* --- Ce qui est disponible --- */}
        <div className="offline-page__available">
          <h2 className="offline-page__subtitle">
            <BookOpen size={20} />
            Ce que tu peux faire hors-ligne
          </h2>
          <ul className="offline-page__list">
            <li>Relire les cours déjà consultés</li>
            <li>Revoir les exercices et leurs corrections</li>
            <li>Consulter tes quiz précédents</li>
            <li>Naviguer dans les disciplines visitées</li>
          </ul>
        </div>

        {/* --- Bouton réessayer --- */}
        <button 
          className="offline-page__retry"
          onClick={handleRetry}
        >
          <RefreshCw size={18} />
          {isOnline ? 'Connexion rétablie — Recharger' : 'Réessayer la connexion'}
        </button>

        {/* --- Conseil --- */}
        <p className="offline-page__tip">
          Astuce : consulte tes cours quand tu es connecté pour qu'ils soient 
          automatiquement disponibles hors-ligne.
        </p>
      </div>
    </div>
  );
};

export default OfflinePage;
