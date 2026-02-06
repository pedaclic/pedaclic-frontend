/**
 * REGISTER PAGE - Page d'inscription PedaClic
 * 
 * Fonctionnalités :
 * - Formulaire complet (nom, email, mot de passe, rôle)
 * - Validation des champs
 * - Choix du rôle (élève ou professeur)
 * - Messages d'erreur en français
 * - Redirection après inscription
 * 
 * Design : Cards blanches sur fond gris clair
 */

import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole, RegisterFormData } from '../../types';
import '../styles/auth.css';

/**
 * Composant RegisterPage
 */
const RegisterPage: React.FC = () => {
  // ==================== HOOKS ====================
  const { register } = useAuth();
  const navigate = useNavigate();

  // ==================== ÉTATS ====================
  
  // État du formulaire
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'eleve' as UserRole
  });
  
  // État de chargement
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // État d'erreur
  const [error, setError] = useState<string>('');
  
  // Afficher/masquer les mots de passe
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  
  // Acceptation des CGU
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);

  // ==================== HANDLERS ====================

  /**
   * Gère les changements dans les champs du formulaire
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  /**
   * Valide le formulaire avant soumission
   */
  const validateForm = (): boolean => {
    // Validation du nom
    if (!formData.displayName.trim()) {
      setError('Veuillez entrer votre nom complet.');
      return false;
    }
    
    if (formData.displayName.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères.');
      return false;
    }
    
    // Validation email
    if (!formData.email.trim()) {
      setError('Veuillez entrer votre adresse email.');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Veuillez entrer une adresse email valide.');
      return false;
    }
    
    // Validation mot de passe
    if (!formData.password) {
      setError('Veuillez entrer un mot de passe.');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }
    
    // Validation confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return false;
    }
    
    // Validation CGU
    if (!acceptTerms) {
      setError('Veuillez accepter les conditions d\'utilisation.');
      return false;
    }
    
    return true;
  };

  /**
   * Gère la soumission du formulaire
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');

    try {
      await register(formData);
      // Rediriger vers la page d'accueil ou le tableau de bord
      navigate('/disciplines', { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue lors de l\'inscription.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== RENDU ====================

  return (
    // <!-- Page d'inscription - Fond gris clair -->
    <div className="auth-page">
      <div className="auth-container">
        
        {/* <!-- Card d'inscription --> */}
        <div className="auth-card auth-card--register">
          
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
            <h1 className="auth-title">Créer un compte</h1>
            <p className="auth-subtitle">
              Rejoignez PedaClic et commencez à apprendre
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
            
            {/* <!-- Champ Nom complet --> */}
            <div className="auth-field">
              <label htmlFor="displayName" className="auth-label">
                Nom complet
              </label>
              <div className="auth-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="auth-input-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Amadou Diallo"
                  className="auth-input"
                  autoComplete="name"
                  disabled={isLoading}
                />
              </div>
            </div>

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

            {/* <!-- Sélection du rôle --> */}
            <div className="auth-field">
              <label className="auth-label">Je suis :</label>
              <div className="auth-role-selector">
                {/* Option Élève */}
                <label className={`auth-role-option ${formData.role === 'eleve' ? 'auth-role-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="eleve"
                    checked={formData.role === 'eleve'}
                    onChange={handleChange}
                    className="auth-role-input"
                    disabled={isLoading}
                  />
                  <div className="auth-role-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                    </svg>
                    <span>Élève</span>
                  </div>
                </label>

                {/* Option Professeur */}
                <label className={`auth-role-option ${formData.role === 'prof' ? 'auth-role-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="prof"
                    checked={formData.role === 'prof'}
                    onChange={handleChange}
                    className="auth-role-input"
                    disabled={isLoading}
                  />
                  <div className="auth-role-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    <span>Professeur</span>
                  </div>
                </label>

                {/* Option Parent */}
                <label className={`auth-role-option ${formData.role === 'parent' ? 'auth-role-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="parent"
                    checked={formData.role === 'parent'}
                    onChange={handleChange}
                    className="auth-role-input"
                    disabled={isLoading}
                  />
                  <div className="auth-role-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span>Parent d'élève</span>
                  </div>
                </label>
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
                  placeholder="Minimum 6 caractères"
                  className="auth-input"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
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
              <p className="auth-hint">
                Au moins 6 caractères avec des lettres et des chiffres
              </p>
            </div>

            {/* <!-- Champ Confirmation mot de passe --> */}
            <div className="auth-field">
              <label htmlFor="confirmPassword" className="auth-label">
                Confirmer le mot de passe
              </label>
              <div className="auth-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="auth-input-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Retapez votre mot de passe"
                  className="auth-input"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                >
                  {showConfirmPassword ? (
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

            {/* <!-- Acceptation CGU --> */}
            <div className="auth-checkbox-field">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="auth-checkbox"
                  disabled={isLoading}
                />
                <span className="auth-checkbox-custom"></span>
                <span>
                  J'accepte les{' '}
                  <Link to="/cgu" target="_blank" className="auth-link">
                    conditions d'utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link to="/confidentialite" target="_blank" className="auth-link">
                    politique de confidentialité
                  </Link>
                </span>
              </label>
            </div>

            {/* <!-- Bouton d'inscription --> */}
            <button
              type="submit"
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="auth-button-spinner"></span>
                  Création du compte...
                </>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          {/* <!-- Séparateur --> */}
          <div className="auth-divider">
            <span>ou</span>
          </div>

          {/* <!-- Lien vers connexion --> */}
          <p className="auth-switch">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="auth-switch-link">
              Se connecter
            </Link>
          </p>
        </div>

        {/* <!-- Avantages inscription --> */}
        <div className="auth-welcome auth-welcome--register">
          <h2>Rejoignez la communauté PedaClic</h2>
          <p>Des milliers d'élèves et professeurs sénégalais nous font déjà confiance.</p>
          
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-number">10 000+</span>
              <span className="auth-stat-label">Élèves inscrits</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-number">500+</span>
              <span className="auth-stat-label">Cours disponibles</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-number">95%</span>
              <span className="auth-stat-label">Taux de satisfaction</span>
            </div>
          </div>
          
          <div className="auth-testimonial">
            <p className="auth-testimonial-text">
              "Grâce à PedaClic, j'ai amélioré mes notes en mathématiques de 4 points !"
            </p>
            <p className="auth-testimonial-author">
              — Fatou N., élève de 3ème à Dakar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
