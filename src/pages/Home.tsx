/**
 * ============================================
 * PAGE HOME - Accueil PedaClic
 * ============================================
 * 
 * Page d'accueil avec :
 * - Hero section avec CTA
 * - Section fonctionnalités
 * - Section statistiques
 * - Section témoignages
 * - Section CTA Premium
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Trophy,
  CheckCircle,
  Star,
  ArrowRight,
  Play,
  Zap,
  Shield,
  Clock,
  Award
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Home.css';

/* ==================== COMPOSANT HOME ==================== */

const Home: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="home-page">
      {/* ===== HERO SECTION ===== */}
      <section className="home-page__hero">
        <div className="home-page__hero-content">
          {/* Badge */}
          <div className="home-page__hero-badge">
            <Star size={14} />
            <span>Plateforme N°1 au Sénégal</span>
          </div>

          {/* Titre principal */}
          <h1 className="home-page__hero-title">
            Réussis tes examens avec
            <span className="home-page__hero-highlight"> PedaClic</span>
          </h1>

          {/* Sous-titre */}
          <p className="home-page__hero-subtitle">
            La plateforme éducative qui accompagne les élèves sénégalais 
            du collège au lycée avec des cours, exercices et quiz de qualité.
          </p>

          {/* Boutons CTA */}
          <div className="home-page__hero-cta">
            {currentUser ? (
<Link to={currentUser.role === 'eleve' ? '/eleve/dashboard' : currentUser.role === 'prof' ? '/prof/dashboard' : currentUser.role === 'parent' ? '/parent/dashboard' : '/admin'} className="home-page__btn home-page__btn--primary">
                Accéder à mon espace
                <ArrowRight size={20} />
              </Link>
            ) : (
              <>
                <Link to="/inscription" className="home-page__btn home-page__btn--primary">
                  Commencer gratuitement
                  <ArrowRight size={20} />
                </Link>
                <Link to="/disciplines" className="home-page__btn home-page__btn--outline">
                  <Play size={18} />
                  Découvrir les cours
                </Link>
              </>
            )}
          </div>

          {/* Stats rapides */}
          <div className="home-page__hero-stats">
            <div className="home-page__hero-stat">
              <strong>10 000+</strong>
              <span>Élèves inscrits</span>
            </div>
            <div className="home-page__hero-stat">
              <strong>500+</strong>
              <span>Cours disponibles</span>
            </div>
            <div className="home-page__hero-stat">
              <strong>95%</strong>
              <span>Taux de réussite</span>
            </div>
          </div>
        </div>

        {/* Image/Illustration */}
        <div className="home-page__hero-image">
          <div className="home-page__hero-illustration">
            <GraduationCap size={120} />
            <div className="home-page__hero-floating home-page__hero-floating--1">📚</div>
            <div className="home-page__hero-floating home-page__hero-floating--2">✨</div>
            <div className="home-page__hero-floating home-page__hero-floating--3">🎓</div>
          </div>
        </div>
      </section>

      {/* ===== SECTION NIVEAUX ===== */}
      <section className="home-page__levels">
        <div className="home-page__container">
          <h2 className="home-page__section-title">
            Tous les niveaux, toutes les matières
          </h2>
          <p className="home-page__section-subtitle">
            Du collège au lycée, prépare tes examens avec confiance
          </p>

          <div className="home-page__levels-grid">
            {/* Collège */}
            <Link to="/disciplines?niveau=college" className="home-page__level-card">
              <div className="home-page__level-icon home-page__level-icon--college">
                🏫
              </div>
              <h3>Collège</h3>
              <p>6ème à 3ème</p>
              <ul>
                <li><CheckCircle size={16} /> Préparation au BFEM</li>
                <li><CheckCircle size={16} /> 9 matières disponibles</li>
                <li><CheckCircle size={16} /> Exercices corrigés</li>
              </ul>
              <span className="home-page__level-link">
                Voir les cours <ArrowRight size={16} />
              </span>
            </Link>

            {/* Lycée */}
            <Link to="/disciplines?niveau=lycee" className="home-page__level-card">
              <div className="home-page__level-icon home-page__level-icon--lycee">
                🎓
              </div>
              <h3>Lycée</h3>
              <p>2nde à Terminale</p>
              <ul>
                <li><CheckCircle size={16} /> Préparation au BAC</li>
                <li><CheckCircle size={16} /> 12 matières disponibles</li>
                <li><CheckCircle size={16} /> Annales d'examens</li>
              </ul>
              <span className="home-page__level-link">
                Voir les cours <ArrowRight size={16} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== SECTION FONCTIONNALITÉS ===== */}
      <section className="home-page__features">
        <div className="home-page__container">
          <h2 className="home-page__section-title">
            Pourquoi choisir PedaClic ?
          </h2>
          <p className="home-page__section-subtitle">
            Des outils modernes pour une éducation de qualité
          </p>

          <div className="home-page__features-grid">
            {/* Feature 1 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon">
                <BookOpen size={28} />
              </div>
              <h3>Cours complets</h3>
              <p>
                Des cours structurés et conformes au programme sénégalais, 
                rédigés par des enseignants expérimentés.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon home-page__feature-icon--secondary">
                <Zap size={28} />
              </div>
              <h3>Quiz interactifs</h3>
              <p>
                Testez vos connaissances avec des quiz adaptés à chaque niveau 
                et obtenez un feedback instantané.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon home-page__feature-icon--warning">
                <Trophy size={28} />
              </div>
              <h3>Suivi de progression</h3>
              <p>
                Visualisez vos progrès et identifiez vos points faibles 
                pour cibler vos révisions.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon home-page__feature-icon--success">
                <Shield size={28} />
              </div>
              <h3>Contenu vérifié</h3>
              <p>
                Tous nos contenus sont validés par des professeurs certifiés 
                pour garantir leur qualité.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon home-page__feature-icon--info">
                <Clock size={28} />
              </div>
              <h3>Accessible 24/7</h3>
              <p>
                Étudiez à votre rythme, où que vous soyez, 
                sur ordinateur, tablette ou smartphone.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="home-page__feature-card">
              <div className="home-page__feature-icon home-page__feature-icon--premium">
                <Award size={28} />
              </div>
              <h3>Certificats</h3>
              <p>
                Obtenez des certificats de réussite pour valoriser 
                vos compétences acquises.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION CTA PREMIUM ===== */}
      <section className="home-page__premium">
        <div className="home-page__container">
          <div className="home-page__premium-content">
            <div className="home-page__premium-text">
              <span className="home-page__premium-badge">⭐ Premium</span>
              <h2>Passez à la vitesse supérieure</h2>
              <p>
                Accédez à tous les quiz, exercices corrigés et ressources 
                exclusives pour seulement <strong>2 000 FCFA/mois</strong>.
              </p>
              <ul className="home-page__premium-features">
                <li><CheckCircle size={18} /> Quiz illimités dans toutes les matières</li>
                <li><CheckCircle size={18} /> Corrections détaillées des exercices</li>
                <li><CheckCircle size={18} /> Annales des examens (BFEM, BAC)</li>
                <li><CheckCircle size={18} /> Support prioritaire</li>
              </ul>
              <Link to="/premium" className="home-page__btn home-page__btn--premium">
                Découvrir Premium
                <ArrowRight size={20} />
              </Link>
            </div>
            <div className="home-page__premium-pricing">
              <div className="home-page__pricing-card">
                <span className="home-page__pricing-popular">Plus populaire</span>
                <h3>Accès illimité 6 mois</h3>
                <div className="home-page__pricing-price">
                  <span className="home-page__pricing-amount">20 000</span>
                  <span className="home-page__pricing-currency">FCFA</span>
                  <span className="home-page__pricing-period">/6 mois</span>
                </div>
                <p className="home-page__pricing-save">
                  Économisez 10 000 FCFA vs 2×3 mois
                </p>
                <Link to="/premium" className="home-page__btn home-page__btn--primary home-page__btn--block">
                  Choisir ce plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION TÉMOIGNAGES ===== */}
      <section className="home-page__testimonials">
        <div className="home-page__container">
          <h2 className="home-page__section-title">
            Ce qu'en disent nos élèves
          </h2>
          
          <div className="home-page__testimonials-grid">
            {/* Témoignage 1 */}
            <div className="home-page__testimonial-card">
              <div className="home-page__testimonial-stars">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
              </div>
              <p className="home-page__testimonial-text">
                "Grâce à PedaClic, j'ai obtenu mon BFEM avec mention. 
                Les quiz m'ont vraiment aidé à me préparer !"
              </p>
              <div className="home-page__testimonial-author">
                <div className="home-page__testimonial-avatar">FA</div>
                <div>
                  <strong>Fatou Aïdara</strong>
                  <span>Élève en 3ème - Dakar</span>
                </div>
              </div>
            </div>

            {/* Témoignage 2 */}
            <div className="home-page__testimonial-card">
              <div className="home-page__testimonial-stars">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
              </div>
              <p className="home-page__testimonial-text">
                "Les cours de maths sont très bien expliqués. 
                J'ai enfin compris les équations du second degré !"
              </p>
              <div className="home-page__testimonial-author">
                <div className="home-page__testimonial-avatar">MD</div>
                <div>
                  <strong>Moussa Diallo</strong>
                  <span>Élève en Terminale S - Thiès</span>
                </div>
              </div>
            </div>

            {/* Témoignage 3 */}
            <div className="home-page__testimonial-card">
              <div className="home-page__testimonial-stars">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
              </div>
              <p className="home-page__testimonial-text">
                "Je recommande PedaClic à tous les parents. 
                Ma fille a beaucoup progressé depuis qu'elle l'utilise."
              </p>
              <div className="home-page__testimonial-author">
                <div className="home-page__testimonial-avatar">AN</div>
                <div>
                  <strong>Aminata Ndiaye</strong>
                  <span>Parent d'élève - Saint-Louis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION CTA FINAL ===== */}
      <section className="home-page__final-cta">
        <div className="home-page__container">
          <h2>Prêt à réussir ?</h2>
          <p>Rejoignez les milliers d'élèves qui font confiance à PedaClic</p>
          {!currentUser && (
            <Link to="/inscription" className="home-page__btn home-page__btn--large">
              Créer mon compte gratuit
              <ArrowRight size={24} />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
