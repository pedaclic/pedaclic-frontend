/**
 * ============================================================================
 * PAGE DISCIPLINEDETAIL - PEDACLIC
 * ============================================================================
 * 
 * Page de détail d'une discipline avec ses chapitres et ressources.
 * Route : /disciplines/:id
 * 
 * Fonctionnalités :
 * - En-tête avec informations de la discipline
 * - Filtres par type de ressource
 * - Liste des chapitres en accordéon
 * - Statistiques de la discipline
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ChapterCard, { ChapterCardSkeleton } from '../components/resources/ChapterCard';
import { ResourceService, countResourcesByDiscipline, getResourcesByChapter } from '../services/ResourceService';
import type { Discipline, Resource, TypeRessource } from '../index';

// ==================== TYPES ====================

interface RouteParams {
  id: string;
}

interface DisciplineStats {
  total: number;
  premium: number;
  gratuit: number;
  parType: Record<TypeRessource, number>;
}

// ==================== CONFIGURATION ====================

/**
 * Configuration des filtres de type
 */
const TYPE_FILTERS: Array<{
  value: TypeRessource | 'all';
  label: string;
  icon: string;
}> = [
  { value: 'all', label: 'Tous', icon: '📚' },
  { value: 'cours', label: 'Cours', icon: '📖' },
  { value: 'exercice', label: 'Exercices', icon: '✏️' },
  { value: 'video', label: 'Vidéos', icon: '🎬' },
  { value: 'document', label: 'Documents', icon: '📄' },
  { value: 'quiz', label: 'Quiz', icon: '❓' }
];

/**
 * Mapping niveau vers libellé français
 */
const NIVEAU_LABELS: Record<string, string> = {
  college: 'Collège',
  lycee: 'Lycée'
};

/**
 * Mapping classe vers libellé français
 */
const CLASSE_LABELS: Record<string, string> = {
  '6eme': '6ème',
  '5eme': '5ème',
  '4eme': '4ème',
  '3eme': '3ème',
  '2nde': 'Seconde',
  '1ere': 'Première',
  'Terminale': 'Terminale'
};

// ==================== COMPOSANT PRINCIPAL ====================

const DisciplineDetail: React.FC = () => {
  // ===== STATE =====
  const { id } = useParams<keyof RouteParams>() as RouteParams;
  
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [resourcesByChapter, setResourcesByChapter] = useState<Map<string, Resource[]>>(new Map());
  const [stats, setStats] = useState<DisciplineStats | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<TypeRessource | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== CHARGEMENT DES DONNÉES =====
  
  useEffect(() => {
    const loadDisciplineData = async () => {
      if (!id) {
        setError('ID de discipline manquant');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Charger la discipline
        const disciplineRef = doc(db, 'disciplines', id);
        const disciplineSnap = await getDoc(disciplineRef);

        if (!disciplineSnap.exists()) {
          setError('Discipline non trouvée');
          setIsLoading(false);
          return;
        }

        const disciplineData = disciplineSnap.data();
        const loadedDiscipline: Discipline = {
          id: disciplineSnap.id,
          nom: disciplineData.nom,
          niveau: disciplineData.niveau,
          classe: disciplineData.classe,
          ordre: disciplineData.ordre || 0,
          coefficient: disciplineData.coefficient,
          couleur: disciplineData.couleur,
          icone: disciplineData.icone,
          description: disciplineData.description,
          createdAt: disciplineData.createdAt?.toDate() || new Date(),
          updatedAt: disciplineData.updatedAt?.toDate()
        };

        setDiscipline(loadedDiscipline);

        // Charger les ressources par chapitre
        const resourcesResult = await getResourcesByChapter(id);
        if (resourcesResult.success && resourcesResult.data) {
          setResourcesByChapter(resourcesResult.data);
          
          // Ouvrir le premier chapitre par défaut
          const firstChapter = Array.from(resourcesResult.data.keys())[0];
          if (firstChapter) {
            setExpandedChapters(new Set([firstChapter]));
          }
        }

        // Charger les statistiques
        const statsResult = await countResourcesByDiscipline(id);
        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data);
        }

      } catch (err) {
        console.error('Erreur chargement discipline:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    loadDisciplineData();
  }, [id]);

  // ===== FILTRAGE DES RESSOURCES =====
  
  const filteredResourcesByChapter = useMemo(() => {
    if (activeFilter === 'all') {
      return resourcesByChapter;
    }

    const filtered = new Map<string, Resource[]>();
    
    resourcesByChapter.forEach((resources, chapter) => {
      const filteredResources = resources.filter(r => r.type === activeFilter);
      if (filteredResources.length > 0) {
        filtered.set(chapter, filteredResources);
      }
    });

    return filtered;
  }, [resourcesByChapter, activeFilter]);

  // Comptage des ressources filtrées par type
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    
    resourcesByChapter.forEach(resources => {
      counts.all += resources.length;
      resources.forEach(resource => {
        counts[resource.type] = (counts[resource.type] || 0) + 1;
      });
    });

    return counts;
  }, [resourcesByChapter]);

  // ===== GESTION DES ACCORDÉONS =====
  
  const toggleChapter = useCallback((chapterName: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterName)) {
        next.delete(chapterName);
      } else {
        next.add(chapterName);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allChapters = new Set(filteredResourcesByChapter.keys());
    setExpandedChapters(allChapters);
  }, [filteredResourcesByChapter]);

  const collapseAll = useCallback(() => {
    setExpandedChapters(new Set());
  }, []);

  // ===== RENDU ÉTAT DE CHARGEMENT =====
  
  if (isLoading) {
    return (
      <div className="discipline-detail">
        {/* Skeleton header */}
        <div className="discipline-detail__header discipline-detail__header--skeleton">
          <div className="container">
            <div className="skeleton skeleton--title" style={{ width: '200px', height: '40px' }} />
            <div className="skeleton skeleton--text" style={{ width: '300px', marginTop: '16px' }} />
          </div>
        </div>

        {/* Skeleton filters */}
        <div className="discipline-detail__filters">
          <div className="container">
            <div className="discipline-detail__filter-bar">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton skeleton--button" style={{ width: '100px', height: '40px' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Skeleton chapters */}
        <div className="discipline-detail__content">
          <div className="container">
            <ChapterCardSkeleton />
            <ChapterCardSkeleton />
            <ChapterCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDU ÉTAT D'ERREUR =====
  
  if (error || !discipline) {
    return (
      <div className="discipline-detail">
        <div className="discipline-detail__error">
          <div className="container">
            <div className="error-box">
              <span className="error-box__icon">⚠️</span>
              <h2 className="error-box__title">
                {error || 'Discipline non trouvée'}
              </h2>
              <p className="error-box__message">
                La discipline demandée n'existe pas ou a été supprimée.
              </p>
              <Link to="/disciplines" className="error-box__link">
                ← Retour aux disciplines
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDU PRINCIPAL =====
  
  const chaptersArray = Array.from(filteredResourcesByChapter.entries());
  const totalChapters = Array.from(resourcesByChapter.keys()).length;

  return (
    <div className="discipline-detail">
      {/* ===== EN-TÊTE DE LA DISCIPLINE ===== */}
      <header className="discipline-detail__header">
        <div className="container">
          {/* Fil d'ariane */}
          <nav className="discipline-detail__breadcrumb" aria-label="Fil d'ariane">
            <Link to="/">Accueil</Link>
            <span className="discipline-detail__breadcrumb-separator">/</span>
            <Link to="/disciplines">Disciplines</Link>
            <span className="discipline-detail__breadcrumb-separator">/</span>
            <span className="discipline-detail__breadcrumb-current">{discipline.nom}</span>
          </nav>

          {/* Titre et infos */}
          <div className="discipline-detail__title-section">
            {/* Icône */}
            {discipline.icone && (
              <span className="discipline-detail__icon">{discipline.icone}</span>
            )}
            
            <div className="discipline-detail__title-info">
              <h1 className="discipline-detail__title">{discipline.nom}</h1>
              
              {/* Méta infos */}
              <div className="discipline-detail__meta">
                <span className="discipline-detail__niveau">
                  {NIVEAU_LABELS[discipline.niveau] || discipline.niveau}
                </span>
                <span className="discipline-detail__separator">•</span>
                <span className="discipline-detail__classe">
                  {CLASSE_LABELS[discipline.classe] || discipline.classe}
                </span>
                {discipline.coefficient && (
                  <>
                    <span className="discipline-detail__separator">•</span>
                    <span className="discipline-detail__coefficient">
                      Coef. {discipline.coefficient}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Statistiques */}
          {stats && (
            <div className="discipline-detail__stats">
              <div className="discipline-detail__stat">
                <span className="discipline-detail__stat-value">{totalChapters}</span>
                <span className="discipline-detail__stat-label">Chapitre{totalChapters > 1 ? 's' : ''}</span>
              </div>
              <div className="discipline-detail__stat">
                <span className="discipline-detail__stat-value">{stats.total}</span>
                <span className="discipline-detail__stat-label">Ressource{stats.total > 1 ? 's' : ''}</span>
              </div>
              <div className="discipline-detail__stat discipline-detail__stat--free">
                <span className="discipline-detail__stat-value">{stats.gratuit}</span>
                <span className="discipline-detail__stat-label">Gratuit{stats.gratuit > 1 ? 's' : ''}</span>
              </div>
              <div className="discipline-detail__stat discipline-detail__stat--premium">
                <span className="discipline-detail__stat-value">{stats.premium}</span>
                <span className="discipline-detail__stat-label">Premium</span>
              </div>
            </div>
          )}

          {/* Description */}
          {discipline.description && (
            <p className="discipline-detail__description">
              {discipline.description}
            </p>
          )}
        </div>
      </header>

      {/* ===== BARRE DE FILTRES ===== */}
      <section className="discipline-detail__filters">
        <div className="container">
          <div className="discipline-detail__filter-bar">
            {/* Filtres par type */}
            <div className="discipline-detail__type-filters">
              {TYPE_FILTERS.map(filter => {
                const count = filterCounts[filter.value] || 0;
                const isActive = activeFilter === filter.value;
                const isDisabled = filter.value !== 'all' && count === 0;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={`discipline-detail__filter-btn ${isActive ? 'discipline-detail__filter-btn--active' : ''}`}
                    onClick={() => setActiveFilter(filter.value)}
                    disabled={isDisabled}
                    aria-pressed={isActive}
                  >
                    <span className="discipline-detail__filter-icon">{filter.icon}</span>
                    <span className="discipline-detail__filter-label">{filter.label}</span>
                    <span className="discipline-detail__filter-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions sur les chapitres */}
            <div className="discipline-detail__chapter-actions">
              <button
                type="button"
                className="discipline-detail__expand-btn"
                onClick={expandAll}
                title="Tout déplier"
              >
                <span>↕</span> Tout déplier
              </button>
              <button
                type="button"
                className="discipline-detail__collapse-btn"
                onClick={collapseAll}
                title="Tout replier"
              >
                <span>↔</span> Tout replier
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTENU - LISTE DES CHAPITRES ===== */}
      <main className="discipline-detail__content">
        <div className="container">
          {chaptersArray.length > 0 ? (
            <div className="discipline-detail__chapters">
              {chaptersArray.map(([chapterName, resources], index) => (
                <ChapterCard
                  key={chapterName}
                  chapterName={chapterName}
                  chapterNumber={index + 1}
                  resources={resources}
                  isExpanded={expandedChapters.has(chapterName)}
                  onToggle={() => toggleChapter(chapterName)}
                />
              ))}
            </div>
          ) : (
            <div className="discipline-detail__empty">
              <span className="discipline-detail__empty-icon">📭</span>
              <h3 className="discipline-detail__empty-title">
                {activeFilter === 'all' 
                  ? 'Aucune ressource disponible'
                  : `Aucun(e) ${TYPE_FILTERS.find(f => f.value === activeFilter)?.label.toLowerCase()} disponible`
                }
              </h3>
              <p className="discipline-detail__empty-message">
                {activeFilter === 'all'
                  ? 'Cette discipline ne contient pas encore de ressources pédagogiques.'
                  : 'Essayez de changer de filtre ou revenez plus tard.'
                }
              </p>
              {activeFilter !== 'all' && (
                <button
                  type="button"
                  className="discipline-detail__reset-filter"
                  onClick={() => setActiveFilter('all')}
                >
                  Afficher toutes les ressources
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ===== BANNIÈRE PREMIUM ===== */}
      {stats && stats.premium > 0 && (
        <aside className="discipline-detail__premium-banner">
          <div className="container">
            <div className="premium-banner">
              <div className="premium-banner__content">
                <span className="premium-banner__icon">⭐</span>
                <div className="premium-banner__text">
                  <strong>{stats.premium} ressource{stats.premium > 1 ? 's' : ''} Premium</strong>
                  <span>Accédez à tout le contenu pour seulement 2 000 FCFA/mois</span>
                </div>
              </div>
              <Link to="/premium" className="premium-banner__cta">
                Devenir Premium
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default DisciplineDetail;
