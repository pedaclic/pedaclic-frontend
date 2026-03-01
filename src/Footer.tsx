/**
 * FOOTER - Pied de page PedaClic
 * 
 * Fonctionnalités :
 * - Logo et description courte
 * - Liens de navigation rapide
 * - Liens légaux (CGU, Mentions légales)
 * - Réseaux sociaux
 * - Copyright
 * 
 * Design : Fond gris foncé (#1f2937) - Style professionnel
 */

import { Link } from 'react-router-dom';
import './Footer.css';

/**
 * Composant Footer principal
 * Affiché en bas de toutes les pages
 */
const Footer: React.FC = () => {
  // Année actuelle pour le copyright
  const currentYear = new Date().getFullYear();

  return (
    // <!-- Conteneur principal du footer - Fond gris foncé -->
    <footer className="footer">
      {/* <!-- Container principal avec grille --> */}
      <div className="footer__container">
        
        {/* <!-- SECTION 1 : Logo et Description --> */}
        <div className="footer__brand">
          {/* Logo PedaClic */}
          <Link to="/" className="footer__logo">
            <div className="footer__logo-icon">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="footer__logo-text">PedaClic</span>
          </Link>

          {/* Slogan et description */}
          <p className="footer__tagline">L'école en un clic</p>
          <p className="footer__description">
            Plateforme éducative sénégalaise offrant des cours, exercices et quiz 
            interactifs pour les élèves de la 6ème à la Terminale.
          </p>

          {/* Réseaux sociaux */}
          <div className="footer__social">
            {/* Facebook */}
            <a 
              href="https://facebook.com/pedaclic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer__social-link"
              aria-label="Suivez-nous sur Facebook"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>

            {/* Twitter / X */}
            <a 
              href="https://twitter.com/pedaclic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer__social-link"
              aria-label="Suivez-nous sur Twitter"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            {/* LinkedIn */}
            <a 
              href="https://linkedin.com/company/pedaclic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer__social-link"
              aria-label="Suivez-nous sur LinkedIn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>

            {/* YouTube */}
            <a 
              href="https://youtube.com/@pedaclic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer__social-link"
              aria-label="Suivez-nous sur YouTube"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>

            {/* WhatsApp */}
            <a 
              href="https://wa.me/221770000000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer__social-link footer__social-link--whatsapp"
              aria-label="Contactez-nous sur WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* <!-- SECTION 2 : Liens de navigation --> */}
        <div className="footer__links">
          <h4 className="footer__title">Navigation</h4>
          <ul className="footer__list">
            <li>
              <Link to="/" className="footer__link">Accueil</Link>
            </li>
            <li>
              <Link to="/disciplines" className="footer__link">Disciplines</Link>
            </li>
            <li>
              <Link to="/cours" className="footer__link footer__link--highlight">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', color: '#f59e0b' }}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                </svg>
                Cours en ligne
                <span style={{
                  display: 'inline-block',
                  marginLeft: '6px',
                  padding: '1px 6px',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                  lineHeight: '1.6',
                  verticalAlign: 'middle',
                }}>
                  Nouveau
                </span>
              </Link>
            </li>
            <li>
              <Link to="/premium" className="footer__link">Premium</Link>
            </li>
            <li>
              <Link to="/connexion" className="footer__link">Connexion</Link>
            </li>
            <li>
              <Link to="/inscription" className="footer__link">Inscription</Link>
            </li>
          </ul>
        </div>

        {/* <!-- SECTION 3 : Niveaux scolaires --> */}
        <div className="footer__links">
          <h4 className="footer__title">Niveaux</h4>
          <ul className="footer__list">
            <li>
              <Link to="/disciplines?niveau=college&classe=6ème" className="footer__link">
                6ème
              </Link>
            </li>
            <li>
              <Link to="/disciplines?niveau=college&classe=5ème" className="footer__link">
                5ème
              </Link>
            </li>
            <li>
              <Link to="/disciplines?niveau=college&classe=4ème" className="footer__link">
                4ème
              </Link>
            </li>
            <li>
              <Link to="/disciplines?niveau=college&classe=3ème" className="footer__link">
                3ème
              </Link>
            </li>
            <li>
              <Link to="/disciplines?niveau=lycee" className="footer__link">
                Lycée (2nde - Tle)
              </Link>
            </li>
          </ul>
        </div>

        {/* <!-- SECTION 4 : Liens légaux et contact --> */}
        <div className="footer__links">
          <h4 className="footer__title">À propos</h4>
          <ul className="footer__list">
            <li>
              <Link to="/a-propos" className="footer__link">Qui sommes-nous ?</Link>
            </li>
            <li>
              <Link to="/contact" className="footer__link">Nous contacter</Link>
            </li>
            <li>
              <Link to="/faq" className="footer__link">FAQ</Link>
            </li>
            <li>
              <Link to="/cgu" className="footer__link">Conditions d'utilisation</Link>
            </li>
            <li>
              <Link to="/confidentialite" className="footer__link">Politique de confidentialité</Link>
            </li>
          </ul>
        </div>
      </div>

      {/* <!-- SECTION NEWSLETTER (optionnelle) --> */}
      <div className="footer__newsletter">
        <div className="footer__newsletter-container">
          <div className="footer__newsletter-content">
            <h4 className="footer__newsletter-title">
              Restez informé
            </h4>
            <p className="footer__newsletter-text">
              Recevez nos actualités et nouveaux cours directement dans votre boîte mail.
            </p>
          </div>
          <form className="footer__newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="email" 
              placeholder="Votre adresse email"
              className="footer__newsletter-input"
              aria-label="Adresse email pour la newsletter"
            />
            <button type="submit" className="footer__newsletter-btn">
              S'abonner
            </button>
          </form>
        </div>
      </div>

      {/* <!-- BARRE DE COPYRIGHT --> */}
      <div className="footer__bottom">
        <div className="footer__bottom-container">
          <p className="footer__copyright">
            © {currentYear} PedaClic. Tous droits réservés.
          </p>
          <p className="footer__made-in">
            Fait avec <span className="footer__heart">❤️</span> au Sénégal 🇸🇳
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
