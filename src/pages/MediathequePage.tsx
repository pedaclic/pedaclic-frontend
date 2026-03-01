// ============================================================
// PedaClic — Phase 27 : MediathequePage
// Catalogue filtrable de contenus audio, vidéo, webinaires
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import { CLASSES } from '../types/cahierTextes.types';
import {
  getMediatheque,
  getMediasProf,
  getAllMediasAdmin,
  setStatutMedia,
  togglePremiumMedia,
  deleteMediaComplet,
} from '../services/mediathequeService';
import type { MediaItem, FiltresMediatheque, TypeMedia } from '../types/mediatheque_types';
import {
  CONFIG_TYPE_MEDIA,
  CONFIG_STATUT_MEDIA,
  formatDuree,
} from '../types/mediatheque_types';
import type { StatutMedia } from '../types/mediatheque_types';
import '../styles/Mediatheque.css';

interface MediaCardProps {
  media: MediaItem;
  isPremium: boolean;
  onClick: () => void;
  isAdmin?: boolean;
  onEdit?: (media: MediaItem) => void;
  onDelete?: (media: MediaItem) => void;
  onTogglePremium?: (media: MediaItem) => void;
  onSetStatut?: (media: MediaItem, statut: StatutMedia) => void;
}

function MediaCard({ media, isPremium, onClick, isAdmin, onEdit, onDelete, onTogglePremium, onSetStatut }: MediaCardProps) {
  const config = CONFIG_TYPE_MEDIA[media.type];
  const aAcces = !media.isPremium || isPremium;

  return (
    <article
      className={`media-card ${isAdmin ? 'media-card--admin' : ''}`}
      onClick={!isAdmin ? onClick : undefined}
      role={isAdmin ? undefined : 'button'}
      tabIndex={isAdmin ? undefined : 0}
      onKeyDown={!isAdmin ? (e => e.key === 'Enter' && onClick()) : undefined}
      aria-label={isAdmin ? undefined : `Lire : ${media.titre}`}
    >
      <div className="media-card__vignette">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.titre}
            className="media-card__image"
            loading="lazy"
          />
        ) : (
          <div className="media-card__vignette-default">
            <span>{config.emoji}</span>
          </div>
        )}

        {media.duree > 0 && (
          <span className="media-card__duree">{formatDuree(media.duree)}</span>
        )}

        {media.isPremium ? (
          <span className="media-card__badge-premium">⭐ Premium</span>
        ) : (
          <span className="media-card__badge-gratuit">✓ Gratuit</span>
        )}

        {media.isPremium && !aAcces && (
          <div className="media-card__apercu-overlay">
            🔒 Aperçu 30 secondes
          </div>
        )}

        <div className="media-card__play" aria-hidden="true">
          <div className="media-card__play-icone">▶</div>
        </div>
      </div>

      {isAdmin && onEdit && onDelete && onTogglePremium && onSetStatut && (
        <div className="media-card__admin-actions" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            className="media-card__admin-btn media-card__admin-btn--edit"
            onClick={() => onEdit(media)}
            title="Modifier"
          >
            ✏️
          </button>
          <button
            type="button"
            className={`media-card__admin-btn ${media.isPremium ? 'media-card__admin-btn--premium' : ''}`}
            onClick={() => onTogglePremium(media)}
            title={media.isPremium ? 'Passer en gratuit' : 'Passer en Premium'}
          >
            {media.isPremium ? '⭐' : '☆'}
          </button>
          <select
            className="media-card__admin-select"
            value={media.statut}
            onChange={e => onSetStatut(media, e.target.value as StatutMedia)}
            onClick={e => e.stopPropagation()}
            title="Statut"
          >
            {(Object.entries(CONFIG_STATUT_MEDIA) as [StatutMedia, (typeof CONFIG_STATUT_MEDIA)[StatutMedia]][]).map(([v, config]) => (
              <option key={v} value={v}>{config.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="media-card__admin-btn media-card__admin-btn--view"
            onClick={() => onClick()}
            title="Voir"
          >
            👁️
          </button>
          <button
            type="button"
            className="media-card__admin-btn media-card__admin-btn--delete"
            onClick={() => onDelete(media)}
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      )}

      <div className="media-card__corps" onClick={!isAdmin ? undefined : () => onClick()} style={isAdmin ? { cursor: 'pointer' } : undefined}>
        <span
          className="media-card__type"
          style={{
            backgroundColor: config.bg,
            color: config.couleur,
          }}
        >
          {config.emoji} {config.label}
        </span>

        <h3 className="media-card__titre">{media.titre}</h3>

        <p className="media-card__auteur">Par {media.auteurNom}</p>

        <div className="media-card__footer">
          <div className="media-card__meta">
            <span className="media-card__discipline">{media.discipline}</span>
            <span className="media-card__classe">
              {media.niveau} {media.classe ? `· ${media.classe}` : ''}
            </span>
          </div>
          <span className="media-card__vues">
            👁 {media.vues.toLocaleString('fr-SN')}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function MediathequePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [medias, setMedias] = useState<MediaItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtres, setFiltres] = useState<FiltresMediatheque & { statut?: string }>({
    type: 'all',
    discipline: '',
    niveau: '',
    recherche: '',
    acces: 'all',
    statut: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Disciplines depuis Firestore ; niveaux depuis CLASSES (même source que Cahier de textes)
  const { matieres: matieresOptions } = useDisciplinesOptions();

  const stats = useMemo(() => {
    const total   = medias.length;
    const videos  = medias.filter(m => m.type === 'video').length;
    const audios  = medias.filter(m => m.type === 'audio' || m.type === 'podcast').length;
    const webs    = medias.filter(m => m.type === 'webinaire').length;
    return { total, videos, audios, webs };
  }, [medias]);

  const mediasFiltres = useMemo(() => {
    return medias.filter(media => {
      if (filtres.type !== 'all' && media.type !== filtres.type) return false;
      if (filtres.discipline && media.discipline !== filtres.discipline) return false;
      if (filtres.niveau && media.niveau !== filtres.niveau) return false;
      if (filtres.acces === 'gratuit' && media.isPremium) return false;
      if (filtres.acces === 'premium' && !media.isPremium) return false;
      if (filtres.statut && media.statut !== filtres.statut) return false;
      if (filtres.recherche.trim()) {
        const terme = filtres.recherche.toLowerCase().trim();
        return (
          media.titre.toLowerCase().includes(terme) ||
          media.description.toLowerCase().includes(terme) ||
          media.discipline.toLowerCase().includes(terme) ||
          (media.tags ?? []).some(t => t.toLowerCase().includes(terme))
        );
      }
      return true;
    });
  }, [medias, filtres]);

  useEffect(() => {
    async function charger() {
      try {
        setChargement(true);
        setErreur(null);

        let data: MediaItem[];

        if (currentUser?.role === 'admin') {
          data = await getAllMediasAdmin();
        } else if (currentUser?.role === 'prof') {
          const [publies, siens] = await Promise.all([
            getMediatheque(),
            getMediasProf(currentUser.uid),
          ]);
          const idsPublies = new Set(publies.map(m => m.id));
          const siensPasDansPublies = siens.filter(m => !idsPublies.has(m.id));
          data = [...publies, ...siensPasDansPublies];
        } else {
          data = await getMediatheque();
        }

        setMedias(data);
      } catch (err) {
        console.error('[Médiathèque] Erreur chargement :', err);
        setErreur('Impossible de charger la médiathèque. Vérifiez votre connexion.');
      } finally {
        setChargement(false);
      }
    }

    charger();
  }, [currentUser]);

  const changerFiltre = <K extends keyof FiltresMediatheque>(
    cle: K,
    valeur: FiltresMediatheque[K]
  ) => {
    setFiltres(prev => ({ ...prev, [cle]: valeur }));
  };

  const reinitialiserFiltres = () => {
    setFiltres({ type: 'all', discipline: '', niveau: '', recherche: '', acces: 'all', statut: '' });
  };

  const ouvrirMedia = (mediaId: string) => {
    navigate(`/mediatheque/${mediaId}`);
  };

  const isAdmin = currentUser?.role === 'admin';

  const handleEdit = (media: MediaItem) => {
    navigate(`/mediatheque/${media.id}/modifier`);
  };

  const handleDeleteClick = (media: MediaItem) => {
    setDeleteConfirm(media);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteMediaComplet(deleteConfirm);
      setMedias(prev => prev.filter(m => m.id !== deleteConfirm.id));
      setActionMsg('Contenu supprimé.');
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      console.error('[Médiathèque] Erreur suppression:', err);
      setActionMsg('Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleTogglePremium = async (media: MediaItem) => {
    try {
      await togglePremiumMedia(media.id, !media.isPremium);
      setMedias(prev => prev.map(m => m.id === media.id ? { ...m, isPremium: !m.isPremium } : m));
      setActionMsg(media.isPremium ? 'Passé en gratuit' : 'Passé en Premium');
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      setActionMsg('Erreur');
    }
  };

  const handleSetStatut = async (media: MediaItem, statut: StatutMedia) => {
    try {
      await setStatutMedia(media.id, statut);
      setMedias(prev => prev.map(m => m.id === media.id ? { ...m, statut } : m));
      setActionMsg(`Statut : ${CONFIG_STATUT_MEDIA[statut].label}`);
      setTimeout(() => setActionMsg(null), 2000);
    } catch (err) {
      setActionMsg('Erreur');
    }
  };

  return (
    <div className="mediatheque-page">

      <section className="mediatheque-hero" aria-label="En-tête médiathèque">
        <h1 className="mediatheque-hero__titre">🎬 Médiathèque PedaClic</h1>
        <p className="mediatheque-hero__sous-titre">
          Cours en vidéo, podcasts pédagogiques et webinaires — L&apos;école en un clic
        </p>

        <div className="mediatheque-hero__stats" aria-label="Statistiques des contenus">
          <div className="mediatheque-hero__stat">
            <span className="mediatheque-hero__stat-nombre">{stats.total}</span>
            <span className="mediatheque-hero__stat-label">Contenus</span>
          </div>
          <div className="mediatheque-hero__stat">
            <span className="mediatheque-hero__stat-nombre">{stats.videos}</span>
            <span className="mediatheque-hero__stat-label">Vidéos</span>
          </div>
          <div className="mediatheque-hero__stat">
            <span className="mediatheque-hero__stat-nombre">{stats.audios}</span>
            <span className="mediatheque-hero__stat-label">Audio</span>
          </div>
          <div className="mediatheque-hero__stat">
            <span className="mediatheque-hero__stat-nombre">{stats.webs}</span>
            <span className="mediatheque-hero__stat-label">Webinaires</span>
          </div>
        </div>
      </section>

      <nav className="mediatheque-filtres" aria-label="Filtres de la médiathèque">
        <div className="mediatheque-filtres__ligne">
          <div className="mediatheque-filtres__recherche">
            <span className="mediatheque-filtres__recherche-icone" aria-hidden>🔍</span>
            <input
              type="search"
              className="mediatheque-filtres__recherche-input"
              placeholder="Rechercher un cours, une matière, un tag..."
              value={filtres.recherche}
              onChange={e => changerFiltre('recherche', e.target.value)}
              aria-label="Rechercher dans la médiathèque"
            />
          </div>

          <select
            className="mediatheque-filtres__select"
            value={filtres.discipline}
            onChange={e => changerFiltre('discipline', e.target.value)}
            aria-label="Filtrer par discipline"
          >
            <option value="">Toutes les matières</option>
            {matieresOptions.map(m => (
              <option key={m.valeur} value={m.valeur}>{m.label}</option>
            ))}
          </select>

          <select
            className="mediatheque-filtres__select"
            value={filtres.niveau}
            onChange={e => changerFiltre('niveau', e.target.value)}
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {CLASSES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="mediatheque-filtres__select"
            value={filtres.acces}
            onChange={e => changerFiltre('acces', e.target.value as FiltresMediatheque['acces'])}
            aria-label="Filtrer par type d'accès"
          >
            <option value="all">Tout l&apos;accès</option>
            <option value="gratuit">✓ Gratuit</option>
            <option value="premium">⭐ Premium</option>
          </select>

          {isAdmin && (
            <select
              className="mediatheque-filtres__select"
              value={filtres.statut || ''}
              onChange={e => setFiltres(prev => ({ ...prev, statut: e.target.value }))}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {(Object.entries(CONFIG_STATUT_MEDIA) as [StatutMedia, (typeof CONFIG_STATUT_MEDIA)[StatutMedia]][]).map(([v, config]) => (
                <option key={v} value={v}>{config.label}</option>
              ))}
            </select>
          )}

          {(currentUser?.role === 'admin' || currentUser?.role === 'prof') && (
            <button
              className="btn-principal"
              onClick={() => navigate('/mediatheque/ajouter')}
              aria-label="Ajouter un nouveau contenu"
            >
              + Ajouter
            </button>
          )}
        </div>

        <div className="mediatheque-filtres__types" role="group" aria-label="Filtrer par type">
          <button
            className={`mediatheque-filtres__type-btn${filtres.type === 'all' ? ' mediatheque-filtres__type-btn--actif' : ''}`}
            onClick={() => changerFiltre('type', 'all')}
            aria-pressed={filtres.type === 'all'}
          >
            🎯 Tous
          </button>

          {(Object.entries(CONFIG_TYPE_MEDIA) as [TypeMedia, (typeof CONFIG_TYPE_MEDIA)[TypeMedia]][]).map(
            ([type, config]) => (
              <button
                key={type}
                className={`mediatheque-filtres__type-btn${filtres.type === type ? ' mediatheque-filtres__type-btn--actif' : ''}`}
                onClick={() => changerFiltre('type', type)}
                aria-pressed={filtres.type === type}
              >
                {config.emoji} {config.label}
              </button>
            )
          )}
        </div>
      </nav>

      <main className="mediatheque-contenu">

        <div className="mediatheque-catalogue__header">
          <h2 className="mediatheque-catalogue__titre">
            {filtres.type === 'all' ? 'Tous les contenus' : CONFIG_TYPE_MEDIA[filtres.type as TypeMedia]?.label ?? 'Contenus'}
          </h2>
          {!chargement && (
            <span className="mediatheque-catalogue__compteur">
              {mediasFiltres.length} résultat{mediasFiltres.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {chargement && (
          <div className="mediatheque-chargement" role="status" aria-live="polite">
            <div className="mediatheque-spinner" aria-hidden="true" />
            <p>Chargement de la médiathèque...</p>
          </div>
        )}

        {!chargement && erreur && (
          <div className="mediatheque-vide" role="alert">
            <span className="mediatheque-vide__emoji">⚠️</span>
            <h3 className="mediatheque-vide__titre">Erreur de chargement</h3>
            <p className="mediatheque-vide__message">{erreur}</p>
            <button
              className="btn-principal"
              onClick={() => window.location.reload()}
            >
              🔄 Réessayer
            </button>
          </div>
        )}

        {!chargement && !erreur && mediasFiltres.length === 0 && (
          <div className="mediatheque-vide" role="status">
            <span className="mediatheque-vide__emoji">📭</span>
            <h3 className="mediatheque-vide__titre">Aucun contenu trouvé</h3>
            <p className="mediatheque-vide__message">
              {medias.length === 0
                ? 'La médiathèque ne contient pas encore de contenus publiés.'
                : 'Aucun contenu ne correspond à vos critères de recherche.'}
            </p>
            {(filtres.type !== 'all' || filtres.discipline || filtres.niveau ||
              filtres.recherche || filtres.acces !== 'all' || filtres.statut) && (
              <button className="btn-secondaire" onClick={reinitialiserFiltres}>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {!chargement && !erreur && mediasFiltres.length > 0 && (
          <div
            className="mediatheque-grille"
            role="list"
            aria-label="Liste des contenus multimédias"
          >
            {mediasFiltres.map(media => (
              <div key={media.id} role="listitem">
                <MediaCard
                  media={media}
                  isPremium={currentUser?.isPremium ?? false}
                  onClick={() => ouvrirMedia(media.id)}
                  isAdmin={isAdmin}
                  onEdit={isAdmin ? handleEdit : undefined}
                  onDelete={isAdmin ? handleDeleteClick : undefined}
                  onTogglePremium={isAdmin ? handleTogglePremium : undefined}
                  onSetStatut={isAdmin ? handleSetStatut : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {actionMsg && (
          <div className="mediatheque-toast" role="status">
            {actionMsg}
          </div>
        )}

        {deleteConfirm && (
          <div className="mediatheque-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="mediatheque-modal" onClick={e => e.stopPropagation()}>
              <h3>Supprimer ce contenu ?</h3>
              <p>« {deleteConfirm.titre} » sera définitivement supprimé.</p>
              <div className="mediatheque-modal__actions">
                <button type="button" className="btn-secondaire" onClick={() => setDeleteConfirm(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-principal"
                  style={{ background: '#dc2626' }}
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
