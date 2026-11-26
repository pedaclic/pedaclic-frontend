// ============================================================
// PedaClic — Phase 27 : MediaDetailPage
// Lecteur multimédia + informations + médias similaires
// Support YouTube et fichiers directs (Firebase Storage)
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

// ─────────────────────────────────────────────────────────────
// UTILITAIRE — Détection et extraction YouTube
// Supporte : youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
// ─────────────────────────────────────────────────────────────

function extraireYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const segments = u.pathname.split('/').filter(Boolean);
      const idx = segments.findIndex(s => s === 'embed' || s === 'shorts');
      if (idx !== -1 && segments[idx + 1]) return segments[idx + 1];
    }
  } catch {
    // URL malformée
  }
  return null;
}

function construireUrlEmbed(youtubeId: string, debutSecondes = 0): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    enablejsapi: '0',
    origin: window.location.origin,
    ...(debutSecondes > 5 ? { start: String(Math.floor(debutSecondes)) } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT LECTEUR VIDÉO — YouTube iframe ou fichier HTML5
// ─────────────────────────────────────────────────────────────

interface LecteurVideoProps {
  url: string;
  mimeType?: string;
  titre: string;
  thumbnailUrl?: string;
  aAccesPremium: boolean;
  positionInitiale: number;
  onTempsChange: (secondes: number) => void;
  onAperçuTermine: () => void;
}

function LecteurVideo({
  url,
  mimeType,
  titre,
  thumbnailUrl,
  aAccesPremium,
  positionInitiale,
  onTempsChange,
  onAperçuTermine,
}: LecteurVideoProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [overlayPremium, setOverlayPremium]   = useState(false);
  const [repriseProposee, setRepriseProposee] = useState(positionInitiale > 5);
  const [erreurVideo, setErreurVideo]         = useState<string | null>(null);

  const youtubeId = extraireYoutubeId(url);
  const estYoutube = youtubeId !== null;

  const urlEmbed = estYoutube
    ? construireUrlEmbed(youtubeId!, positionInitiale)
    : null;

  useEffect(() => {
    setOverlayPremium(false);
    setErreurVideo(null);
    if (timerRef.current) clearInterval(timerRef.current);

    if (estYoutube && !aAccesPremium) {
      let ecoulees = 0;
      timerRef.current = setInterval(() => {
        ecoulees += 1;
        onTempsChange(ecoulees);
        if (ecoulees >= DUREE_APERCU_GRATUIT) {
          clearInterval(timerRef.current!);
          setOverlayPremium(true);
          onAperçuTermine();
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [url, aAccesPremium, estYoutube, onTempsChange, onAperçuTermine]);

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

  const handleError = () => {
    const video = videoRef.current;
    let message = 'Impossible de charger la vidéo.';
    if (!url || url.trim() === '') {
      message = 'Aucune URL vidéo configurée pour ce contenu.';
    } else if (video?.error) {
      switch (video.error.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          message = 'Erreur réseau — vérifiez votre connexion.'; break;
        case MediaError.MEDIA_ERR_DECODE:
          message = 'Format vidéo non supporté par ce navigateur.'; break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Fichier introuvable ou format non supporté.'; break;
        default:
          message = `Erreur de lecture (code ${video.error.code}).`;
      }
    }
    setErreurVideo(message);
  };

  const reprendreDepuisSauvegarde = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = positionInitiale;
      videoRef.current.play().catch(console.warn);
      setRepriseProposee(false);
    }
  };

  const commencerDepuisDebut = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.warn);
      setRepriseProposee(false);
    }
  };

  const typeMime = mimeType || 'video/mp4';

  return (
    <div className="media-player">
      <div className="media-player__video-wrapper">

        {/* YouTube → Iframe embed */}
        {estYoutube && !overlayPremium && urlEmbed && (
          <iframe
            src={urlEmbed}
            title={titre}
            className="media-player__video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: 'none' }}
            aria-label={`Lecteur YouTube : ${titre}`}
          />
        )}

        {/* Fichier direct (Firebase Storage, MP4…) */}
        {!estYoutube && !erreurVideo && (
          /*
            ★ Phase 59 — CORRECTIF lecture : l'URL est posée directement sur
            <video src> au lieu d'un <source type=…>. Deux bénéfices :
            1. un <source> dont le type MIME est jugé « non lisible »
               (ex. video/quicktime d'un iPhone) était ignoré en silence :
               lecteur noir, aucun message ;
            2. les erreurs d'un <source> ne remontent pas à <video onError> ;
               avec src, le message « Vidéo indisponible » s'affiche bien.
            Le navigateur détecte lui-même le format réel du fichier.
          */
          <video
            ref={videoRef}
            className="media-player__video"
            src={url && url.trim() !== '' ? url : undefined}
            data-mime={typeMime}
            controls
            preload="metadata"
            poster={thumbnailUrl}
            onTimeUpdate={handleTimeUpdate}
            onError={handleError}
            playsInline
            aria-label={`Lecteur vidéo : ${titre}`}
          >
            <p>Votre navigateur ne supporte pas la lecture vidéo HTML5.</p>
          </video>
        )}

        {/* Erreur fichier direct */}
        {!estYoutube && erreurVideo && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: '#0f172a', color: 'white',
              gap: '0.75rem', padding: '2rem', textAlign: 'center',
            }}
            role="alert"
          >
            <span style={{ fontSize: '2.5rem' }}>🎬</span>
            <p style={{ margin: 0, fontWeight: 700 }}>Vidéo indisponible</p>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7, maxWidth: 300 }}>
              {erreurVideo}
            </p>
            <button
              type="button"
              style={{
                marginTop: '0.5rem', background: '#2563eb', color: 'white',
                border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.85rem',
              }}
              onClick={() => {
                setErreurVideo(null);
                if (videoRef.current) videoRef.current.load();
              }}
            >
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* URL vide */}
        {!estYoutube && !erreurVideo && (!url || url.trim() === '') && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: '#0f172a', color: 'rgba(255,255,255,0.5)',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '3rem' }}>🎬</span>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Aucun fichier vidéo configuré</p>
          </div>
        )}

        {/* Overlay Premium */}
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

      {/* Reprise (fichier direct uniquement) */}
      {!estYoutube && repriseProposee && positionInitiale > 5 && (
        <div className="media-player__reprise" role="complementary">
          <span className="media-player__reprise-texte">
            ▶ Reprendre à {formatDuree(positionInitiale)}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondaire"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
              onClick={commencerDepuisDebut}
            >
              Depuis le début
            </button>
            <button
              type="button"
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

// ─────────────────────────────────────────────────────────────
// COMPOSANT LECTEUR AUDIO
// ─────────────────────────────────────────────────────────────

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

        {/* ★ Phase 59 — même correctif que la vidéo : src direct, sans
            type « audio/mpeg » imposé (m4a, wav, ogg lisibles aussi) */}
        <audio
          ref={audioRef}
          className="media-player__audio"
          src={url && url.trim() !== '' ? url : undefined}
          controls
          preload="metadata"
          onLoadedMetadata={handleLoaded}
          onTimeUpdate={handleTimeUpdate}
          aria-label={`Lecteur audio : ${titre}`}
        >
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

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — MediaDetailPage
// ─────────────────────────────────────────────────────────────

export default function MediaDetailPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [similaires, setSimilaires] = useState<MediaItem[]>([]);
  const [progression, setProgression] = useState<MediaVue | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

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

        // ★ Phase 59 — CORRECTIF lecture : les données SECONDAIRES ne doivent
        // jamais empêcher l'affichage du lecteur. Auparavant, un refus
        // Firestore sur la progression (document encore inexistant) ou sur
        // les contenus similaires faisait échouer tout le chargement et la
        // page affichait « Contenu introuvable ». allSettled isole chaque appel.
        const [simRes, progRes] = await Promise.allSettled([
          mediaData.discipline
            ? getMediasSimilaires(mediaId!, mediaData.discipline)
            : Promise.resolve([] as MediaItem[]),
          currentUser
            ? getProgression(currentUser.uid, mediaId!)
            : Promise.resolve(null),
        ]);

        if (simRes.status === 'fulfilled') {
          setSimilaires(simRes.value);
        } else {
          console.warn('[MediaDetail] Contenus similaires indisponibles :', simRes.reason);
        }

        const prog = progRes.status === 'fulfilled' ? progRes.value : null;
        if (progRes.status === 'rejected') {
          console.warn('[MediaDetail] Progression indisponible :', progRes.reason);
        }
        setProgression(prog);

        if (prog?.positionReprise) {
          positionRef.current = prog.positionReprise;
        }

        // Compteur de vues : best-effort, sans impact sur la lecture
        incrementerVues(mediaId!).catch(e =>
          console.warn('[MediaDetail] Compteur de vues non mis à jour :', e)
        );

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
        // ★ Phase 59 — try/catch : évite une promesse rejetée non gérée
        // toutes les 30 s si l'écriture est refusée ou hors ligne.
        try {
          await sauvegarderProgression(
            currentUser.uid,
            media.id,
            positionRef.current,
            positionRef.current,
            media.duree
          );
        } catch (e) {
          console.warn('[MediaDetail] Progression non sauvegardée :', e);
        }
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
    // no-op, état géré dans les lecteurs
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
          <button type="button" className="media-detail-retour" onClick={() => navigate('/mediatheque')}>
            ← Retour à la médiathèque
          </button>
        </div>
        <div className="mediatheque-vide" role="alert">
          <span className="mediatheque-vide__emoji">⚠️</span>
          <h3 className="mediatheque-vide__titre">Contenu introuvable</h3>
          <p className="mediatheque-vide__message">{erreur}</p>
          <button
            type="button"
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
          type="button"
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
              mimeType={media.mimeType}
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
