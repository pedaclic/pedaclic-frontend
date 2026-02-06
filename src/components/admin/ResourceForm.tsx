/**
 * ============================================================================
 * COMPOSANT RESOURCEFORM - ADMIN PEDACLIC
 * ============================================================================
 * 
 * Formulaire pour créer ou modifier une ressource pédagogique.
 * Utilisé dans l'interface d'administration.
 * 
 * Fonctionnalités :
 * - Création de nouvelle ressource
 * - Modification de ressource existante
 * - Upload de fichier avec progression
 * - Validation des champs
 * - Auto-complétion des chapitres existants
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ResourceService } from '../../services/ResourceService';
import { StorageService, formatFileSize, validateFile } from '../../services/StorageService';
import type { Resource, ResourceFormData, TypeRessource } from '../../types';

// ==================== TYPES ====================

interface ResourceFormProps {
  /** ID de la discipline */
  disciplineId: string;
  /** Ressource à modifier (null pour création) */
  resource?: Resource | null;
  /** ID de l'auteur (utilisateur connecté) */
  auteurId: string;
  /** Callback après succès */
  onSuccess: (resource: Resource) => void;
  /** Callback pour annulation */
  onCancel: () => void;
}

interface FormErrors {
  titre?: string;
  type?: string;
  contenu?: string;
  chapitre?: string;
  fichier?: string;
  general?: string;
}

// ==================== CONFIGURATION ====================

const RESOURCE_TYPES: Array<{
  value: TypeRessource;
  label: string;
  icon: string;
}> = [
  { value: 'cours', label: 'Cours', icon: '📖' },
  { value: 'exercice', label: 'Exercice', icon: '✏️' },
  { value: 'video', label: 'Vidéo', icon: '🎬' },
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'quiz', label: 'Quiz', icon: '❓' }
];

// ==================== COMPOSANT PRINCIPAL ====================

const ResourceForm: React.FC<ResourceFormProps> = ({
  disciplineId,
  resource,
  auteurId,
  onSuccess,
  onCancel
}) => {
  // ===== STATE DU FORMULAIRE =====
  const [titre, setTitre] = useState(resource?.titre || '');
  const [type, setType] = useState<TypeRessource>(resource?.type || 'cours');
  const [chapitre, setChapitre] = useState(resource?.chapitre || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [contenu, setContenu] = useState(resource?.contenu || '');
  const [ordre, setOrdre] = useState(resource?.ordre || 1);
  const [dureeEstimee, setDureeEstimee] = useState(resource?.dureeEstimee || 0);
  const [isPremium, setIsPremium] = useState(resource?.isPremium || false);
  const [tags, setTags] = useState(resource?.tags?.join(', ') || '');
  
  // ===== STATE FICHIER =====
  const [fichier, setFichier] = useState<File | null>(null);
  const [fichierURL, setFichierURL] = useState(resource?.fichierURL || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // ===== STATE UI =====
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chaptersExistants, setChaptersExistants] = useState<string[]>([]);

  // Mode édition ou création
  const isEditMode = !!resource;

  // ===== CHARGEMENT DES CHAPITRES EXISTANTS =====
  
  useEffect(() => {
    const loadChapters = async () => {
      const result = await ResourceService.getByDiscipline(disciplineId);
      if (result) {
      setChaptersExistants(result.map((r: any) => r.chapitre).filter(Boolean));
      }
    };
    loadChapters();
  }, [disciplineId]);

  // ===== VALIDATION =====
  
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Titre requis (min 3 caractères)
    if (!titre.trim()) {
      newErrors.titre = 'Le titre est requis';
    } else if (titre.trim().length < 3) {
      newErrors.titre = 'Le titre doit contenir au moins 3 caractères';
    }

    // Type requis
    if (!type) {
      newErrors.type = 'Veuillez sélectionner un type';
    }

    // Contenu requis (min 10 caractères)
    if (!contenu.trim()) {
      newErrors.contenu = 'Le contenu est requis';
    } else if (contenu.trim().length < 10) {
      newErrors.contenu = 'Le contenu doit contenir au moins 10 caractères';
    }

    // Valider le fichier si sélectionné
    if (fichier) {
      const validation = validateFile(fichier);
      if (!validation.isValid) {
        newErrors.fichier = validation.error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [titre, type, contenu, fichier]);

  // ===== GESTION DU FICHIER =====
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateFile(file);
      if (validation.isValid) {
        setFichier(file);
        setErrors(prev => ({ ...prev, fichier: undefined }));
      } else {
        setErrors(prev => ({ ...prev, fichier: validation.error }));
        setFichier(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFichier(null);
    // Réinitialiser l'input file
    const fileInput = document.getElementById('resource-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleRemoveExistingFile = async () => {
    if (fichierURL && window.confirm('Voulez-vous vraiment supprimer ce fichier ?')) {
      const result = await StorageService.deleteFileByURL(fichierURL);
      if (result.success) {
        setFichierURL('');
      }
    }
  };

  // ===== SOUMISSION DU FORMULAIRE =====
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Valider le formulaire
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      let finalFichierURL = fichierURL;

      // Upload du fichier si sélectionné
      if (fichier) {
        setIsUploading(true);
        setUploadProgress(0);

        const uploadResult = await StorageService.uploadResourceFile(
          fichier,
          disciplineId,
          (progress) => setUploadProgress(progress)
        );

        setIsUploading(false);

        if (!uploadResult.success) {
          setErrors(prev => ({ ...prev, fichier: uploadResult.error }));
          setIsSubmitting(false);
          return;
        }

        finalFichierURL = uploadResult.data?.url || '';

        // Supprimer l'ancien fichier si on le remplace
        if (fichierURL && fichierURL !== finalFichierURL) {
          await StorageService.deleteFileByURL(fichierURL);
        }
      }

      // Préparer les données
      const formData: ResourceFormData = {
        disciplineId,
        titre: titre.trim(),
        type,
        contenu: contenu.trim(),
        description: description.trim(),
        isPremium,
        ordre,
        chapitre: chapitre.trim(),
        fichierURL: finalFichierURL,
        dureeEstimee: dureeEstimee > 0 ? dureeEstimee : undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      // Créer ou mettre à jour
      let result;
      if (isEditMode && resource) {
        result = await ResourceService.update(resource.id, formData);
      } else {
        result = await ResourceService.create(formData, auteurId);
      }

      if (result.success && result.data) {
        onSuccess(result.data);
      } else {
        setErrors({ general: result.error || 'Une erreur est survenue' });
      }
    } catch (error) {
      console.error('Erreur soumission formulaire:', error);
      setErrors({ general: 'Une erreur inattendue est survenue' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== RENDU =====
  
  return (
    <form className="resource-form" onSubmit={handleSubmit}>
      {/* ===== EN-TÊTE ===== */}
      <div className="resource-form__header">
        <h2 className="resource-form__title">
          {isEditMode ? '✏️ Modifier la ressource' : '➕ Nouvelle ressource'}
        </h2>
        <p className="resource-form__subtitle">
          {isEditMode 
            ? 'Modifiez les informations de cette ressource pédagogique'
            : 'Créez une nouvelle ressource pédagogique pour vos élèves'
          }
        </p>
      </div>

      {/* ===== ERREUR GÉNÉRALE ===== */}
      {errors.general && (
        <div className="resource-form__error-banner">
          <span className="resource-form__error-icon">⚠️</span>
          <span>{errors.general}</span>
        </div>
      )}

      {/* ===== CHAMPS DU FORMULAIRE ===== */}
      <div className="resource-form__fields">
        
        {/* ----- TITRE ----- */}
        <div className={`resource-form__field ${errors.titre ? 'resource-form__field--error' : ''}`}>
          <label htmlFor="resource-titre" className="resource-form__label">
            Titre <span className="resource-form__required">*</span>
          </label>
          <input
            type="text"
            id="resource-titre"
            className="resource-form__input"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex: Introduction au théorème de Pythagore"
            maxLength={200}
            disabled={isSubmitting}
          />
          {errors.titre && (
            <span className="resource-form__error">{errors.titre}</span>
          )}
        </div>

        {/* ----- TYPE DE RESSOURCE ----- */}
        <div className={`resource-form__field ${errors.type ? 'resource-form__field--error' : ''}`}>
          <label className="resource-form__label">
            Type de ressource <span className="resource-form__required">*</span>
          </label>
          <div className="resource-form__type-grid">
            {RESOURCE_TYPES.map(typeOption => (
              <button
                key={typeOption.value}
                type="button"
                className={`resource-form__type-btn ${type === typeOption.value ? 'resource-form__type-btn--active' : ''}`}
                onClick={() => setType(typeOption.value)}
                disabled={isSubmitting}
              >
                <span className="resource-form__type-icon">{typeOption.icon}</span>
                <span className="resource-form__type-label">{typeOption.label}</span>
              </button>
            ))}
          </div>
          {errors.type && (
            <span className="resource-form__error">{errors.type}</span>
          )}
        </div>

        {/* ----- CHAPITRE (avec auto-complétion) ----- */}
        <div className="resource-form__field">
          <label htmlFor="resource-chapitre" className="resource-form__label">
            Chapitre
          </label>
          <input
            type="text"
            id="resource-chapitre"
            className="resource-form__input"
            value={chapitre}
            onChange={(e) => setChapitre(e.target.value)}
            placeholder="Ex: Chapitre 1 - Géométrie plane"
            list="chapitres-list"
            disabled={isSubmitting}
          />
          {/* Liste des chapitres existants pour auto-complétion */}
          <datalist id="chapitres-list">
            {chaptersExistants.map((ch, index) => (
              <option key={index} value={ch} />
            ))}
          </datalist>
          <span className="resource-form__hint">
            Saisissez ou sélectionnez un chapitre existant
          </span>
        </div>

        {/* ----- DESCRIPTION ----- */}
        <div className="resource-form__field">
          <label htmlFor="resource-description" className="resource-form__label">
            Description courte
          </label>
          <input
            type="text"
            id="resource-description"
            className="resource-form__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Résumé bref de la ressource (affiché dans les listes)"
            maxLength={300}
            disabled={isSubmitting}
          />
        </div>

        {/* ----- CONTENU ----- */}
        <div className={`resource-form__field ${errors.contenu ? 'resource-form__field--error' : ''}`}>
          <label htmlFor="resource-contenu" className="resource-form__label">
            Contenu <span className="resource-form__required">*</span>
          </label>
          <textarea
            id="resource-contenu"
            className="resource-form__textarea"
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Rédigez le contenu de votre ressource ici. Vous pouvez utiliser du HTML pour le formatage."
            rows={10}
            disabled={isSubmitting}
          />
          <span className="resource-form__hint">
            Le contenu supporte le HTML pour le formatage (gras, italique, listes, etc.)
          </span>
          {errors.contenu && (
            <span className="resource-form__error">{errors.contenu}</span>
          )}
        </div>

        {/* ----- FICHIER ATTACHÉ ----- */}
        <div className={`resource-form__field ${errors.fichier ? 'resource-form__field--error' : ''}`}>
          <label htmlFor="resource-file" className="resource-form__label">
            Fichier attaché
          </label>
          
          {/* Fichier existant */}
          {fichierURL && !fichier && (
            <div className="resource-form__existing-file">
              <span className="resource-form__file-icon">📎</span>
              <a 
                href={fichierURL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="resource-form__file-link"
              >
                Voir le fichier actuel
              </a>
              <button
                type="button"
                className="resource-form__file-remove"
                onClick={handleRemoveExistingFile}
                disabled={isSubmitting}
              >
                Supprimer
              </button>
            </div>
          )}

          {/* Zone de drop pour nouveau fichier */}
          <div className="resource-form__file-upload">
            <input
              type="file"
              id="resource-file"
              className="resource-form__file-input"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.wav"
              disabled={isSubmitting || isUploading}
            />
            <label htmlFor="resource-file" className="resource-form__file-label">
              <span className="resource-form__file-upload-icon">📁</span>
              <span className="resource-form__file-upload-text">
                {fichier 
                  ? fichier.name 
                  : 'Cliquez ou glissez un fichier ici'
                }
              </span>
              {fichier && (
                <span className="resource-form__file-size">
                  {formatFileSize(fichier.size)}
                </span>
              )}
            </label>
            
            {/* Bouton supprimer le fichier sélectionné */}
            {fichier && (
              <button
                type="button"
                className="resource-form__file-clear"
                onClick={handleRemoveFile}
                disabled={isSubmitting}
              >
                ✕
              </button>
            )}
          </div>

          {/* Barre de progression upload */}
          {isUploading && (
            <div className="resource-form__upload-progress">
              <div 
                className="resource-form__upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
              <span className="resource-form__upload-progress-text">
                Upload en cours... {uploadProgress}%
              </span>
            </div>
          )}

          <span className="resource-form__hint">
            PDF, Word, images, vidéos ou audio (max 100 Mo pour vidéos, 10 Mo pour documents)
          </span>
          {errors.fichier && (
            <span className="resource-form__error">{errors.fichier}</span>
          )}
        </div>

        {/* ----- LIGNE: ORDRE + DURÉE + PREMIUM ----- */}
        <div className="resource-form__row">
          {/* Ordre */}
          <div className="resource-form__field resource-form__field--small">
            <label htmlFor="resource-ordre" className="resource-form__label">
              Ordre
            </label>
            <input
              type="number"
              id="resource-ordre"
              className="resource-form__input"
              value={ordre}
              onChange={(e) => setOrdre(parseInt(e.target.value) || 1)}
              min={1}
              max={999}
              disabled={isSubmitting}
            />
          </div>

          {/* Durée estimée */}
          <div className="resource-form__field resource-form__field--small">
            <label htmlFor="resource-duree" className="resource-form__label">
              Durée (min)
            </label>
            <input
              type="number"
              id="resource-duree"
              className="resource-form__input"
              value={dureeEstimee || ''}
              onChange={(e) => setDureeEstimee(parseInt(e.target.value) || 0)}
              min={0}
              max={999}
              placeholder="0"
              disabled={isSubmitting}
            />
          </div>

          {/* Premium */}
          <div className="resource-form__field resource-form__field--checkbox">
            <label className="resource-form__checkbox-label">
              <input
                type="checkbox"
                className="resource-form__checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                disabled={isSubmitting}
              />
              <span className="resource-form__checkbox-text">
                <span className="resource-form__checkbox-icon">⭐</span>
                Contenu Premium
              </span>
            </label>
          </div>
        </div>

        {/* ----- TAGS ----- */}
        <div className="resource-form__field">
          <label htmlFor="resource-tags" className="resource-form__label">
            Tags
          </label>
          <input
            type="text"
            id="resource-tags"
            className="resource-form__input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="géométrie, pythagore, triangle (séparés par des virgules)"
            disabled={isSubmitting}
          />
          <span className="resource-form__hint">
            Séparez les tags par des virgules pour faciliter la recherche
          </span>
        </div>
      </div>

      {/* ===== ACTIONS ===== */}
      <div className="resource-form__actions">
        <button
          type="button"
          className="resource-form__btn resource-form__btn--cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="resource-form__btn resource-form__btn--submit"
          disabled={isSubmitting || isUploading}
        >
          {isSubmitting ? (
            <>
              <span className="resource-form__spinner" />
              {isEditMode ? 'Modification...' : 'Création...'}
            </>
          ) : (
            isEditMode ? '💾 Enregistrer' : '✅ Créer la ressource'
          )}
        </button>
      </div>
    </form>
  );
};

export default ResourceForm;
