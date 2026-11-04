/**
 * ============================================
 * LAYOUT PEDACLIC - Wrapper Principal
 * ============================================
 * 
 * Composant Layout qui enveloppe toutes les pages avec :
 * - Header fixe en haut
 * - Contenu principal (children)
 * - Footer en bas
 * 
 * Utilise flexbox pour s'assurer que le footer
 * reste toujours en bas de page, même si le contenu est court.
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import './Layout.css';

/* ==================== INTERFACE ==================== */

interface LayoutProps {
  /** Contenu de la page */
  children: ReactNode;
  /** Masquer le Header (optionnel) */
  hideHeader?: boolean;
  /** Masquer le Footer (optionnel) */
  hideFooter?: boolean;
  /** Classe CSS additionnelle pour le main (optionnel) */
  className?: string;
}

/* ==================== COMPOSANT LAYOUT ==================== */

const Layout: React.FC<LayoutProps> = ({
  children,
  hideHeader = false,
  hideFooter = false,
  className = ''
}) => {
  const location = useLocation();

  /* Pied de page escamotable (confort de lecture).
     Choix mémorisé sur l'appareil ; lecture protégée (navigation privée). */
  const [footerMasque, setFooterMasque] = useState<boolean>(() => {
    try { return localStorage.getItem('pedaclic.footerMasque') === '1'; } catch { return false; }
  });
  const basculerFooter = () => {
    setFooterMasque(m => {
      try { localStorage.setItem('pedaclic.footerMasque', m ? '0' : '1'); } catch { /* indisponible */ }
      return !m;
    });
  };

  return (
    <div className="layout">
      {/* ===== SKIP TO CONTENT (Accessibilité) ===== */}
      <a href="#main-content" className="skip-to-content">
        Passer au contenu principal
      </a>

      {/* ===== HEADER ===== */}
      {!hideHeader && <Header />}

      {/* ===== CONTENU PRINCIPAL ===== */}
      <main
        id="main-content"
        key={location.pathname}
        className={`layout__main page-enter ${!hideHeader ? 'layout__main--with-header' : ''} ${className}`}
      >
        {children}
      </main>

      {/* ===== FOOTER (escamotable) ===== */}
      {!hideFooter && (
        <>
          {/* Barre fine avec le bouton Masquer / Afficher */}
          <div className={`layout__footer-toggle ${footerMasque ? 'layout__footer-toggle--masque' : ''}`}>
            <button
              type="button"
              onClick={basculerFooter}
              aria-expanded={!footerMasque}
              aria-controls="pied-de-page"
            >
              {footerMasque ? '▴ Afficher le pied de page' : '▾ Masquer le pied de page'}
            </button>
          </div>
          {!footerMasque && <div id="pied-de-page"><Footer /></div>}
        </>
      )}
    </div>
  );
};

export default Layout;
