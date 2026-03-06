// ==================== ADMIN EBOOKS - PHASE 20 ====================
// PedaClic : Interface d'administration des ebooks
// CRUD complet + upload PDF + couverture + aperçu
// Statistiques et gestion de la bibliothèque
// ==============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Ebook,
  EbookFormData,
  EbookStats,
  CategorieEbook,
  CATEGORIE_LABELS,
  CATEGORIE_ICONS
} from '../types/ebook.types';
import {
  getAllEbooksAdmin,
  addEbook,
  updateEbook,
  deleteEbook,
  toggleEbookActive,
  calculateEbookStats,
  formatFileSize,
  MATIERES_DISPONIBLES_FALLBACK
} from '../services/ebookService';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import { CLASSES } from '../types/cahierTextes.types';
import '../styles/AdminEbooks.css';

export const AdminEbooks: React.FC = () => {
  const { matieres: matieresDisciplines } = useDisciplinesOptions();
  const matieresOptions = useMemo(
    () => (matieresDisciplines?.length ? matieresDisciplines : MATIERES_DISPONIBLES_FALLBACK),
    [matieresDisciplines]
  );
  // ==================== STATES ====================
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EbookStats | null>(null);

  // --- État du formulaire ---
  const [showForm, setShowForm] = useState(false);
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null);
  const [formData, setFormData] = useState<EbookFormData>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Fichiers à uploader ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // --- Refs pour les inputs file ---
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  // --- Confirmation suppression ---
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ==================== FORMULAIRE VIDE ====================
  function getEmptyForm(): EbookFormData {
    return {
      titre: '',
      auteur: '',
      description: '',
      categorie: 'manuel',
      niveau: 'college',
      classe: 'all',
      matiere: '',
      nombrePages: 0,
      pagesApercu: 5,
      annee: '',
      editeur: '',
      isbn: '',
      tags: [],
      ordre: 0,
      isActive: true
    };
  }

  // ==================== CHARGEMENT ====================
  useEffect(() => {
    loadEbooks();
  }, []);

  const loadEbooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEbooksAdmin();
      setEbooks(data);
      setStats(calculateEbookStats(data));
    } catch (err: any) {
      setError('Erreur lors du chargement des ebooks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== HANDLERS FORMULAIRE ====================

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /**
   * Gère le champ tags (séparés par des virgules)
   */
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  // ==================== SOUMISSION FORMULAIRE ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Validations ---
    if (!formData.titre.trim()) {
      setError('Le titre est obligatoire');
      return;
    }
    if (!editingEbook && !pdfFile) {
      setError('Le fichier PDF est obligatoire');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingEbook) {
        // --- Mode modification ---
        await updateEbook(editingEbook.id, formData, pdfFile, coverFile, previewFile);
        setSuccessMessage(`✅ Ebook "${formData.titre}" modifié avec succès`);
      } else {
        // --- Mode ajout ---
        await addEbook(formData, pdfFile!, coverFile, previewFile);
        setSuccessMessage(`✅ Ebook "${formData.titre}" ajouté avec succès`);
      }

      // --- Réinitialisation ---
      resetForm();
      await loadEbooks();

      // Masquer le message après 4 secondes
      setTimeout(() => setSuccessMessage(null), 4000);

    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ==================== ÉDITION ====================

  const handleEdit = (ebook: Ebook) => {
    setEditingEbook(ebook);
    setFormData({
      titre: ebook.titre,
      auteur: ebook.auteur,
      description: ebook.description,
      categorie: ebook.categorie,
      niveau: ebook.niveau,
      classe: ebook.classe,
      matiere: ebook.matiere || '',
      nombrePages: ebook.nombrePages,
      pagesApercu: ebook.pagesApercu,
      annee: ebook.annee || '',
      editeur: ebook.editeur || '',
      isbn: ebook.isbn || '',
      tags: ebook.tags || [],
      ordre: ebook.ordre,
      isActive: ebook.isActive
    });
    setShowForm(true);
    // Scroll vers le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==================== SUPPRESSION ====================

  const handleDelete = async (id: string) => {
    try {
      await deleteEbook(id);
      setDeleteConfirm(null);
      setSuccessMessage('✅ Ebook supprimé avec succès');
      await loadEbooks();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  // ==================== ACTIVATION / DÉSACTIVATION ====================

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await toggleEbookActive(id, !currentState);
      await loadEbooks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ==================== RÉINITIALISATION ====================

  const resetForm = () => {
    setFormData(getEmptyForm());
    setEditingEbook(null);
    setPdfFile(null);
    setCoverFile(null);
    setPreviewFile(null);
    setShowForm(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (previewInputRef.current) previewInputRef.current.value = '';
  };

  // ==================== RENDER STATES ====================

  if (loading) {
    return (
      <div className="admin-ebooks">
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Chargement des ebooks...</p>
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="admin-ebooks">

      {/* <!-- En-tête Admin --> */}
      <div className="admin-ebooks-header">
        <h1>📚 Gestion de la Bibliothèque</h1>
        <button
          className="btn-add-ebook"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? '✕ Fermer' : '+ Ajouter un ebook'}
        </button>
      </div>

      {/* <!-- Messages --> */}
      {error && <div className="admin-alert error">❌ {error}</div>}
      {successMessage && <div className="admin-alert success">{successMessage}</div>}

      {/* <!-- Statistiques rapides --> */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="stat-card">
            <span className="stat-number">{stats.totalEbooks}</span>
            <span className="stat-label">Total ebooks</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.ebooksActifs}</span>
            <span className="stat-label">Actifs</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalVues}</span>
            <span className="stat-label">Vues totales</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalTelechargements}</span>
            <span className="stat-label">Téléchargements</span>
          </div>
        </div>
      )}

      {/* ==================== FORMULAIRE AJOUT/MODIFICATION ==================== */}
      {showForm && (
        <div className="admin-ebook-form-container">
          <h2>{editingEbook ? '✏️ Modifier l\'ebook' : '📥 Ajouter un ebook'}</h2>

          <form onSubmit={handleSubmit} className="admin-ebook-form">

            {/* <!-- Ligne 1 : Titre + Auteur --> */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="titre">Titre *</label>
                <input
                  id="titre"
                  name="titre"
                  type="text"
                  value={formData.titre}
                  onChange={handleInputChange}
                  placeholder="Ex: Mathématiques 3ème - Programme complet"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="auteur">Auteur(s) *</label>
                <input
                  id="auteur"
                  name="auteur"
                  type="text"
                  value={formData.auteur}
                  onChange={handleInputChange}
                  placeholder="Ex: Pr. Diallo Moussa"
                  required
                />
              </div>
            </div>

            {/* <!-- Description --> */}
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Décrivez le contenu de cet ebook..."
                rows={3}
                required
              />
            </div>

            {/* <!-- Ligne 2 : Catégorie + Niveau + Classe --> */}
            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="categorie">Catégorie *</label>
                <select
                  id="categorie"
                  name="categorie"
                  value={formData.categorie}
                  onChange={handleInputChange}
                >
                  {(Object.keys(CATEGORIE_LABELS) as CategorieEbook[]).map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORIE_ICONS[cat]} {CATEGORIE_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="niveau">Niveau *</label>
                <select
                  id="niveau"
                  name="niveau"
                  value={formData.niveau}
                  onChange={handleInputChange}
                >
                  <option value="college">Collège</option>
                  <option value="lycee">Lycée</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="classe">Classe</label>
                <select
                  id="classe"
                  name="classe"
                  value={formData.classe}
                  onChange={handleInputChange}
                >
                  <option value="all">Toutes les classes</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* <!-- Ligne 3 : Matière + Année + Éditeur --> */}
            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="matiere">Matière</label>
                <select
                  id="matiere"
                  name="matiere"
                  value={formData.matiere}
                  onChange={handleInputChange}
                >
                  <option value="">-- Sélectionner --</option>
                  {matieresOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="annee">Année</label>
                <input
                  id="annee"
                  name="annee"
                  type="text"
                  value={formData.annee}
                  onChange={handleInputChange}
                  placeholder="Ex: 2024-2025"
                />
              </div>
              <div className="form-group">
                <label htmlFor="editeur">Éditeur</label>
                <input
                  id="editeur"
                  name="editeur"
                  type="text"
                  value={formData.editeur}
                  onChange={handleInputChange}
                  placeholder="Ex: INEADE"
                />
              </div>
            </div>

            {/* <!-- Ligne 4 : Pages + Aperçu + Ordre --> */}
            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="nombrePages">Nombre de pages *</label>
                <input
                  id="nombrePages"
                  name="nombrePages"
                  type="number"
                  value={formData.nombrePages}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="pagesApercu">Pages en aperçu gratuit</label>
                <input
                  id="pagesApercu"
                  name="pagesApercu"
                  type="number"
                  value={formData.pagesApercu}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                />
                <small>Nombre de pages visibles sans Premium (1-20)</small>
              </div>
              <div className="form-group">
                <label htmlFor="ordre">Ordre d'affichage</label>
                <input
                  id="ordre"
                  name="ordre"
                  type="number"
                  value={formData.ordre}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
            </div>

            {/* <!-- Tags --> */}
            <div className="form-group">
              <label htmlFor="tags">Tags (séparés par des virgules)</label>
              <input
                id="tags"
                type="text"
                value={formData.tags?.join(', ') || ''}
                onChange={handleTagsChange}
                placeholder="Ex: BFEM, annales, mathématiques, géométrie"
              />
            </div>

            {/* <!-- Upload fichiers --> */}
            <div className="form-files-section">
              <h3>📁 Fichiers</h3>

              {/* PDF complet */}
              <div className="form-group file-group">
                <label>
                  Fichier PDF complet {!editingEbook && '*'}
                  {editingEbook && <small>(laisser vide pour garder l'actuel)</small>}
                </label>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="file-input"
                />
                {pdfFile && (
                  <span className="file-info">
                    📄 {pdfFile.name} ({formatFileSize(pdfFile.size)})
                  </span>
                )}
              </div>

              {/* Image de couverture */}
              <div className="form-group file-group">
                <label>
                  Image de couverture
                  <small>(JPG, PNG — recommandé : 400×560px)</small>
                </label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="file-input"
                />
                {coverFile && (
                  <span className="file-info">
                    🖼️ {coverFile.name} ({formatFileSize(coverFile.size)})
                  </span>
                )}
              </div>

              {/* PDF aperçu */}
              <div className="form-group file-group">
                <label>
                  PDF Aperçu (premières pages uniquement)
                  <small>(optionnel — sinon le PDF complet est affiché aux non-Premium)</small>
                </label>
                <input
                  ref={previewInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                  className="file-input"
                />
                {previewFile && (
                  <span className="file-info">
                    📄 {previewFile.name} ({formatFileSize(previewFile.size)})
                  </span>
                )}
              </div>
            </div>

            {/* <!-- Actif/Inactif --> */}
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Ebook actif (visible dans la bibliothèque)
              </label>
            </div>

            {/* <!-- Boutons --> */}
            <div className="form-actions">
              <button type="submit" className="btn-save" disabled={saving}>
                {saving
                  ? '⏳ Enregistrement...'
                  : editingEbook
                    ? '💾 Modifier l\'ebook'
                    : '📥 Ajouter l\'ebook'
                }
              </button>
              <button type="button" className="btn-cancel" onClick={resetForm}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== LISTE DES EBOOKS ==================== */}
      <div className="admin-ebooks-list">
        <h2>📋 Liste des ebooks ({ebooks.length})</h2>

        {ebooks.length === 0 ? (
          <div className="admin-empty">
            <p>Aucun ebook pour le moment.</p>
            <button
              className="btn-add-ebook"
              onClick={() => setShowForm(true)}
            >
              + Ajouter le premier ebook
            </button>
          </div>
        ) : (
          <div className="admin-ebooks-table-wrapper">
            <table className="admin-ebooks-table">
              <thead>
                <tr>
                  <th>Couverture</th>
                  <th>Titre / Auteur</th>
                  <th>Catégorie</th>
                  <th>Classe</th>
                  <th>Pages</th>
                  <th>Vues / DL</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ebooks.map(ebook => (
                  <tr key={ebook.id} className={!ebook.isActive ? 'row-inactive' : ''}>
                    {/* Couverture miniature */}
                    <td className="td-cover">
                      {ebook.couvertureURL ? (
                        <img src={ebook.couvertureURL} alt="" className="mini-cover" />
                      ) : (
                        <div className="mini-cover-placeholder">
                          {CATEGORIE_ICONS[ebook.categorie]}
                        </div>
                      )}
                    </td>

                    {/* Titre + Auteur */}
                    <td className="td-title">
                      <strong>{ebook.titre}</strong>
                      <span className="td-author">{ebook.auteur}</span>
                    </td>

                    {/* Catégorie */}
                    <td>
                      <span className="badge-category">
                        {CATEGORIE_ICONS[ebook.categorie]} {CATEGORIE_LABELS[ebook.categorie]}
                      </span>
                    </td>

                    {/* Classe */}
                    <td>{ebook.classe === 'all' ? 'Toutes' : ebook.classe}</td>

                    {/* Pages */}
                    <td>{ebook.nombrePages}</td>

                    {/* Vues / Téléchargements */}
                    <td>
                      <span className="td-stats">
                        👁️ {ebook.nombreVues}<br />
                        ⬇️ {ebook.nombreTelechargements}
                      </span>
                    </td>

                    {/* Statut */}
                    <td>
                      <button
                        className={`btn-status ${ebook.isActive ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleActive(ebook.id, ebook.isActive)}
                        title={ebook.isActive ? 'Désactiver' : 'Activer'}
                      >
                        {ebook.isActive ? '✅ Actif' : '⏸️ Inactif'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="td-actions">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(ebook)}
                        title="Modifier"
                      >
                        ✏️
                      </button>

                      {deleteConfirm === ebook.id ? (
                        <div className="delete-confirm">
                          <span>Supprimer ?</span>
                          <button
                            className="btn-confirm-yes"
                            onClick={() => handleDelete(ebook.id)}
                          >
                            Oui
                          </button>
                          <button
                            className="btn-confirm-no"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-delete"
                          onClick={() => setDeleteConfirm(ebook.id)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEbooks;
