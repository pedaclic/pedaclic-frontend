/**
 * ============================================================================
 * COMPOSANT DISCIPLINE MANAGER - PedaClic
 * ============================================================================
 * Interface CRUD complète pour la gestion des disciplines (matières)
 * Permet de créer, modifier, supprimer et visualiser les disciplines
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import DisciplineService from '../../services/disciplineService';
import type { Discipline, DisciplineFormData, Niveau, Classe } from '../../types';

// ==================== CONSTANTES ====================

/** Options de niveaux scolaires */
const NIVEAUX: { value: Niveau; label: string }[] = [
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' }
];

/** Options de classes par niveau */
const CLASSES: Record<Niveau, { value: Classe; label: string }[]> = {
  college: [
    { value: '6eme', label: '6ème' },
    { value: '5eme', label: '5ème' },
    { value: '4eme', label: '4ème' },
    { value: '3eme', label: '3ème' }
  ],
  lycee: [
    { value: '2nde', label: 'Seconde' },
    { value: '1ere', label: 'Première' },
    { value: 'Terminale', label: 'Terminale' }
  ]
};

/** Couleurs prédéfinies pour les disciplines */
const COULEURS = [
  { value: '#2563eb', label: 'Bleu' },
  { value: '#059669', label: 'Vert' },
  { value: '#dc2626', label: 'Rouge' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#be185d', label: 'Rose' },
  { value: '#4b5563', label: 'Gris' }
];

/** État initial du formulaire */
const INITIAL_FORM_DATA: DisciplineFormData = {
  nom: '',
  niveau: 'college',
  classe: '6eme',
  ordre: 1,
  coefficient: 1,
  couleur: '#2563eb',
  icone: '📚',
  description: ''
};

// ==================== INTERFACES ====================

interface FormErrors {
  nom?: string;
  niveau?: string;
  classe?: string;
  ordre?: string;
}

// ==================== COMPOSANT PRINCIPAL ====================

const DisciplineManager: React.FC = () => {
  // ==================== ÉTAT ====================

  // Liste des disciplines
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filteredDisciplines, setFilteredDisciplines] = useState<Discipline[]>([]);
  
  // État de chargement
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal et formulaire
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);
  const [deletingDiscipline, setDeletingDiscipline] = useState<Discipline | null>(null);
  const [formData, setFormData] = useState<DisciplineFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Filtres
  const [filterNiveau, setFilterNiveau] = useState<Niveau | ''>('');
  const [filterClasse, setFilterClasse] = useState<Classe | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // ==================== CHARGEMENT DES DONNÉES ====================

  /**
   * Charge la liste des disciplines depuis Firestore
   */
  const loadDisciplines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DisciplineService.getAll();
      setDisciplines(data);
      setFilteredDisciplines(data);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Impossible de charger les disciplines. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDisciplines();
  }, [loadDisciplines]);

  // ==================== FILTRAGE ====================

  useEffect(() => {
    let result = [...disciplines];

    // Filtre par niveau
    if (filterNiveau) {
      result = result.filter(d => d.niveau === filterNiveau);
    }

    // Filtre par classe
    if (filterClasse) {
      result = result.filter(d => d.classe === filterClasse);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.nom.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      );
    }

    setFilteredDisciplines(result);
  }, [disciplines, filterNiveau, filterClasse, searchQuery]);

  // ==================== VALIDATION DU FORMULAIRE ====================

  /**
   * Valide les données du formulaire
   * @returns true si le formulaire est valide
   */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.nom.trim()) {
      errors.nom = 'Le nom de la discipline est requis';
    } else if (formData.nom.length < 2) {
      errors.nom = 'Le nom doit contenir au moins 2 caractères';
    }

    if (!formData.niveau) {
      errors.niveau = 'Veuillez sélectionner un niveau';
    }

    if (!formData.classe) {
      errors.classe = 'Veuillez sélectionner une classe';
    }

    if (formData.ordre < 1) {
      errors.ordre = 'L\'ordre doit être supérieur à 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ==================== HANDLERS ====================

  /**
   * Ouvre le modal pour créer une nouvelle discipline
   */
  const handleCreate = () => {
    setEditingDiscipline(null);
    setFormData(INITIAL_FORM_DATA);
    setFormErrors({});
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal pour modifier une discipline existante
   */
  const handleEdit = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setFormData({
      nom: discipline.nom,
      niveau: discipline.niveau,
      classe: discipline.classe,
      ordre: discipline.ordre,
      coefficient: discipline.coefficient,
      couleur: discipline.couleur,
      icone: discipline.icone,
      description: discipline.description
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  /**
   * Ouvre le modal de confirmation de suppression
   */
  const handleDeleteClick = (discipline: Discipline) => {
    setDeletingDiscipline(discipline);
    setIsDeleteModalOpen(true);
  };

  /**
   * Ferme les modals
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setEditingDiscipline(null);
    setDeletingDiscipline(null);
    setFormData(INITIAL_FORM_DATA);
    setFormErrors({});
  };

  /**
   * Gère les changements dans le formulaire
   */
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    // Gestion spéciale pour le niveau (reset de la classe)
    if (name === 'niveau') {
      const newNiveau = value as Niveau;
      setFormData(prev => ({
        ...prev,
        niveau: newNiveau,
        classe: CLASSES[newNiveau][0].value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? Number(value) : value
      }));
    }

    // Effacer l'erreur du champ modifié
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  /**
   * Soumet le formulaire (création ou modification)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      if (editingDiscipline) {
        // Modification
        await DisciplineService.update(editingDiscipline.id, formData);
        setSuccess('Discipline modifiée avec succès !');
      } else {
        // Création
        await DisciplineService.create(formData);
        setSuccess('Discipline créée avec succès !');
      }

      handleCloseModal();
      await loadDisciplines();

      // Effacer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Confirme la suppression d'une discipline
   */
  const handleConfirmDelete = async () => {
    if (!deletingDiscipline) return;

    try {
      setDeleting(deletingDiscipline.id);
      await DisciplineService.delete(deletingDiscipline.id);
      setSuccess('Discipline supprimée avec succès !');
      handleCloseModal();
      await loadDisciplines();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression. Veuillez réessayer.');
    } finally {
      setDeleting(null);
    }
  };

  /**
   * Obtient le label de la classe
   */
  const getClasseLabel = (classe: Classe): string => {
    for (const niveau of Object.values(CLASSES)) {
      const found = niveau.find(c => c.value === classe);
      if (found) return found.label;
    }
    return classe;
  };

  // ==================== RENDU ====================

  return (
    <div className="discipline-manager">
      {/* En-tête de la page */}
      <header className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">
            Gestion des Disciplines
          </h1>
          <p className="admin-page-header__subtitle">
            Gérez les matières enseignées sur PedaClic
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button onClick={handleCreate} className="btn btn--primary">
            <span>➕</span>
            Nouvelle discipline
          </button>
        </div>
      </header>

      {/* Messages d'alerte */}
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

      {/* Tableau des disciplines */}
      <div className="admin-table-container">
        {/* En-tête du tableau avec filtres */}
        <div className="admin-table-header">
          <h2 className="admin-table-title">
            Liste des disciplines ({filteredDisciplines.length})
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

            {/* Filtre par niveau */}
            <select
              className="form-select"
              value={filterNiveau}
              onChange={(e) => setFilterNiveau(e.target.value as Niveau | '')}
              style={{ width: 'auto' }}
            >
              <option value="">Tous les niveaux</option>
              {NIVEAUX.map(n => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>

            {/* Filtre par classe */}
            <select
              className="form-select"
              value={filterClasse}
              onChange={(e) => setFilterClasse(e.target.value as Classe | '')}
              style={{ width: 'auto' }}
              disabled={!filterNiveau}
            >
              <option value="">Toutes les classes</option>
              {filterNiveau && CLASSES[filterNiveau].map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contenu du tableau */}
        {loading ? (
          <div className="loading-container" style={{ padding: 'var(--spacing-2xl)' }}>
            <div className="spinner"></div>
            <p>Chargement des disciplines...</p>
          </div>
        ) : filteredDisciplines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">Aucune discipline trouvée</h3>
            <p className="empty-state__message">
              {searchQuery || filterNiveau || filterClasse
                ? 'Aucune discipline ne correspond aux critères de recherche.'
                : 'Commencez par créer votre première discipline.'}
            </p>
            {!searchQuery && !filterNiveau && !filterClasse && (
              <button onClick={handleCreate} className="btn btn--primary">
                Créer une discipline
              </button>
            )}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Discipline</th>
                <th>Niveau</th>
                <th>Classe</th>
                <th>Coefficient</th>
                <th>Ordre</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDisciplines.map((discipline) => (
                <tr key={discipline.id}>
                  {/* Nom avec icône et couleur */}
                  <td>
                    <div className="table-cell-icon">
                      <div
                        className="table-icon"
                        style={{ backgroundColor: `${discipline.couleur}20`, color: discipline.couleur }}
                      >
                        {discipline.icone || '📚'}
                      </div>
                      <div>
                        <strong>{discipline.nom}</strong>
                        {discipline.description && (
                          <div className="text-muted text-sm">{discipline.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Niveau */}
                  <td>
                    <span className={`badge badge--${discipline.niveau === 'college' ? 'primary' : 'secondary'}`}>
                      {discipline.niveau === 'college' ? 'Collège' : 'Lycée'}
                    </span>
                  </td>
                  
                  {/* Classe */}
                  <td>{getClasseLabel(discipline.classe)}</td>
                  
                  {/* Coefficient */}
                  <td>{discipline.coefficient || '-'}</td>
                  
                  {/* Ordre */}
                  <td>{discipline.ordre}</td>
                  
                  {/* Actions */}
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => handleEdit(discipline)}
                        className="table-action-btn table-action-btn--edit"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteClick(discipline)}
                        className="table-action-btn table-action-btn--delete"
                        title="Supprimer"
                        disabled={deleting === discipline.id}
                      >
                        {deleting === discipline.id ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ==================== MODAL CRÉATION/ÉDITION ==================== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal--lg" onClick={(e) => e.stopPropagation()}>
            {/* En-tête du modal */}
            <div className="modal__header">
              <h2 className="modal__title">
                {editingDiscipline ? 'Modifier la discipline' : 'Nouvelle discipline'}
              </h2>
              <button onClick={handleCloseModal} className="modal__close">
                ✕
              </button>
            </div>

            {/* Corps du modal - Formulaire */}
            <form onSubmit={handleSubmit}>
              <div className="modal__body">
                {/* Ligne 1: Nom et Icône */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label form-label--required">
                      Nom de la discipline
                    </label>
                    <input
                      type="text"
                      name="nom"
                      className={`form-input ${formErrors.nom ? 'form-input--error' : ''}`}
                      placeholder="Ex: Mathématiques, Français, SVT..."
                      value={formData.nom}
                      onChange={handleFormChange}
                    />
                    {formErrors.nom && (
                      <span className="form-error">{formErrors.nom}</span>
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Icône</label>
                    <input
                      type="text"
                      name="icone"
                      className="form-input"
                      placeholder="📚"
                      value={formData.icone || ''}
                      onChange={handleFormChange}
                      maxLength={4}
                    />
                    <span className="form-helper">Emoji uniquement</span>
                  </div>
                </div>

                {/* Ligne 2: Niveau et Classe */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label--required">Niveau</label>
                    <select
                      name="niveau"
                      className={`form-select ${formErrors.niveau ? 'form-select--error' : ''}`}
                      value={formData.niveau}
                      onChange={handleFormChange}
                    >
                      {NIVEAUX.map(n => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </select>
                    {formErrors.niveau && (
                      <span className="form-error">{formErrors.niveau}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label--required">Classe</label>
                    <select
                      name="classe"
                      className={`form-select ${formErrors.classe ? 'form-select--error' : ''}`}
                      value={formData.classe}
                      onChange={handleFormChange}
                    >
                      {CLASSES[formData.niveau].map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {formErrors.classe && (
                      <span className="form-error">{formErrors.classe}</span>
                    )}
                  </div>
                </div>

                {/* Ligne 3: Coefficient et Ordre */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Coefficient</label>
                    <input
                      type="number"
                      name="coefficient"
                      className="form-input"
                      min="1"
                      max="10"
                      value={formData.coefficient || 1}
                      onChange={handleFormChange}
                    />
                    <span className="form-helper">Pour les calculs de moyennes</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label--required">Ordre d'affichage</label>
                    <input
                      type="number"
                      name="ordre"
                      className={`form-input ${formErrors.ordre ? 'form-input--error' : ''}`}
                      min="1"
                      value={formData.ordre}
                      onChange={handleFormChange}
                    />
                    {formErrors.ordre && (
                      <span className="form-error">{formErrors.ordre}</span>
                    )}
                  </div>
                </div>

                {/* Ligne 4: Couleur */}
                <div className="form-group">
                  <label className="form-label">Couleur</label>
                  <div className="color-picker">
                    {COULEURS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        className={`color-option ${formData.couleur === c.value ? 'color-option--active' : ''}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setFormData(prev => ({ ...prev, couleur: c.value }))}
                        title={c.label}
                      >
                        {formData.couleur === c.value && '✓'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ligne 5: Description */}
                <div className="form-group">
                  <label className="form-label">Description (optionnel)</label>
                  <textarea
                    name="description"
                    className="form-textarea"
                    placeholder="Description courte de la discipline..."
                    rows={3}
                    value={formData.description || ''}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Footer du modal */}
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
                  {saving ? (
                    <>
                      <span className="spinner-small"></span>
                      Enregistrement...
                    </>
                  ) : (
                    editingDiscipline ? 'Mettre à jour' : 'Créer la discipline'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIRMATION SUPPRESSION ==================== */}
      {isDeleteModalOpen && deletingDiscipline && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Confirmer la suppression</h2>
              <button onClick={handleCloseModal} className="modal__close">✕</button>
            </div>
            <div className="modal__body">
              <p>
                Êtes-vous sûr de vouloir supprimer la discipline
                <strong> {deletingDiscipline.nom}</strong> ?
              </p>
              <div className="alert alert--warning" style={{ marginTop: 'var(--spacing-md)' }}>
                <span className="alert__icon">⚠️</span>
                <div className="alert__content">
                  <p className="alert__message">
                    Cette action est irréversible. Tous les chapitres et ressources
                    associés devront être supprimés manuellement.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button
                onClick={handleCloseModal}
                className="btn btn--outline"
                disabled={deleting !== null}
              >
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

      {/* Styles spécifiques au composant */}
      <style>{`
        /* Ligne de formulaire */
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

        /* Sélecteur de couleur */
        .color-picker {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .color-option {
          width: 36px;
          height: 36px;
          border: 2px solid transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          transition: all var(--transition-base);
        }

        .color-option:hover {
          transform: scale(1.1);
        }

        .color-option--active {
          border-color: var(--color-text);
          box-shadow: 0 0 0 2px white, 0 0 0 4px var(--color-text);
        }

        /* Fermer l'alerte */
        .alert__close {
          background: none;
          border: none;
          cursor: pointer;
          font-size: var(--text-lg);
          opacity: 0.7;
          transition: opacity var(--transition-base);
        }

        .alert__close:hover {
          opacity: 1;
        }

        /* Spinner petit pour les boutons */
        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Ajustement du form-select */
        .form-select {
          min-width: 150px;
        }
      `}</style>
    </div>
  );
};

export default DisciplineManager;
