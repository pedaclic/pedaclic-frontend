// ============================================================
// PedaClic — Phase 27 : MediathequePage
// Catalogue filtrable de contenus audio, vidéo, webinaires
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getMediatheque,
  getMediasProf,
  getAllMediasAdmin,
} from '../services/mediathequeService';
import type { MediaItem, FiltresMediatheque, TypeMedia } from '../types/mediatheque_types';
import {
  CONFIG_TYPE_MEDIA,
  DISCIPLINES_MEDIATHEQUE,
  NIVEAUX_MEDIATHEQUE,
  formatDuree,
} from '../types/mediatheque_types';
import '../styles/Mediatheque.css';

interface MediaCardProps {
  media: MediaItem;
  isPremium: boolean;
  onClick: () => void;
}

function MediaCard({ media, isPremium, onClick }: MediaCardProps) {
  const config = CONFIG_TYPE_MEDIA[media.type];
  const aAcces = !media.isPremium || isPremium;

  return (
    <article
      className="media-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Lire : ${media.titre}`}
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

      <div className="media-card__corps">
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

  const [filtres, setFiltres] = useState<FiltresMediatheque>({
    type: 'all',
    discipline: '',
    niveau: '',
    recherche: '',
    acces: 'all',
  });

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
    setFiltres({ type: 'all', discipline: '', niveau: '', recherche: '', acces: 'all' });
  };

  const ouvrirMedia = (mediaId: string) => {
    navigate(`/mediatheque/${mediaId}`);
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
            {DISCIPLINES_MEDIATHEQUE.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="mediatheque-filtres__select"
            value={filtres.niveau}
            onChange={e => changerFiltre('niveau', e.target.value)}
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {NIVEAUX_MEDIATHEQUE.map(n => (
              <option key={n.valeur} value={n.valeur}>{n.label}</option>
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
              filtres.recherche || filtres.acces !== 'all') && (
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
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
