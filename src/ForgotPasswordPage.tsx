/**
 * FORGOT PASSWORD PAGE - Récupération de mot de passe PedaClic
 * 
 * Fonctionnalités :
 * - Formulaire avec email
 * - Envoi du lien de réinitialisation
 * - Message de confirmation
 * - Retour à la connexion
 * 
 * Design : Cards blanches sur fond gris clair
 */

import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

/**
 * Composant ForgotPasswordPage
 */
const ForgotPasswordPage: React.FC = () => {
  // ==================== HOOKS ====================
  const { resetPassword } = useAuth();

  // ==================== ÉTATS ====================
  
  // Email
  const [email, setEmail] = useState<string>('');
  
  // État de chargement
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // État d'erreur
  const [error, setError] = useState<string>('');
  
  // État de succès
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // ==================== HANDLERS ====================

  /**
   * Valide l'email
   */
  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Veuillez entrer une adresse email valide.');
      return false;
    }
    
    return true;
  };

  /**
   * Gère la soumission du formulaire
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!validateEmail()) return;
    
    setIsLoading(true);
    setError('');

    try {
      await resetPassword(email);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Réinitialiser le formulaire pour un nouvel essai
   */
  const handleReset = (): void => {
    setIsSuccess(false);
    setEmail('');
    setError('');
  };

  // ==================== RENDU ====================

  return (
    // <!-- Page de récupération - Fond gris clair -->
    <div className="auth-page">
      <div className="auth-container auth-container--centered">
        
        {/* <!-- Card principale --> */}
        <div className="auth-card auth-card--narrow">
          
          {/* <!-- En-tête avec logo --> */}
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <div className="auth-logo__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </div>
              <span>PedaClic</span>
            </Link>
          </div>

          {isSuccess ? (
            // ==================== MESSAGE DE SUCCÈS ====================
            <div className="auth-success-content">
              {/* Icône de succès */}
              <div className="auth-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              
              <h1 className="auth-title">Email envoyé !</h1>
              <p className="auth-subtitle">
                Nous avons envoyé un lien de réinitialisation à <strong>{email}</strong>
              </p>
              
              {/* Instructions */}
              <div className="auth-instructions">
                <p>Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.</p>
                <p className="auth-instructions-note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  Si vous ne voyez pas l'email, vérifiez votre dossier spam.
                </p>
              </div>
              
              {/* Actions */}
              <div className="auth-success-actions">
                <Link to="/connexion" className="auth-button">
                  Retour à la connexion
                </Link>
                <button 
                  type="button" 
                  className="auth-button auth-button--outline"
                  onClick={handleReset}
                >
                  Renvoyer l'email
                </button>
              </div>
            </div>
          ) : (
            // ==================== FORMULAIRE ====================
            <>
              {/* Icône clé */}
              <div className="auth-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              
              <h1 className="auth-title">Mot de passe oublié ?</h1>
              <p className="auth-subtitle">
                Pas de panique ! Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {/* Message d'erreur */}
              {error && (
                <div className="auth-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Formulaire */}
              <form onSubmit={handleSubmit} className="auth-form">
                
                {/* Champ Email */}
                <div className="auth-field">
                  <label htmlFor="email" className="auth-label">
                    Adresse email
                  </label>
                  <div className="auth-input-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="auth-input-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="exemple@email.com"
                      className="auth-input"
                      autoComplete="email"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Bouton de soumission */}
                <button
                  type="submit"
                  className="auth-button"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="auth-button-spinner"></span>
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le lien'
                  )}
                </button>
              </form>

              {/* Lien retour connexion */}
              <div className="auth-back">
                <Link to="/connexion" className="auth-back-link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                  </svg>
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
