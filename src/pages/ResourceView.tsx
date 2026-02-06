/**
 * ============================================================
 * PAGE RESOURCE VIEW - AFFICHAGE COMPLET D'UNE RESSOURCE
 * ============================================================
 * 
 * Page de consultation d'une ressource pédagogique :
 * - Affichage du contenu complet (cours, exercice, etc.)
 * - Lecteur vidéo intégré pour les vidéos
 * - Visualiseur PDF pour les documents
 * - Accès Premium avec vérification
 * - Navigation vers ressource précédente/suivante
 * 
 * Route: /resources/:id
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Resource, Discipline, TypeRessource } from '../types';
import { getResourceById, getResourcesByChapter } from '../services/ResourceService';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// ==================== INTERFACES ====================

interface ResourceViewState {
  resource: Resource | null;
  discipline: Discipline | null;
  relatedResources: Resource[];
  loading: boolean;
  error: string | null;
}

// ==================== CONSTANTES ====================

/**
 * Configuration des types de ressources
 */
const TYPE_CONFIG: Record<TypeRessource, { 
  icon: string; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  cours: { 
    icon: '📖', 
    label: 'Cours',
    color: '#2563eb',
    bgColor: '#eff6ff'
  },
  exercice: { 
    icon: '✏️', 
    label: 'Exercice',
    color: '#059669',
    bgColor: '#ecfdf5'
  },
  video: { 
    icon: '🎬', 
    label: 'Vidéo',
    color: '#dc2626',
    bgColor: '#fef2f2'
  },
  document: { 
    icon: '📄', 
    label: 'Document',
    color: '#7c3aed',
    bgColor: '#f5f3ff'
  },
  quiz: { 
    icon: '❓', 
    label: 'Quiz',
    color: '#f59e0b',
    bgColor: '#fffbeb'
  }
};

// ==================== COMPOSANT ====================

const ResourceView: React.FC = () => {
  // ===== HOOKS =====
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ===== ÉTATS =====
  const [state, setState] = useState<ResourceViewState>({
    resource: null,
    discipline: null,
    relatedResources: [],
    loading: true,
    error: null
  });

  // État Premium de l'utilisateur (à connecter avec AuthContext)
  const [isPremiumUser] = useState(false); // TODO: Connecter avec auth

  // ===== CHARGEMENT DES DONNÉES =====
  useEffect(() => {
    const loadResource = async () => {
      if (!id) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: "ID de ressource manquant"
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // 1. Charger la ressource
        const resource = await getResourceById(id) as Resource;

        if (!resource) {
          throw new Error("Ressource introuvable");
        }

        // 2. Charger la discipline
        const disciplineRef = doc(db, 'disciplines', resource.disciplineId);
        const disciplineSnap = await getDoc(disciplineRef);
        
        let discipline: Discipline | null = null;
        if (disciplineSnap.exists()) {
          discipline = {
            id: disciplineSnap.id,
            ...disciplineSnap.data()
          } as Discipline;
        }

        // 3. Charger les ressources liées (même chapitre)
        let relatedResources: Resource[] = [];
        if (resource.chapitre) {
          const relatedList = await getResourcesByChapter(resource.chapitre);
	  relatedResources = (relatedList as Resource[]).filter(r => r.id !== id);
        }

        setState({
          resource,
          discipline,
          relatedResources,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error("Erreur chargement ressource:", error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Erreur inconnue"
        }));
      }
    };

    loadResource();
  }, [id]);

  // ===== HELPERS =====

  /**
   * Formatage de la durée
   */
  const formatDuration = (minutes?: number): string => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  /**
   * Formatage de la date
   */
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-SN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  /**
   * Déterminer le type de fichier
   */
  const getFileType = (url: string): 'pdf' | 'video' | 'image' | 'other' => {
    const lower = url.toLowerCase();
    if (lower.includes('.pdf')) return 'pdf';
    if (lower.includes('.mp4') || lower.includes('.webm')) return 'video';
    if (lower.includes('.jpg') || lower.includes('.jpeg') || 
        lower.includes('.png') || lower.includes('.gif') || 
        lower.includes('.webp')) return 'image';
    return 'other';
  };

  // ===== RENDU =====

  // État de chargement
  if (state.loading) {
    return (
      <div className="resource-view resource-view--loading">
        {/* ===== Skeleton Header ===== */}
        <div className="resource-view__header skeleton">
          <div className="skeleton-back"></div>
          <div className="skeleton-title"></div>
          <div className="skeleton-meta"></div>
        </div>
        
        {/* ===== Skeleton Content ===== */}
        <div className="resource-view__body">
          <div className="resource-view__content skeleton">
            <div className="skeleton-line skeleton-line--full"></div>
            <div className="skeleton-line skeleton-line--80"></div>
            <div className="skeleton-line skeleton-line--60"></div>
            <div className="skeleton-line skeleton-line--90"></div>
          </div>
        </div>
      </div>
    );
  }

  // État d'erreur
  if (state.error || !state.resource) {
    return (
      <div className="resource-view resource-view--error">
        <div className="error-container">
          <span className="error-icon">😕</span>
          <h2>Ressource introuvable</h2>
          <p>{state.error || "Cette ressource n'existe pas ou a été supprimée."}</p>
          <button 
            className="btn btn--primary"
            onClick={() => navigate(-1)}
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const { resource, discipline, relatedResources } = state;
  const typeConfig = TYPE_CONFIG[resource.type];
  const canAccess = !resource.isPremium || isPremiumUser;

  return (
    <div className="resource-view">
      {/* ============================================
          EN-TÊTE DE LA RESSOURCE
          ============================================ */}
      <header 
        className="resource-view__header"
        style={{ 
          '--type-color': typeConfig.color,
          '--type-bg': typeConfig.bgColor 
        } as React.CSSProperties}
      >
        {/* Navigation fil d'Ariane */}
        <nav className="resource-view__breadcrumb">
          <Link to="/disciplines" className="breadcrumb-link">
            Disciplines
          </Link>
          <span className="breadcrumb-separator">/</span>
          {discipline && (
            <>
              <Link 
                to={`/disciplines/${discipline.id}`}
                className="breadcrumb-link"
              >
                {discipline.nom}
              </Link>
              <span className="breadcrumb-separator">/</span>
            </>
          )}
          <span className="breadcrumb-current">{resource.titre}</span>
        </nav>

        {/* Bouton retour */}
        <button 
          className="resource-view__back"
          onClick={() => navigate(-1)}
        >
          ← Retour
        </button>

        {/* Informations principales */}
        <div className="resource-view__info">
          {/* Badge type */}
          <span 
            className="resource-view__type-badge"
            style={{ 
              background: typeConfig.bgColor,
              color: typeConfig.color
            }}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>

          {/* Titre */}
          <h1 className="resource-view__title">{resource.titre}</h1>

          {/* Description */}
          {resource.description && (
            <p className="resource-view__description">
              {resource.description}
            </p>
          )}

          {/* Métadonnées */}
          <div className="resource-view__meta">
            {/* Chapitre */}
            {resource.chapitre && (
              <span className="meta-item">
                📚 {resource.chapitre}
              </span>
            )}

            {/* Durée */}
            {resource.dureeEstimee && (
              <span className="meta-item">
                ⏱️ {formatDuration(resource.dureeEstimee)}
              </span>
            )}

            {/* Date */}
            <span className="meta-item">
              📅 {formatDate(resource.createdAt)}
            </span>

            {/* Badge Premium/Gratuit */}
            {resource.isPremium ? (
              <span className="meta-badge meta-badge--premium">
                ⭐ Premium
              </span>
            ) : (
              <span className="meta-badge meta-badge--free">
                ✓ Gratuit
              </span>
            )}
          </div>

          {/* Tags */}
          {resource.tags && resource.tags.length > 0 && (
            <div className="resource-view__tags">
              {resource.tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ============================================
          CORPS DE LA RESSOURCE
          ============================================ */}
      <div className="resource-view__body">
        {/* Vérification accès Premium */}
        {!canAccess ? (
          /* ===== Contenu bloqué (Premium requis) ===== */
          <div className="resource-view__locked">
            <div className="locked-content">
              <span className="locked-icon">🔒</span>
              <h2>Contenu Premium</h2>
              <p>
                Cette ressource est réservée aux abonnés Premium.
                Abonnez-vous pour accéder à tous les contenus pédagogiques !
              </p>
              <div className="locked-price">
                <span className="price">2 000 FCFA</span>
                <span className="period">/mois</span>
              </div>
              <Link to="/premium" className="btn btn--premium">
                ⭐ Devenir Premium
              </Link>
            </div>
            
            {/* Aperçu flou du contenu */}
            <div className="locked-preview">
              <div 
                className="preview-blur"
                dangerouslySetInnerHTML={{ 
                  __html: resource.contenu.substring(0, 200) + '...' 
                }}
              />
            </div>
          </div>
        ) : (
          /* ===== Contenu accessible ===== */
          <div className="resource-view__content">
            {/* Fichier joint (vidéo, PDF, image) */}
            {resource.fichierURL && (
              <div className="resource-view__media">
                {(() => {
                  const fileType = getFileType(resource.fichierURL);
                  
                  switch (fileType) {
                    case 'video':
                      return (
                        <div className="media-video">
                          <video 
                            controls 
                            className="video-player"
                            poster=""
                          >
                            <source 
                              src={resource.fichierURL} 
                              type="video/mp4" 
                            />
                            Votre navigateur ne supporte pas la lecture vidéo.
                          </video>
                        </div>
                      );
                    
                    case 'pdf':
                      return (
                        <div className="media-pdf">
                          <iframe
                            src={`${resource.fichierURL}#toolbar=0`}
                            className="pdf-viewer"
                            title={resource.titre}
                          />
                          <a 
                            href={resource.fichierURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--secondary pdf-download"
                          >
                            📥 Télécharger le PDF
                          </a>
                        </div>
                      );
                    
                    case 'image':
                      return (
                        <div className="media-image">
                          <img 
                            src={resource.fichierURL}
                            alt={resource.titre}
                            className="image-viewer"
                          />
                        </div>
                      );
                    
                    default:
                      return (
                        <div className="media-download">
                          <a 
                            href={resource.fichierURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--primary"
                          >
                            📥 Télécharger le fichier
                          </a>
                        </div>
                      );
                  }
                })()}
              </div>
            )}

            {/* Contenu textuel */}
            <article 
              className="resource-view__text"
              dangerouslySetInnerHTML={{ __html: resource.contenu }}
            />
          </div>
        )}

        {/* ============================================
            RESSOURCES LIÉES
            ============================================ */}
        {relatedResources.length > 0 && (
          <aside className="resource-view__related">
            <h3 className="related-title">
              📚 Autres ressources du chapitre
            </h3>
            <ul className="related-list">
              {relatedResources.slice(0, 5).map((related) => (
                <li key={related.id}>
                  <Link 
                    to={`/resources/${related.id}`}
                    className="related-item"
                  >
                    <span className="related-icon">
                      {TYPE_CONFIG[related.type].icon}
                    </span>
                    <div className="related-info">
                      <span className="related-name">{related.titre}</span>
                      <span className="related-type">
                        {TYPE_CONFIG[related.type].label}
                      </span>
                    </div>
                    {related.isPremium && (
                      <span className="related-premium">⭐</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* ============================================
          PIED DE PAGE ACTIONS
          ============================================ */}
      <footer className="resource-view__footer">
        <button
          className="btn btn--secondary"
          onClick={() => navigate(-1)}
        >
          ← Retour aux ressources
        </button>
        
        {discipline && (
          <Link 
            to={`/disciplines/${discipline.id}`}
            className="btn btn--primary"
          >
            Voir tous les chapitres →
          </Link>
        )}
      </footer>
    </div>
  );
};

export default ResourceView;
