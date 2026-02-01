/**
 * ============================================================================
 * SERVICE FIREBASE STORAGE - PEDACLIC
 * ============================================================================
 * 
 * Ce service gère l'upload, le téléchargement et la suppression de fichiers
 * vers Firebase Storage (PDFs, vidéos, images, audio).
 * 
 * Structure de stockage :
 * - /resources/{disciplineId}/{resourceId}/fichier.pdf
 * - /avatars/{userId}/avatar.jpg
 * - /temp/{timestamp}_{filename}
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from 'firebase/storage';
import { storage } from '../firebase';
import type { OperationResult } from '../index';

// ==================== CONSTANTES ====================

/**
 * Types de fichiers autorisés avec leurs MIME types
 */
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  // Documents
  pdf: ['application/pdf'],
  doc: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Images
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  
  // Vidéos
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  
  // Audio
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
};

/**
 * Tailles maximales par type (en octets)
 */
export const MAX_FILE_SIZES: Record<string, number> = {
  pdf: 10 * 1024 * 1024,      // 10 Mo pour PDFs
  doc: 10 * 1024 * 1024,      // 10 Mo pour documents Word
  image: 5 * 1024 * 1024,     // 5 Mo pour images
  video: 100 * 1024 * 1024,   // 100 Mo pour vidéos
  audio: 20 * 1024 * 1024     // 20 Mo pour audio
};

/**
 * Extensions de fichiers autorisées
 */
export const ALLOWED_EXTENSIONS: string[] = [
  '.pdf', '.doc', '.docx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.ogg',
  '.mp3', '.wav'
];

// ==================== TYPES ====================

/**
 * Callback pour le suivi de progression
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Résultat d'un upload réussi
 */
export interface UploadResult {
  url: string;           // URL de téléchargement du fichier
  path: string;          // Chemin dans Storage
  filename: string;      // Nom du fichier
  size: number;          // Taille en octets
  contentType: string;   // Type MIME
}

/**
 * Information de validation de fichier
 */
export interface FileValidation {
  isValid: boolean;
  error?: string;
  fileType?: string;
  maxSize?: number;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Détermine le type de fichier à partir du MIME type
 */
const getFileType = (mimeType: string): string | null => {
  for (const [type, mimeTypes] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (mimeTypes.includes(mimeType)) {
      return type;
    }
  }
  return null;
};

/**
 * Vérifie l'extension du fichier
 */
const hasValidExtension = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
};

/**
 * Génère un nom de fichier unique
 */
const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const cleanName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '_')  // Remplace caractères spéciaux
    .replace(/_+/g, '_');          // Évite les underscores multiples
  return `${timestamp}_${cleanName}`;
};

/**
 * Construit le chemin de stockage
 */
const buildStoragePath = (
  folder: string,
  subfolder: string,
  filename: string
): string => {
  return `${folder}/${subfolder}/${filename}`;
};

/**
 * Formate la taille de fichier pour affichage
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Octets';
  
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ==================== VALIDATION ====================

/**
 * Valide un fichier avant upload
 * 
 * @param file - Fichier à valider
 * @returns Résultat de la validation
 * 
 * @example
 * const validation = validateFile(myFile);
 * if (!validation.isValid) {
 *   console.error(validation.error);
 * }
 */
export const validateFile = (file: File): FileValidation => {
  // Vérifier l'extension
  if (!hasValidExtension(file.name)) {
    return {
      isValid: false,
      error: `Extension de fichier non autorisée. Extensions acceptées : ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Vérifier le type MIME
  const fileType = getFileType(file.type);
  if (!fileType) {
    return {
      isValid: false,
      error: `Type de fichier non supporté (${file.type}). Types acceptés : PDF, images, vidéos, audio.`
    };
  }

  // Vérifier la taille
  const maxSize = MAX_FILE_SIZES[fileType];
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `Fichier trop volumineux (${formatFileSize(file.size)}). Taille maximale : ${formatFileSize(maxSize)}`,
      fileType,
      maxSize
    };
  }

  return {
    isValid: true,
    fileType,
    maxSize
  };
};

// ==================== OPÉRATIONS D'UPLOAD ====================

/**
 * Upload un fichier vers Firebase Storage
 * 
 * @param file - Fichier à uploader
 * @param folder - Dossier principal (ex: 'resources', 'avatars')
 * @param subfolder - Sous-dossier (ex: disciplineId, userId)
 * @param onProgress - Callback de progression (0-100)
 * @returns Résultat de l'upload avec l'URL
 * 
 * @example
 * const result = await uploadFile(
 *   pdfFile,
 *   'resources',
 *   'disc_123',
 *   (progress) => setUploadProgress(progress)
 * );
 * 
 * if (result.success) {
 *   console.log('URL:', result.data.url);
 * }
 */
export const uploadFile = async (
  file: File,
  folder: string,
  subfolder: string,
  onProgress?: ProgressCallback
): Promise<OperationResult<UploadResult>> => {
  try {
    // Valider le fichier
    const validation = validateFile(file);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Générer le nom et le chemin
    const uniqueFilename = generateUniqueFileName(file.name);
    const storagePath = buildStoragePath(folder, subfolder, uniqueFilename);
    
    // Créer la référence
    const storageRef = ref(storage, storagePath);

    // Configurer l'upload
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    // Retourner une promesse qui suit la progression
    return new Promise((resolve) => {
      uploadTask.on(
        'state_changed',
        // Progression
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        // Erreur
        (error) => {
          console.error('Erreur upload:', error);
          resolve({
            success: false,
            error: `Erreur lors de l'upload : ${error.message}`
          });
        },
        // Succès
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            resolve({
              success: true,
              data: {
                url: downloadURL,
                path: storagePath,
                filename: uniqueFilename,
                size: file.size,
                contentType: file.type
              }
            });
          } catch (error) {
            resolve({
              success: false,
              error: 'Erreur lors de la récupération de l\'URL de téléchargement'
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('Erreur upload fichier:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'upload'
    };
  }
};

/**
 * Upload un fichier pour une ressource pédagogique
 * Raccourci pour les uploads dans le dossier resources
 */
export const uploadResourceFile = async (
  file: File,
  disciplineId: string,
  onProgress?: ProgressCallback
): Promise<OperationResult<UploadResult>> => {
  return uploadFile(file, 'resources', disciplineId, onProgress);
};

/**
 * Upload un avatar utilisateur
 */
export const uploadAvatar = async (
  file: File,
  userId: string,
  onProgress?: ProgressCallback
): Promise<OperationResult<UploadResult>> => {
  // Validation spécifique pour les images
  if (!file.type.startsWith('image/')) {
    return {
      success: false,
      error: 'Le fichier doit être une image (JPEG, PNG, GIF ou WebP)'
    };
  }

  // Taille max réduite pour les avatars : 2 Mo
  if (file.size > 2 * 1024 * 1024) {
    return {
      success: false,
      error: 'L\'image ne doit pas dépasser 2 Mo'
    };
  }

  return uploadFile(file, 'avatars', userId, onProgress);
};

// ==================== OPÉRATIONS DE SUPPRESSION ====================

/**
 * Supprime un fichier de Firebase Storage
 * 
 * @param storagePath - Chemin complet du fichier dans Storage
 * @returns Résultat de l'opération
 * 
 * @example
 * const result = await deleteFile('resources/disc_123/1234567890_cours.pdf');
 */
export const deleteFile = async (
  storagePath: string
): Promise<OperationResult<void>> => {
  try {
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
    
    return { success: true };
  } catch (error: unknown) {
    console.error('Erreur suppression fichier:', error);
    
    // Gérer le cas où le fichier n'existe pas
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === 'storage/object-not-found') {
        // Le fichier n'existe pas, considérer comme succès
        return { success: true };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la suppression'
    };
  }
};

/**
 * Supprime un fichier à partir de son URL de téléchargement
 * 
 * @param downloadURL - URL complète du fichier
 * @returns Résultat de l'opération
 */
export const deleteFileByURL = async (
  downloadURL: string
): Promise<OperationResult<void>> => {
  try {
    // Extraire le chemin de l'URL
    // Format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?...
    const url = new URL(downloadURL);
    const pathMatch = url.pathname.match(/\/o\/(.+)/);
    
    if (!pathMatch) {
      return {
        success: false,
        error: 'URL de fichier invalide'
      };
    }
    
    // Décoder le chemin (les / sont encodés en %2F)
    const storagePath = decodeURIComponent(pathMatch[1]);
    
    return deleteFile(storagePath);
  } catch (error) {
    console.error('Erreur extraction chemin depuis URL:', error);
    return {
      success: false,
      error: 'Impossible d\'extraire le chemin du fichier depuis l\'URL'
    };
  }
};

// ==================== OPÉRATIONS DE TÉLÉCHARGEMENT ====================

/**
 * Récupère l'URL de téléchargement d'un fichier
 * 
 * @param storagePath - Chemin du fichier dans Storage
 * @returns URL de téléchargement
 */
export const getFileURL = async (
  storagePath: string
): Promise<OperationResult<string>> => {
  try {
    const fileRef = ref(storage, storagePath);
    const url = await getDownloadURL(fileRef);
    
    return {
      success: true,
      data: url
    };
  } catch (error) {
    console.error('Erreur récupération URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération de l\'URL'
    };
  }
};

// ==================== EXPORT DU SERVICE ====================

/**
 * Service centralisé pour la gestion des fichiers
 */
export const StorageService = {
  // Upload
  uploadFile,
  uploadResourceFile,
  uploadAvatar,
  
  // Suppression
  deleteFile,
  deleteFileByURL,
  
  // Téléchargement
  getFileURL,
  
  // Validation
  validateFile,
  formatFileSize,
  
  // Constantes
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
  ALLOWED_EXTENSIONS
};

export default StorageService;
