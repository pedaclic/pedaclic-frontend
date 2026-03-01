/**
 * ============================================
 * PAGE DISCIPLINES - Liste des Matières
 * ============================================
 * 
 * Page publique affichant toutes les disciplines disponibles
 * avec filtrage par niveau (Collège / Lycée).
 * 
 * Fonctionnalités :
 * - Affichage des disciplines depuis Firestore
 * - Filtrage par niveau (Collège / Lycée)
 * - Filtrage par classe
 * - Cards cliquables vers les ressources
 * - États de chargement et erreurs
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calculator,
  Globe,
  FlaskConical,
  History,
  Languages,
  Music,
  Palette,
  Dumbbell,
  BookText,
  Atom,
  Lightbulb,
  GraduationCap,
  ChevronRight,
  Filter,
  Search,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  CLASSES_COLLEGE_OPTIONS,
  CLASSES_LYCEE_OPTIONS,
  normaliserClassePourComparaison,
  type Classe
} from '../types/cahierTextes.types';
import './Disciplines.css';

/* ==================== TYPES ==================== */

type Niveau = 'college' | 'lycee';

interface Discipline {
  id: string;
  nom: string;
  niveau: Niveau;
  classe: string;  // Firestore : 6eme/6ème, etc.
  ordre: number;
  coefficient?: number;
  couleur?: string;
  icone?: string;
  description?: string;
}

const classesByNiveau: Record<Niveau, Array<{ valeur: Classe; label: string }>> = {
  college: CLASSES_COLLEGE_OPTIONS,
  lycee: CLASSES_LYCEE_OPTIONS
};

/* ==================== DONNÉES STATIQUES ==================== */

/**
 * Mapping des icônes par nom de discipline
 * Utilisé pour afficher l'icône appropriée
 */
const disciplineIcons: Record<string, React.ReactNode> = {
  'Français': <BookText size={28} />,
  'Mathématiques': <Calculator size={28} />,
  'Anglais': <Languages size={28} />,
  'Histoire-Géographie': <Globe size={28} />,
  'Histoire': <History size={28} />,
  'Géographie': <Globe size={28} />,
  'SVT': <FlaskConical size={28} />,
  'Sciences de la Vie et de la Terre': <FlaskConical size={28} />,
  'Physique-Chimie': <Atom size={28} />,
  'Philosophie': <Lightbulb size={28} />,
  'Éducation Physique': <Dumbbell size={28} />,
  'EPS': <Dumbbell size={28} />,
  'Arts Plastiques': <Palette size={28} />,
  'Musique': <Music size={28} />,
  'default': <BookOpen size={28} />
};

/**
 * Couleurs par défaut des disciplines
 */
const disciplineColors: Record<string, string> = {
  'Français': '#3b82f6',
  'Mathématiques': '#ef4444',
  'Anglais': '#8b5cf6',
  'Histoire-Géographie': '#f59e0b',
  'SVT': '#10b981',
  'Physique-Chimie': '#06b6d4',
  'Philosophie': '#6366f1',
  'EPS': '#22c55e',
  'Arts Plastiques': '#ec4899',
  'Musique': '#a855f7'
};

/* ==================== COMPOSANT DISCIPLINES ==================== */

const Disciplines: React.FC = () => {
  // ===== ÉTATS =====
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [selectedNiveau, setSelectedNiveau] = useState<Niveau>('college');
  const [selectedClasse, setSelectedClasse] = useState<Classe | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* ==================== CHARGEMENT DES DONNÉES ==================== */

  /**
   * Charge les disciplines depuis Firestore
   */
  const fetchDisciplines = async () => {
    try {
      setLoading(true);
      setError(null);

      const disciplinesRef = collection(db, 'disciplines');
      const q = query(disciplinesRef, orderBy('ordre', 'asc'));
      const querySnapshot = await getDocs(q);

      const disciplinesData: Discipline[] = [];
      querySnapshot.forEach((doc) => {
        disciplinesData.push({
          id: doc.id,
          ...doc.data()
        } as Discipline);
      });

      setDisciplines(disciplinesData);
    } catch (err) {
      console.error('Erreur lors du chargement des disciplines:', err);
      setError('Impossible de charger les disciplines. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Charge les disciplines au montage du composant
   */
  useEffect(() => {
    fetchDisciplines();
  }, []);

  /**
   * Filtre les disciplines selon les critères sélectionnés
   */
  useEffect(() => {
    let filtered = disciplines.filter(d => d.niveau === selectedNiveau);

    // Filtre par classe (normalisation pour rétrocompat 6eme/6ème)
    if (selectedClasse !== 'all') {
      const selNorm = normaliserClassePourComparaison(selectedClasse);
      filtered = filtered.filter(d => normaliserClassePourComparaison(d.classe) === selNorm);
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.nom.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      );
    }

    // Supprimer les doublons (même nom)
    const uniqueFiltered = filtered.reduce((acc, curr) => {
      const exists = acc.find(d => d.nom === curr.nom);
      if (!exists) acc.push(curr);
      return acc;
    }, [] as Discipline[]);

    setFilteredDisciplines(uniqueFiltered);
  }, [disciplines, selectedNiveau, selectedClasse, searchQuery]);

  /* ==================== HELPERS ==================== */

  /**
   * Obtient l'icône d'une discipline
   */
  const getIcon = (nom: string): React.ReactNode => {
    return disciplineIcons[nom] || disciplineIcons['default'];
  };

  /**
   * Obtient la couleur d'une discipline
   */
  const getColor = (discipline: Discipline): string => {
    return discipline.couleur || disciplineColors[discipline.nom] || '#6b7280';
  };

  /* ==================== RENDU ==================== */

  return (
    <div className="disciplines-page">
      {/* ===== EN-TÊTE ===== */}
      <section className="disciplines-page__header">
        <div className="disciplines-page__header-content">
          <h1 className="disciplines-page__title">
            <GraduationCap size={40} />
            Nos Disciplines
          </h1>
          <p className="disciplines-page__subtitle">
            Explorez toutes les matières disponibles sur PedaClic, 
            du collège au lycée, avec des cours, exercices et quiz de qualité.
          </p>
        </div>
      </section>

      {/* ===== FILTRES ===== */}
      <section className="disciplines-page__filters">
        <div className="disciplines-page__container">
          
          {/* Tabs Niveau */}
          <div className="disciplines-page__niveau-tabs">
            <button
              className={`disciplines-page__niveau-tab ${selectedNiveau === 'college' ? 'disciplines-page__niveau-tab--active' : ''}`}
              onClick={() => {
                setSelectedNiveau('college');
                setSelectedClasse('all');
              }}
            >
              <span className="disciplines-page__niveau-icon">🏫</span>
              Collège
              <span className="disciplines-page__niveau-badge">6ème - 3ème</span>
            </button>
            <button
              className={`disciplines-page__niveau-tab ${selectedNiveau === 'lycee' ? 'disciplines-page__niveau-tab--active' : ''}`}
              onClick={() => {
                setSelectedNiveau('lycee');
                setSelectedClasse('all');
              }}
            >
              <span className="disciplines-page__niveau-icon">🎓</span>
              Lycée
              <span className="disciplines-page__niveau-badge">2nde - Terminale</span>
            </button>
          </div>

          {/* Filtres secondaires */}
          <div className="disciplines-page__secondary-filters">
            {/* Filtre par classe */}
            <div className="disciplines-page__filter-group">
              <label className="disciplines-page__filter-label">
                <Filter size={16} />
                Classe
              </label>
              <select
                className="disciplines-page__select"
                value={selectedClasse}
                onChange={(e) => setSelectedClasse(e.target.value as Classe | 'all')}
              >
                <option value="all">Toutes les classes</option>
                {classesByNiveau[selectedNiveau].map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Recherche */}
            <div className="disciplines-page__filter-group disciplines-page__filter-group--search">
              <label className="disciplines-page__filter-label">
                <Search size={16} />
                Rechercher
              </label>
              <input
                type="text"
                className="disciplines-page__input"
                placeholder="Nom de la matière..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTENU PRINCIPAL ===== */}
      <section className="disciplines-page__content">
        <div className="disciplines-page__container">
          
          {/* État de chargement */}
          {loading && (
            <div className="disciplines-page__loading">
              <div className="spinner"></div>
              <p>Chargement des disciplines...</p>
            </div>
          )}

          {/* État d'erreur */}
          {error && !loading && (
            <div className="disciplines-page__error">
              <AlertCircle size={48} />
              <p>{error}</p>
              <button 
                className="disciplines-page__retry-btn"
                onClick={fetchDisciplines}
              >
                <RefreshCw size={18} />
                Réessayer
              </button>
            </div>
          )}

          {/* Aucun résultat */}
          {!loading && !error && filteredDisciplines.length === 0 && (
            <div className="disciplines-page__empty">
              <BookOpen size={48} />
              <p>Aucune discipline trouvée pour ces critères.</p>
              {searchQuery && (
                <button 
                  className="disciplines-page__clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          )}

          {/* Grille des disciplines */}
          {!loading && !error && filteredDisciplines.length > 0 && (
            <>
              {/* Compteur de résultats */}
              <p className="disciplines-page__results-count">
                {filteredDisciplines.length} discipline{filteredDisciplines.length > 1 ? 's' : ''} 
                {selectedClasse !== 'all' && ` en ${selectedClasse}`}
              </p>

              {/* Grille */}
              <div className="disciplines-page__grid">
                {filteredDisciplines.map((discipline) => (
                  <Link
                    key={discipline.id}
                    to={`/disciplines/${discipline.id}`}
                    className="discipline-card"
                    style={{ '--card-color': getColor(discipline) } as React.CSSProperties}
                  >
                    {/* Icône */}
                    <div 
                      className="discipline-card__icon"
                      style={{ backgroundColor: getColor(discipline) }}
                    >
                      {getIcon(discipline.nom)}
                    </div>

                    {/* Contenu */}
                    <div className="discipline-card__content">
                      <h3 className="discipline-card__title">{discipline.nom}</h3>
                      
                      {discipline.description && (
                        <p className="discipline-card__description">
                          {discipline.description}
                        </p>
                      )}

                      {/* Métadonnées */}
                      <div className="discipline-card__meta">
                        {discipline.coefficient && (
                          <span className="discipline-card__coef">
                            Coef. {discipline.coefficient}
                          </span>
                        )}
                        <span className="discipline-card__classe">
                          {normaliserClassePourComparaison(discipline.classe)}
                        </span>
                      </div>
                    </div>

                    {/* Flèche */}
                    <ChevronRight className="discipline-card__arrow" size={20} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===== SECTION CTA ===== */}
      <section className="disciplines-page__cta">
        <div className="disciplines-page__container">
          <div className="disciplines-page__cta-content">
            <h2>🎯 Besoin de plus de contenu ?</h2>
            <p>
              Passez à Premium pour accéder à tous les quiz, exercices corrigés 
              et ressources exclusives pour réussir vos examens !
            </p>
            <Link to="/premium" className="disciplines-page__cta-btn">
              Découvrir Premium
              <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Disciplines;
