/**
 * ============================================
 * PAGE LOGIN - Connexion PedaClic
 * ============================================
 */
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Auth.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const clearError = () => setError(null);

  // États du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Soumission du formulaire
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // Validation basique
    if (!email || !password) {
      setLocalError('Veuillez remplir tous les champs.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        {/* En-tête */}
        <div className="auth-page__header">
          <LogIn size={40} className="auth-page__icon" />
          <h1>Connexion</h1>
          <p>Accédez à votre espace PedaClic</p>
        </div>

        {/* Erreur */}
        {displayError && (
          <div className="auth-page__error">
            <AlertCircle size={18} />
            <span>{displayError}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="auth-page__form">
          {/* Email */}
          <div className="auth-page__field">
            <label htmlFor="email">
              <Mail size={16} />
              Adresse email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              disabled={isSubmitting}
              autoComplete="email"
            />
          </div>

          {/* Mot de passe */}
          <div className="auth-page__field">
            <label htmlFor="password">
              <Lock size={16} />
              Mot de passe
            </label>
            <div className="auth-page__password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-page__password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Bouton submit */}
          <button
            type="submit"
            className="auth-page__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Lien inscription */}
        <p className="auth-page__footer">
          Pas encore de compte ?{' '}
          <Link to="/inscription">S'inscrire</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
