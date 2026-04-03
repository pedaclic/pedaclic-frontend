import React from 'react';
import { Link } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────
interface BreadcrumbItem {
  label: string;   // Texte affiché
  path?: string;   // Lien (optionnel — dernier élément sans lien)
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

// ── Composant Breadcrumbs ──────────────────────────────────────────────────
// Affiche un fil d'Ariane : Séquences > Ma Séquence
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Fil d'Ariane" className={`flex items-center gap-1 text-sm text-gray-500 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {/* Séparateur entre les items */}
            {index > 0 && (
              <span className="text-gray-300 mx-1" aria-hidden="true">/</span>
            )}
            {/* Lien cliquable ou texte simple pour le dernier item */}
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="hover:text-blue-600 transition-colors duration-150"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-gray-800 font-medium' : ''}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
