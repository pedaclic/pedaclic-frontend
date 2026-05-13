// ==================== BIBLIOTHÈQUE EBOOKS - PHASE 20 ====================
// PedaClic : Page de consultation des ebooks pour les élèves
// Filtrage par catégorie, niveau, classe et matière
// Aperçu gratuit + accès complet Premium
// ==================================================================

import React, { useState, useEffect, useMemo } from 'react';
// <!-- Icônes Lucide : on remplace les emojis textuels des boutons d'action
//      par des pictogrammes vectoriels homogènes. -->
//   • BookOpen   → bouton "Lire" (PDF, état Premium)
//   • Globe      → bouton "Consulter" (HTML, état Premium)
//   • Eye        → bouton "Aperçu" (utilisateur non-Premium)
//   • Lock       → bouton "Réservé Premium" (HTML, non-Premium)
//   • Download   → bouton "Télécharger" (actif → vert ; inactif → grisé)
import { BookOpen, Globe, Eye, Lock, Download } from 'lucide-react';
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
  incrementTelechargements,
  MATIERES_DISPONIBLES_FALLBACK
} from '../services/ebookService';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import { CLASSES } from '../types/cahierTextes.types';
import '../styles/EbookLibrary.css';

const MSG_PREMIUM_RESTRICTED = 'Ce contenu est réservé aux utilisateurs Premium.';

// --- Interface des props ---
interface EbookLibraryProps {
  isPremium: boolean;
  onReadEbook: (ebook: Ebook) => void; // Navigation vers le viewer
}

export const EbookLibrary: React.FC<EbookLibraryProps> = ({ isPremium, onReadEbook }) => {
  const { matieres: matieresDisciplines } = useDisciplinesOptions();
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

  // --- Matières : source canonique (disciplines) + valeurs existantes dans ebooks (rétrocompat) ---
  const matieresOptions = useMemo(() => {
    const fromDisciplines = matieresDisciplines.map(m => m.valeur);
    const fromEbooks = [...new Set(ebooks.map(e => e.matiere).filter(Boolean) as string[])];
    const merged = [...new Set([...fromDisciplines, ...fromEbooks])].sort((a, b) => a.localeCompare(b, 'fr'));
    return merged.length ? merged : MATIERES_DISPONIBLES_FALLBACK;
  }, [matieresDisciplines, ebooks]);

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
          {matieresOptions.map(m => (
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
  // Rétrocompat : un ebook sans `format` est un PDF historique.
  const ebookFormat = ebook.format || 'pdf';
  const isHtml = ebookFormat === 'html';

  // --- Autorisation du téléchargement par l'administrateur ---
  // Rétrocompatibilité : un ebook créé avant l'introduction du champ
  // `telechargementActif` n'a pas la propriété → on la traite comme `true`,
  // donc le bouton de téléchargement reste visible (comportement historique).
  // S'applique aussi bien au Premium qu'au non-Premium : c'est un verrou
  // global piloté depuis le panneau AdminEbooks.
  const canDownload = ebook.telechargementActif !== false;

  // Pour le HTML, on suggère un nom de fichier .html lors du téléchargement
  // (sans cela, le navigateur conserverait le nom horodaté du Storage).
  const downloadName = isHtml
    ? `${ebook.titre.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'ebook'}.html`
    : undefined;

  return (
    <div className={`ebook-card ${viewMode === 'list' ? 'ebook-card-list' : ''}`}>
      {/* <!-- Couverture --> */}
      <div className="ebook-cover" onClick={onRead}>
        {ebook.couvertureURL ? (
          <img src={ebook.couvertureURL} alt={ebook.titre} loading="lazy" />
        ) : (
          <div className="ebook-cover-placeholder">
            {/* Pour un HTML sans couverture, on remplace l'icône de catégorie
                par un globe afin de signaler visuellement la nature web. */}
            <span className="cover-icon">{isHtml ? '🌐' : CATEGORIE_ICONS[ebook.categorie]}</span>
            <span className="cover-title">{ebook.titre}</span>
          </div>
        )}
        {/* <!-- Badge Premium --> */}
        {!isPremium && (
          <div className="ebook-badge-premium">
            <span>🔒 Premium</span>
          </div>
        )}
        {/* <!-- Badge format HTML : visible uniquement pour les pages HTML
              afin de ne pas alourdir le cas dominant (PDF). --> */}
        {isHtml && (
          <div className="ebook-badge-format" title="Page web interactive">
            🌐 HTML
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

        {/* <!-- Métadonnées : "n pages" n'est affiché que pour les PDF. --> */}
        <div className="ebook-meta">
          {ebook.classe !== 'all' && (
            <span className="meta-tag">{ebook.classe}</span>
          )}
          {ebook.matiere && (
            <span className="meta-tag">{ebook.matiere}</span>
          )}
          {isHtml ? (
            <span className="meta-pages">Page web</span>
          ) : (
            <span className="meta-pages">{ebook.nombrePages} pages</span>
          )}
          <span className="meta-size">{formatFileSize(ebook.tailleFichier)}</span>
        </div>

        {/* <!-- =====================================================
                 BOUTONS D'ACTION
                 -----------------------------------------------------
                 Refonte UX :
                  • Boutons contigus (flex + gap), jamais superposés.
                  • Libellés textuels remplacés par des icônes Lucide
                    accompagnées d'un libellé court explicite.
                  • Côté Premium : le bouton de téléchargement est
                    toujours rendu — désactivé/grisé quand l'admin a
                    coupé le DL, vert et cliquable sinon.
                    Plus aucun badge « DL bloqué » : la grammaire
                    visuelle (gris = inactif, vert = actif) suffit.
                 ===================================================== */}
        <div className="ebook-actions">
          {/* <!-- Bouton "Lire / Consulter / Aperçu / Réservé Premium" --> */}
          <button
            className="btn-read"
            onClick={onRead}
            // Le `aria-label` détaillé reste accessible aux lecteurs d'écran
            // même quand l'utilisateur ne voit qu'une icône + un mot court.
            aria-label={
              isHtml
                ? (isPremium ? 'Consulter la page web' : 'Contenu réservé aux utilisateurs Premium')
                : (isPremium ? 'Lire le document'   : `Aperçu gratuit (${ebook.pagesApercu} pages)`)
            }
          >
            {/* Icône contextuelle (taille uniforme, alignée verticalement) */}
            {isHtml
              ? (isPremium
                  ? <Globe size={18} aria-hidden="true" />
                  : <Lock size={18} aria-hidden="true" />)
              : (isPremium
                  ? <BookOpen size={18} aria-hidden="true" />
                  : <Eye size={18} aria-hidden="true" />)
            }
            {/* Libellé court — l'icône porte déjà l'essentiel du sens */}
            <span className="btn-label">
              {isHtml
                ? (isPremium ? 'Consulter' : 'Premium')
                : (isPremium ? 'Lire'      : `Aperçu (${ebook.pagesApercu})`)
              }
            </span>
          </button>

          {/* <!-- Bouton "Télécharger" — visible uniquement pour les Premium.
                 Deux états mutuellement exclusifs :
                  1. canDownload === true  → <a> vert, cliquable, déclenche
                     l'incrément du compteur de téléchargements.
                  2. canDownload === false → <button disabled> gris,
                     non-cliquable. On garde la même empreinte visuelle
                     (mêmes dimensions, même icône) pour que la carte
                     ne « saute » pas entre deux ebooks. --> */}
          {isPremium && canDownload && (
            // <!-- Lien actif (vert) : on déclenche d'abord l'incrément
            //      du compteur (fire-and-forget pour ne pas bloquer le
            //      téléchargement), puis le navigateur suit le href.
            //      Pour le HTML, on force un nom de fichier .html via
            //      l'attribut download (cf. downloadName plus haut). -->
            <a
              href={ebook.fichierURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-download is-active"
              download={downloadName || ''}
              aria-label="Télécharger le document"
              title="Télécharger le document"
              onClick={() => {
                // Fire-and-forget : si l'incrément échoue, le DL passe.
                incrementTelechargements(ebook.id);
              }}
            >
              <Download size={18} aria-hidden="true" />
            </a>
          )}
          {isPremium && !canDownload && (
            // <!-- Bouton désactivé (gris) : on utilise un vrai <button
            //      disabled> plutôt qu'un <span> pour bénéficier de la
            //      sémantique native (focus, lecteurs d'écran, etc.).
            //      Le `title` indique la raison au survol. -->
            <button
              type="button"
              className="btn-download is-disabled"
              disabled
              aria-label="Téléchargement désactivé par l'administrateur"
              title="Téléchargement désactivé par l'administrateur"
            >
              <Download size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EbookLibrary;
