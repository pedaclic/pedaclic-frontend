/**
 * ============================================================================
 * COMPOSANT RESOURCE MANAGER - PedaClic
 * ============================================================================
 * Interface CRUD complète pour la gestion des ressources pédagogiques
 * Types supportés : cours, exercice, video, document, quiz
 * Inclut l'upload de fichiers vers Firebase Storage
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DisciplineService from '../../services/disciplineService';
import { ChapitreService, Chapitre } from '../../services/chapitreService';
import ResourceService from '../../services/ResourceService';
import type { Resource, ResourceFormData, TypeRessource as ResourceType } from '../../types';
import type { Discipline } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// ==================== CONSTANTES ====================

/** Types de ressources disponibles */
const RESOURCE_TYPES: { value: ResourceType; label: string; icon: string; color: string }[] = [
  { value: 'cours', label: 'Cours', icon: '📚', color: '#2563eb' },
  { value: 'exercice', label: 'Exercice', icon: '✏️', color: '#10b981' },
  { value: 'video', label: 'Vidéo', icon: '🎬', color: '#ef4444' },
  { value: 'document', label: 'Document', icon: '📄', color: '#f59e0b' },
  { value: 'quiz', label: 'Quiz', icon: '🧩', color: '#8b5cf6' }
];

/** Extensions de fichiers autorisées par type */
const ALLOWED_EXTENSIONS: Record<ResourceType, string[]> = {
  cours: ['.pdf', '.doc', '.docx', '.ppt', '.pptx'],
  exercice: ['.pdf', '.doc', '.docx'],
  video: ['.mp4', '.webm', '.mov', '.avi'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  quiz: ['.json', '.pdf']
};

/** Taille maximale des fichiers (en Mo) */
const MAX_FILE_SIZE_MB = 50;

/** État initial du formulaire */
const INITIAL_FORM_DATA: Omit<ResourceFormData, 'disciplineId'> = {
  titre: '',
  type: 'cours',
  description: '',
  contenu: '',
  chapitre: '',
  ordre: 1,
  isPremium: false,
  actif: true,
  tags: [],
  duree: undefined,
  urlExterne: ''
};

// ==================== INTERFACES ====================

interface FormErrors {
  disciplineId?: string;
  titre?: string;
  type?: string;
  fichier?: string;
}

// ==================== COMPOSANT PRINCIPAL ====================

const ResourceManager: React.FC = () => {
  // ==================== CONTEXTE ====================
  
  const { currentUser } = useAuth();

  // ==================== ÉTAT ====================

  // Données
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [chapitres, setChapitres] = useState<Chapitre[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  
  // Sélections et filtres
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedChapitre, setSelectedChapitre] = useState<string>('');
  const [filterType, setFilterType] = useState<ResourceType | ''>('');
  const [filterPremium, setFilterPremium] = useState<'' | 'premium' | 'free'>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // États de chargement
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);
  const [loadingChapitres, setLoadingChapitres] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal et formulaire
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState<ResourceFormData>({
    ...INITIAL_FORM_DATA,
    disciplineId: ''
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Gestion des fichiers
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Gestion des tags
  const [newTag, setNewTag] = useState('');

  // ==================== CHARGEMENT DES DONNÉES ====================

  /**
   * Charge la liste des disciplines
   */
  const loadDisciplines = useCallback(async () => {
    try {
      setLoadingDisciplines(true);
      const data = await DisciplineService.getAll();
      setDisciplines(data);
      
      // Sélectionner la première discipline par défaut
      if (data.length > 0 && !selectedDiscipline) {
        setSelectedDiscipline(data[0].id);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des disciplines:', err);
      setError('Impossible de charger les disciplines.');
    } finally {
      setLoadingDisciplines(false);
    }
  }, [selectedDiscipline]);

  /**
   * Charge les chapitres de la discipline sélectionnée
   */
  const loadChapitres = useCallback(async () => {
    if (!selectedDiscipline) {
      setChapitres([]);
      return;
    }

    try {
      setLoadingChapitres(true);
      const data = await ChapitreService.getByDiscipline(selectedDiscipline);
      setChapitres(data);
    } catch (err) {
      console.error('Erreur lors du chargement des chapitres:', err);
    } finally {
      setLoadingChapitres(false);
    }
  }, [selectedDiscipline]);

  /**
   * Charge les ressources de la discipline sélectionnée
   */
  const loadResources = useCallback(async () => {
    if (!selectedDiscipline) {
      setResources([]);
      setFilteredResources([]);
      return;
    }

    try {
      setLoadingResources(true);
      const data = await ResourceService.getByDiscipline(selectedDiscipline);
      setResources(data);
      setFilteredResources(data);
    } catch (err) {
      console.error('Erreur lors du chargement des ressources:', err);
      setError('Impossible de charger les ressources.');
    } finally {
      setLoadingResources(false);
    }
  }, [selectedDiscipline]);

  // Chargement initial
  useEffect(() => {
    loadDisciplines();
  }, [loadDisciplines]);

  // Chargement des chapitres quand la discipline change
  useEffect(() => {
    loadChapitres();
  }, [loadChapitres]);

  // Chargement des ressources quand la discipline change
  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // ==================== FILTRAGE ====================

  useEffect(() => {
    let result = [...resources];

    // Filtre par chapitre
    if (selectedChapitre) {
      result = result.filter(r => r.chapitre === selectedChapitre);
    }

    // Filtre par type
    if (filterType) {
      result = result.filter(r => r.type === filterType);
    }

    // Filtre par statut premium
    if (filterPremium === 'premium') {
      result = result.filter(r => r.isPremium);
    } else if (filterPremium === 'free') {
      result = result.filter(r => !r.isPremium);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.titre.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    setFilteredResources(result);
  }, [resources, selectedChapitre, filterType, filterPremium, searchQuery]);

  // ==================== VALIDATION ====================

  /**
   * Valide les données du formulaire
   */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.disciplineId) {
      errors.disciplineId = 'Veuillez sélectionner une discipline';
    }

    if (!formData.titre.trim()) {
      errors.titre = 'Le titre est requis';
    } else if (formData.titre.length < 3) {
      errors.titre = 'Le titre doit contenir au moins 3 caractères';
    }

    if (!formData.type) {
      errors.type = 'Veuillez sélectionner un type de ressource';
    }

    // Validation du fichier si sélectionné
    if (selectedFile) {
      const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
      const allowedExts = ALLOWED_EXTENSIONS[formData.type];
      
      if (!allowedExts.includes(ext)) {
        errors.fichier = `Extension non autorisée. Extensions acceptées : ${allowedExts.join(', ')}`;
      }

      const fileSizeMB = selectedFile.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        errors.fichier = `Le fichier est trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ==================== HANDLERS ====================

  /**
   * Change la discipline sélectionnée
   */
  const handleDisciplineChange = (disciplineId: string) => {
    setSelectedDiscipline(disciplineId);
    setSelectedChapitre('');
    setError(null);
  };

  /**
   * Ouvre le modal pour créer une nouvelle ressource
   */
  const handleCreate = () => {
    setEditingResource(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      disciplineId: selectedDiscipline
    });
    setFormErrors({});
    setSelectedFile(null);
    setFilePreview(null);
    setNewTag('');
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal pour modifier une ressource
   */
  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      disciplineId: resource.disciplineId,
      titre: resource.titre,
      type: resource.type,
      description: resource.description,
      contenu: resource.contenu,
      chapitre: resource.chapitre || '',
      ordre: resource.ordre,
      isPremium: resource.isPremium,
      actif: resource.actif,
      tags: resource.tags || [],
      duree: resource.duree,
      urlExterne: resource.urlExterne || ''
    });
    setFormErrors({});
    setSelectedFile(null);
    setFilePreview(resource.fichierURL || null);
    setNewTag('');
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal de prévisualisation
   */
  const handlePreview = (resource: Resource) => {
    setPreviewResource(resource);
    setIsPreviewOpen(true);
  };

  /**
   * Ouvre le modal de confirmation de suppression
   */
  const handleDeleteClick = (resource: Resource) => {
    setDeletingResource(resource);
    setIsDeleteModalOpen(true);
  };

  /**
   * Ferme les modals
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsPreviewOpen(false);
    setEditingResource(null);
    setDeletingResource(null);
    setPreviewResource(null);
    setFormErrors({});
    setSelectedFile(null);
    setFilePreview(null);
    setNewTag('');
  };

  /**
   * Gère les changements dans le formulaire
   */
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));

    // Effacer l'erreur
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  /**
   * Gère la sélection d'un fichier
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFormErrors(prev => ({ ...prev, fichier: undefined }));

    // Prévisualisation pour les images et vidéos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  /**
   * Supprime le fichier sélectionné
   */
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Ajoute un tag
   */
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  /**
   * Supprime un tag
   */
  const handleRemoveTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter((_, i) => i !== index)
    }));
  };

  /**
   * Soumet le formulaire
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      let fichierUrl = editingResource?.fichierURL;
      let fichierNom = editingResource?.fichierNom;

      // Upload du fichier si sélectionné
      if (selectedFile) {
        setUploading(true);
        const tempId = editingResource?.id || `temp_${Date.now()}`;
        
        const uploadResult = await ResourceService.uploadFile(
          selectedFile,
          tempId
	);
        
        fichierUrl = uploadResult as string;
        fichierNom = selectedFile?.name || 'fichier';
        setUploading(false);
      }

      const resourceData: ResourceFormData = {
        ...formData,
        fichierURL: fichierUrl,
        fichierNom: fichierNom,
        // auteurId passe en 2e argument de create
      };

      if (editingResource) {
        // Modification
        await ResourceService.update(editingResource.id, resourceData);
        setSuccess('Ressource modifiée avec succès !');
      } else {
        // Création
        await ResourceService.create(resourceData, 'admin');
        setSuccess('Ressource créée avec succès !');
      }

      handleCloseModal();
      await loadResources();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Confirme la suppression
   */
  const handleConfirmDelete = async () => {
    if (!deletingResource) return;

    try {
      setDeleting(deletingResource.id);
      
      // Supprimer le fichier associé si présent
      if (deletingResource.fichierURL) {
        await ResourceService.deleteFile(deletingResource.fichierURL);
      }
      
      await ResourceService.delete(deletingResource.id);
      setSuccess('Ressource supprimée avec succès !');
      handleCloseModal();
      await loadResources();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Bascule le statut premium d'une ressource
   */
  const handleTogglePremium = async (resource: Resource) => {
    try {
      await ResourceService.togglePremium(resource.id, !resource.isPremium);
      await loadResources();
      setSuccess(resource.isPremium ? 'Ressource passée en gratuit' : 'Ressource passée en Premium');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  /**
   * Bascule le statut actif d'une ressource
   */
  const handleToggleActive = async (resource: Resource) => {
    try {
      await ResourceService.toggleActive(resource.id, !(resource.actif !== false));
      await loadResources();
      setSuccess(resource.actif !== false ? 'Ressource désactivée' : 'Ressource activée');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  // ==================== HELPERS ====================

  /**
   * Obtient le nom de la discipline
   */
  const getDisciplineName = (id: string): string => {
    const discipline = disciplines.find(d => d.id === id);
    return discipline ? discipline.nom : 'Non trouvée';
  };

  /**
   * Obtient le nom du chapitre
   */
  const getChapitreName = (id: string): string => {
    const chapitre = chapitres.find(c => c.id === id);
    return chapitre ? `${chapitre.numero}. ${chapitre.titre}` : '';
  };

  /**
   * Obtient les infos d'un type de ressource
   */
  const getTypeInfo = (type: ResourceType) => {
    return RESOURCE_TYPES.find(t => t.value === type) || RESOURCE_TYPES[0];
  };

  /**
   * Formate la taille du fichier
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  };

  // ==================== RENDU ====================

  return (
    <div className="resource-manager">
      {/* ==================== EN-TÊTE ==================== */}
      <header className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">
            Gestion des Ressources
          </h1>
          <p className="admin-page-header__subtitle">
            Gérez les cours, exercices, vidéos et documents pédagogiques
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button
            onClick={handleCreate}
            className="btn btn--primary"
            disabled={!selectedDiscipline || loadingDisciplines}
          >
            <span>➕</span>
            Nouvelle ressource
          </button>
        </div>
      </header>

      {/* ==================== MESSAGES ==================== */}
      {error && (
        <div className="alert alert--error">
          <span className="alert__icon">⚠️</span>
          <div className="alert__content">
            <p className="alert__message">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="alert__close">✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert--success">
          <span className="alert__icon">✅</span>
          <div className="alert__content">
            <p className="alert__message">{success}</p>
          </div>
        </div>
      )}

      {/* ==================== SÉLECTEUR DE DISCIPLINE ==================== */}
      <div className="content-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="content-card__body">
          <div className="discipline-selector">
            <label className="form-label">Sélectionner une discipline :</label>
            {loadingDisciplines ? (
              <p className="text-muted">Chargement des disciplines...</p>
            ) : disciplines.length === 0 ? (
              <p className="text-muted">
                Aucune discipline disponible.
                <a href="/admin/disciplines"> Créer une discipline</a>
              </p>
            ) : (
              <div className="discipline-tabs">
                {disciplines.map(discipline => (
                  <button
                    key={discipline.id}
                    className={`discipline-tab ${selectedDiscipline === discipline.id ? 'discipline-tab--active' : ''}`}
                    onClick={() => handleDisciplineChange(discipline.id)}
                    style={{
                      '--discipline-color': discipline.couleur || '#2563eb'
                    } as React.CSSProperties}
                  >
                    <span className="discipline-tab__icon">{discipline.icone || '📚'}</span>
                    <span className="discipline-tab__name">{discipline.nom}</span>
                    <span className="discipline-tab__class">{discipline.classe}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== FILTRES ==================== */}
      <div className="admin-table-container">
        <div className="admin-table-header">
          <h2 className="admin-table-title">
            Ressources {selectedDiscipline && `- ${getDisciplineName(selectedDiscipline)}`}
            {filteredResources.length > 0 && ` (${filteredResources.length})`}
          </h2>
          <div className="admin-table-actions">
            {/* Recherche */}
            <div className="search-input">
              <span className="search-input__icon">🔍</span>
              <input
                type="text"
                className="search-input__field"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filtre par chapitre */}
            <select
              className="form-select form-select--sm"
              value={selectedChapitre}
              onChange={(e) => setSelectedChapitre(e.target.value)}
              disabled={loadingChapitres || chapitres.length === 0}
            >
              <option value="">Tous les chapitres</option>
              {chapitres.map(c => (
                <option key={c.id} value={c.id}>
                  {c.numero}. {c.titre}
                </option>
              ))}
            </select>

            {/* Filtre par type */}
            <select
              className="form-select form-select--sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ResourceType | '')}
            >
              <option value="">Tous les types</option>
              {RESOURCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>

            {/* Filtre premium */}
            <select
              className="form-select form-select--sm"
              value={filterPremium}
              onChange={(e) => setFilterPremium(e.target.value as '' | 'premium' | 'free')}
            >
              <option value="">Tous</option>
              <option value="premium">⭐ Premium</option>
              <option value="free">Gratuit</option>
            </select>
          </div>
        </div>

        {/* ==================== LISTE DES RESSOURCES ==================== */}
        {loadingResources ? (
          <div className="loading-container" style={{ padding: 'var(--spacing-2xl)' }}>
            <div className="spinner"></div>
            <p>Chargement des ressources...</p>
          </div>
        ) : !selectedDiscipline ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">Sélectionnez une discipline</h3>
            <p className="empty-state__message">
              Choisissez une discipline ci-dessus pour voir ses ressources.
            </p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <h3 className="empty-state__title">Aucune ressource</h3>
            <p className="empty-state__message">
              {searchQuery || filterType || filterPremium || selectedChapitre
                ? 'Aucune ressource ne correspond aux critères de recherche.'
                : 'Cette discipline n\'a pas encore de ressources.'}
            </p>
            {!searchQuery && !filterType && !filterPremium && !selectedChapitre && (
              <button onClick={handleCreate} className="btn btn--primary">
                Créer la première ressource
              </button>
            )}
          </div>
        ) : (
          <div className="resource-list" style={{ padding: 'var(--spacing-lg)' }}>
            {filteredResources.map((resource) => {
              const typeInfo = getTypeInfo(resource.type);
              return (
                <div key={resource.id} className="resource-item">
                  {/* Icône du type */}
                  <div
                    className={`resource-item__icon resource-item__icon--${resource.type}`}
                    style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}
                  >
                    {typeInfo.icon}
                  </div>

                  {/* Contenu */}
                  <div className="resource-item__content">
                    <div className="resource-item__title">
                      {resource.titre}
                      {resource.isPremium && (
                        <span className="badge badge--premium">Premium</span>
                      )}
                      {!resource.actif && (
                        <span className="badge badge--warning">Inactif</span>
                      )}
                    </div>
                    <div className="resource-item__meta">
                      <span>{typeInfo.label}</span>
                      {resource.chapitre && (
                        <span>📖 {getChapitreName(resource.chapitre)}</span>
                      )}
                      {resource.duree && (
                        <span>⏱️ {resource.duree} min</span>
                      )}
                      {resource.fichierNom && (
                        <span>📎 {resource.fichierNom}</span>
                      )}
                      {resource.tags && resource.tags.length > 0 && (
                        <span>🏷️ {resource.tags.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="resource-item__actions">
                    <button
                      onClick={() => handleTogglePremium(resource)}
                      className={`table-action-btn ${resource.isPremium ? 'table-action-btn--warning' : 'table-action-btn--view'}`}
                      title={resource.isPremium ? 'Passer en gratuit' : 'Passer en Premium'}
                    >
                      {resource.isPremium ? '⭐' : '☆'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(resource)}
                      className={`table-action-btn ${resource.actif !== false ? 'table-action-btn--view' : 'table-action-btn--warning'}`}
                      title={resource.actif !== false ? 'Désactiver' : 'Activer'}
                    >
                      {resource.actif !== false ? '✓' : '○'}
                    </button>
                    {(resource.fichierURL || resource.urlExterne) && (
                      <button
                        onClick={() => handlePreview(resource)}
                        className="table-action-btn table-action-btn--view"
                        title="Prévisualiser"
                      >
                        👁️
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(resource)}
                      className="table-action-btn table-action-btn--edit"
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteClick(resource)}
                      className="table-action-btn table-action-btn--delete"
                      title="Supprimer"
                      disabled={deleting === resource.id}
                    >
                      {deleting === resource.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== MODAL CRÉATION/ÉDITION ==================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            {/* En-tête */}
            <div className="modal__header">
              <h2 className="modal__title">
                {editingResource ? 'Modifier la ressource' : 'Nouvelle ressource'}
              </h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit}>
              <div className="modal__body">
                {/* Discipline (si création) */}
                {!editingResource && (
                  <div className="form-group">
                    <label className="form-label form-label--required">Discipline</label>
                    <select
                      name="disciplineId"
                      className={`form-select ${formErrors.disciplineId ? 'form-select--error' : ''}`}
                      value={formData.disciplineId}
                      onChange={handleFormChange}
                    >
                      <option value="">Sélectionner une discipline</option>
                      {disciplines.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.icone} {d.nom} ({d.classe})
                        </option>
                      ))}
                    </select>
                    {formErrors.disciplineId && (
                      <span className="form-error">{formErrors.disciplineId}</span>
                    )}
                  </div>
                )}

                {/* Titre et Type */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label form-label--required">Titre</label>
                    <input
                      type="text"
                      name="titre"
                      className={`form-input ${formErrors.titre ? 'form-input--error' : ''}`}
                      placeholder="Ex: Introduction aux fractions"
                      value={formData.titre}
                      onChange={handleFormChange}
                    />
                    {formErrors.titre && (
                      <span className="form-error">{formErrors.titre}</span>
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label form-label--required">Type</label>
                    <select
                      name="type"
                      className={`form-select ${formErrors.type ? 'form-select--error' : ''}`}
                      value={formData.type}
                      onChange={handleFormChange}
                    >
                      {RESOURCE_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.icon} {t.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.type && (
                      <span className="form-error">{formErrors.type}</span>
                    )}
                  </div>
                </div>

                {/* Chapitre et Ordre */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Chapitre (optionnel)</label>
                    <select
                      name="chapitre"
                      className="form-select"
                      value={formData.chapitre || formData.chapitreId || ''}
                      onChange={handleFormChange}
                      disabled={loadingChapitres}
                    >
                      <option value="">Aucun chapitre</option>
                      {chapitres.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.numero}. {c.titre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label className="form-label">Ordre</label>
                    <input
                      type="number"
                      name="ordre"
                      className="form-input"
                      min="1"
                      value={formData.ordre}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label className="form-label">Durée (min)</label>
                    <input
                      type="number"
                      name="duree"
                      className="form-input"
                      min="0"
                      placeholder="Ex: 30"
                      value={formData.duree || ''}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    className="form-textarea"
                    rows={3}
                    placeholder="Description de la ressource..."
                    value={formData.description || ''}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Upload de fichier */}
                <div className="form-group">
                  <label className="form-label">
                    Fichier
                    <span className="form-helper" style={{ marginLeft: 'var(--spacing-sm)' }}>
                      ({ALLOWED_EXTENSIONS[formData.type].join(', ')} - max {MAX_FILE_SIZE_MB} Mo)
                    </span>
                  </label>
                  
                  <div className="file-upload">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_EXTENSIONS[formData.type].join(',')}
                      onChange={handleFileSelect}
                      className="file-upload__input"
                      id="file-input"
                    />
                    
                    {!selectedFile && !filePreview ? (
                      <label htmlFor="file-input" className="file-upload__dropzone">
                        <div className="file-upload__icon">📁</div>
                        <p className="file-upload__text">
                          Cliquez ou glissez un fichier ici
                        </p>
                        <p className="file-upload__hint">
                          {ALLOWED_EXTENSIONS[formData.type].join(', ')}
                        </p>
                      </label>
                    ) : (
                      <div className="file-upload__preview">
                        {/* Prévisualisation selon le type */}
                        {selectedFile?.type.startsWith('image/') && filePreview && (
                          <img src={filePreview} alt="Aperçu" className="file-preview__image" />
                        )}
                        {selectedFile?.type.startsWith('video/') && filePreview && (
                          <video src={filePreview} controls className="file-preview__video" />
                        )}
                        {!selectedFile?.type.startsWith('image/') && !selectedFile?.type.startsWith('video/') && (
                          <div className="file-preview__document">
                            <span className="file-preview__icon">
                              {getTypeInfo(formData.type).icon}
                            </span>
                          </div>
                        )}
                        
                        <div className="file-preview__info">
                          <p className="file-preview__name">
                            {selectedFile?.name || editingResource?.fichierNom}
                          </p>
                          {selectedFile && (
                            <p className="file-preview__size">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          )}
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="file-preview__remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {formErrors.fichier && (
                    <span className="form-error">{formErrors.fichier}</span>
                  )}
                  
                  {/* Barre de progression upload */}
                  {uploading && (
                    <div className="upload-progress">
                      <div 
                        className="upload-progress__bar" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                      <span className="upload-progress__text">{uploadProgress}%</span>
                    </div>
                  )}
                </div>

                {/* URL externe (pour vidéos YouTube, etc.) */}
                {formData.type === 'video' && (
                  <div className="form-group">
                    <label className="form-label">URL externe (YouTube, Vimeo...)</label>
                    <input
                      type="url"
                      name="urlExterne"
                      className="form-input"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={formData.urlExterne || ''}
                      onChange={handleFormChange}
                    />
                    <span className="form-helper">
                      Alternative à l'upload de fichier
                    </span>
                  </div>
                )}

                {/* Contenu texte (pour les cours) */}
                {formData.type === 'cours' && (
                  <div className="form-group">
                    <label className="form-label">Contenu du cours</label>
                    <textarea
                      name="contenu"
                      className="form-textarea"
                      rows={6}
                      placeholder="Saisissez le contenu du cours ici..."
                      value={formData.contenu || ''}
                      onChange={handleFormChange}
                    />
                    <span className="form-helper">
                      Optionnel si vous uploadez un fichier
                    </span>
                  </div>
                )}

                {/* Tags */}
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div className="tags-input">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ajouter un tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="btn btn--outline btn--sm"
                    >
                      Ajouter
                    </button>
                  </div>
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="tags-list">
                      {formData.tags.map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(index)}
                            className="tag__remove"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="form-group">
                  <label className="form-label">Options</label>
                  <div className="form-options">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        name="isPremium"
                        checked={formData.isPremium}
                        onChange={handleFormChange}
                      />
                      <span>Contenu Premium ⭐</span>
                    </label>
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        name="actif"
                        checked={formData.actif !== false}
                        onChange={handleFormChange}
                      />
                      <span>Ressource active</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal__footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn--outline"
                  disabled={saving || uploading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || uploading}
                >
                  {saving || uploading ? (
                    uploading ? `Upload ${uploadProgress}%...` : 'Enregistrement...'
                  ) : (
                    editingResource ? 'Mettre à jour' : 'Créer la ressource'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL PRÉVISUALISATION ==================== */}
      {isPreviewOpen && previewResource && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {getTypeInfo(previewResource.type).icon} {previewResource.titre}
              </h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>
            <div className="modal__body">
              {/* Prévisualisation selon le type */}
              {previewResource.type === 'video' && previewResource.urlExterne ? (
                <div className="preview-video">
                  <iframe
                    src={previewResource.urlExterne.replace('watch?v=', 'embed/')}
                    title={previewResource.titre}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : previewResource.fichierURL ? (
                <div className="preview-file">
                  {previewResource.fichierURL.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={previewResource.fichierURL} alt={previewResource.titre} />
                  ) : previewResource.fichierURL.match(/\.(mp4|webm)$/i) ? (
                    <video src={previewResource.fichierURL} controls />
                  ) : previewResource.fichierURL.match(/\.pdf$/i) ? (
                    <iframe src={previewResource.fichierURL} title={previewResource.titre} />
                  ) : (
                    <div className="preview-download">
                      <span className="preview-download__icon">
                        {getTypeInfo(previewResource.type).icon}
                      </span>
                      <p>{previewResource.fichierNom}</p>
                      <a
                        href={previewResource.fichierURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--primary"
                      >
                        Télécharger
                      </a>
                    </div>
                  )}
                </div>
              ) : previewResource.contenu ? (
                <div className="preview-content">
                  <p>{previewResource.contenu}</p>
                </div>
              ) : (
                <div className="preview-empty">
                  <p>Aucun contenu à prévisualiser</p>
                </div>
              )}

              {/* Informations */}
              <div className="preview-info">
                {previewResource.description && (
                  <p className="preview-description">{previewResource.description}</p>
                )}
                <div className="preview-meta">
                  <span>Type : {getTypeInfo(previewResource.type).label}</span>
                  {previewResource.duree && <span>Durée : {previewResource.duree} min</span>}
                  {previewResource.isPremium && <span className="badge badge--premium">Premium</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL SUPPRESSION ==================== */}
      {isDeleteModalOpen && deletingResource && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Confirmer la suppression</h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>
            <div className="modal__body">
              <p>
                Supprimer la ressource <strong>{deletingResource.titre}</strong> ?
              </p>
              {deletingResource.fichierURL && (
                <div className="alert alert--warning" style={{ marginTop: 'var(--spacing-md)' }}>
                  <span className="alert__icon">⚠️</span>
                  <div className="alert__content">
                    <p className="alert__message">
                      Le fichier associé sera également supprimé de façon permanente.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button onClick={handleCloseModal} className="btn btn--outline">
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn btn--danger"
                disabled={deleting !== null}
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STYLES SPÉCIFIQUES ==================== */}
      <style>{`
        /* ==================== SÉLECTEUR DE DISCIPLINE ==================== */
        
        .discipline-tabs {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
          margin-top: var(--spacing-md);
        }

        .discipline-tab {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: white;
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .discipline-tab:hover {
          border-color: var(--discipline-color, var(--color-primary));
        }

        .discipline-tab--active {
          border-color: var(--discipline-color, var(--color-primary));
          background: color-mix(in srgb, var(--discipline-color, var(--color-primary)) 10%, white);
        }

        .discipline-tab__icon {
          font-size: var(--text-lg);
        }

        .discipline-tab__name {
          font-weight: var(--font-medium);
        }

        .discipline-tab__class {
          font-size: var(--text-xs);
          color: var(--color-text-light);
          background: var(--color-bg-secondary);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        /* ==================== FORMULAIRE ==================== */
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--spacing-lg);
        }

        .form-options {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-lg);
          margin-top: var(--spacing-sm);
        }

        .form-select--sm {
          padding: var(--spacing-sm) var(--spacing-md);
          font-size: var(--text-sm);
          min-width: 140px;
        }

        /* ==================== UPLOAD DE FICHIER ==================== */
        
        .file-upload {
          position: relative;
        }

        .file-upload__input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .file-upload__dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xl);
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-bg-secondary);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .file-upload__dropzone:hover {
          border-color: var(--color-primary);
          background: rgba(37, 99, 235, 0.05);
        }

        .file-upload__icon {
          font-size: 48px;
          margin-bottom: var(--spacing-md);
        }

        .file-upload__text {
          font-weight: var(--font-medium);
          margin-bottom: var(--spacing-xs);
        }

        .file-upload__hint {
          font-size: var(--text-sm);
          color: var(--color-text-light);
        }

        .file-upload__preview {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          padding: var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-bg-secondary);
        }

        .file-preview__image,
        .file-preview__video {
          width: 120px;
          height: 80px;
          object-fit: cover;
          border-radius: var(--radius-md);
        }

        .file-preview__document {
          width: 80px;
          height: 80px;
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .file-preview__icon {
          font-size: 32px;
        }

        .file-preview__info {
          flex: 1;
        }

        .file-preview__name {
          font-weight: var(--font-medium);
          margin-bottom: var(--spacing-xs);
          word-break: break-all;
        }

        .file-preview__size {
          font-size: var(--text-sm);
          color: var(--color-text-light);
        }

        .file-preview__remove {
          width: 32px;
          height: 32px;
          border: none;
          background: var(--color-error);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-base);
        }

        .file-preview__remove:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        /* ==================== BARRE DE PROGRESSION ==================== */
        
        .upload-progress {
          margin-top: var(--spacing-md);
          height: 8px;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
          position: relative;
        }

        .upload-progress__bar {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
          border-radius: var(--radius-full);
          transition: width var(--transition-base);
        }

        .upload-progress__text {
          position: absolute;
          right: var(--spacing-sm);
          top: 50%;
          transform: translateY(-50%);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          color: var(--color-text);
        }

        /* ==================== TAGS ==================== */
        
        .tags-input {
          display: flex;
          gap: var(--spacing-sm);
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-md);
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          color: var(--color-text);
        }

        .tag__remove {
          width: 18px;
          height: 18px;
          border: none;
          background: transparent;
          color: var(--color-text-light);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all var(--transition-base);
        }

        .tag__remove:hover {
          background: var(--color-error);
          color: white;
        }

        /* ==================== PRÉVISUALISATION ==================== */
        
        .preview-video {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: var(--radius-lg);
        }

        .preview-video iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .preview-file {
          text-align: center;
        }

        .preview-file img,
        .preview-file video {
          max-width: 100%;
          max-height: 60vh;
          border-radius: var(--radius-lg);
        }

        .preview-file iframe {
          width: 100%;
          height: 60vh;
          border: none;
          border-radius: var(--radius-lg);
        }

        .preview-download {
          padding: var(--spacing-2xl);
          text-align: center;
        }

        .preview-download__icon {
          font-size: 64px;
          display: block;
          margin-bottom: var(--spacing-lg);
        }

        .preview-content {
          padding: var(--spacing-lg);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          white-space: pre-wrap;
        }

        .preview-empty {
          padding: var(--spacing-2xl);
          text-align: center;
          color: var(--color-text-light);
        }

        .preview-info {
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-lg);
          border-top: 1px solid var(--color-border);
        }

        .preview-description {
          color: var(--color-text-light);
          margin-bottom: var(--spacing-md);
        }

        .preview-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-lg);
          font-size: var(--text-sm);
          color: var(--color-text-light);
        }

        /* ==================== RESSOURCES - AFFICHAGE CARTE ==================== */
        
        .resource-item__title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        /* ==================== ACTION WARNING ==================== */
        
        .table-action-btn--warning {
          color: var(--color-warning);
        }

        /* ==================== RESPONSIVE ==================== */
        
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .admin-table-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input__field {
            width: 100%;
          }

          .file-upload__preview {
            flex-direction: column;
            text-align: center;
          }

          .preview-meta {
            flex-direction: column;
            gap: var(--spacing-sm);
          }
        }
      `}</style>
    </div>
  );
};

export default ResourceManager;
