// ============================================================
// PedaClic — Phase 22 : MediaPlayer (CORRECTIF v2)
//
// BUGS CORRIGÉS :
//   1. detecterTypeMedia() retourne maintenant 'pdf' pour application/pdf
//   2. TYPES_ACCEPTES inclut les PDFs et documents Word
//   3. PieceJointeItem gère les MIME types bruts stockés (ex: 'application/pdf')
//      → les fichiers uploadés avant le correctif s'ouvrent maintenant
//   4. La barre d'info grise est cliquable comme fallback pour tous types
//   5. Bouton ⬇ de téléchargement ajouté dans la barre d'info
//
// OPTIMISÉ pour les connexions lentes (Sénégal)
// ============================================================

import React, { useState, useRef } from 'react';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../../firebase';
import type { PieceJointe, MediaType } from '../types/cahierTextes.types';
import '../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

/** Taille maximale autorisée : 50 Mo */
const TAILLE_MAX_OCTETS = 50 * 1024 * 1024;

/**
 * Types MIME acceptés pour l'upload.
 * CORRECTIF : ajout de application/pdf, Word, PowerPoint, Excel.
 */
const TYPES_ACCEPTES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  // Vidéo
  'video/mp4',
  // Documents (NOUVEAU)
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Détermine le MediaType à partir du type MIME du fichier.
 *
 * CORRECTIF : retourne désormais 'pdf' pour application/pdf,
 * ce qui était ignoré avant (retournait 'autre').
 */
function detecterTypeMedia(mimeType: string): MediaType {
  if (mimeType.startsWith('image/'))               return 'image';
  if (mimeType.startsWith('audio/'))               return 'audio';
  if (mimeType.startsWith('video/'))               return 'video';
  if (mimeType === 'application/pdf')              return 'pdf';
  return 'autre';
}

/**
 * CORRECTIF : normalise un type stocké en Firestore vers MediaType.
 *
 * Avant le correctif, certains fichiers PDF pouvaient être stockés
 * avec type = 'application/pdf' (MIME brut) au lieu de 'pdf'.
 * Cette fonction garantit la compatibilité ascendante.
 */
function normaliserType(type: string): MediaType {
  if (!type) return 'autre';
  // Cas nominal : déjà une valeur MediaType valide
  const valeurs: MediaType[] = ['pdf', 'image', 'audio', 'video', 'autre'];
  if (valeurs.includes(type as MediaType)) return type as MediaType;
  // Cas héritage : MIME brut stocké directement
  return detecterTypeMedia(type);
}

/**
 * Retourne l'icône emoji correspondant au type de fichier.
 */
function iconeType(type: MediaType, nom: string): string {
  if (type === 'image') return '🖼️';
  if (type === 'audio') return '🎵';
  if (type === 'video') return '🎬';
  if (type === 'pdf')   return '📄';
  // Heuristique sur le nom pour 'autre'
  const ext = nom.split('.').pop()?.toLowerCase() ?? '';
  if (['doc', 'docx'].includes(ext))         return '📝';
  if (['ppt', 'pptx'].includes(ext))         return '📊';
  if (['xls', 'xlsx'].includes(ext))         return '📊';
  return '📎';
}

/**
 * Formate une taille en octets en chaîne lisible (Ko / Mo).
 */
function formatTaille(octets: number): string {
  if (octets < 1024)              return `${octets} o`;
  if (octets < 1024 * 1024)      return `${(octets / 1024).toFixed(1)} Ko`;
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

  /**
   * CORRECTIF : normaliser le type avant tout rendu.
   * Cela corrige les fichiers déjà en base avec MIME brut (ex: 'application/pdf').
   */
  const typeFinal: MediaType = normaliserType(pj.type as string);
  const icone = iconeType(typeFinal, pj.nom);

  /**
   * Ouvre le fichier dans un nouvel onglet.
   * Utilisé comme fallback sur la barre info et sur les zones sans lien natif.
   */
  function ouvrirFichier() {
    if (pj.url) {
      window.open(pj.url, '_blank', 'noopener,noreferrer');
    }
  }

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
      {typeFinal === 'image' && (
        <>
          {/* Miniature cliquable pour plein écran */}
          <img
            src={pj.url}
            alt={pj.nom}
            className="media-image"
            onClick={() => setFullscreen(true)}
            style={{ maxWidth: '100%', display: 'block', cursor: 'zoom-in' }}
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
      {typeFinal === 'audio' && (
        <div className="media-player" style={{ padding: '10px 14px' }}>
          {/* Lecteur HTML5 natif — contrôles complets */}
          <audio controls preload="metadata" style={{ width: '100%' }}>
            <source src={pj.url} type={pj.mimeType} />
            Votre navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      )}

      {/* ── VIDÉO LOCALE ── */}
      {typeFinal === 'video' && (
        <div className="media-player">
          {/* preload="none" pour économiser la bande passante */}
          <video controls preload="none" playsInline style={{ width: '100%' }}>
            <source src={pj.url} type={pj.mimeType} />
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </div>
      )}

      {/* ── PDF / AUTRE / DOCUMENT ── */}
      {(typeFinal === 'pdf' || typeFinal === 'autre') && (
        /*
         * CORRECTIF :
         *   Avant : <a href={pj.url}> avec target="_blank"
         *   Problème : si pj.url est vide ou si le MIME type n'était
         *   pas normalisé, rien ne s'affichait.
         *
         *   Maintenant : bouton accessible + fallback ouvrirFichier()
         *   pour garantir l'ouverture même si href est vide.
         */
        <a
          href={pj.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Si l'URL est vide, empêcher la navigation et signaler
            if (!pj.url) {
              e.preventDefault();
              alert('Ce fichier n\'est pas disponible. Contactez votre professeur.');
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            textDecoration: 'none',
            color: '#2563eb',
            fontWeight: 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Icône selon extension */}
          <span style={{ fontSize: '1.2rem' }}>{icone}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pj.nom}
          </span>
          {/* Flèche indiquant "ouvre dans un onglet" */}
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.6 }}>↗</span>
        </a>
      )}

      {/* ── BARRE D'INFO + SUPPRESSION ── */}
      {/*
       * CORRECTIF :
       *   La barre d'info est maintenant cliquable via onClick → ouvrirFichier().
       *   Avant : l'élève cliquait ici (zone naturelle du regard) et rien ne se passait.
       */}
      <div
        role={readonly ? 'button' : undefined}
        tabIndex={readonly ? 0 : undefined}
        onClick={readonly ? ouvrirFichier : undefined}
        onKeyDown={readonly ? (e) => e.key === 'Enter' && ouvrirFichier() : undefined}
        title={readonly ? `Cliquer pour ouvrir : ${pj.nom}` : pj.nom}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#f9fafb',
          borderTop: '1px solid #f3f4f6',
          cursor: readonly ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* Nom et taille */}
        <span
          style={{
            fontSize: '0.78rem',
            color: '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pj.nom}
          {pj.taille ? ` · ${formatTaille(pj.taille)}` : ''}
        </span>

        {/* Actions à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Bouton téléchargement (visible en readonly) */}
          {readonly && pj.url && (
            <a
              href={pj.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir / Télécharger"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: '#2563eb',
                fontSize: '0.9rem',
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              aria-label={`Télécharger ${pj.nom}`}
            >
              ⬇
            </a>
          )}

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
  const [progression, setProgression]   = useState<number | null>(null);
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
      setErreurUpload(
        `Fichier trop volumineux (max 50 Mo). Ce fichier fait ${formatTaille(fichier.size)}.`
      );
      return;
    }
    setErreurUpload('');

    // Construction du chemin Firebase Storage
    const nom      = `${Date.now()}_${fichier.name}`;
    const chemin   = `cahiers/${profId}/${entreeId}/${nom}`;
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
        // Upload terminé — récupère l'URL de téléchargement permanente
        const url  = await getDownloadURL(uploadTask.snapshot.ref);
        // CORRECTIF : utilise detecterTypeMedia pour avoir une valeur propre
        const type = detecterTypeMedia(fichier.type);

        const nouvellePJ: PieceJointe = {
          id:       String(Date.now()),
          nom:      fichier.name,
          url,
          type,                 // 'image' | 'audio' | 'video' | 'pdf' | 'autre'
          taille:   fichier.size,
          mimeType: fichier.type, // MIME brut conservé pour les lecteurs natifs
        };

        onChange([...piecesJointes, nouvellePJ]);
        setProgression(null);

        // Réinitialise l'input pour permettre le même fichier à nouveau
        if (inputRef.current) inputRef.current.value = '';
      }
    );
  }

  /**
   * Supprime une pièce jointe de la liste locale.
   * Note : ne supprime pas le fichier de Storage.
   */
  function handleSupprimer(id: string) {
    onChange(piecesJointes.filter(pj => pj.id !== id));
  }

  return (
    <section aria-label="Fichiers médias" style={{ marginTop: 20 }}>
      {/* ── En-tête ── */}
      <h4
        style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        📁 Fichiers médias
      </h4>

      {/* ── Liste des pièces jointes ── */}
      {piecesJointes.map(pj => (
        <PieceJointeItem
          key={pj.id}
          pj={pj}
          onSupprimer={handleSupprimer}
          readonly={readonly}
        />
      ))}

      {/* ── Message vide ── */}
      {piecesJointes.length === 0 && !readonly && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 12px' }}>
          Aucun fichier ajouté. Formats acceptés : images, audio, vidéo, PDF, Word (max 50 Mo).
        </p>
      )}

      {/* ── Zone d'upload (prof uniquement) ── */}
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
            📎 Ajouter un fichier (image / audio / vidéo / PDF / Word)
          </button>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>
            Max 50 Mo · JPG, PNG, GIF, WebP, MP3, WAV, OGG, MP4, PDF, DOCX, PPTX, XLSX
          </p>
        </>
      )}
    </section>
  );
};

export default MediaPlayer;
