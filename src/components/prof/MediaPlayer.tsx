// ============================================================
// PedaClic — Phase 22 : MediaPlayer
// Lecteur inline pour images, audio et vidéo locale.
// Gère aussi l'upload vers Firebase Storage.
// Optimisé pour les connexions lentes (Sénégal)
// ============================================================

import React, { useState, useRef } from 'react';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../../firebase'; // Adapter selon votre config
import type { PieceJointe, MediaType } from '../../types/cahierTextes.types';
import '../../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

/** Taille maximale autorisée : 50 Mo */
const TAILLE_MAX_OCTETS = 50 * 1024 * 1024;

/** Types MIME acceptés */
const TYPES_ACCEPTES =
  'image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,video/mp4';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Détermine le type de média à partir du type MIME du fichier.
 */
function detecterTypeMedia(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'autre';
}

/**
 * Formate une taille en octets en chaîne lisible (Ko / Mo).
 */
function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Visionneuse d'image en plein écran
// ─────────────────────────────────────────────────────────────

interface ImageFullscreenProps {
  src: string;
  alt: string;
  onFermer: () => void;
}

const ImageFullscreen: React.FC<ImageFullscreenProps> = ({ src, alt, onFermer }) => (
  /* Overlay sombre, clic pour fermer */
  <div
    className="image-fullscreen-overlay"
    onClick={onFermer}
    role="dialog"
    aria-modal="true"
    aria-label="Image en plein écran"
  >
    <img src={src} alt={alt} />
  </div>
);

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Affichage d'une pièce jointe existante
// ─────────────────────────────────────────────────────────────

interface PieceJointeItemProps {
  pj: PieceJointe;
  onSupprimer?: (id: string) => void;
  readonly?: boolean;
}

const PieceJointeItem: React.FC<PieceJointeItemProps> = ({
  pj,
  onSupprimer,
  readonly = false,
}) => {
  // Contrôle le plein écran pour les images
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 10,
        background: '#fff',
      }}
    >
      {/* ── IMAGE ── */}
      {pj.type === 'image' && (
        <>
          {/* Miniature cliquable pour plein écran */}
          <img
            src={pj.url}
            alt={pj.nom}
            className="media-image"
            onClick={() => setFullscreen(true)}
            style={{ maxWidth: '100%', display: 'block' }}
            loading="lazy"
          />
          {/* Overlay plein écran */}
          {fullscreen && (
            <ImageFullscreen
              src={pj.url}
              alt={pj.nom}
              onFermer={() => setFullscreen(false)}
            />
          )}
        </>
      )}

      {/* ── AUDIO ── */}
      {pj.type === 'audio' && (
        <div className="media-player">
          {/* Lecteur HTML5 natif — contrôles complets */}
          <audio controls preload="metadata">
            <source src={pj.url} type={pj.mimeType} />
            Votre navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      )}

      {/* ── VIDÉO LOCALE ── */}
      {pj.type === 'video' && (
        <div className="media-player">
          {/* preload="none" pour économiser la bande passante */}
          <video controls preload="none" playsInline>
            <source src={pj.url} type={pj.mimeType} />
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>
      )}

      {/* ── PDF / AUTRE ── */}
      {(pj.type === 'pdf' || pj.type === 'autre') && (
        <a
          href={pj.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            textDecoration: 'none',
            color: '#2563eb',
          }}
        >
          📎 {pj.nom}
        </a>
      )}

      {/* ── BARRE D'INFO + SUPPRESSION ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#f9fafb',
          borderTop: '1px solid #f3f4f6',
        }}
      >
        {/* Nom et taille */}
        <span style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pj.nom}
          {pj.taille && ` · ${formatTaille(pj.taille)}`}
        </span>

        {/* Bouton supprimer (masqué en lecture seule) */}
        {!readonly && onSupprimer && (
          <button
            type="button"
            onClick={() => onSupprimer(pj.id)}
            title="Supprimer ce fichier"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: '1rem',
              padding: '0 4px',
            }}
            aria-label={`Supprimer ${pj.nom}`}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : MediaPlayer
// ─────────────────────────────────────────────────────────────

interface MediaPlayerProps {
  /** Pièces jointes existantes */
  piecesJointes: PieceJointe[];
  /** ID de la séance (utilisé pour le chemin Storage) */
  entreeId: string;
  /** ID du prof (utilisé pour le chemin Storage) */
  profId: string;
  /** Appelé quand la liste change */
  onChange: (pj: PieceJointe[]) => void;
  /** Mode lecture seule */
  readonly?: boolean;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  piecesJointes,
  entreeId,
  profId,
  onChange,
  readonly = false,
}) => {
  // Référence vers l'input file caché
  const inputRef = useRef<HTMLInputElement>(null);

  // Progression d'upload : null = pas d'upload en cours
  const [progression, setProgression] = useState<number | null>(null);
  const [erreurUpload, setErreurUpload] = useState('');

  /**
   * Déclenche l'upload vers Firebase Storage.
   * Chemin : cahiers/{profId}/{entreeId}/{timestamp}_{filename}
   */
  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    // Validation taille
    if (fichier.size > TAILLE_MAX_OCTETS) {
      setErreurUpload(`Fichier trop volumineux (max 50 Mo). Ce fichier fait ${formatTaille(fichier.size)}.`);
      return;
    }
    setErreurUpload('');

    // Construction du chemin Firebase Storage
    const nom = `${Date.now()}_${fichier.name}`;
    const chemin = `cahiers/${profId}/${entreeId}/${nom}`;
    const refFichier = storageRef(storage, chemin);

    // Upload avec suivi de progression
    const uploadTask = uploadBytesResumable(refFichier, fichier);

    uploadTask.on(
      'state_changed',
      snapshot => {
        // Mise à jour de la barre de progression
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgression(pct);
      },
      error => {
        // Erreur d'upload
        setErreurUpload(`Erreur d'envoi : ${error.message}`);
        setProgression(null);
      },
      async () => {
        // Upload terminé — récupère l'URL de téléchargement
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const type = detecterTypeMedia(fichier.type);

        const nouvellePJ: PieceJointe = {
          id:       String(Date.now()),
          nom:      fichier.name,
          url,
          type,
          taille:   fichier.size,
          mimeType: fichier.type,
        };

        onChange([...piecesJointes, nouvellePJ]);
        setProgression(null);

        // Réinitialise l'input pour permettre le même fichier à nouveau
        if (inputRef.current) inputRef.current.value = '';
      }
    );
  }

  /**
   * Supprime une pièce jointe de la liste.
   * Note : ne supprime pas le fichier de Storage (à faire séparément si nécessaire).
   */
  function handleSupprimer(id: string) {
    onChange(piecesJointes.filter(pj => pj.id !== id));
  }

  return (
    <section aria-label="Fichiers médias" style={{ marginTop: 20 }}>
      {/* En-tête */}
      <h4
        style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 12px',
        }}
      >
        🖼️ Fichiers médias
      </h4>

      {/* Liste des pièces jointes */}
      {piecesJointes.map(pj => (
        <PieceJointeItem
          key={pj.id}
          pj={pj}
          onSupprimer={handleSupprimer}
          readonly={readonly}
        />
      ))}

      {/* Message vide */}
      {piecesJointes.length === 0 && !readonly && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 12px' }}>
          Aucun fichier ajouté. Formats acceptés : images, audio, vidéo (max 50 Mo).
        </p>
      )}

      {/* Zone d'upload (prof uniquement) */}
      {!readonly && (
        <>
          {/* Barre de progression pendant l'upload */}
          {progression !== null && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 8,
                  background: '#e5e7eb',
                  borderRadius: 9999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progression}%`,
                    background: '#2563eb',
                    transition: 'width 0.3s ease',
                  }}
                  role="progressbar"
                  aria-valuenow={progression}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0' }}>
                Envoi en cours… {progression}%
              </p>
            </div>
          )}

          {/* Message d'erreur upload */}
          {erreurUpload && (
            <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: '0 0 8px' }}>
              ⚠️ {erreurUpload}
            </p>
          )}

          {/* Input file caché + bouton de déclenchement */}
          <input
            ref={inputRef}
            type="file"
            accept={TYPES_ACCEPTES}
            onChange={handleFichier}
            style={{ display: 'none' }}
            aria-label="Choisir un fichier média"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => inputRef.current?.click()}
            disabled={progression !== null}
          >
            📎 Ajouter un fichier (image / audio / vidéo)
          </button>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>
            Max 50 Mo · JPG, PNG, GIF, WebP, MP3, WAV, OGG, MP4
          </p>
        </>
      )}
    </section>
  );
};

export default MediaPlayer;
