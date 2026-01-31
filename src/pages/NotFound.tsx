/**
 * ============================================
 * PAGE NOT FOUND - 404 PedaClic
 * ============================================
 */

import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';
import './NotFound.css';

const NotFound: React.FC = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-page__content">
        {/* Illustration 404 */}
        <div className="not-found-page__illustration">
          <span className="not-found-page__404">404</span>
          <span className="not-found-page__emoji">🔍</span>
        </div>

        {/* Texte */}
        <h1>Page introuvable</h1>
        <p>
          Oups ! La page que vous recherchez n'existe pas ou a été déplacée.
          Pas de panique, retournez à l'accueil pour continuer à apprendre !
        </p>

        {/* Actions */}
        <div className="not-found-page__actions">
          <Link to="/" className="not-found-page__btn not-found-page__btn--primary">
            <Home size={18} />
            Retour à l'accueil
          </Link>
          <Link to="/disciplines" className="not-found-page__btn not-found-page__btn--outline">
            <Search size={18} />
            Explorer les cours
          </Link>
        </div>

        {/* Lien retour */}
        <button 
          className="not-found-page__back"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={16} />
          Revenir en arrière
        </button>
      </div>
    </div>
  );
};

export default NotFound;
