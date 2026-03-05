/**
 * EMAIL VERIFICATION PAGE - Vérification de l'email PedaClic
 *
 * Affiche un message après inscription demandant à l'utilisateur
 * de vérifier son adresse email avant de pouvoir se connecter.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/auth.css';

const EmailVerificationPage: React.FC = () => {
  const location = useLocation();
  const stateEmail = (location.state as { email?: string })?.email;
  const queryEmail = new URLSearchParams(location.search).get('email');
  const email = stateEmail || queryEmail;

  return (
    <div className="auth-page">
      <div className="auth-container auth-container--centered">
        <div className="auth-card auth-card--narrow">
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <div className="auth-logo__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <span>PedaClic</span>
            </Link>

            <div
              className="auth-verification-icon"
              style={{
                width: 64,
                height: 64,
                margin: '0 auto 1rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width={32}
                height={32}
              >
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                <path d="M21 8l-9 5-9-5" />
              </svg>
            </div>

            <h1 className="auth-title">Vérifiez votre email</h1>
            <p className="auth-subtitle" style={{ marginBottom: '1rem' }}>
              Un email de vérification a été envoyé à votre adresse.
            </p>

            {email && (
              <p className="auth-hint" style={{ fontWeight: 600, marginBottom: '1rem' }}>
                {email}
              </p>
            )}

            <p className="auth-hint" style={{ textAlign: 'center', lineHeight: 1.6 }}>
              Cliquez sur le lien dans l'email pour activer votre compte.
              Vous pourrez ensuite vous connecter à PedaClic.
            </p>

            <p className="auth-hint" style={{ textAlign: 'center', marginTop: '1rem' }}>
              Vous n'avez pas reçu l'email ? Vérifiez votre dossier spam ou réessayez de vous connecter
              — un nouvel email vous sera envoyé.
            </p>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/connexion" className="auth-button" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Aller à la connexion
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
