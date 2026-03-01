// ==================== BIBLIOTHÈQUE EBOOKS - PHASE 20 ====================
// PedaClic : Page de consultation des ebooks pour les élèves
// Filtrage par catégorie, niveau, classe et matière
// Aperçu gratuit + accès complet Premium
// ==================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Ebook,
  EbookFilters,
  CategorieEbook,
  CATEGORIE_LABELS,
  CATEGORIE_ICONS
} from '../types/ebook.types';
import {
  getAllEbooks,
  filterEbooks,
  formatFileSize,
  MATIERES_DISPONIBLES
} from '../services/ebookService';
import { CLASSES } from '../types/cahierTextes.types';
import '../styles/EbookLibrary.css';

const MSG_PREMIUM_RESTRICTED = 'Ce contenu est réservé aux utilisateurs Premium.';

// --- Interface des props ---
interface EbookLibraryProps {
  isPremium: boolean;
  onReadEbook: (ebook: Ebook) => void; // Navigation vers le viewer
}

export const EbookLibrary: React.FC<EbookLibraryProps> = ({ isPremium, onReadEbook }) => {
  // ==================== STATES ====================
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EbookFilters>({
    categorie: 'all',
    niveau: 'all',
    classe: 'all',
    matiere: '',
    recherche: ''
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ==================== CHARGEMENT ====================
  useEffect(() => {
    loadEbooks();
  }, []);

  const loadEbooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEbooks();
      setEbooks(data);
    } catch (err: any) {
      setError(isPremium ? 'Erreur lors du chargement de la bibliothèque' : MSG_PREMIUM_RESTRICTED);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FILTRAGE ====================
  const filteredEbooks = useMemo(() => {
    return filterEbooks(ebooks, filters);
  }, [ebooks, filters]);

  // --- Compteurs par catégorie ---
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: ebooks.length };
    ebooks.forEach(e => {
      counts[e.categorie] = (counts[e.categorie] || 0) + 1;
    });
    return counts;
  }, [ebooks]);

  // ==================== HANDLERS ====================
  const handleFilterChange = (key: keyof EbookFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      categorie: 'all',
      niveau: 'all',
      classe: 'all',
      matiere: '',
      recherche: ''
    });
  };

  // ==================== RENDER STATES ====================
  if (loading) {
    return (
      <div className="ebook-library">
        {/* <!-- Squelette de chargement --> */}
        <div className="ebook-loading">
          <div className="loading-spinner"></div>
          <p>Chargement de la bibliothèque...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isPremiumRestriction = error === MSG_PREMIUM_RESTRICTED;
    return (
      <div className="ebook-library">
        <div className="ebook-error">
          <p>❌ {error}</p>
          {isPremiumRestriction ? (
            <a href="/premium" className="btn-retry">Passer à Premium</a>
          ) : (
            <button onClick={loadEbooks} className="btn-retry">Réessayer</button>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="ebook-library">

      {/* <!-- En-tête de la bibliothèque --> */}
      <div className="ebook-library-header">
        <div className="ebook-header-content">
          <h1>📚 Bibliothèque PedaClic</h1>
          <p className="ebook-subtitle">
            Manuels, annales, fiches de révision et bien plus encore
            {!isPremium && (
              <span className="preview-badge">Aperçu gratuit disponible</span>
            )}
          </p>
        </div>

        {/* <!-- Barre de recherche --> */}
        <div className="ebook-search-bar">
          <input
            type="text"
            placeholder="Rechercher un ebook (titre, auteur, mot-clé)..."
            value={filters.recherche || ''}
            onChange={(e) => handleFilterChange('recherche', e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* <!-- Navigation par catégorie (onglets) --> */}
      <div className="ebook-categories">
        {/* <!-- Onglet "Tous" --> */}
        <button
          className={`category-tab ${filters.categorie === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('categorie', 'all')}
        >
          📚 Tous
          <span className="category-count">{countByCategory.all || 0}</span>
        </button>

        {/* <!-- Onglets par catégorie --> */}
        {(Object.keys(CATEGORIE_LABELS) as CategorieEbook[]).map(cat => (
          <button
            key={cat}
            className={`category-tab ${filters.categorie === cat ? 'active' : ''}`}
            onClick={() => handleFilterChange('categorie', cat)}
          >
            {CATEGORIE_ICONS[cat]} {CATEGORIE_LABELS[cat]}
            <span className="category-count">{countByCategory[cat] || 0}</span>
          </button>
        ))}
      </div>

      {/* <!-- Filtres avancés --> */}
      <div className="ebook-filters">
        {/* <!-- Filtre par niveau --> */}
        <select
          value={filters.niveau || 'all'}
          onChange={(e) => handleFilterChange('niveau', e.target.value)}
          className="filter-select"
        >
          <option value="all">Tous les niveaux</option>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
        </select>

        {/* <!-- Filtre par classe (source cahierTextes) --> */}
        <select
          value={filters.classe || 'all'}
          onChange={(e) => handleFilterChange('classe', e.target.value)}
          className="filter-select"
        >
          <option value="all">Toutes les classes</option>
          {CLASSES.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>

        {/* <!-- Filtre par matière --> */}
        <select
          value={filters.matiere || ''}
          onChange={(e) => handleFilterChange('matiere', e.target.value)}
          className="filter-select"
        >
          <option value="">Toutes les matières</option>
          {MATIERES_DISPONIBLES.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* <!-- Bouton vue grille/liste --> */}
        <div className="view-toggle">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            title="Vue grille"
          >▦</button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            title="Vue liste"
          >☰</button>
        </div>

        {/* <!-- Bouton réinitialiser les filtres --> */}
        {(filters.categorie !== 'all' || filters.niveau !== 'all' ||
          filters.classe !== 'all' || filters.matiere || filters.recherche) && (
          <button onClick={resetFilters} className="btn-reset-filters">
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* <!-- Compteur de résultats --> */}
      <div className="ebook-results-info">
        <span>{filteredEbooks.length} ebook{filteredEbooks.length > 1 ? 's' : ''} trouvé{filteredEbooks.length > 1 ? 's' : ''}</span>
      </div>

      {/* <!-- Grille/Liste des ebooks --> */}
      {filteredEbooks.length === 0 ? (
        <div className="ebook-empty">
          <p>📭 Aucun ebook trouvé avec ces filtres.</p>
          <button onClick={resetFilters} className="btn-reset-filters">
            Voir tous les ebooks
          </button>
        </div>
      ) : (
        <div className={`ebook-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
          {filteredEbooks.map(ebook => (
            <EbookCard
              key={ebook.id}
              ebook={ebook}
              isPremium={isPremium}
              onRead={() => onReadEbook(ebook)}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* <!-- Bandeau Premium (si non abonné) --> */}
      {!isPremium && filteredEbooks.length > 0 && (
        <div className="ebook-premium-banner">
          <div className="premium-banner-content">
            <h3>🌟 Accédez à tous les ebooks en illimité</h3>
            <p>
              Abonnez-vous à PedaClic Premium pour lire et télécharger tous les 
              manuels, annales et fiches de révision sans limite.
            </p>
            <a href="/premium" className="btn-premium">
              S'abonner — 2 000 FCFA/mois
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== COMPOSANT CARTE EBOOK ====================

interface EbookCardProps {
  ebook: Ebook;
  isPremium: boolean;
  onRead: () => void;
  viewMode: 'grid' | 'list';
}

const EbookCard: React.FC<EbookCardProps> = ({ ebook, isPremium, onRead, viewMode }) => {
  return (
    <div className={`ebook-card ${viewMode === 'list' ? 'ebook-card-list' : ''}`}>
      {/* <!-- Couverture --> */}
      <div className="ebook-cover" onClick={onRead}>
        {ebook.couvertureURL ? (
          <img src={ebook.couvertureURL} alt={ebook.titre} loading="lazy" />
        ) : (
          <div className="ebook-cover-placeholder">
            <span className="cover-icon">{CATEGORIE_ICONS[ebook.categorie]}</span>
            <span className="cover-title">{ebook.titre}</span>
          </div>
        )}
        {/* <!-- Badge Premium --> */}
        {!isPremium && (
          <div className="ebook-badge-premium">
            <span>🔒 Premium</span>
          </div>
        )}
        {/* <!-- Badge catégorie --> */}
        <div className="ebook-badge-category">
          {CATEGORIE_LABELS[ebook.categorie]}
        </div>
      </div>

      {/* <!-- Informations --> */}
      <div className="ebook-info">
        <h3 className="ebook-title" onClick={onRead}>{ebook.titre}</h3>
        <p className="ebook-author">{ebook.auteur}</p>
        <p className="ebook-description">{ebook.description}</p>

        {/* <!-- Métadonnées --> */}
        <div className="ebook-meta">
          {ebook.classe !== 'all' && (
            <span className="meta-tag">{ebook.classe}</span>
          )}
          {ebook.matiere && (
            <span className="meta-tag">{ebook.matiere}</span>
          )}
          <span className="meta-pages">{ebook.nombrePages} pages</span>
          <span className="meta-size">{formatFileSize(ebook.tailleFichier)}</span>
        </div>

        {/* <!-- Boutons d'action --> */}
        <div className="ebook-actions">
          <button className="btn-read" onClick={onRead}>
            {isPremium ? '📖 Lire' : `👁️ Aperçu (${ebook.pagesApercu} pages)`}
          </button>
          {isPremium && (
            <a
              href={ebook.fichierURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-download"
              download
            >
              ⬇️ Télécharger
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default EbookLibrary;
