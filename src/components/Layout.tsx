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

import { ReactNode } from 'react';
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
  return (
    <div className="layout">
      {/* ===== HEADER ===== */}
      {!hideHeader && <Header />}

      {/* ===== CONTENU PRINCIPAL ===== */}
      <main className={`layout__main ${!hideHeader ? 'layout__main--with-header' : ''} ${className}`}>
        {children}
      </main>

      {/* ===== FOOTER ===== */}
      {!hideFooter && <Footer />}
    </div>
  );
};

export default Layout;
