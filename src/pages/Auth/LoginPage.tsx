/**
 * LOGIN PAGE - Page de connexion PedaClic
 * 
 * Fonctionnalités :
 * - Formulaire email/mot de passe
 * - Validation des champs
 * - Messages d'erreur en français
 * - Redirection après connexion
 * - Liens vers inscription et mot de passe oublié
 * 
 * Design : Cards blanches sur fond gris clair
 */

import React, { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import '../styles/auth.css';

/**
 * Interface pour l'état du formulaire
 */
interface FormState {
  email: string;
  password: string;
}

/**
 * Interface pour l'état de la location (redirection)
 */
interface LocationState {
  from?: string;
}

/**
 * Composant LoginPage
 */
const LoginPage: React.FC = () => {
  // ==================== HOOKS ====================
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Récupérer l'URL de redirection si présente
  const from = (location.state as LocationState)?.from || '/';

  // ==================== ÉTATS ====================
  
  // État du formulaire
  const [formData, setFormData] = useState<FormState>({
    email: '',
    password: ''
  });
  
  // État de chargement
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // État d'erreur
  const [error, setError] = useState<string>('');
  
  // Afficher/masquer le mot de passe
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // ==================== HANDLERS ====================

  /**
   * Gère les changements dans les champs du formulaire
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Effacer l'erreur quand l'utilisateur modifie un champ
    if (error) setError('');
  };

  /**
   * Valide le formulaire avant soumission
   */
  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError('Veuillez entrer votre adresse email.');
      return false;
    }
    
    if (!formData.password) {
      setError('Veuillez entrer votre mot de passe.');
      return false;
    }
    
    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
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
    
    // Validation
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      // Rediriger vers la page d'origine ou l'accueil
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue lors de la connexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== RENDU ====================

  return (
    // <!-- Page de connexion - Fond gris clair -->
    <div className="auth-page">
      <div className="auth-container">
        
        {/* <!-- Card de connexion --> */}
        <div className="auth-card">
          
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
            <h1 className="auth-title">Connexion</h1>
            <p className="auth-subtitle">
              Accédez à votre espace d'apprentissage
            </p>
          </div>

          {/* <!-- Message d'erreur --> */}
          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* <!-- Formulaire --> */}
          <form onSubmit={handleSubmit} className="auth-form">
            
            {/* <!-- Champ Email --> */}
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
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="exemple@email.com"
                  className="auth-input"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* <!-- Champ Mot de passe --> */}
            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Mot de passe
              </label>
              <div className="auth-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="auth-input-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
                  <path strokeWidth="2" d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Votre mot de passe"
                  className="auth-input"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                {/* Bouton afficher/masquer */}
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* <!-- Lien mot de passe oublié --> */}
            <div className="auth-forgot">
              <Link to="/mot-de-passe-oublie" className="auth-forgot-link">
                Mot de passe oublié ?
              </Link>
            </div>

            {/* <!-- Bouton de connexion --> */}
            <button
              type="submit"
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="auth-button-spinner"></span>
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* <!-- Séparateur --> */}
          <div className="auth-divider">
            <span>ou</span>
          </div>

          {/* <!-- Lien vers inscription --> */}
          <p className="auth-switch">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="auth-switch-link">
              Créer un compte
            </Link>
          </p>
        </div>

        {/* <!-- Message de bienvenue --> */}
        <div className="auth-welcome">
          <h2>Bienvenue sur PedaClic !</h2>
          <p>L'école en un clic - Accédez à des milliers de cours, exercices et quiz.</p>
          <ul className="auth-features">
            <li>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Cours du programme sénégalais
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Exercices interactifs
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Quiz pour tester vos connaissances
            </li>
            <li>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Suivi de progression
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
