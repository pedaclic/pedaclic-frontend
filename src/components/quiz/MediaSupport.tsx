/**
 * ============================================================
 * PEDACLIC — Support multimédia de compréhension orale
 * ------------------------------------------------------------
 * Composants pour attacher un AUDIO ou une VIDÉO à n'importe
 * quelle question d'un quiz avancé :
 *   • MediaSupportEditor  → côté professeur (éditeur)
 *   • MediaSupportPlayer  → côté élève (lecteur)
 *
 * Sources prises en charge :
 *   • upload  : fichier hébergé sur Firebase Storage
 *   • externe : lien direct (mp3/mp4) ou plateforme YouTube / Vimeo
 *
 * Conçu pour être 100 % additif : sans support attaché, le quiz
 * se comporte exactement comme avant.
 * ============================================================
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import type { MediaSupport, TypeMediaSupport } from '../../types/quiz-advanced';

// ============================================================
// Helpers — détection de la plateforme d'un lien externe
// ============================================================

/** Résultat de l'analyse d'une URL média. */
interface EmbedInfo {
  provider: 'youtube' | 'vimeo' | 'file';
  embedUrl?: string; // URL d'intégration (iframe) pour YouTube/Vimeo
}

/**
 * Analyse une URL et détermine s'il s'agit d'un lien YouTube / Vimeo
 * (à intégrer via iframe) ou d'un fichier direct (lecteur natif).
 */
export function analyserUrlMedia(url: string): EmbedInfo {
  if (!url) return { provider: 'file' };
  const u = url.trim();

  // --- YouTube : youtu.be/ID | youtube.com/watch?v=ID | /embed/ID ---
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (yt) {
    return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  }

  // --- Vimeo : vimeo.com/123456789 ---
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vm) {
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vm[1]}` };
  }

  // --- Sinon : fichier direct (mp3, mp4, wav, ogg, webm…) ---
  return { provider: 'file' };
}

// ============================================================
// ÉDITEUR — côté professeur
// ============================================================

interface MediaSupportEditorProps {
  /** Support actuel (undefined = aucun support attaché). */
  value?: MediaSupport;
  /** Renvoie le nouveau support, ou null pour le retirer complètement. */
  onChange: (media: MediaSupport | null) => void;
  /** ID de l'auteur (pour ranger le fichier dans Storage). */
  auteurId: string;
}

/** Types MIME acceptés à l'upload (audio + vidéo courants). */
const ACCEPTED_MEDIA =
  'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/aac,audio/x-m4a,' +
  'video/mp4,video/webm,video/ogg';
const ACCEPTED_EXT = '.mp3,.wav,.ogg,.m4a,.aac,.mp4,.webm,.mov';

/** Taille max d'upload selon le type (Mo). */
const MAX_MO_AUDIO = 50;
const MAX_MO_VIDEO = 200;

export const MediaSupportEditor: React.FC<MediaSupportEditorProps> = ({
  value,
  onChange,
  auteurId,
}) => {
  // L'éditeur est « ouvert » dès qu'un support existe.
  const actif = !!value;

  // État local de l'upload (progression / erreur).
  const [progress, setProgress] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Activer : créer un support audio vide par défaut ---
  const activer = () => {
    onChange({ type: 'audio', source: 'externe', url: '' });
  };

  // --- Modifier un champ du support en conservant le reste ---
  const patch = (updates: Partial<MediaSupport>) => {
    if (!value) return;
    onChange({ ...value, ...updates });
  };

  // --- Upload d'un fichier vers Firebase Storage ---
  const uploaderFichier = useCallback(
    (file: File) => {
      if (!value) return;
      setErreur(null);

      // 1) Déduire le type (audio/vidéo) du MIME du fichier
      const estVideo = file.type.startsWith('video/');
      const typeMedia: TypeMediaSupport = estVideo ? 'video' : 'audio';

      // 2) Validation de la taille
      const maxMo = estVideo ? MAX_MO_VIDEO : MAX_MO_AUDIO;
      const sizeMo = file.size / (1024 * 1024);
      if (sizeMo > maxMo) {
        setErreur(`Fichier trop lourd : ${sizeMo.toFixed(1)} Mo (max ${maxMo} Mo).`);
        return;
      }

      // 3) Référence Storage : quiz-media/{auteurId}/{timestamp_nom}
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-40);
      const fullPath = `quiz-media/${auteurId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, fullPath);

      // 4) Upload avec suivi de progression
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      setProgress(0);
      task.on(
        'state_changed',
        (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => {
          setErreur(`Erreur upload : ${err.message}`);
          setProgress(null);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          // On bascule la source sur "upload" et on renseigne l'URL + le type détecté
          onChange({ ...value, type: typeMedia, source: 'upload', url });
          setProgress(null);
        },
      );
    },
    [value, auteurId, onChange],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploaderFichier(file);
    e.target.value = '';
  };

  // ---------------- Rendu ----------------

  // Bouton d'activation tant qu'aucun support n'est attaché.
  if (!actif) {
    return (
      <div className="media-support-editor media-support-editor--empty">
        {/* Bouton pour attacher un support de compréhension orale */}
        <button type="button" className="media-support-editor__add" onClick={activer}>
          🎧 Ajouter un support audio / vidéo (compréhension orale)
        </button>
      </div>
    );
  }

  const apercu = analyserUrlMedia(value.url);

  return (
    <div className="media-support-editor">
      {/* En-tête de la section avec bouton de retrait */}
      <div className="media-support-editor__head">
        <span className="media-support-editor__title">
          🎧 Support de compréhension orale
        </span>
        <button
          type="button"
          className="media-support-editor__remove"
          onClick={() => onChange(null)}
          title="Retirer le support"
        >
          ✕ Retirer
        </button>
      </div>

      {/* Type de média : audio ou vidéo */}
      <div className="media-support-editor__row">
        <label>Type :</label>
        <select
          value={value.type}
          onChange={(e) => patch({ type: e.target.value as TypeMediaSupport })}
        >
          <option value="audio">🔊 Audio (écoute)</option>
          <option value="video">🎬 Vidéo (visionnage)</option>
        </select>

        <label>Source :</label>
        <select
          value={value.source}
          onChange={(e) =>
            patch({ source: e.target.value as MediaSupport['source'], url: '' })
          }
        >
          <option value="externe">🔗 Lien externe (YouTube, Vimeo, MP3/MP4…)</option>
          <option value="upload">⬆️ Fichier importé</option>
        </select>
      </div>

      {/* Cas 1 : lien externe → champ URL */}
      {value.source === 'externe' && (
        <div className="media-support-editor__field">
          <label>URL du média</label>
          <input
            type="url"
            value={value.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=… ou https://…/audio.mp3"
            className="media-support-editor__input"
          />
          {value.url && (
            <span className="media-support-editor__provider">
              Détecté : {apercu.provider === 'youtube'
                ? 'YouTube'
                : apercu.provider === 'vimeo'
                ? 'Vimeo'
                : 'Fichier direct'}
            </span>
          )}
        </div>
      )}

      {/* Cas 2 : upload de fichier */}
      {value.source === 'upload' && (
        <div className="media-support-editor__field">
          <label>Fichier audio / vidéo</label>
          <button
            type="button"
            className="media-support-editor__upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={progress !== null}
          >
            {progress !== null
              ? `⏳ Upload… ${progress}%`
              : value.url
              ? '🔄 Remplacer le fichier'
              : '⬆️ Choisir un fichier'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={`${ACCEPTED_MEDIA},${ACCEPTED_EXT}`}
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <p className="media-support-editor__hint">
            Audio ≤ {MAX_MO_AUDIO} Mo · Vidéo ≤ {MAX_MO_VIDEO} Mo
          </p>
        </div>
      )}

      {erreur && <p className="media-support-editor__error">⚠️ {erreur}</p>}

      {/* Titre / légende affichée à l'élève */}
      <div className="media-support-editor__field">
        <label>Titre / légende (optionnel)</label>
        <input
          type="text"
          value={value.titre || ''}
          onChange={(e) => patch({ titre: e.target.value || undefined })}
          placeholder="Ex : Document sonore — Interview en français"
          className="media-support-editor__input"
        />
      </div>

      {/* Limite d'écoutes (conditions d'examen) — fichiers directs uniquement */}
      <div className="media-support-editor__row">
        <label>Écoutes max (0 = illimité) :</label>
        <input
          type="number"
          min={0}
          max={10}
          value={value.lecturesMax ?? 0}
          onChange={(e) =>
            patch({ lecturesMax: Number(e.target.value) || undefined })
          }
          className="media-support-editor__num"
        />
        <span className="media-support-editor__hint">
          Appliqué aux fichiers/MP3-MP4 (pas aux intégrations YouTube/Vimeo).
        </span>
      </div>

      {/* Transcription optionnelle (accessibilité) */}
      <div className="media-support-editor__field">
        <label>Transcription (optionnel — accessibilité)</label>
        <textarea
          value={value.transcription || ''}
          onChange={(e) => patch({ transcription: e.target.value || undefined })}
          placeholder="Transcription du document sonore…"
          rows={3}
          className="media-support-editor__textarea"
        />
      </div>

      {/* Aperçu du lecteur tel que vu par l'élève */}
      {value.url && (
        <div className="media-support-editor__preview">
          <span className="media-support-editor__preview-label">Aperçu élève :</span>
          <MediaSupportPlayer media={value} />
        </div>
      )}
    </div>
  );
};

// ============================================================
// LECTEUR — côté élève
// ============================================================

interface MediaSupportPlayerProps {
  media: MediaSupport;
}

export const MediaSupportPlayer: React.FC<MediaSupportPlayerProps> = ({ media }) => {
  const info = useMemo(() => analyserUrlMedia(media.url), [media.url]);

  // Compteur d'écoutes pour faire respecter lecturesMax (lecteurs natifs).
  const [lectures, setLectures] = useState(0);
  const [transcriptionOuverte, setTranscriptionOuverte] = useState(false);
  const mediaElRef = useRef<HTMLMediaElement | null>(null);

  const limite = media.lecturesMax && media.lecturesMax > 0 ? media.lecturesMax : 0;
  const quotaAtteint = limite > 0 && lectures >= limite;

  // Incrémente le compteur à chaque nouvelle lecture (évènement "play").
  const onPlay = () => {
    setLectures((n) => n + 1);
  };

  // Quand le quota est atteint, on bloque toute relecture.
  useEffect(() => {
    const el = mediaElRef.current;
    if (!el || limite === 0) return;
    const handler = (e: Event) => {
      if (lectures >= limite) {
        e.preventDefault();
        el.pause();
      }
    };
    el.addEventListener('play', handler);
    return () => el.removeEventListener('play', handler);
  }, [lectures, limite]);

  return (
    <div className={`media-support-player media-support-player--${media.type}`}>
      {/* Légende */}
      {media.titre && <div className="media-support-player__title">🎧 {media.titre}</div>}

      {/* --- Lecture selon la source --- */}
      {info.provider === 'youtube' || info.provider === 'vimeo' ? (
        // Intégration plateforme via iframe (responsive 16:9)
        <div className="media-support-player__embed">
          <iframe
            src={info.embedUrl}
            title={media.titre || 'Support vidéo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : media.type === 'video' ? (
        // Lecteur vidéo natif
        <video
          ref={(el) => (mediaElRef.current = el)}
          src={media.url}
          controls
          onPlay={onPlay}
          className="media-support-player__video"
        />
      ) : (
        // Lecteur audio natif
        <audio
          ref={(el) => (mediaElRef.current = el)}
          src={media.url}
          controls
          onPlay={onPlay}
          className="media-support-player__audio"
        />
      )}

      {/* Indicateur d'écoutes restantes */}
      {limite > 0 && (
        <div
          className={`media-support-player__quota ${
            quotaAtteint ? 'media-support-player__quota--done' : ''
          }`}
        >
          {quotaAtteint
            ? '⛔ Nombre d\'écoutes atteint'
            : `🔁 Écoutes restantes : ${limite - lectures} / ${limite}`}
        </div>
      )}

      {/* Transcription repliable */}
      {media.transcription && (
        <div className="media-support-player__transcription">
          <button
            type="button"
            className="media-support-player__transcription-toggle"
            onClick={() => setTranscriptionOuverte((v) => !v)}
          >
            {transcriptionOuverte ? '▲ Masquer la transcription' : '▼ Afficher la transcription'}
          </button>
          {transcriptionOuverte && (
            <div className="media-support-player__transcription-text">
              {media.transcription}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaSupportPlayer;
