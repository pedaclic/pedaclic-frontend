/**
 * ============================================================================
 * COMPOSANT CHAPTERCARD - PEDACLIC
 * ============================================================================
 * 
 * Carte accordéon pour afficher un chapitre avec ses ressources.
 * Permet d'ouvrir/fermer pour voir la liste des ressources du chapitre.
 * 
 * Fonctionnalités :
 * - En-tête avec numéro, titre et statistiques
 * - Animation d'accordéon fluide
 * - Affichage des ressources par type
 * - Badge de progression (futur)
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import ResourceCard, { TYPE_CONFIG } from './ResourceCard';
import type { Resource, TypeRessource } from '../../index';

// ==================== TYPES ====================

interface ChapterCardProps {
  /** Nom du chapitre */
  chapterName: string;
  /** Numéro du chapitre (pour l'affichage) */
  chapterNumber: number;
  /** Liste des ressources du chapitre */
  resources: Resource[];
  /** État ouvert/fermé */
  isExpanded: boolean;
  /** Callback pour toggle */
  onToggle: () => void;
  /** Classe CSS additionnelle */
  className?: string;
}

// ==================== TYPES INTERNES ====================

interface ChapterStats {
  total: number;
  premium: number;
  gratuit: number;
  parType: Record<TypeRessource, number>;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Calcule les statistiques du chapitre
 */
const calculateChapterStats = (resources: Resource[]): ChapterStats => {
  const stats: ChapterStats = {
    total: resources.length,
    premium: 0,
    gratuit: 0,
    parType: {
      cours: 0,
      exercice: 0,
      video: 0,
      document: 0,
      quiz: 0
    }
  };

  resources.forEach(resource => {
    // Comptage premium/gratuit
    if (resource.isPremium) {
      stats.premium++;
    } else {
      stats.gratuit++;
    }

    // Comptage par type
    if (stats.parType.hasOwnProperty(resource.type)) {
      stats.parType[resource.type]++;
    }
  });

  return stats;
};

/**
 * Trie les ressources par ordre puis par type
 */
const sortResources = (resources: Resource[]): Resource[] => {
  const typeOrder: Record<TypeRessource, number> = {
    cours: 1,
    exercice: 2,
    video: 3,
    document: 4,
    quiz: 5
  };

  return [...resources].sort((a, b) => {
    // D'abord par ordre explicite
    if (a.ordre !== b.ordre) {
      return a.ordre - b.ordre;
    }
    // Puis par type
    return typeOrder[a.type] - typeOrder[b.type];
  });
};

// ==================== COMPOSANT PRINCIPAL ====================

const ChapterCard: React.FC<ChapterCardProps> = ({
  chapterName,
  chapterNumber,
  resources,
  isExpanded,
  onToggle,
  className = ''
}) => {
  // Calcul des statistiques (mémoïsé pour performance)
  const stats = useMemo(() => calculateChapterStats(resources), [resources]);
  
  // Ressources triées
  const sortedResources = useMemo(() => sortResources(resources), [resources]);

  // Générer le résumé des types de ressources
  const typeSummary = useMemo(() => {
    const types: TypeRessource[] = ['cours', 'exercice', 'video', 'document', 'quiz'];
    return types
      .filter(type => stats.parType[type] > 0)
      .map(type => ({
        type,
        count: stats.parType[type],
        config: TYPE_CONFIG[type]
      }));
  }, [stats]);

  // Vérifier s'il y a du contenu premium
  const hasPremium = stats.premium > 0;

  return (
    <div className={`chapter-card ${isExpanded ? 'chapter-card--expanded' : ''} ${className}`}>
      {/* ===== EN-TÊTE DU CHAPITRE (cliquable) ===== */}
      <button
        type="button"
        className="chapter-card__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`chapter-content-${chapterNumber}`}
      >
        {/* Numéro du chapitre */}
        <div className="chapter-card__number">
          <span>{chapterNumber}</span>
        </div>

        {/* Titre et méta */}
        <div className="chapter-card__info">
          {/* Titre */}
          <h3 className="chapter-card__title">
            {chapterName}
          </h3>

          {/* Résumé des types */}
          <div className="chapter-card__type-summary">
            {typeSummary.map(({ type, count, config }) => (
              <span 
                key={type} 
                className="chapter-card__type-count"
                title={`${count} ${config.label.toLowerCase()}${count > 1 ? 's' : ''}`}
              >
                <span className="chapter-card__type-icon">{config.icon}</span>
                <span>{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Badges et indicateurs */}
        <div className="chapter-card__badges">
          {/* Badge nombre de ressources */}
          <span className="chapter-card__count-badge">
            {stats.total} ressource{stats.total > 1 ? 's' : ''}
          </span>

          {/* Badge premium si applicable */}
          {hasPremium && (
            <span className="chapter-card__premium-badge" title={`${stats.premium} contenu(s) premium`}>
              ⭐ {stats.premium}
            </span>
          )}
        </div>

        {/* Chevron d'ouverture */}
        <div className={`chapter-card__chevron ${isExpanded ? 'chapter-card__chevron--open' : ''}`}>
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M5 7.5L10 12.5L15 7.5" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* ===== CONTENU DÉROULANT ===== */}
      <div 
        id={`chapter-content-${chapterNumber}`}
        className={`chapter-card__content ${isExpanded ? 'chapter-card__content--visible' : ''}`}
        aria-hidden={!isExpanded}
      >
        {/* Barre de progression (placeholder pour futur) */}
        <div className="chapter-card__progress">
          <div className="chapter-card__progress-bar">
            <div 
              className="chapter-card__progress-fill"
              style={{ width: '0%' }}
            />
          </div>
          <span className="chapter-card__progress-text">
            0/{stats.total} terminé{stats.total > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste des ressources */}
        <div className="chapter-card__resources">
          {sortedResources.length > 0 ? (
            sortedResources.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                className="chapter-card__resource"
              />
            ))
          ) : (
            <div className="chapter-card__empty">
              <span className="chapter-card__empty-icon">📚</span>
              <p>Aucune ressource dans ce chapitre</p>
            </div>
          )}
        </div>

        {/* Statistiques du chapitre */}
        <div className="chapter-card__stats">
          <div className="chapter-card__stat">
            <span className="chapter-card__stat-value">{stats.total}</span>
            <span className="chapter-card__stat-label">Total</span>
          </div>
          <div className="chapter-card__stat">
            <span className="chapter-card__stat-value chapter-card__stat-value--premium">
              {stats.premium}
            </span>
            <span className="chapter-card__stat-label">Premium</span>
          </div>
          <div className="chapter-card__stat">
            <span className="chapter-card__stat-value chapter-card__stat-value--free">
              {stats.gratuit}
            </span>
            <span className="chapter-card__stat-label">Gratuit</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== COMPOSANT SKELETON ====================

/**
 * Skeleton de chargement pour ChapterCard
 */
export const ChapterCardSkeleton: React.FC = () => {
  return (
    <div className="chapter-card chapter-card--skeleton">
      <div className="chapter-card__header">
        <div className="skeleton skeleton--number" />
        <div className="chapter-card__info">
          <div className="skeleton skeleton--title" style={{ width: '60%' }} />
          <div className="skeleton skeleton--meta" style={{ width: '40%' }} />
        </div>
        <div className="skeleton skeleton--badge" style={{ width: '100px' }} />
        <div className="skeleton skeleton--chevron" />
      </div>
    </div>
  );
};

// ==================== EXPORTS ====================

export default ChapterCard;
