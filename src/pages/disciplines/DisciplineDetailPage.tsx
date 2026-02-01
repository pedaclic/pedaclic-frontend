/**
 * PAGE DÉTAIL DISCIPLINE - PedaClic
 * Affiche les chapitres et ressources d'une discipline spécifique
 * avec distinction contenu gratuit/Premium
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Discipline, Resource, TypeRessource } from '../../index';
import { getDisciplineById } from '../../services/DisciplineService';
import { getResourcesByDiscipline, getChaptersForDiscipline } from '../../services/ResourceService';
import { useAuth } from '../../hooks/useAuth';
import './DisciplineDetailPage.css';

/**
 * Interface pour un chapitre avec ses ressources
 */
interface ChapterWithResources {
  chapitre: string;
  resources: Resource[];
}

/**
 * Icônes par type de ressource
 */
const typeIcons: Record<TypeRessource, string> = {
  cours: '📖',
  exercice: '✏️',
  video: '🎬',
  document: '📄',
  quiz: '❓'
};

/**
 * Labels par type de ressource
 */
const typeLabels: Record<TypeRessource, string> = {
  cours: 'Cours',
  exercice: 'Exercice',
  video: 'Vidéo',
  document: 'Document',
  quiz: 'Quiz'
};

const DisciplineDetailPage: React.FC = () => {
  // ==================== HOOKS ====================
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ==================== ÉTATS ====================
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [chapters, setChapters] = useState<ChapterWithResources[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtre par type de ressource
  const [filterType, setFilterType] = useState<TypeRessource | 'all'>('all');
  
  // Chapitre ouvert/fermé (accordéon)
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  // ==================== CHARGEMENT DES DONNÉES ====================
  useEffect(() => {
    const loadDisciplineData = async () => {
      if (!id) {
        setError('ID de discipline manquant');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Charger la discipline
        const disciplineData = await getDisciplineById(id);
        if (!disciplineData) {
          setError('Discipline non trouvée');
          setLoading(false);
          return;
        }
        setDiscipline(disciplineData);

        // Charger les ressources
        const resources = await getResourcesByDiscipline(id);
        
        // Charger la liste des chapitres
        const chaptersList = await getChaptersForDiscipline(id);

        // Organiser les ressources par chapitre
        const chaptersMap: Record<string, Resource[]> = {};
        
        // Initialiser tous les chapitres
        chaptersList.forEach(chap => {
          chaptersMap[chap] = [];
        });

        // Répartir les ressources
        resources.forEach(resource => {
          const chap = resource.chapitre || 'Non classé';
          if (!chaptersMap[chap]) {
            chaptersMap[chap] = [];
          }
          chaptersMap[chap].push(resource);
        });

        // Convertir en tableau et trier les ressources par ordre
        const chaptersWithResources: ChapterWithResources[] = Object.entries(chaptersMap)
          .map(([chapitre, res]) => ({
            chapitre,
            resources: res.sort((a, b) => a.ordre - b.ordre)
          }))
          .filter(c => c.resources.length > 0); // Exclure les chapitres vides

        setChapters(chaptersWithResources);
        
        // Ouvrir le premier chapitre par défaut
        if (chaptersWithResources.length > 0) {
          setOpenChapters(new Set([chaptersWithResources[0].chapitre]));
        }

      } catch (err) {
        console.error('Erreur chargement discipline:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadDisciplineData();
  }, [id]);

  // ==================== HANDLERS ====================
  
  /**
   * Toggle l'accordéon d'un chapitre
   */
  const toggleChapter = (chapitre: string) => {
    setOpenChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapitre)) {
        next.delete(chapitre);
      } else {
        next.add(chapitre);
      }
      return next;
    });
  };

  /**
   * Ouvrir tous les chapitres
   */
  const openAllChapters = () => {
    setOpenChapters(new Set(chapters.map(c => c.chapitre)));
  };

  /**
   * Fermer tous les chapitres
   */
  const closeAllChapters = () => {
    setOpenChapters(new Set());
  };

  /**
   * Vérifier si l'utilisateur peut accéder à une ressource Premium
   */
  const canAccessPremium = (): boolean => {
    if (!currentUser) return false;
    return currentUser.isPremium || currentUser.role === 'admin' || currentUser.role === 'prof';
  };

  /**
   * Filtrer les ressources par type
   */
  const filterResources = (resources: Resource[]): Resource[] => {
    if (filterType === 'all') return resources;
    return resources.filter(r => r.type === filterType);
  };

  /**
   * Naviguer vers une ressource
   */
  const handleResourceClick = (resource: Resource) => {
    if (resource.isPremium && !canAccessPremium()) {
      // Rediriger vers la page Premium
      navigate('/premium', { state: { from: `/disciplines/${id}` } });
    } else {
      // Naviguer vers la ressource
      navigate(`/ressource/${resource.id}`);
    }
  };

  // ==================== RENDU CONDITIONNEL ====================

  // État de chargement
  if (loading) {
    return (
      <div className="discipline-detail">
        <div className="container">
          <div className="discipline-detail__loading">
            <div className="spinner"></div>
            <p>Chargement de la discipline...</p>
          </div>
        </div>
      </div>
    );
  }

  // État d'erreur
  if (error || !discipline) {
    return (
      <div className="discipline-detail">
        <div className="container">
          <div className="discipline-detail__error">
            <span className="discipline-detail__error-icon">⚠️</span>
            <h2>Erreur</h2>
            <p>{error || 'Discipline non trouvée'}</p>
            <Link to="/disciplines" className="btn btn--primary">
              Retour aux disciplines
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Compter les ressources
  const totalResources = chapters.reduce((acc, c) => acc + c.resources.length, 0);
  const premiumCount = chapters.reduce(
    (acc, c) => acc + c.resources.filter(r => r.isPremium).length, 
    0
  );

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div className="discipline-detail">
      {/* ========== EN-TÊTE ========== */}
      <header 
        className="discipline-detail__header"
        style={{ '--discipline-color': discipline.couleur || '#2563eb' } as React.CSSProperties}
      >
        <div className="container">
          {/* Fil d'Ariane */}
          <nav className="discipline-detail__breadcrumb">
            <Link to="/">Accueil</Link>
            <span className="separator">›</span>
            <Link to="/disciplines">Disciplines</Link>
            <span className="separator">›</span>
            <span className="current">{discipline.nom}</span>
          </nav>

          {/* Informations discipline */}
          <div className="discipline-detail__info">
            <div className="discipline-detail__icon">
              {discipline.icone || '📚'}
            </div>
            <div className="discipline-detail__text">
              <h1 className="discipline-detail__title">{discipline.nom}</h1>
              <div className="discipline-detail__meta">
                <span className="discipline-detail__classe">
                  {discipline.classe.replace('eme', 'ème').replace('ere', 'ère')}
                </span>
                <span className="discipline-detail__niveau">
                  {discipline.niveau === 'college' ? 'Collège' : 'Lycée'}
                </span>
                {discipline.coefficient && (
                  <span className="discipline-detail__coef">
                    Coef. {discipline.coefficient}
                  </span>
                )}
              </div>
              {discipline.description && (
                <p className="discipline-detail__description">
                  {discipline.description}
                </p>
              )}
            </div>
          </div>

          {/* Statistiques */}
          <div className="discipline-detail__stats">
            <div className="stat-item">
              <span className="stat-value">{chapters.length}</span>
              <span className="stat-label">Chapitres</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{totalResources}</span>
              <span className="stat-label">Ressources</span>
            </div>
            <div className="stat-item stat-item--premium">
              <span className="stat-value">{premiumCount}</span>
              <span className="stat-label">Premium</span>
            </div>
          </div>
        </div>
      </header>

      {/* ========== CONTENU PRINCIPAL ========== */}
      <main className="discipline-detail__content">
        <div className="container">
          {/* Barre de filtres */}
          <div className="discipline-detail__filters">
            <div className="filters-left">
              {/* Filtre par type */}
              <div className="filter-group">
                <label htmlFor="filter-type">Filtrer par type :</label>
                <select 
                  id="filter-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TypeRessource | 'all')}
                  className="filter-select"
                >
                  <option value="all">Tous les types</option>
                  <option value="cours">📖 Cours</option>
                  <option value="exercice">✏️ Exercices</option>
                  <option value="video">🎬 Vidéos</option>
                  <option value="document">📄 Documents</option>
                  <option value="quiz">❓ Quiz</option>
                </select>
              </div>
            </div>

            <div className="filters-right">
              {/* Boutons accordéon */}
              <button 
                className="btn btn--outline btn--sm"
                onClick={openAllChapters}
              >
                Tout ouvrir
              </button>
              <button 
                className="btn btn--outline btn--sm"
                onClick={closeAllChapters}
              >
                Tout fermer
              </button>
            </div>
          </div>

          {/* Liste des chapitres (accordéon) */}
          {chapters.length === 0 ? (
            <div className="discipline-detail__empty">
              <span className="empty-icon">📭</span>
              <h3>Aucun contenu disponible</h3>
              <p>Les ressources de cette discipline seront bientôt ajoutées.</p>
            </div>
          ) : (
            <div className="chapters-list">
              {chapters.map((chapter, index) => {
                const filteredResources = filterResources(chapter.resources);
                const isOpen = openChapters.has(chapter.chapitre);

                // Si filtre actif et aucune ressource, masquer le chapitre
                if (filterType !== 'all' && filteredResources.length === 0) {
                  return null;
                }

                return (
                  <div 
                    key={chapter.chapitre}
                    className={`chapter-card ${isOpen ? 'chapter-card--open' : ''}`}
                  >
                    {/* En-tête du chapitre */}
                    <button
                      className="chapter-card__header"
                      onClick={() => toggleChapter(chapter.chapitre)}
                      aria-expanded={isOpen}
                    >
                      <div className="chapter-card__number">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="chapter-card__title">
                        <h3>{chapter.chapitre}</h3>
                        <span className="chapter-card__count">
                          {filteredResources.length} ressource{filteredResources.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="chapter-card__arrow">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Contenu du chapitre (ressources) */}
                    {isOpen && (
                      <div className="chapter-card__content">
                        <ul className="resources-list">
                          {filteredResources.map(resource => (
                            <li key={resource.id} className="resource-item">
                              <button
                                className={`resource-item__button ${resource.isPremium ? 'resource-item__button--premium' : ''}`}
                                onClick={() => handleResourceClick(resource)}
                              >
                                {/* Icône type */}
                                <span className="resource-item__icon">
                                  {typeIcons[resource.type]}
                                </span>

                                {/* Informations */}
                                <div className="resource-item__info">
                                  <span className="resource-item__title">
                                    {resource.titre}
                                  </span>
                                  <span className="resource-item__type">
                                    {typeLabels[resource.type]}
                                    {resource.dureeEstimee && (
                                      <> • {resource.dureeEstimee} min</>
                                    )}
                                  </span>
                                </div>

                                {/* Badge Premium ou Gratuit */}
                                {resource.isPremium ? (
                                  <span className="resource-item__badge resource-item__badge--premium">
                                    {canAccessPremium() ? '⭐ Premium' : '🔒 Premium'}
                                  </span>
                                ) : (
                                  <span className="resource-item__badge resource-item__badge--free">
                                    ✓ Gratuit
                                  </span>
                                )}

                                {/* Flèche */}
                                <span className="resource-item__arrow">→</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA Premium si non abonné */}
          {!canAccessPremium() && premiumCount > 0 && (
            <div className="discipline-detail__premium-cta">
              <div className="premium-cta__content">
                <span className="premium-cta__icon">🔓</span>
                <div className="premium-cta__text">
                  <h3>Débloquez {premiumCount} ressources Premium</h3>
                  <p>Accédez à tous les cours, exercices corrigés et quiz de cette discipline.</p>
                </div>
                <Link to="/premium" className="btn btn--premium">
                  Devenir Premium - 2 000 FCFA/mois
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DisciplineDetailPage;
