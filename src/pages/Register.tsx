/**
 * ============================================
 * PAGE REGISTER - Inscription PedaClic
 * ============================================
 */

import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, 
  User, GraduationCap 
} from 'lucide-react';
import { useAuth, UserRole } from '../hooks/useAuth';
import './Auth.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();

  // États du formulaire
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'eleve' as UserRole
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Mise à jour des champs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // Validations
    if (!formData.displayName || !formData.email || !formData.password) {
      setLocalError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        role: formData.role
      });
      navigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-page">
      <div className="auth-page__card auth-page__card--wide">
        {/* En-tête */}
        <div className="auth-page__header">
          <UserPlus size={40} className="auth-page__icon" />
          <h1>Inscription</h1>
          <p>Créez votre compte PedaClic gratuit</p>
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
          {/* Nom complet */}
          <div className="auth-page__field">
            <label htmlFor="displayName">
              <User size={16} />
              Nom complet *
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Prénom Nom"
              disabled={isSubmitting}
              autoComplete="name"
            />
          </div>

          {/* Email */}
          <div className="auth-page__field">
            <label htmlFor="email">
              <Mail size={16} />
              Adresse email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="exemple@email.com"
              disabled={isSubmitting}
              autoComplete="email"
            />
          </div>

          {/* Rôle */}
          <div className="auth-page__field">
            <label htmlFor="role">
              <GraduationCap size={16} />
              Je suis *
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={isSubmitting}
            >
              <option value="eleve">Un élève</option>
              <option value="prof">Un professeur</option>
            </select>
          </div>

          {/* Mot de passe */}
          <div className="auth-page__field">
            <label htmlFor="password">
              <Lock size={16} />
              Mot de passe *
            </label>
            <div className="auth-page__password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 caractères"
                disabled={isSubmitting}
                autoComplete="new-password"
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

          {/* Confirmation mot de passe */}
          <div className="auth-page__field">
            <label htmlFor="confirmPassword">
              <Lock size={16} />
              Confirmer le mot de passe *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Répétez le mot de passe"
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          {/* Bouton submit */}
          <button
            type="submit"
            className="auth-page__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        {/* Lien connexion */}
        <p className="auth-page__footer">
          Déjà un compte ?{' '}
          <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
