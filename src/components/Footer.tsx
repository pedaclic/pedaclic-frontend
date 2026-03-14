import { Link } from 'react-router-dom';
import { GraduationCap, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Youtube, Heart, BookOpen, Users, FileText, Scale, Shield, HelpCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Footer.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { currentUser } = useAuth();

  // Résout la route du tableau de bord selon le rôle de l'utilisateur connecté.
  // Non connecté → page de connexion avec redirection post-login.
  const getDashboardPath = (): string => {
    if (!currentUser) return '/connexion';
    switch (currentUser.role) {
      case 'eleve':  return '/eleve/dashboard';
      case 'prof':   return '/prof/dashboard';
      case 'parent': return '/parent/dashboard';
      case 'admin':  return '/admin';
      default:       return '/connexion';
    }
  };

  const platformLinks = [
    { label: 'Accueil', path: '/' },
    { label: 'Disciplines', path: '/disciplines' },
    { label: 'Quiz Avancés', path: '/quizzes' },
    { label: 'Tarifs', path: '/premium' },
    { label: 'Tableau de bord', path: getDashboardPath() }
  ];

  const resourceLinks = [
    { label: 'Cours en ligne', path: '/cours', badge: 'Nouveau', icon: <PlayCircle size={14} /> },
    { label: 'Exercices corrigés', path: '/disciplines' },
    { label: 'Annales examens', path: '/disciplines' },
    { label: 'Fiches de révision', path: '/disciplines' }
  ];

  const socialLinks = [
    { name: 'Facebook', url: 'https://facebook.com/pedaclic', icon: <Facebook size={20} /> },
    { name: 'Twitter', url: 'https://twitter.com/pedaclic', icon: <Twitter size={20} /> },
    { name: 'Instagram', url: 'https://instagram.com/pedaclic', icon: <Instagram size={20} /> },
    { name: 'LinkedIn', url: 'https://linkedin.com/company/pedaclic', icon: <Linkedin size={20} /> },
    { name: 'YouTube', url: 'https://youtube.com/@pedaclic', icon: <Youtube size={20} /> }
  ];

  return (
    <footer className="footer">
      <div className="footer__main">
        <div className="footer__container">
          <div className="footer__column footer__column--about">
            <Link to="/" className="footer__logo">
              <GraduationCap className="footer__logo-icon" size={36} />
              <div className="footer__logo-text">
                <span className="footer__logo-name">PedaClic</span>
                <span className="footer__logo-tagline">L'école en un clic</span>
              </div>
            </Link>
            <p className="footer__description">
              PedaClic est la plateforme éducative de référence au Sénégal. Nous accompagnons les élèves du collège au lycée avec des cours, exercices et quiz de qualité.
            </p>
            <div className="footer__stats">
              <div className="footer__stat"><BookOpen size={18} /><span>500+ cours</span></div>
              <div className="footer__stat"><Users size={18} /><span>10 000+ élèves</span></div>
            </div>
          </div>

          <div className="footer__column">
            <h3 className="footer__title"><span className="footer__title-icon">📚</span>Plateforme</h3>
            <nav className="footer__nav">
              <ul className="footer__list">
                {platformLinks.map((link, index) => (
                  <li key={index} className="footer__item">
                    <Link to={link.path} className="footer__link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="footer__column">
            <h3 className="footer__title"><span className="footer__title-icon">📖</span>Ressources</h3>
            <nav className="footer__nav">
              <ul className="footer__list">
                {resourceLinks.map((link, index) => (
                  <li key={index} className="footer__item">
                    <Link
                      to={link.path}
                      className={`footer__link${link.badge ? ' footer__link--new' : ''}`}
                    >
                      {link.icon && <span className="footer__link-icon">{link.icon}</span>}
                      {link.label}
                      {link.badge && <span className="footer__badge">{link.badge}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="footer__column">
            <h3 className="footer__title"><span className="footer__title-icon">📞</span>Contact</h3>
            <div className="footer__contact">
              <a href="mailto:contact@pedaclic.sn" className="footer__contact-item">
                <Mail size={16} className="footer__contact-icon" /><span>contact@pedaclic.sn</span>
              </a>
              <a href="tel:+221788732222" className="footer__contact-item">
                <Phone size={16} className="footer__contact-icon" /><span>78 873 22 22</span>
              </a>
              <div className="footer__contact-item">
                <MapPin size={16} className="footer__contact-icon" /><span>Dakar, Sénégal</span>
              </div>
            </div>
            <div className="footer__social">
              <h4 className="footer__social-title">Suivez-nous</h4>
              <div className="footer__social-links">
                {socialLinks.map((social, index) => (
                  <a key={index} href={social.url} target="_blank" rel="noopener noreferrer" className="footer__social-link" title={social.name}>
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="footer__container footer__bottom-content">
          <p className="footer__copyright">© {currentYear} PedaClic. Tous droits réservés.</p>
          <p className="footer__made-with">Fait avec <Heart size={14} className="footer__heart" /> au Sénégal 🇸🇳</p>
          <nav className="footer__legal">
            <Link to="/mentions-legales" className="footer__legal-link"><FileText size={14} /> Mentions légales</Link>
            <Link to="/cgu" className="footer__legal-link"><Scale size={14} /> CGU</Link>
            <Link to="/confidentialite" className="footer__legal-link"><Shield size={14} /> Confidentialité</Link>
            <Link to="/aide" className="footer__legal-link"><HelpCircle size={14} /> Aide</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
