/**
 * ============================================================
 * COMPOSANT ADMIN RESOURCE LIST - LISTE CRUD DES RESSOURCES
 * ============================================================
 * 
 * Liste administrative des ressources avec :
 * - Tableau triable et filtrable
 * - Actions: Voir, Modifier, Supprimer
 * - Filtres par type, chapitre, statut Premium
 * - Pagination
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Resource, TypeRessource } from '../../index';
import { getResources, deleteResource, ResourceFilters } from '../../services/ResourceService';
import { deleteFileByURL } from '../../services/StorageService';

// ==================== INTERFACES ====================

interface ResourceListProps {
  /** ID de la discipline pour filtrer les ressources */
  disciplineId: string;
  
  /** Callback pour éditer une ressource */
  onEdit: (resource: Resource) => void;
  
  /** Callback pour voir une ressource */
  onView: (resource: Resource) => void;
  
  /** Callback pour créer une nouvelle ressource */
  onCreate: () => void;
  
  /** Rafraîchir la liste (compteur) */
  refreshTrigger?: number;
}

interface ListState {
  resources: Resource[];
  loading: boolean;
  error: string | null;
}

// ==================== CONSTANTES ====================

/**
 * Configuration des types pour affichage
 */
const TYPE_CONFIG: Record<TypeRessource, { icon: string; label: string }> = {
  cours: { icon: '📖', label: 'Cours' },
  exercice: { icon: '✏️', label: 'Exercice' },
  video: { icon: '🎬', label: 'Vidéo' },
  document: { icon: '📄', label: 'Document' },
  quiz: { icon: '❓', label: 'Quiz' }
};

/**
 * Nombre d'éléments par page
 */
const ITEMS_PER_PAGE = 10;

// ==================== COMPOSANT ====================

const ResourceList: React.FC<ResourceListProps> = ({
  disciplineId,
  onEdit,
  onView,
  onCreate,
  refreshTrigger
}) => {
  // ===== ÉTATS =====
  
  // Liste des ressources
  const [state, setState] = useState<ListState>({
    resources: [],
    loading: true,
    error: null
  });

  // Filtres
  const [filterType, setFilterType] = useState<TypeRessource | ''>('');
  const [filterPremium, setFilterPremium] = useState<'' | 'premium' | 'free'>('');
  const [filterChapter, setFilterChapter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tri
  const [sortField, setSortField] = useState<'titre' | 'ordre' | 'createdAt'>('ordre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Ressource en cours de suppression
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ===== CHARGEMENT DES DONNÉES =====
  useEffect(() => {
    const loadResources = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const filters: ResourceFilters = { disciplineId };
        
        const result = await getResources(filters);

        if (!result.success) {
          throw new Error(result.error || "Erreur de chargement");
        }

        setState({
          resources: result.data,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error("Erreur chargement ressources:", error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Erreur inconnue"
        }));
      }
    };

    loadResources();
  }, [disciplineId, refreshTrigger]);

  // ===== CHAPITRES UNIQUES (pour filtre) =====
  const uniqueChapters = useMemo(() => {
    const chapters = new Set<string>();
    state.resources.forEach(r => {
      if (r.chapitre) chapters.add(r.chapitre);
    });
    return Array.from(chapters).sort((a, b) => 
      a.localeCompare(b, 'fr', { numeric: true })
    );
  }, [state.resources]);

  // ===== FILTRAGE ET TRI =====
  const filteredResources = useMemo(() => {
    let result = [...state.resources];

    // Filtre par type
    if (filterType) {
      result = result.filter(r => r.type === filterType);
    }

    // Filtre Premium/Gratuit
    if (filterPremium === 'premium') {
      result = result.filter(r => r.isPremium);
    } else if (filterPremium === 'free') {
      result = result.filter(r => !r.isPremium);
    }

    // Filtre par chapitre
    if (filterChapter) {
      result = result.filter(r => r.chapitre === filterChapter);
    }

    // Recherche textuelle
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.titre.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Tri
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'titre':
          comparison = a.titre.localeCompare(b.titre, 'fr');
          break;
        case 'ordre':
          comparison = a.ordre - b.ordre;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [state.resources, filterType, filterPremium, filterChapter, searchQuery, sortField, sortDirection]);

  // ===== PAGINATION =====
  const paginatedResources = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResources.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredResources, currentPage]);

  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);

  // Reset page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterPremium, filterChapter, searchQuery]);

  // ===== HANDLERS =====

  /**
   * Changement de tri
   */
  const handleSort = (field: 'titre' | 'ordre' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Suppression d'une ressource
   */
  const handleDelete = async (resource: Resource) => {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer "${resource.titre}" ?\n\nCette action est irréversible.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingId(resource.id);

    try {
      // Suppression du fichier associé si présent
      if (resource.fichierURL) {
        await deleteFileByURL(resource.fichierURL);
      }

      // Suppression de la ressource
      const result = await deleteResource(resource.id);

      if (!result.success) {
        throw new Error(result.error || "Erreur de suppression");
      }

      // Mise à jour locale
      setState(prev => ({
        ...prev,
        resources: prev.resources.filter(r => r.id !== resource.id)
      }));

      // Notification succès
      alert(`✅ Ressource "${resource.titre}" supprimée avec succès`);

    } catch (error) {
      console.error("Erreur suppression:", error);
      alert(`❌ Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Formatage de la date
   */
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-SN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ===== RENDU =====

  // État de chargement
  if (state.loading) {
    return (
      <div className="resource-list resource-list--loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des ressources...</p>
        </div>
      </div>
    );
  }

  // État d'erreur
  if (state.error) {
    return (
      <div className="resource-list resource-list--error">
        <div className="error-message">
          <span className="error-icon">❌</span>
          <p>{state.error}</p>
          <button 
            className="btn btn--secondary"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-list">
      {/* ============================================
          EN-TÊTE AVEC ACTIONS
          ============================================ */}
      <header className="resource-list__header">
        <div className="resource-list__title-row">
          <h2 className="resource-list__title">
            📚 Gestion des ressources
            <span className="resource-list__count">
              ({filteredResources.length} ressource{filteredResources.length > 1 ? 's' : ''})
            </span>
          </h2>
          
          <button 
            className="btn btn--primary"
            onClick={onCreate}
          >
            ➕ Nouvelle ressource
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="resource-list__search">
          <input
            type="search"
            className="search-input"
            placeholder="🔍 Rechercher par titre, description ou tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filtres */}
        <div className="resource-list__filters">
          {/* Filtre par type */}
          <select
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TypeRessource | '')}
          >
            <option value="">Tous les types</option>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>

          {/* Filtre Premium */}
          <select
            className="filter-select"
            value={filterPremium}
            onChange={(e) => setFilterPremium(e.target.value as '' | 'premium' | 'free')}
          >
            <option value="">Premium & Gratuit</option>
            <option value="premium">⭐ Premium uniquement</option>
            <option value="free">✓ Gratuit uniquement</option>
          </select>

          {/* Filtre par chapitre */}
          <select
            className="filter-select"
            value={filterChapter}
            onChange={(e) => setFilterChapter(e.target.value)}
          >
            <option value="">Tous les chapitres</option>
            {uniqueChapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>

          {/* Bouton reset filtres */}
          {(filterType || filterPremium || filterChapter || searchQuery) && (
            <button
              className="btn btn--ghost"
              onClick={() => {
                setFilterType('');
                setFilterPremium('');
                setFilterChapter('');
                setSearchQuery('');
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </header>

      {/* ============================================
          TABLEAU DES RESSOURCES
          ============================================ */}
      {filteredResources.length === 0 ? (
        /* État vide */
        <div className="resource-list__empty">
          <div className="empty-icon">📭</div>
          <h3>Aucune ressource trouvée</h3>
          <p>
            {searchQuery || filterType || filterPremium || filterChapter
              ? "Essayez de modifier vos critères de recherche."
              : "Commencez par créer votre première ressource."
            }
          </p>
          <button className="btn btn--primary" onClick={onCreate}>
            ➕ Créer une ressource
          </button>
        </div>
      ) : (
        <>
          {/* Tableau */}
          <div className="resource-list__table-wrapper">
            <table className="resource-list__table">
              {/* En-tête du tableau */}
              <thead>
                <tr>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('ordre')}
                  >
                    # {sortField === 'ordre' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Type</th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('titre')}
                  >
                    Titre {sortField === 'titre' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Chapitre</th>
                  <th>Statut</th>
                  <th 
                    className="sortable"
                    onClick={() => handleSort('createdAt')}
                  >
                    Date {sortField === 'createdAt' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>

              {/* Corps du tableau */}
              <tbody>
                {paginatedResources.map((resource) => (
                  <tr 
                    key={resource.id}
                    className={deletingId === resource.id ? 'row--deleting' : ''}
                  >
                    {/* Ordre */}
                    <td className="col-ordre">
                      <span className="ordre-badge">{resource.ordre}</span>
                    </td>

                    {/* Type */}
                    <td className="col-type">
                      <span 
                        className="type-badge"
                        title={TYPE_CONFIG[resource.type].label}
                      >
                        {TYPE_CONFIG[resource.type].icon}
                      </span>
                    </td>

                    {/* Titre */}
                    <td className="col-titre">
                      <div className="titre-wrapper">
                        <span className="titre-text">{resource.titre}</span>
                        {resource.fichierURL && (
                          <span className="attachment-icon" title="Fichier joint">
                            📎
                          </span>
                        )}
                      </div>
                      {resource.description && (
                        <span className="titre-description">
                          {resource.description.substring(0, 60)}
                          {resource.description.length > 60 ? '...' : ''}
                        </span>
                      )}
                    </td>

                    {/* Chapitre */}
                    <td className="col-chapitre">
                      {resource.chapitre || (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Statut Premium */}
                    <td className="col-statut">
                      {resource.isPremium ? (
                        <span className="status-badge status-badge--premium">
                          ⭐ Premium
                        </span>
                      ) : (
                        <span className="status-badge status-badge--free">
                          ✓ Gratuit
                        </span>
                      )}
                    </td>

                    {/* Date de création */}
                    <td className="col-date">
                      {formatDate(resource.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="col-actions">
                      <div className="actions-group">
                        {/* Voir */}
                        <button
                          className="action-btn action-btn--view"
                          onClick={() => onView(resource)}
                          title="Voir"
                          disabled={deletingId !== null}
                        >
                          👁️
                        </button>

                        {/* Modifier */}
                        <button
                          className="action-btn action-btn--edit"
                          onClick={() => onEdit(resource)}
                          title="Modifier"
                          disabled={deletingId !== null}
                        >
                          ✏️
                        </button>

                        {/* Supprimer */}
                        <button
                          className="action-btn action-btn--delete"
                          onClick={() => handleDelete(resource)}
                          title="Supprimer"
                          disabled={deletingId !== null}
                        >
                          {deletingId === resource.id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ============================================
              PAGINATION
              ============================================ */}
          {totalPages > 1 && (
            <footer className="resource-list__pagination">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                ««
              </button>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1}
              >
                «
              </button>

              <span className="pagination-info">
                Page {currentPage} sur {totalPages}
              </span>

              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                »»
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  );
};

export default ResourceList;
