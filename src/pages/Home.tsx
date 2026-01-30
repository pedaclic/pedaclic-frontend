/**
 * Page Home - Page d'accueil PedaClic
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, Award, Users, ArrowRight } from 'lucide-react';
import './Home.css';

export const Home: React.FC = () => {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <GraduationCap size={80} className="hero-icon" />
          <h1 className="hero-title">
            PedaClic - L'école en un clic
          </h1>
          <p className="hero-description">
            Plateforme éducative sénégalaise pour les élèves de la 6ème à la Terminale
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">
              Commencer gratuitement
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn btn-outline">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2>Pourquoi choisir PedaClic ?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <BookOpen size={40} />
            <h3>Cours complets</h3>
            <p>Accédez à des cours détaillés pour tous les niveaux</p>
          </div>
          <div className="feature-card">
            <Award size={40} />
            <h3>Quiz premium</h3>
            <p>Testez vos connaissances avec nos quiz interactifs</p>
          </div>
          <div className="feature-card">
            <Users size={40} />
            <h3>Communauté</h3>
            <p>Rejoignez des milliers d'élèves sénégalais</p>
          </div>
        </div>
      </section>

      {/* Premium Section */}
      <section className="premium-cta">
        <h2>Passez au Premium</h2>
        <p>Débloquez tout le contenu pour seulement 2000 FCFA/mois</p>
        <Link to="/register" className="btn btn-primary btn-lg">
          Commencer maintenant
        </Link>
      </section>
    </div>
  );
};
