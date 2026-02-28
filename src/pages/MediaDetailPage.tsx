// ============================================================
// PedaClic — Phase 27 : MediaDetailPage
// Lecteur multimédia + informations + médias similaires
// ============================================================

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getMediaById,
  getMediasSimilaires,
  incrementerVues,
  getProgression,
  sauvegarderProgression,
} from '../services/mediathequeService';
import type { MediaItem, MediaVue } from '../types/mediatheque_types';
import {
  CONFIG_TYPE_MEDIA,
  formatDuree,
  DUREE_APERCU_GRATUIT,
} from '../types/mediatheque_types';
import '../styles/Mediatheque.css';

interface LecteurVideoProps {
  url: string;
  titre: string;
  thumbnailUrl?: string;
  aAccesPremium: boolean;
  positionInitiale: number;
  onTempsChange: (secondes: number) => void;
  onAperçuTermine: () => void;
}

function LecteurVideo({
  url,
  titre,
  thumbnailUrl,
  aAccesPremium,
  positionInitiale,
  onTempsChange,
  onAperçuTermine,
}: LecteurVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [overlayPremium, setOverlayPremium] = useState(false);
  const [repriseProposee, setRepriseProposee] = useState(
    positionInitiale > 5
  );

  const handleMetadata = () => {
    if (videoRef.current && positionInitiale > 0 && repriseProposee) {
      // Proposition de reprise gérée via l'UI
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;

    onTempsChange(t);

    if (!aAccesPremium && t >= DUREE_APERCU_GRATUIT) {
      videoRef.current.pause();
      setOverlayPremium(true);
      onAperçuTermine();
    }
  };

  const reprendreDepuisSauvegarde = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = positionInitiale;
      videoRef.current.play();
      setRepriseProposee(false);
    }
  };

  const commencerDepuisDebut = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setRepriseProposee(false);
    }
  };

  return (
    <div className="media-player">
      <div className="media-player__video-wrapper">
        <video
          ref={videoRef}
          className="media-player__video"
          controls
          preload="metadata"
          poster={thumbnailUrl}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={handleTimeUpdate}
          playsInline
          aria-label={`Lecteur vidéo : ${titre}`}
        >
          <source src={url} />
          <p>Votre navigateur ne supporte pas la lecture vidéo.</p>
        </video>

        {overlayPremium && (
          <div className="media-player__overlay-premium" role="dialog" aria-modal>
            <div style={{ fontSize: '3rem' }}>🔒</div>
            <h3>Aperçu terminé</h3>
            <p>
              Abonnez-vous à PedaClic Premium pour accéder à la totalité de ce contenu
              et à toute la médiathèque.
            </p>
            <Link to="/premium" className="btn-premium-overlay">
              ⭐ Devenir Premium — 2 000 FCFA/mois
            </Link>
          </div>
        )}
      </div>

      {repriseProposee && positionInitiale > 5 && (
        <div className="media-player__reprise" role="complementary">
          <span className="media-player__reprise-texte">
            ▶ Reprendre à {formatDuree(positionInitiale)}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondaire"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
              onClick={commencerDepuisDebut}
            >
              Depuis le début
            </button>
            <button
              className="media-player__reprise-btn"
              onClick={reprendreDepuisSauvegarde}
            >
              Reprendre
            </button>
          </div>
        </div>
      )}

      <div
        className="media-player__progression-barre"
        aria-hidden="true"
        title="Progression de visionnage"
      >
        <div
          className="media-player__progression-rempli"
          style={{
            width: videoRef.current?.duration
              ? `${(positionInitiale / videoRef.current.duration) * 100}%`
              : '0%',
          }}
        />
      </div>
    </div>
  );
}

interface LecteurAudioProps {
  url: string;
  titre: string;
  thumbnailUrl?: string;
  typeMedia: 'audio' | 'podcast';
  aAccesPremium: boolean;
  positionInitiale: number;
  onTempsChange: (secondes: number) => void;
  onAperçuTermine: () => void;
}

function LecteurAudio({
  url,
  titre,
  thumbnailUrl,
  typeMedia,
  aAccesPremium,
  positionInitiale,
  onTempsChange,
  onAperçuTermine,
}: LecteurAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [overlayPremium, setOverlayPremium] = useState(false);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    onTempsChange(t);

    if (!aAccesPremium && t >= DUREE_APERCU_GRATUIT) {
      audioRef.current.pause();
      setOverlayPremium(true);
      onAperçuTermine();
    }
  };

  const handleLoaded = () => {
    if (audioRef.current && positionInitiale > 5) {
      audioRef.current.currentTime = positionInitiale;
    }
  };

  const config = CONFIG_TYPE_MEDIA[typeMedia];

  return (
    <div className="media-player" style={{ position: 'relative' }}>
      <div className="media-player__audio-wrapper">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={titre} className="media-player__audio-art" />
        ) : (
          <div className="media-player__audio-art-placeholder">
            {config.emoji}
          </div>
        )}

        <p className="media-player__audio-titre">{titre}</p>

        <audio
          ref={audioRef}
          className="media-player__audio"
          controls
          preload="metadata"
          onLoadedMetadata={handleLoaded}
          onTimeUpdate={handleTimeUpdate}
          aria-label={`Lecteur audio : ${titre}`}
        >
          <source src={url} />
          <p>Votre navigateur ne supporte pas la lecture audio.</p>
        </audio>
      </div>

      {overlayPremium && (
        <div className="media-player__overlay-premium" role="dialog">
          <div style={{ fontSize: '3rem' }}>🔒</div>
          <h3>Aperçu terminé</h3>
          <p>Accédez à la totalité de cet audio avec PedaClic Premium.</p>
          <Link to="/premium" className="btn-premium-overlay">
            ⭐ Devenir Premium — 2 000 FCFA/mois
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MediaDetailPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [similaires, setSimilaires] = useState<MediaItem[]>([]);
  const [progression, setProgression] = useState<MediaVue | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [aperçuTermine, setAperçuTermine] = useState(false);

  const positionRef = useRef(0);
  const sauvegardeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const estAdminOuProf = currentUser?.role === 'admin' || currentUser?.role === 'prof';
  const aAccesPremium  = estAdminOuProf ||
    !media?.isPremium ||
    (currentUser?.isPremium ?? false);

  useEffect(() => {
    if (!mediaId) return;

    async function charger() {
      try {
        setChargement(true);
        setErreur(null);

        const mediaData = await getMediaById(mediaId!);
        if (!mediaData) {
          setErreur('Ce contenu est introuvable ou a été supprimé.');
          return;
        }
        setMedia(mediaData);

        const [sim, prog] = await Promise.all([
          getMediasSimilaires(mediaId!, mediaData.discipline),
          currentUser
            ? getProgression(currentUser.uid, mediaId!)
            : Promise.resolve(null),
        ]);

        setSimilaires(sim);
        setProgression(prog);

        if (prog?.positionReprise) {
          positionRef.current = prog.positionReprise;
        }

        await incrementerVues(mediaId!);

      } catch (err) {
        console.error('[MediaDetail] Erreur chargement :', err);
        setErreur('Impossible de charger ce contenu. Réessayez plus tard.');
      } finally {
        setChargement(false);
      }
    }

    charger();
    return () => {
      if (sauvegardeTimerRef.current) {
        clearInterval(sauvegardeTimerRef.current);
      }
    };
  }, [mediaId, currentUser]);

  useEffect(() => {
    if (!currentUser || !media) return;

    sauvegardeTimerRef.current = setInterval(async () => {
      if (positionRef.current > 0) {
        await sauvegarderProgression(
          currentUser.uid,
          media.id,
          positionRef.current,
          positionRef.current,
          media.duree
        );
      }
    }, 30_000);

    return () => {
      if (sauvegardeTimerRef.current) {
        clearInterval(sauvegardeTimerRef.current);
      }
    };
  }, [currentUser, media]);

  const handleTempsChange = useCallback((secondes: number) => {
    positionRef.current = secondes;
  }, []);

  const handleAperçuTermine = useCallback(() => {
    setAperçuTermine(true);
  }, []);

  if (chargement) {
    return (
      <div className="media-detail-page">
        <div className="mediatheque-chargement" role="status">
          <div className="mediatheque-spinner" />
          <p>Chargement du contenu...</p>
        </div>
      </div>
    );
  }

  if (erreur || !media) {
    return (
      <div className="media-detail-page">
        <div className="media-detail-header">
          <button className="media-detail-retour" onClick={() => navigate('/mediatheque')}>
            ← Retour à la médiathèque
          </button>
        </div>
        <div className="mediatheque-vide" role="alert">
          <span className="mediatheque-vide__emoji">⚠️</span>
          <h3 className="mediatheque-vide__titre">Contenu introuvable</h3>
          <p className="mediatheque-vide__message">{erreur}</p>
          <button
            className="btn-principal"
            onClick={() => navigate('/mediatheque')}
          >
            ← Retour à la médiathèque
          </button>
        </div>
      </div>
    );
  }

  const config = CONFIG_TYPE_MEDIA[media.type];

  return (
    <div className="media-detail-page">

      <header className="media-detail-header">
        <button
          className="media-detail-retour"
          onClick={() => navigate('/mediatheque')}
          aria-label="Retourner au catalogue"
        >
          ← Médiathèque
        </button>
        <span
          style={{
            fontSize: '0.8rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            backgroundColor: config.bg,
            color: config.couleur,
            fontWeight: 600,
          }}
        >
          {config.emoji} {config.label}
        </span>
        {media.isPremium && (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
              backgroundColor: '#fffbeb',
              color: '#d97706',
              fontWeight: 700,
            }}
          >
            ⭐ Premium
          </span>
        )}
      </header>

      <div className="media-detail-layout">

        <div>
          {(media.type === 'video' || media.type === 'webinaire') ? (
            <LecteurVideo
              url={media.url}
              titre={media.titre}
              thumbnailUrl={media.thumbnailUrl}
              aAccesPremium={aAccesPremium}
              positionInitiale={progression?.positionReprise ?? 0}
              onTempsChange={handleTempsChange}
              onAperçuTermine={handleAperçuTermine}
            />
          ) : (
            <LecteurAudio
              url={media.url}
              titre={media.titre}
              thumbnailUrl={media.thumbnailUrl}
              typeMedia={media.type as 'audio' | 'podcast'}
              aAccesPremium={aAccesPremium}
              positionInitiale={progression?.positionReprise ?? 0}
              onTempsChange={handleTempsChange}
              onAperçuTermine={handleAperçuTermine}
            />
          )}

          <div className="media-detail-infos">
            <h1 className="media-detail-infos__titre">{media.titre}</h1>

            <div className="media-detail-infos__meta">
              <span className="media-detail-infos__meta-item">
                👤 {media.auteurNom}
              </span>
              <span className="media-detail-infos__meta-item">
                📚 {media.discipline}
              </span>
              <span className="media-detail-infos__meta-item">
                🎓 {media.niveau}{media.classe ? ` · ${media.classe}` : ''}
              </span>
              <span className="media-detail-infos__meta-item">
                ⏱ {formatDuree(media.duree)}
              </span>
              <span className="media-detail-infos__meta-item">
                👁 {media.vues.toLocaleString('fr-SN')} vue{media.vues !== 1 ? 's' : ''}
              </span>
              {media.taille > 0 && (
                <span className="media-detail-infos__meta-item">
                  💾 {(media.taille / (1024 * 1024)).toFixed(1)} Mo
                </span>
              )}
            </div>

            <p className="media-detail-infos__description">{media.description}</p>

            {(media.tags ?? []).length > 0 && (
              <div className="media-detail-infos__tags">
                {(media.tags ?? []).map(tag => (
                  <span key={tag} className="media-detail-infos__tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="media-detail-sidebar" aria-label="Informations complémentaires">

          {media.isPremium && !aAccesPremium && (
            <div className="media-sidebar-premium">
              <p className="media-sidebar-premium__titre">
                ⭐ Débloquez tout le contenu
              </p>
              <p className="media-sidebar-premium__prix">2 000 FCFA</p>
              <p className="media-sidebar-premium__prix-annuel">
                ou 20 000 FCFA / an (2 mois offerts)
              </p>
              <Link to="/premium" className="btn-abonnement">
                S&apos;abonner à Premium
              </Link>
              <ul className="media-sidebar-premium__avantages">
                <li>Vidéos et audios illimités</li>
                <li>Tous les cours en ligne</li>
                <li>Quiz et exercices premium</li>
                <li>Téléchargement pour mode hors-ligne</li>
              </ul>
            </div>
          )}

          {similaires.length > 0 && (
            <div className="media-sidebar-similaires">
              <h2 className="media-sidebar-similaires__titre">
                🎯 Contenus similaires
              </h2>
              <div className="media-sidebar-similaires__liste">
                {similaires.map(sim => (
                  <Link
                    key={sim.id}
                    to={`/mediatheque/${sim.id}`}
                    className="media-similaire-item"
                    aria-label={`Voir : ${sim.titre}`}
                  >
                    <div className="media-similaire-item__vignette">
                      {sim.thumbnailUrl ? (
                        <img src={sim.thumbnailUrl} alt={sim.titre} loading="lazy" />
                      ) : (
                        <span className="media-similaire-item__vignette-emoji">
                          {CONFIG_TYPE_MEDIA[sim.type].emoji}
                        </span>
                      )}
                    </div>

                    <div className="media-similaire-item__infos">
                      <p className="media-similaire-item__titre">{sim.titre}</p>
                      <div className="media-similaire-item__meta">
                        <span>{CONFIG_TYPE_MEDIA[sim.type].label}</span>
                        <span>·</span>
                        <span>{formatDuree(sim.duree)}</span>
                        {sim.isPremium && <span>· ⭐</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '0.875rem',
              fontSize: '0.8rem',
              color: '#166534',
            }}
          >
            <strong>📡 Connexion lente ?</strong>
            <br />
            Le lecteur s&apos;adapte automatiquement à votre débit. En cas de problème,
            rechargez la page ou essayez en Wi-Fi.
          </div>
        </aside>
      </div>
    </div>
  );
}
