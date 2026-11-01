/**
 * ============================================================
 * PAGE RESOURCE VIEW - AFFICHAGE COMPLET D'UNE RESSOURCE
 * ============================================================
 *
 * Page de consultation d'une ressource pédagogique :
 * - Affichage du contenu complet (cours, exercice, etc.)
 * - Lecteur vidéo intégré pour les vidéos (fichier ou YouTube)
 * - Visualiseur PDF pour les documents + téléchargement
 * - Accès Premium avec vérification
 * - Ressources liées du même chapitre
 *
 * Route: /ressources/:id
 *
 * [FIX ressources — v1.1.0]
 *  - Lecture via ResourceService.getById (dates Firestore converties en Date :
 *    l'ancien appel brut faisait planter formatDate sur un Timestamp).
 *  - Ressources liées : chargement non bloquant, filtré côté client
 *    (champ `chapitre`, pas d'index composite requis).
 *  - Lien des ressources liées corrigé (/ressources/…).
 *  - Type de fichier déduit du nom du fichier (les URL Firebase Storage
 *    se terminent par « ?alt=media&token=… »).
 *  - Contenu texte brut : retours à la ligne conservés.
 *  - Bouton de téléchargement explicite (nom de fichier d'origine).
 *  - Vidéo externe (YouTube) prise en charge.
 *
 * @author PedaClic Team
 * @version 1.1.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Resource, Discipline, TypeRessource } from '../types';
import { ResourceService } from '../services/ResourceService';
import { ChapitreService } from '../services/chapitreService';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { marquerRessourceVue } from '../services/progressionService';

// ==================== INTERFACES ====================

interface ResourceViewState {
  resource: Resource | null;
  discipline: Discipline | null;
  relatedResources: Resource[];
  chapitreNom: string | null;     // [FIX] libellé lisible du chapitre
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

/** [FIX] Configuration de repli si le type stocké est inconnu (évite un crash) */
const TYPE_FALLBACK = {
  icon: '📌',
  label: 'Ressource',
  color: '#475569',
  bgColor: '#f1f5f9'
};

const getTypeConfig = (type?: string) =>
  (type && TYPE_CONFIG[type as TypeRessource]) || TYPE_FALLBACK;

// ==================== HELPERS PURS ====================

/**
 * [FIX] Déterminer le type de fichier.
 * On teste d'abord le nom d'origine (fichierNom), puis le chemin de l'URL
 * débarrassé de sa query string et décodé (les URL Firebase Storage encodent
 * le chemin : « ressources%2Fid%2Ffichier.pdf?alt=media&token=… »).
 */
export const getFileType = (
  url: string,
  nom?: string
): 'pdf' | 'video' | 'image' | 'other' => {
  let chemin = url.split('?')[0];
  try { chemin = decodeURIComponent(chemin); } catch { /* URL non décodable : on garde brut */ }
  const cible = `${nom || ''} ${chemin}`.toLowerCase();
  if (/\.pdf\b/.test(cible)) return 'pdf';
  if (/\.(mp4|webm|ogg|mov)\b/.test(cible)) return 'video';
  if (/\.(jpe?g|png|gif|webp|svg)\b/.test(cible)) return 'image';
  return 'other';
};

/** [FIX] Le contenu contient-il du HTML ? (sinon : texte brut saisi au clavier) */
const estHtml = (texte: string): boolean => /<\/?[a-z][\s\S]*?>/i.test(texte);

/** [FIX] URL d'intégration YouTube à partir d'une URL « watch » ou « youtu.be » */
const toEmbedUrl = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};

/**
 * [FIX] Téléchargement d'un fichier distant avec son nom d'origine.
 * L'attribut HTML `download` est ignoré pour une URL d'un autre domaine
 * (Firebase Storage) : on récupère donc le fichier en Blob. En cas d'échec
 * (CORS, réseau), on ouvre simplement le fichier dans un nouvel onglet.
 */
export const telechargerFichier = async (url: string, nom?: string): Promise<void> => {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const blob = await reponse.blob();
    const lienLocal = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lienLocal;
    a.download = nom || 'fichier';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(lienLocal), 1000);
  } catch (err) {
    console.warn('Téléchargement direct impossible, ouverture du fichier :', err);
    window.open(url, '_blank', 'noopener,noreferrer');
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
    chapitreNom: null,
    loading: true,
    error: null
  });

  /** [FIX] Téléchargement en cours (désactive le bouton) */
  const [downloading, setDownloading] = useState(false);

  // État Premium de l'utilisateur
  const { currentUser, loading: authLoading } = useAuth();
  // [FIX] l'administrateur garde l'accès complet (contrôle de ses contenus)
  const isPremiumUser = currentUser?.isPremium || currentUser?.role === 'admin' || false;

  // ===== CHARGEMENT DES DONNÉES =====
  useEffect(() => {
    // [FIX] Attendre la restauration de la session : les règles Firestore
    // exigent un utilisateur connecté pour lire « ressources ».
    if (authLoading) return;

    const loadResource = async () => {
      if (!id) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: "ID de ressource manquant"
        }));
        return;
      }

      // [FIX] Visiteur non connecté : message clair au lieu d'une erreur technique
      if (!currentUser) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: "Connectez-vous pour consulter cette ressource."
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // 1. Charger la ressource (format normalisé, dates converties)
        const resource = await ResourceService.getById(id);

        if (!resource) {
          throw new Error("Ressource introuvable");
        }

        // [FIX] Ressource désactivée : invisible pour les non-admins
        if (resource.actif === false && currentUser.role !== 'admin') {
          throw new Error("Cette ressource n'est pas disponible pour le moment.");
        }

        // 2. Charger la discipline (non bloquant)
        let discipline: Discipline | null = null;
        try {
          const disciplineSnap = await getDoc(doc(db, 'disciplines', resource.disciplineId));
          if (disciplineSnap.exists()) {
            discipline = {
              id: disciplineSnap.id,
              ...disciplineSnap.data()
            } as Discipline;
          }
        } catch (e) {
          console.warn('Discipline indisponible :', e);
        }

        // 3. [FIX] Libellé du chapitre + ressources liées (non bloquants)
        const chapitreKey = resource.chapitre || resource.chapitreId;
        let chapitreNom: string | null = null;
        let relatedResources: Resource[] = [];
        if (chapitreKey) {
          try {
            const chap = await ChapitreService.getById(chapitreKey);
            if (chap) chapitreNom = `${chap.numero}. ${chap.titre}`;
          } catch { /* l'ID restera affiché tel quel */ }

          try {
            // Même requête que la page discipline (index déjà existant),
            // puis filtrage local par chapitre.
            const memeDiscipline = await ResourceService.getAll({ disciplineId: resource.disciplineId });
            relatedResources = memeDiscipline.filter(r =>
              r.id !== id &&
              r.actif !== false &&
              (r.chapitre || r.chapitreId) === chapitreKey
            );
          } catch (e) {
            console.warn('Ressources liées indisponibles :', e);
          }
        }

        setState({
          resource,
          discipline,
          relatedResources,
          chapitreNom,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, currentUser?.uid, currentUser?.role]);


  // ===== PHASE 14 : SUIVI PROGRESSION =====
  useEffect(() => {
    const trackResourceView = async () => {
      if (!currentUser || !state.resource || !state.discipline) return;
      if (state.resource.isPremium && !isPremiumUser) return;
      try {
        await marquerRessourceVue(
          currentUser.uid,
          state.resource.disciplineId,
          state.discipline.nom || state.resource.disciplineId,
          state.resource.id!
        );
      } catch (err) {
        console.error("Erreur suivi progression :", err);
      }
    };
    trackResourceView();
  }, [state.resource, state.discipline, currentUser, isPremiumUser]);
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
   * [FIX] tolère Date, Timestamp Firestore ou valeur absente
   */
  const formatDate = (date: unknown): string => {
    const d: Date | null =
      date instanceof Date ? date
      : date && typeof (date as { toDate?: () => Date }).toDate === 'function'
        ? (date as { toDate: () => Date }).toDate()
        : null;
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-SN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  /** [FIX] Lance le téléchargement du fichier joint */
  const handleDownload = async (url: string, nom?: string) => {
    setDownloading(true);
    try {
      await telechargerFichier(url, nom);
    } finally {
      setDownloading(false);
    }
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
          <h2>Ressource indisponible</h2>
          <p>{state.error || "Cette ressource n'existe pas ou a été supprimée."}</p>
          {/* [FIX] lien de connexion pour un visiteur non connecté */}
          {!currentUser && (
            <Link to="/connexion" className="btn btn--primary" style={{ marginRight: '0.5rem' }}>
              Se connecter
            </Link>
          )}
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

  const { resource, discipline, relatedResources, chapitreNom } = state;
  const typeConfig = getTypeConfig(resource.type);
  const canAccess = !resource.isPremium || isPremiumUser;
  // [FIX] valeurs sûres (champs facultatifs dans Firestore)
  const contenu = resource.contenu || '';
  const duree = resource.dureeEstimee || resource.duree;
  const videoEmbed = resource.urlExterne ? toEmbedUrl(resource.urlExterne) : null;

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
            {/* Chapitre ([FIX] libellé lisible si disponible) */}
            {(chapitreNom || resource.chapitre) && (
              <span className="meta-item">
                📚 {chapitreNom || resource.chapitre}
              </span>
            )}

            {/* Durée ([FIX] champ `duree` du formulaire admin pris en compte) */}
            {duree && (
              <span className="meta-item">
                ⏱️ {formatDuration(duree)}
              </span>
            )}

            {/* Date */}
            {formatDate(resource.createdAt) && (
              <span className="meta-item">
                📅 {formatDate(resource.createdAt)}
              </span>
            )}

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
            {contenu && (
              <div className="locked-preview">
                <div
                  className="preview-blur"
                  dangerouslySetInnerHTML={{
                    __html: contenu.substring(0, 200) + '...'
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          /* ===== Contenu accessible ===== */
          <div className="resource-view__content">
            {/* [FIX] Vidéo externe (YouTube) */}
            {resource.urlExterne && (
              <div className="resource-view__media">
                {videoEmbed ? (
                  <div className="media-video media-video--embed">
                    <iframe
                      src={videoEmbed}
                      title={resource.titre}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a
                    href={resource.urlExterne}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary"
                  >
                    🔗 Ouvrir le lien externe
                  </a>
                )}
              </div>
            )}

            {/* Fichier joint (vidéo, PDF, image) */}
            {resource.fichierURL && (
              <div className="resource-view__media">
                {(() => {
                  const fichierURL = resource.fichierURL;
                  const fileType = getFileType(fichierURL, resource.fichierNom);

                  switch (fileType) {
                    case 'video':
                      return (
                        <div className="media-video">
                          {/* [FIX] src direct : le navigateur détecte le format */}
                          <video
                            controls
                            className="video-player"
                            src={fichierURL}
                          >
                            Votre navigateur ne supporte pas la lecture vidéo.
                          </video>
                        </div>
                      );

                    case 'pdf':
                      return (
                        <div className="media-pdf">
                          <iframe
                            src={fichierURL}
                            className="pdf-viewer"
                            title={resource.titre}
                          />
                        </div>
                      );

                    case 'image':
                      return (
                        <div className="media-image">
                          <img
                            src={fichierURL}
                            alt={resource.titre}
                            className="image-viewer"
                          />
                        </div>
                      );

                    default:
                      return null; // le bouton de téléchargement ci-dessous suffit
                  }
                })()}

                {/* [FIX] Barre d'actions du fichier joint — toujours visible */}
                <div className="resource-view__file-actions">
                  <span className="file-actions__name">
                    📎 {resource.fichierNom || 'Fichier joint'}
                  </span>
                  <a
                    href={resource.fichierURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary"
                  >
                    ↗ Ouvrir
                  </a>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={downloading}
                    onClick={() => handleDownload(resource.fichierURL!, resource.fichierNom)}
                  >
                    {downloading ? '⏳ Téléchargement…' : '📥 Télécharger'}
                  </button>
                </div>
              </div>
            )}

            {/* Contenu textuel ([FIX] texte brut : retours à la ligne conservés) */}
            {contenu && (
              estHtml(contenu) ? (
                <article
                  className="resource-view__text"
                  dangerouslySetInnerHTML={{ __html: contenu }}
                />
              ) : (
                <article className="resource-view__text resource-view__text--plain">
                  {contenu}
                </article>
              )
            )}
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
                  {/* [FIX] route corrigée : /ressources (et non /resources) */}
                  <Link
                    to={`/ressources/${related.id}`}
                    className="related-item"
                  >
                    <span className="related-icon">
                      {getTypeConfig(related.type).icon}
                    </span>
                    <div className="related-info">
                      <span className="related-name">{related.titre}</span>
                      <span className="related-type">
                        {getTypeConfig(related.type).label}
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
