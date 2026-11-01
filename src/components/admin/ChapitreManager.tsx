/**
 * ============================================================================
 * COMPOSANT CHAPITRE MANAGER - PedaClic
 * ============================================================================
 * Interface CRUD complète pour la gestion des chapitres par discipline
 * Permet de créer, modifier, supprimer et réorganiser les chapitres
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DisciplineService from '../../services/disciplineService';
import { ChapitreService, Chapitre, ChapitreFormData } from '../../services/chapitreService';
import type { Discipline } from '../../types';
// [Chapitres] Comptage des ressources rattachées à chaque chapitre
import { ResourceService } from '../../services/ResourceService';

// ==================== CONSTANTES ====================

/** État initial du formulaire */
const INITIAL_FORM_DATA: Omit<ChapitreFormData, 'disciplineId'> = {
  numero: 1,
  titre: '',
  description: '',
  objectifs: [],
  dureeEstimee: 0,
  isPremium: false,
  actif: true
};

// ==================== INTERFACES ====================

interface FormErrors {
  disciplineId?: string;
  numero?: string;
  titre?: string;
}

// ==================== COMPOSANT PRINCIPAL ====================

const ChapitreManager: React.FC = () => {
  // ==================== ÉTAT ====================

  // Données
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [chapitres, setChapitres] = useState<Chapitre[]>([]);
  /* [Chapitres] Nombre de ressources actives par chapitre (id → nombre).
     Un chapitre n'apparaît côté élève que s'il contient au moins une ressource. */
  const [nbRessources, setNbRessources] = useState<Record<string, number>>({});
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  
  // État de chargement
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);
  const [loadingChapitres, setLoadingChapitres] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal et formulaire
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingChapitre, setEditingChapitre] = useState<Chapitre | null>(null);
  const [deletingChapitre, setDeletingChapitre] = useState<Chapitre | null>(null);
  const [formData, setFormData] = useState<ChapitreFormData>({
    ...INITIAL_FORM_DATA,
    disciplineId: ''
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Gestion des objectifs
  const [newObjectif, setNewObjectif] = useState('');

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

      /* [Chapitres] Comptage non bloquant des ressources par chapitre */
      try {
        const ressources = await ResourceService.getAll({ disciplineId: selectedDiscipline });
        const compte: Record<string, number> = {};
        ressources.forEach(r => {
          if (r.actif === false) return;               // ressource masquée = non visible
          const cle = r.chapitre || r.chapitreId;
          if (cle) compte[cle] = (compte[cle] || 0) + 1;
        });
        setNbRessources(compte);
      } catch (e) {
        console.warn('Comptage des ressources indisponible :', e);
        setNbRessources({});
      }
    } catch (err) {
      console.error('Erreur lors du chargement des chapitres:', err);
      setError('Impossible de charger les chapitres.');
    } finally {
      setLoadingChapitres(false);
    }
  }, [selectedDiscipline]);

  useEffect(() => {
    loadDisciplines();
  }, [loadDisciplines]);

  useEffect(() => {
    loadChapitres();
  }, [loadChapitres]);

  // ==================== VALIDATION DU FORMULAIRE ====================

  /**
   * Valide les données du formulaire
   */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.disciplineId) {
      errors.disciplineId = 'Veuillez sélectionner une discipline';
    }

    if (!formData.titre.trim()) {
      errors.titre = 'Le titre du chapitre est requis';
    } else if (formData.titre.length < 3) {
      errors.titre = 'Le titre doit contenir au moins 3 caractères';
    }

    if (formData.numero < 1) {
      errors.numero = 'Le numéro doit être supérieur à 0';
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
    setError(null);
  };

  /**
   * Ouvre le modal pour créer un nouveau chapitre
   */
  const handleCreate = async () => {
    const nextNumero = await ChapitreService.getNextNumero(selectedDiscipline);
    setEditingChapitre(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      disciplineId: selectedDiscipline,
      numero: nextNumero
    });
    setFormErrors({});
    setNewObjectif('');
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal pour modifier un chapitre
   */
  const handleEdit = (chapitre: Chapitre) => {
    setEditingChapitre(chapitre);
    setFormData({
      disciplineId: chapitre.disciplineId,
      numero: chapitre.numero,
      titre: chapitre.titre,
      description: chapitre.description,
      objectifs: chapitre.objectifs || [],
      dureeEstimee: chapitre.dureeEstimee,
      isPremium: chapitre.isPremium,
      actif: chapitre.actif
    });
    setFormErrors({});
    setNewObjectif('');
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal de confirmation de suppression
   */
  const handleDeleteClick = (chapitre: Chapitre) => {
    setDeletingChapitre(chapitre);
    setIsDeleteModalOpen(true);
  };

  /**
   * Ferme les modals
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setEditingChapitre(null);
    setDeletingChapitre(null);
    setFormErrors({});
    setNewObjectif('');
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
   * Ajoute un objectif pédagogique
   */
  const handleAddObjectif = () => {
    if (newObjectif.trim()) {
      setFormData(prev => ({
        ...prev,
        objectifs: [...(prev.objectifs || []), newObjectif.trim()]
      }));
      setNewObjectif('');
    }
  };

  /**
   * Supprime un objectif pédagogique
   */
  const handleRemoveObjectif = (index: number) => {
    setFormData(prev => ({
      ...prev,
      objectifs: (prev.objectifs || []).filter((_, i) => i !== index)
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

      if (editingChapitre) {
        await ChapitreService.update(editingChapitre.id, formData);
        setSuccess('Chapitre modifié avec succès !');
      } else {
        await ChapitreService.create(formData);
        setSuccess('Chapitre créé avec succès !');
      }

      handleCloseModal();
      await loadChapitres();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Confirme la suppression
   */
  const handleConfirmDelete = async () => {
    if (!deletingChapitre) return;

    try {
      setDeleting(deletingChapitre.id);
      await ChapitreService.delete(deletingChapitre.id);
      setSuccess('Chapitre supprimé avec succès !');
      handleCloseModal();
      await loadChapitres();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Bascule l'état actif d'un chapitre
   */
  const handleToggleActive = async (chapitre: Chapitre) => {
    try {
      await ChapitreService.toggleActive(chapitre.id, !chapitre.actif);
      await loadChapitres();
      setSuccess(chapitre.actif ? 'Chapitre désactivé' : 'Chapitre activé');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  /**
   * Obtient le nom de la discipline
   */
  const getDisciplineName = (id: string): string => {
    const discipline = disciplines.find(d => d.id === id);
    return discipline ? discipline.nom : 'Non trouvée';
  };

  // ==================== RENDU ====================

  return (
    <div className="chapitre-manager">
      {/* En-tête de la page */}
      <header className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">
            Gestion des Chapitres
          </h1>
          <p className="admin-page-header__subtitle">
            Organisez le contenu pédagogique par chapitres
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button
            onClick={handleCreate}
            className="btn btn--primary"
            disabled={!selectedDiscipline || loadingDisciplines}
          >
            <span>➕</span>
            Nouveau chapitre
          </button>
        </div>
      </header>

      {/* Messages */}
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

      {/* Sélecteur de discipline */}
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
                    <span className="discipline-tab__class">
                      {discipline.classe}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== [Chapitres] Rôle de cette page (aide à l'administrateur) =====
          Un chapitre est un « classeur » : il structure les ressources d'une
          discipline, mais n'a pas de contenu propre à lire. */}
      <div className="chapitres-info">
        <span className="chapitres-info__icon" aria-hidden="true">💡</span>
        <p className="chapitres-info__texte">
          Un chapitre sert à <strong>regrouper les ressources</strong> d'une discipline
          (cours, exercices, vidéos…). Il apparaît sur la page de la discipline côté élève
          dès qu'au moins une ressource active y est rattachée, avec sa description et ses objectifs.
          Pour le remplir : <Link to="/admin/ressources">Ressources</Link> → choisir ce chapitre
          dans le champ « Chapitre ».
        </p>
      </div>

      {/* Liste des chapitres */}
      <div className="admin-table-container">
        <div className="admin-table-header">
          <h2 className="admin-table-title">
            Chapitres {selectedDiscipline && `- ${getDisciplineName(selectedDiscipline)}`}
            {chapitres.length > 0 && ` (${chapitres.length})`}
          </h2>
        </div>

        {loadingChapitres ? (
          <div className="loading-container" style={{ padding: 'var(--spacing-2xl)' }}>
            <div className="spinner"></div>
            <p>Chargement des chapitres...</p>
          </div>
        ) : !selectedDiscipline ? (
          <div className="empty-state">
            <div className="empty-state__icon">📖</div>
            <h3 className="empty-state__title">Sélectionnez une discipline</h3>
            <p className="empty-state__message">
              Choisissez une discipline ci-dessus pour voir ses chapitres.
            </p>
          </div>
        ) : chapitres.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📖</div>
            <h3 className="empty-state__title">Aucun chapitre</h3>
            <p className="empty-state__message">
              Cette discipline n'a pas encore de chapitres.
            </p>
            <button onClick={handleCreate} className="btn btn--primary">
              Créer le premier chapitre
            </button>
          </div>
        ) : (
          <div className="chapitres-list">
            {chapitres.map((chapitre) => (
              <div
                key={chapitre.id}
                className={`chapitre-card ${!chapitre.actif ? 'chapitre-card--inactive' : ''}`}
              >
                {/* Numéro du chapitre */}
                <div className="chapitre-card__number">
                  {chapitre.numero}
                </div>

                {/* Contenu principal */}
                <div className="chapitre-card__content">
                  <h3 className="chapitre-card__title">
                    {chapitre.titre}
                    {chapitre.isPremium && (
                      <span className="badge badge--premium">Premium</span>
                    )}
                    {!chapitre.actif && (
                      <span className="badge badge--warning">Inactif</span>
                    )}
                  </h3>
                  
                  {chapitre.description && (
                    <p className="chapitre-card__description">{chapitre.description}</p>
                  )}

                  <div className="chapitre-card__meta">
                    {/* !! : évite d'afficher « 0 » quand la durée vaut 0 */}
                    {!!chapitre.dureeEstimee && (
                      <span>⏱️ {chapitre.dureeEstimee}h estimée</span>
                    )}
                    {chapitre.objectifs && chapitre.objectifs.length > 0 && (
                      <span>🎯 {chapitre.objectifs.length} objectif(s)</span>
                    )}
                    {/* [Chapitres] Nombre de ressources rattachées */}
                    <span>📎 {nbRessources[chapitre.id] || 0} ressource(s)</span>
                  </div>

                  {/* [Chapitres] Alerte : chapitre vide = invisible pour les élèves */}
                  {chapitre.actif && !nbRessources[chapitre.id] && (
                    <p className="chapitre-card__alerte">
                      Non visible par les élèves : aucune ressource rattachée.{' '}
                      <Link to="/admin/ressources">Ajouter une ressource</Link>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="chapitre-card__actions">
                  <button
                    onClick={() => handleToggleActive(chapitre)}
                    className={`table-action-btn ${chapitre.actif ? 'table-action-btn--view' : 'table-action-btn--edit'}`}
                    title={chapitre.actif ? 'Désactiver' : 'Activer'}
                  >
                    {chapitre.actif ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button
                    onClick={() => handleEdit(chapitre)}
                    className="table-action-btn table-action-btn--edit"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteClick(chapitre)}
                    className="table-action-btn table-action-btn--delete"
                    title="Supprimer"
                    disabled={deleting === chapitre.id}
                  >
                    {deleting === chapitre.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== MODAL CRÉATION/ÉDITION ==================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {editingChapitre ? 'Modifier le chapitre' : 'Nouveau chapitre'}
              </h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal__body">
                {/* Discipline (si création) */}
                {!editingChapitre && (
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

                {/* Numéro et Titre */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: '0 0 100px' }}>
                    <label className="form-label form-label--required">N°</label>
                    <input
                      type="number"
                      name="numero"
                      className={`form-input ${formErrors.numero ? 'form-input--error' : ''}`}
                      min="1"
                      value={formData.numero}
                      onChange={handleFormChange}
                    />
                    {formErrors.numero && (
                      <span className="form-error">{formErrors.numero}</span>
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label form-label--required">Titre du chapitre</label>
                    <input
                      type="text"
                      name="titre"
                      className={`form-input ${formErrors.titre ? 'form-input--error' : ''}`}
                      placeholder="Ex: Les fractions, La Révolution française..."
                      value={formData.titre}
                      onChange={handleFormChange}
                    />
                    {formErrors.titre && (
                      <span className="form-error">{formErrors.titre}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    className="form-textarea"
                    rows={3}
                    placeholder="Description du chapitre..."
                    value={formData.description || ''}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Objectifs pédagogiques */}
                <div className="form-group">
                  <label className="form-label">Objectifs pédagogiques</label>
                  <div className="objectifs-input">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ajouter un objectif..."
                      value={newObjectif}
                      onChange={(e) => setNewObjectif(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjectif())}
                    />
                    <button
                      type="button"
                      onClick={handleAddObjectif}
                      className="btn btn--outline btn--sm"
                    >
                      Ajouter
                    </button>
                  </div>
                  {formData.objectifs && formData.objectifs.length > 0 && (
                    <ul className="objectifs-list">
                      {formData.objectifs.map((obj, index) => (
                        <li key={index} className="objectif-item">
                          <span>🎯 {obj}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveObjectif(index)}
                            className="objectif-remove"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Durée et Options */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Durée estimée (heures)</label>
                    <input
                      type="number"
                      name="dureeEstimee"
                      className="form-input"
                      min="0"
                      step="0.5"
                      placeholder="Ex: 2"
                      value={formData.dureeEstimee || ''}
                      onChange={handleFormChange}
                    />
                  </div>

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
                        <span>Chapitre actif</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn--outline"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? 'Enregistrement...' : (editingChapitre ? 'Mettre à jour' : 'Créer le chapitre')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIRMATION SUPPRESSION ==================== */}
      {isDeleteModalOpen && deletingChapitre && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Confirmer la suppression</h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>
            <div className="modal__body">
              <p>
                Supprimer le chapitre <strong>{deletingChapitre.numero}. {deletingChapitre.titre}</strong> ?
              </p>
              <div className="alert alert--warning" style={{ marginTop: 'var(--spacing-md)' }}>
                <span className="alert__icon">⚠️</span>
                <div className="alert__content">
                  <p className="alert__message">
                    Les ressources associées ne seront pas supprimées automatiquement.
                    {/* [Chapitres] Conséquence précise de la suppression */}
                    {(nbRessources[deletingChapitre.id] || 0) > 0 && (
                      <> Les {nbRessources[deletingChapitre.id]} ressource(s) rattachée(s)
                      apparaîtront ensuite dans « Autres ressources » de la discipline.</>
                    )}
                  </p>
                </div>
              </div>
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

      {/* Styles spécifiques */}
      <style>{`
        /* Sélecteur de discipline */
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

        /* Liste des chapitres */
        .chapitres-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
        }

        .chapitre-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          transition: all var(--transition-base);
        }

        .chapitre-card:hover {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-md);
        }

        .chapitre-card--inactive {
          opacity: 0.6;
          background: var(--color-bg-tertiary);
        }

        .chapitre-card__number {
          width: 48px;
          height: 48px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          flex-shrink: 0;
        }

        .chapitre-card__content {
          flex: 1;
          min-width: 0;
        }

        .chapitre-card__title {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          margin-bottom: var(--spacing-xs);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .chapitre-card__description {
          font-size: var(--text-sm);
          color: var(--color-text-light);
          margin: 0 0 var(--spacing-sm);
        }

        .chapitre-card__meta {
          display: flex;
          gap: var(--spacing-lg);
          font-size: var(--text-xs);
          color: var(--color-text-lighter);
        }

        /* [Chapitres] Encadré d'aide sous le sélecteur de discipline */
        .chapitres-info {
          display: flex;
          gap: var(--spacing-sm);
          align-items: flex-start;
          margin-bottom: var(--spacing-lg);
          padding: var(--spacing-md) var(--spacing-lg);
          background: #eff6ff;                 /* bleu très clair */
          border: 1px solid #bfdbfe;
          border-radius: 12px;
        }
        .chapitres-info__icon { font-size: 1.1rem; line-height: 1.5; }
        .chapitres-info__texte {
          margin: 0;
          font-size: var(--text-sm);
          line-height: 1.55;
          color: #1e3a8a;
        }
        .chapitres-info__texte a { font-weight: 600; text-decoration: underline; }

        /* [Chapitres] Alerte « chapitre vide » sur une carte */
        .chapitre-card__alerte {
          margin: var(--spacing-sm) 0 0;
          font-size: var(--text-xs);
          color: #b45309;                      /* ambre : avertissement */
        }
        .chapitre-card__alerte a { font-weight: 600; text-decoration: underline; }

        .chapitre-card__actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        /* Formulaire: Ligne */
        .form-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-lg);
        }

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }

        /* Objectifs */
        .objectifs-input {
          display: flex;
          gap: var(--spacing-sm);
        }

        .objectifs-list {
          list-style: none;
          margin-top: var(--spacing-md);
        }

        .objectif-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-xs);
        }

        .objectif-remove {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-error);
          opacity: 0.7;
        }

        .objectif-remove:hover {
          opacity: 1;
        }

        /* Options */
        .form-options {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-sm);
        }
      `}</style>
    </div>
  );
};

export default ChapitreManager;
