/**
 * ============================================================
 * PAGE DISCIPLINES - LISTE DES MATIÈRES
 * ============================================================
 * 
 * Affiche toutes les disciplines disponibles sur PedaClic
 * avec filtrage par niveau (Collège/Lycée) et classe.
 * 
 * Route : /disciplines
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// ==================== INTERFACES ====================

interface Discipline {
  id: string;
  nom: string;
  description: string;
  niveau: 'college' | 'lycee' | 'tous';
  classe: string;
  coefficient: number;
  icone: string;
  couleur: string;
  ordre: number;
}

// ==================== COMPOSANT PRINCIPAL ====================

const DisciplinesPage = () => {
  // ===== États =====
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [selectedNiveau, setSelectedNiveau] = useState<'tous' | 'college' | 'lycee'>('tous');
  const [searchQuery, setSearchQuery] = useState('');

  // ===== Chargement des disciplines =====
  useEffect(() => {
    const fetchDisciplines = async () => {
      try {
        setIsLoading(true);
        const q = query(collection(db, 'disciplines'), orderBy('ordre', 'asc'));
        const snapshot = await getDocs(q);
        
        const disciplinesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Discipline[];
        
        setDisciplines(disciplinesData);
        setFilteredDisciplines(disciplinesData);
        setError(null);
      } catch (err) {
        console.error('Erreur chargement disciplines:', err);
        setError('Impossible de charger les disciplines. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDisciplines();
  }, []);

  // ===== Filtrage =====
  useEffect(() => {
    let result = disciplines;

    // Filtre par niveau
    if (selectedNiveau !== 'tous') {
      result = result.filter(d => d.niveau === selectedNiveau);
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.nom.toLowerCase().includes(search) ||
        d.description.toLowerCase().includes(search) ||
        d.classe.toLowerCase().includes(search)
      );
    }

    setFilteredDisciplines(result);
  }, [disciplines, selectedNiveau, searchQuery]);

  // ===== Compteurs par niveau =====
  const countByNiveau = {
    tous: disciplines.length,
    college: disciplines.filter(d => d.niveau === 'college').length,
    lycee: disciplines.filter(d => d.niveau === 'lycee').length
  };

  // ===== Rendu chargement =====
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Chargement des disciplines...</p>
        </div>
      </div>
    );
  }

  // ===== Rendu erreur =====
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <h2 style={styles.errorTitle}>Erreur</h2>
          <p style={styles.errorText}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={styles.retryButton}
          >
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ===== Rendu principal =====
  return (
    <div style={styles.container}>
      {/* ===== Header ===== */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link to="/" style={styles.backLink}>← Accueil</Link>
          <h1 style={styles.title}>📚 Nos Disciplines</h1>
          <p style={styles.subtitle}>
            Découvrez toutes les matières disponibles sur PedaClic, 
            de la 6ème à la Terminale.
          </p>
        </div>
      </header>

      {/* ===== Filtres ===== */}
      <div style={styles.filtersSection}>
        <div style={styles.filtersContainer}>
          {/* Recherche */}
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher une discipline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={styles.clearSearch}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtres par niveau */}
          <div style={styles.niveauFilters}>
            <button
              onClick={() => setSelectedNiveau('tous')}
              style={{
                ...styles.filterButton,
                ...(selectedNiveau === 'tous' ? styles.filterButtonActive : {})
              }}
            >
              📖 Tous ({countByNiveau.tous})
            </button>
            <button
              onClick={() => setSelectedNiveau('college')}
              style={{
                ...styles.filterButton,
                ...(selectedNiveau === 'college' ? styles.filterButtonActive : {})
              }}
            >
              🏫 Collège ({countByNiveau.college})
            </button>
            <button
              onClick={() => setSelectedNiveau('lycee')}
              style={{
                ...styles.filterButton,
                ...(selectedNiveau === 'lycee' ? styles.filterButtonActive : {})
              }}
            >
              🎓 Lycée ({countByNiveau.lycee})
            </button>
          </div>
        </div>
      </div>

      {/* ===== Grille des disciplines ===== */}
      <main style={styles.main}>
        {filteredDisciplines.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>🔎</span>
            <h3 style={styles.emptyTitle}>Aucune discipline trouvée</h3>
            <p style={styles.emptyText}>
              Essayez de modifier vos critères de recherche.
            </p>
            <button 
              onClick={() => { setSelectedNiveau('tous'); setSearchQuery(''); }}
              style={styles.resetButton}
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredDisciplines.map((discipline) => (
              <DisciplineCard key={discipline.id} discipline={discipline} />
            ))}
          </div>
        )}
      </main>

      {/* ===== Footer ===== */}
      <footer style={styles.footer}>
        <p>🎓 PedaClic - L'école en un clic</p>
        <p style={styles.footerSubtext}>
          {disciplines.length} disciplines disponibles • 6ème à Terminale
        </p>
      </footer>
    </div>
  );
};

// ==================== COMPOSANT CARD ====================

interface DisciplineCardProps {
  discipline: Discipline;
}

const DisciplineCard = ({ discipline }: DisciplineCardProps) => {
  const niveauLabel = discipline.niveau === 'college' ? 'Collège' : 'Lycée';
  const niveauEmoji = discipline.niveau === 'college' ? '🏫' : '🎓';

  return (
    <Link 
      to={`/disciplines/${discipline.id}`} 
      style={styles.card}
      className="discipline-card"
    >
      {/* Icône et couleur */}
      <div 
        style={{
          ...styles.cardIcon,
          backgroundColor: discipline.couleur || '#2563eb'
        }}
      >
        <span style={styles.cardEmoji}>{discipline.icone || '📖'}</span>
      </div>

      {/* Contenu */}
      <div style={styles.cardContent}>
        <h3 style={styles.cardTitle}>{discipline.nom}</h3>
        
        <div style={styles.cardMeta}>
          <span style={styles.cardBadge}>
            {niveauEmoji} {niveauLabel}
          </span>
          <span style={styles.cardBadge}>
            📝 {discipline.classe}
          </span>
          <span style={styles.cardBadge}>
            ⚖️ Coef. {discipline.coefficient}
          </span>
        </div>

        <p style={styles.cardDescription}>
          {discipline.description}
        </p>
      </div>

      {/* Flèche */}
      <div style={styles.cardArrow}>→</div>
    </Link>
  );
};

// ==================== STYLES ====================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  
  // Header
  header: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    padding: '2rem 1rem 3rem'
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  backLink: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    display: 'inline-block',
    marginBottom: '1rem'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    margin: '0 0 0.5rem 0'
  },
  subtitle: {
    fontSize: '1.1rem',
    opacity: 0.9,
    margin: 0,
    maxWidth: '600px'
  },

  // Filtres
  filtersSection: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '1rem',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  filtersContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '1rem',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '0.5rem 1rem',
    flex: '1',
    maxWidth: '400px',
    minWidth: '200px'
  },
  searchIcon: {
    marginRight: '0.5rem',
    fontSize: '1rem'
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    flex: 1,
    fontSize: '1rem',
    outline: 'none'
  },
  clearSearch: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '1rem',
    padding: '0 0.25rem'
  },
  niveauFilters: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const
  },
  filterButton: {
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    border: '1px solid #e5e7eb',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.2s',
    color: '#374151'
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: 'white'
  },

  // Main
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem'
  },

  // Card
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    border: '1px solid #e5e7eb'
  },
  cardIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  cardEmoji: {
    fontSize: '1.75rem'
  },
  cardContent: {
    flex: 1,
    minWidth: 0
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 0.5rem 0'
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginBottom: '0.75rem'
  },
  cardBadge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    color: '#6b7280'
  },
  cardDescription: {
    fontSize: '0.9rem',
    color: '#6b7280',
    margin: 0,
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden'
  },
  cardArrow: {
    color: '#9ca3af',
    fontSize: '1.25rem',
    alignSelf: 'center',
    transition: 'transform 0.2s'
  },

  // États vides et erreurs
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh'
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '1rem',
    color: '#6b7280'
  },
  errorContainer: {
    textAlign: 'center' as const,
    padding: '4rem 2rem'
  },
  errorIcon: {
    fontSize: '4rem'
  },
  errorTitle: {
    color: '#dc2626',
    margin: '1rem 0 0.5rem'
  },
  errorText: {
    color: '#6b7280',
    marginBottom: '1.5rem'
  },
  retryButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '4rem 2rem',
    backgroundColor: 'white',
    borderRadius: '12px'
  },
  emptyIcon: {
    fontSize: '4rem'
  },
  emptyTitle: {
    color: '#1f2937',
    margin: '1rem 0 0.5rem'
  },
  emptyText: {
    color: '#6b7280',
    marginBottom: '1.5rem'
  },
  resetButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem'
  },

  // Footer
  footer: {
    textAlign: 'center' as const,
    padding: '2rem',
    backgroundColor: '#1f2937',
    color: 'white',
    marginTop: '2rem'
  },
  footerSubtext: {
    fontSize: '0.85rem',
    opacity: 0.7,
    marginTop: '0.5rem'
  }
};

// ==================== CSS GLOBAL (à ajouter) ====================
// Ajoutez ce CSS dans votre fichier globals.css ou créez un style tag

const GlobalStyles = () => (
  <style>{`
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .discipline-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.15) !important;
      border-color: #2563eb !important;
    }
    
    .discipline-card:hover .card-arrow {
      transform: translateX(4px);
    }
  `}</style>
);

// Export avec styles globaux
const DisciplinesPageWithStyles = () => (
  <>
    <GlobalStyles />
    <DisciplinesPage />
  </>
);

export default DisciplinesPageWithStyles;
