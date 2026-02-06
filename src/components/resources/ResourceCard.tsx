/**
 * ============================================================================
 * COMPOSANT RESOURCECARD - PEDACLIC
 * ============================================================================
 * 
 * Carte d'affichage d'une ressource pédagogique individuelle.
 * Utilisée dans la liste des ressources par chapitre.
 * 
 * Modes d'affichage :
 * - Normal : carte complète avec description et métadonnées
 * - Compact : version réduite pour listes denses
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { Resource, TypeRessource } from '../../types';

// ==================== CONFIGURATION DES TYPES ====================

/**
 * Configuration visuelle pour chaque type de ressource
 */
interface TypeConfig {
  icon: string;       // Emoji ou icône
  label: string;      // Label français
  color: string;      // Couleur du texte
  bgColor: string;    // Couleur de fond
}

const TYPE_CONFIG: Record<TypeRessource, TypeConfig> = {
  cours: {
    icon: '📖',
    label: 'Cours',
    color: '#2563eb',
    bgColor: '#dbeafe'
  },
  exercice: {
    icon: '✏️',
    label: 'Exercice',
    color: '#059669',
    bgColor: '#d1fae5'
  },
  video: {
    icon: '🎬',
    label: 'Vidéo',
    color: '#dc2626',
    bgColor: '#fee2e2'
  },
  document: {
    icon: '📄',
    label: 'Document',
    color: '#7c3aed',
    bgColor: '#ede9fe'
  },
  quiz: {
    icon: '❓',
    label: 'Quiz',
    color: '#ea580c',
    bgColor: '#ffedd5'
  }
};

// ==================== TYPES ====================

interface ResourceCardProps {
  /** Données de la ressource à afficher */
  resource: Resource;
  /** Mode d'affichage compact */
  compact?: boolean;
  /** Callback au clic (alternative à la navigation) */
  onClick?: (resource: Resource) => void;
  /** Classe CSS additionnelle */
  className?: string;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Formate la durée estimée pour affichage
 * @param minutes - Durée en minutes
 * @returns Chaîne formatée (ex: "30 min" ou "1h30")
 */
const formatDuration = (minutes?: number): string | null => {
  if (!minutes || minutes <= 0) return null;
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
};

/**
 * Tronque un texte avec ellipsis
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

// ==================== COMPOSANT PRINCIPAL ====================

/**
 * Carte d'affichage d'une ressource pédagogique
 */
const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  compact = false,
  onClick,
  className = ''
}) => {
  // Récupérer la configuration du type
  const typeConfig = TYPE_CONFIG[resource.type];
  
  // Formater la durée
  const formattedDuration = formatDuration(resource.dureeEstimee);
  
  // Gérer le clic
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(resource);
    }
  };

  // ==================== RENDU MODE COMPACT ====================
  
  if (compact) {
    return (
      <Link
        to={`/resources/${resource.id}`}
        className={`resource-card resource-card--compact ${className}`}
        onClick={handleClick}
        aria-label={`${typeConfig.label}: ${resource.titre}`}
      >
        {/* Icône du type */}
        <span 
          className="resource-card__icon"
          style={{ backgroundColor: typeConfig.bgColor }}
          title={typeConfig.label}
        >
          {typeConfig.icon}
        </span>

        {/* Titre */}
        <span className="resource-card__title">
          {truncateText(resource.titre, 50)}
        </span>

        {/* Badge Premium/Gratuit */}
        <span className={`resource-card__badge ${resource.isPremium ? 'resource-card__badge--premium' : 'resource-card__badge--free'}`}>
          {resource.isPremium ? '⭐' : '✓'}
        </span>
      </Link>
    );
  }

  // ==================== RENDU MODE NORMAL ====================

  return (
    <Link
      to={`/resources/${resource.id}`}
      className={`resource-card ${className}`}
      onClick={handleClick}
      aria-label={`${typeConfig.label}: ${resource.titre}`}
    >
      {/* ===== En-tête avec icône et type ===== */}
      <div className="resource-card__header">
        {/* Icône du type */}
        <div 
          className="resource-card__type-icon"
          style={{ backgroundColor: typeConfig.bgColor }}
        >
          {typeConfig.icon}
        </div>

        {/* Badge du type */}
        <span 
          className="resource-card__type-badge"
          style={{ 
            color: typeConfig.color,
            backgroundColor: typeConfig.bgColor
          }}
        >
          {typeConfig.label}
        </span>

        {/* Spacer */}
        <div className="resource-card__spacer" />

        {/* Badge Premium/Gratuit */}
        <span className={`resource-card__status ${resource.isPremium ? 'resource-card__status--premium' : 'resource-card__status--free'}`}>
          {resource.isPremium ? (
            <>
              <span className="resource-card__status-icon">⭐</span>
              <span>Premium</span>
            </>
          ) : (
            <>
              <span className="resource-card__status-icon">✓</span>
              <span>Gratuit</span>
            </>
          )}
        </span>
      </div>

      {/* ===== Contenu principal ===== */}
      <div className="resource-card__content">
        {/* Titre */}
        <h4 className="resource-card__title">
          {resource.titre}
        </h4>

        {/* Description (si présente) */}
        {resource.description && (
          <p className="resource-card__description">
            {truncateText(resource.description, 120)}
          </p>
        )}
      </div>

      {/* ===== Pied avec métadonnées ===== */}
      <div className="resource-card__footer">
        {/* Durée estimée */}
        {formattedDuration && (
          <span className="resource-card__meta">
            <span className="resource-card__meta-icon">⏱️</span>
            {formattedDuration}
          </span>
        )}

        {/* Tags (max 3 affichés) */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="resource-card__tags">
            {resource.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="resource-card__tag">
                {tag}
              </span>
            ))}
            {resource.tags.length > 3 && (
              <span className="resource-card__tag resource-card__tag--more">
                +{resource.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Indicateur de fichier attaché */}
        {resource.fichierURL && (
          <span className="resource-card__file-indicator" title="Fichier attaché">
            📎
          </span>
        )}

        {/* Flèche d'action */}
        <span className="resource-card__arrow">→</span>
      </div>
    </Link>
  );
};

// ==================== COMPOSANT SKELETON ====================

/**
 * Skeleton de chargement pour ResourceCard
 */
export const ResourceCardSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="resource-card resource-card--compact resource-card--skeleton">
        <div className="skeleton skeleton--icon" />
        <div className="skeleton skeleton--text" style={{ width: '70%' }} />
        <div className="skeleton skeleton--badge" />
      </div>
    );
  }

  return (
    <div className="resource-card resource-card--skeleton">
      <div className="resource-card__header">
        <div className="skeleton skeleton--icon" />
        <div className="skeleton skeleton--badge" style={{ width: '80px' }} />
        <div className="resource-card__spacer" />
        <div className="skeleton skeleton--badge" style={{ width: '70px' }} />
      </div>
      <div className="resource-card__content">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--text" style={{ width: '80%' }} />
      </div>
      <div className="resource-card__footer">
        <div className="skeleton skeleton--meta" />
        <div className="skeleton skeleton--tag" />
        <div className="skeleton skeleton--tag" />
      </div>
    </div>
  );
};

// ==================== EXPORTS ====================

export { TYPE_CONFIG };
export default ResourceCard;
