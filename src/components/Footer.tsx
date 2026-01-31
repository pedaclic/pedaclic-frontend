/**
 * ============================================
 * FOOTER PEDACLIC - Pied de Page
 * ============================================
 * 
 * Footer responsive avec :
 * - 4 colonnes d'informations
 * - Liens de navigation rapide
 * - Informations de contact
 * - Réseaux sociaux
 * - Copyright et mentions légales
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { Link } from 'react-router-dom';
import { 
  GraduationCap,
  Mail, 
  Phone, 
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  ExternalLink,
  Heart,
  BookOpen,
  Users,
  HelpCircle,
  FileText,
  Shield
} from 'lucide-react';
import './Footer.css';

/* ==================== INTERFACES ==================== */

/**
 * Interface pour un lien du footer
 */
interface FooterLink {
  label: string;
  path: string;
  external?: boolean;
}

/**
 * Interface pour un réseau social
 */
interface SocialLink {
  name: string;
  url: string;
  icon: React.ReactNode;
}

/* ==================== COMPOSANT FOOTER ==================== */

const Footer: React.FC = () => {
  // Année courante pour le copyright
  const currentYear = new Date().getFullYear();

  /* ==================== DONNÉES DE CONFIGURATION ==================== */

  /**
   * Liens de navigation - Section Plateforme
   */
  const platformLinks: FooterLink[] = [
    { label: 'Accueil', path: '/' },
    { label: 'Disciplines', path: '/disciplines' },
    { label: 'Quiz Premium', path: '/quiz' },
    { label: 'Tarifs', path: '/premium' },
    { label: 'Tableau de bord', path: '/dashboard' }
  ];

  /**
   * Liens de navigation - Section Ressources
   */
  const resourceLinks: FooterLink[] = [
    { label: 'Cours en ligne', path: '/disciplines' },
    { label: 'Exercices corrigés', path: '/disciplines' },
    { label: 'Annales d\'examens', path: '/disciplines' },
    { label: 'Fiches de révision', path: '/disciplines' },
    { label: 'Guide d\'utilisation', path: '/guide', external: false }
  ];

  /**
   * Liens de navigation - Section À propos
   */
  const aboutLinks: FooterLink[] = [
    { label: 'Qui sommes-nous ?', path: '/a-propos' },
    { label: 'Mentions légales', path: '/mentions-legales' },
    { label: 'Politique de confidentialité', path: '/confidentialite' },
    { label: 'Conditions d\'utilisation', path: '/cgu' },
    { label: 'Contact', path: '/contact' }
  ];

  /**
   * Réseaux sociaux
   */
  const socialLinks: SocialLink[] = [
    {
      name: 'Facebook',
      url: 'https://facebook.com/pedaclic',
      icon: <Facebook size={20} />
    },
    {
      name: 'Twitter',
      url: 'https://twitter.com/pedaclic',
      icon: <Twitter size={20} />
    },
    {
      name: 'Instagram',
      url: 'https://instagram.com/pedaclic',
      icon: <Instagram size={20} />
    },
    {
      name: 'LinkedIn',
      url: 'https://linkedin.com/company/pedaclic',
      icon: <Linkedin size={20} />
    },
    {
      name: 'YouTube',
      url: 'https://youtube.com/@pedaclic',
      icon: <Youtube size={20} />
    }
  ];

  /**
   * Informations de contact
   */
  const contactInfo = {
    email: 'contact@pedaclic.sn',
    phone: '+221 77 000 00 00',
    address: 'Dakar, Sénégal'
  };

  /* ==================== HELPERS ==================== */

  /**
   * Rendu d'un lien (interne ou externe)
   */
  const renderLink = (link: FooterLink) => {
    if (link.external) {
      return (
        <a 
          href={link.path}
          target="_blank"
          rel="noopener noreferrer"
          className="footer__link"
        >
          {link.label}
          <ExternalLink size={12} className="footer__external-icon" />
        </a>
      );
    }
    return (
      <Link to={link.path} className="footer__link">
        {link.label}
      </Link>
    );
  };

  /* ==================== RENDU ==================== */

  return (
    <footer className="footer">
      {/* ===== SECTION PRINCIPALE ===== */}
      <div className="footer__main">
        <div className="footer__container">
          
          {/* ----- COLONNE 1 : À PROPOS ----- */}
          <div className="footer__column footer__column--about">
            {/* Logo */}
            <Link to="/" className="footer__logo">
              <GraduationCap className="footer__logo-icon" size={36} />
              <div className="footer__logo-text">
                <span className="footer__logo-name">PedaClic</span>
                <span className="footer__logo-tagline">L'école en un clic</span>
              </div>
            </Link>
            
            {/* Description */}
            <p className="footer__description">
              PedaClic est la plateforme éducative de référence au Sénégal. 
              Nous accompagnons les élèves du collège au lycée avec des cours, 
              exercices et quiz de qualité, conçus par des enseignants sénégalais.
            </p>

            {/* Statistiques rapides */}
            <div className="footer__stats">
              <div className="footer__stat">
                <BookOpen size={18} />
                <span>500+ cours</span>
              </div>
              <div className="footer__stat">
                <Users size={18} />
                <span>10 000+ élèves</span>
              </div>
            </div>
          </div>

          {/* ----- COLONNE 2 : PLATEFORME ----- */}
          <div className="footer__column">
            <h3 className="footer__title">
              <span className="footer__title-icon">📚</span>
              Plateforme
            </h3>
            <nav className="footer__nav">
              <ul className="footer__list">
                {platformLinks.map((link, index) => (
                  <li key={index} className="footer__item">
                    {renderLink(link)}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* ----- COLONNE 3 : RESSOURCES ----- */}
          <div className="footer__column">
            <h3 className="footer__title">
              <span className="footer__title-icon">📖</span>
              Ressources
            </h3>
            <nav className="footer__nav">
              <ul className="footer__list">
                {resourceLinks.map((link, index) => (
                  <li key={index} className="footer__item">
                    {renderLink(link)}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* ----- COLONNE 4 : CONTACT ----- */}
          <div className="footer__column">
            <h3 className="footer__title">
              <span className="footer__title-icon">📞</span>
              Contact
            </h3>
            
            {/* Informations de contact */}
            <div className="footer__contact">
              <a 
                href={`mailto:${contactInfo.email}`} 
                className="footer__contact-item"
              >
                <Mail size={16} className="footer__contact-icon" />
                <span>{contactInfo.email}</span>
              </a>
              
              <a 
                href={`tel:${contactInfo.phone.replace(/\s/g, '')}`}
                className="footer__contact-item"
              >
                <Phone size={16} className="footer__contact-icon" />
                <span>{contactInfo.phone}</span>
              </a>
              
              <div className="footer__contact-item">
                <MapPin size={16} className="footer__contact-icon" />
                <span>{contactInfo.address}</span>
              </div>
            </div>

            {/* Réseaux sociaux */}
            <div className="footer__social">
              <h4 className="footer__social-title">Suivez-nous</h4>
              <div className="footer__social-links">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer__social-link"
                    aria-label={`Suivez-nous sur ${social.name}`}
                    title={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION INFÉRIEURE ===== */}
      <div className="footer__bottom">
        <div className="footer__container footer__bottom-content">
          {/* Copyright */}
          <p className="footer__copyright">
            © {currentYear} PedaClic. Tous droits réservés.
          </p>

          {/* Made with love */}
          <p className="footer__made-with">
            Fait avec <Heart size={14} className="footer__heart" /> au Sénégal 🇸🇳
          </p>

          {/* Liens légaux */}
          <nav className="footer__legal">
            <Link to="/mentions-legales" className="footer__legal-link">
              <FileText size={14} />
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="footer__legal-link">
              <Shield size={14} />
              Confidentialité
            </Link>
            <Link to="/aide" className="footer__legal-link">
              <HelpCircle size={14} />
              Aide
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
