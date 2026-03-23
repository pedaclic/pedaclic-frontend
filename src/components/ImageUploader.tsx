// ============================================================
// PedaClic — ImageUploader.tsx
// Phase 25 : Composant d'upload d'images Firebase Storage
//
// Composant réutilisable gérant :
//   • Sélection de fichier (drag & drop ou clic)
//   • Validation type (jpg/png/gif/webp) + taille (max 5 Mo)
//   • Upload vers Firebase Storage avec progression en %
//   • Affichage de l'aperçu après upload
//   • Retour de l'URL publique via callback onUploadComplete
//
// Usage :
//   <ImageUploader
//     storagePath="cours-images/coursId123"
//     existingUrl="https://..."         ← URL actuelle (optionnel)
//     onUploadComplete={(url) => ...}   ← callback URL finale
//     onUploadStart={() => ...}         ← désactiver le form parent (optionnel)
//     disabled={false}
//   />
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

// ─── Types ────────────────────────────────────────────────────

/** Props du composant ImageUploader */
interface ImageUploaderProps {
  /** Chemin Storage SANS le nom de fichier, ex: "cours-images/abc123" */
  storagePath: string;
  /** URL d'image déjà existante (pour afficher un aperçu au chargement) */
  existingUrl?: string;
  /** Appelé avec l'URL publique une fois l'upload terminé */
  onUploadComplete: (url: string) => void;
  /** Appelé au démarrage de l'upload (ex: désactiver le bouton Enregistrer) */
  onUploadStart?: () => void;
  /** Appelé si l'upload échoue ou est annulé */
  onUploadError?: (error: string) => void;
  /** Texte affiché dans la zone de drop */
  placeholder?: string;
  /** Désactive le composant (ex: pendant la sauvegarde du cours) */
  disabled?: boolean;
  /** Taille max en Mo (défaut : 5) */
  maxSizeMo?: number;
}

/** État interne de l'upload */
interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;          // 0 à 100
  errorMessage: string | null;
  previewUrl: string | null; // URL locale (avant upload) ou Storage URL
}

// ─── Types MIME autorisés ──────────────────────────────────────
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp';

// ─── Composant principal ───────────────────────────────────────
const ImageUploader: React.FC<ImageUploaderProps> = ({
  storagePath,
  existingUrl,
  onUploadComplete,
  onUploadStart,
  onUploadError,
  placeholder = 'Glissez une image ici ou cliquez pour parcourir',
  disabled = false,
  maxSizeMo = 5,
}) => {
  // ─── État du composant ───────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    errorMessage: null,
    previewUrl: existingUrl || null,
  });

  const [isDragOver, setIsDragOver] = useState(false);

  // Référence vers l'input file caché
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Validation du fichier ───────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    // Vérification du type MIME
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Type non supporté : ${file.type}. Utilisez JPG, PNG, GIF ou WebP.`;
    }
    // Vérification de la taille
    const sizeMo = file.size / (1024 * 1024);
    if (sizeMo > maxSizeMo) {
      return `Fichier trop lourd : ${sizeMo.toFixed(1)} Mo (max ${maxSizeMo} Mo).`;
    }
    return null;
  }, [maxSizeMo]);

  // ─── Génération d'un nom de fichier unique ───────────────────
  const generateFilename = (originalName: string): string => {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    // Nettoyage du nom original pour éviter les caractères spéciaux
    const baseName = originalName
      .replace(/\.[^/.]+$/, '')           // Retirer l'extension
      .replace(/[^a-zA-Z0-9_-]/g, '_')   // Remplacer les caractères spéciaux
      .slice(0, 30);                       // Limiter la longueur
    return `${baseName}_${timestamp}.${extension}`;
  };

  // ─── Processus d'upload ──────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    // 1. Validation
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: validationError,
      }));
      onUploadError?.(validationError);
      return;
    }

    // 2. Aperçu local immédiat (avant upload)
    const localPreview = URL.createObjectURL(file);
    setUploadState({
      status: 'uploading',
      progress: 0,
      errorMessage: null,
      previewUrl: localPreview,
    });
    onUploadStart?.();

    // 3. Référence Firebase Storage
    const filename = generateFilename(file.name);
    const fullPath = `${storagePath}/${filename}`;
    const storageRef = ref(storage, fullPath);

    // 4. Upload avec suivi de progression
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: 'pedaclic-prof',
        originalName: file.name,
      },
    });

    uploadTask.on(
      'state_changed',
      // — Progression —
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadState(prev => ({ ...prev, progress }));
      },
      // — Erreur —
      (error) => {
        // Libérer l'URL locale
        URL.revokeObjectURL(localPreview);
        const msg = `Erreur upload : ${error.message}`;
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: msg,
          previewUrl: existingUrl || null,
        }));
        onUploadError?.(msg);
      },
      // — Succès —
      async () => {
        // Libérer l'URL locale
        URL.revokeObjectURL(localPreview);
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadState({
            status: 'success',
            progress: 100,
            errorMessage: null,
            previewUrl: downloadUrl,
          });
          onUploadComplete(downloadUrl);
        } catch (err) {
          const msg = 'Impossible de récupérer l\'URL de téléchargement.';
          setUploadState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: msg,
          }));
          onUploadError?.(msg);
        }
      }
    );
  }, [storagePath, existingUrl, validateFile, onUploadStart, onUploadComplete, onUploadError]);

  // ─── Gestionnaire : sélection via input ─────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Réinitialiser l'input pour permettre re-sélection du même fichier
    e.target.value = '';
  };

  // ─── Gestionnaires drag & drop ───────────────────────────────
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // ─── Suppression de l'image ──────────────────────────────────
  const handleRemove = async () => {
    if (!uploadState.previewUrl) return;
    // Réinitialiser le composant
    setUploadState({
      status: 'idle',
      progress: 0,
      errorMessage: null,
      previewUrl: null,
    });
    onUploadComplete(''); // Informer le parent que l'image est supprimée
  };

  // ─── Rendu ───────────────────────────────────────────────────
  const { status, progress, errorMessage, previewUrl } = uploadState;
  const isUploading = status === 'uploading';

  return (
    /* Zone d'upload principale */
    <div className={`image-uploader ${isDragOver ? 'image-uploader--drag-over' : ''} ${disabled ? 'image-uploader--disabled' : ''}`}>

      {/* ── Aperçu de l'image ── */}
      {previewUrl && (
        <div className="image-uploader__preview">
          <img
            src={previewUrl}
            alt="Aperçu"
            className="image-uploader__preview-img"
          />
          {/* Overlay pendant l'upload */}
          {isUploading && (
            <div className="image-uploader__overlay">
              <div className="image-uploader__spinner" />
            </div>
          )}
          {/* Bouton de suppression (hors upload en cours) */}
          {!isUploading && !disabled && (
            <button
              type="button"
              className="image-uploader__remove-btn"
              onClick={handleRemove}
              title="Supprimer l'image"
              aria-label="Supprimer l'image"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ── Zone de drop (affichée si pas d'aperçu) ── */}
      {!previewUrl && (
        <div
          className="image-uploader__dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Zone d'upload d'image"
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              fileInputRef.current?.click();
            }
          }}
        >
          {/* Icône d'upload */}
          <span className="image-uploader__icon" aria-hidden="true">🖼️</span>
          {/* Texte descriptif */}
          <p className="image-uploader__text">{placeholder}</p>
          <p className="image-uploader__subtext">
            JPG, PNG, GIF, WebP — max {maxSizeMo} Mo
          </p>
          {/* Bouton explicite */}
          <button
            type="button"
            className="image-uploader__browse-btn"
            disabled={disabled}
            tabIndex={-1}
            aria-hidden="true"
          >
            Parcourir…
          </button>
        </div>
      )}

      {/* ── Barre de progression ── */}
      {isUploading && (
        <div className="image-uploader__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="image-uploader__progress-bar"
            style={{ width: `${progress}%` }}
          />
          <span className="image-uploader__progress-text">
            Upload en cours… {progress}%
          </span>
        </div>
      )}

      {/* ── Message succès ── */}
      {status === 'success' && (
        <p className="image-uploader__success">
          ✅ Image uploadée avec succès
        </p>
      )}

      {/* ── Message d'erreur ── */}
      {errorMessage && (
        <p className="image-uploader__error" role="alert">
          ⚠️ {errorMessage}
        </p>
      )}

      {/* ── Input file caché ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
};

export default ImageUploader;
