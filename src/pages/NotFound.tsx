/**
 * Page NotFound - 404 PedaClic
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import './NotFound.css';

export const NotFound: React.FC = () => {
  return (
    <div className="notfound-page">
      <div className="notfound-container">
        <h1 className="notfound-title">404</h1>
        <h2>Page non trouvée</h2>
        <p>Désolé, la page que vous recherchez n'existe pas.</p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">
            <Home size={20} />
            Retour à l'accueil
          </Link>
          <button onClick={() => window.history.back()} className="btn btn-outline">
            <ArrowLeft size={20} />
            Page précédente
          </button>
        </div>
      </div>
    </div>
  );
};
