/**
 * ============================================================================
 * BANDEAU COOKIES - PedaClic
 * ============================================================================
 * Affiche un bandeau d'information sur les cookies au premier chargement.
 * Le choix de l'utilisateur est enregistré dans localStorage.
 *
 * @author PedaClic Team
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

const STORAGE_KEY = 'pedaclic_cookiesAccepted';

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
      setVisible(false);
    } catch {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Information sur les cookies">
      <div className="cookie-banner__inner">
        <p className="cookie-banner__text">
          En poursuivant votre navigation sur <strong>PedaClic</strong>, vous acceptez
          l'utilisation de cookies pour améliorer votre expérience d'apprentissage et
          sécuriser vos accès.{' '}
          <Link to="/confidentialite" className="cookie-banner__link">
            En savoir plus
          </Link>
        </p>
        <button
          type="button"
          className="cookie-banner__btn"
          onClick={handleAccept}
          aria-label="Accepter les cookies"
        >
          Accepter
        </button>
      </div>
    </div>
  );
};

export default CookieBanner;
