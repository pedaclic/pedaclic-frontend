// ==================== ADMIN EBOOKS - PHASE 20 ====================
// PedaClic : Interface d'administration des ebooks
// CRUD complet + upload PDF + couverture + aperçu
// Statistiques et gestion de la bibliothèque
// ==============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Ebook,
  EbookFormData,
  CategorieEbook,
  CATEGORIE_LABELS,
  CATEGORIE_ICONS
} from '../types/ebook.types';
import {
  getAllEbooksAdmin,
  subscribeToAllEbooksAdmin,
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
  const [refreshing, setRefreshing] = useState(false);

  // --- Stats dérivées : recalculées automatiquement à chaque changement de la liste ---
  // (vues/téléchargements/actifs reste donc toujours synchrone avec Firestore)
  const stats = useMemo(() => calculateEbookStats(ebooks), [ebooks]);

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

  // --- Sources HTML (format 'html') ---
  // L'admin peut soit uploader un fichier .html, soit coller le code source
  // dans la zone de texte. Si les deux sont fournis, le fichier est prioritaire
  // (cf. buildHtmlBlob dans ebookService).
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [htmlCode, setHtmlCode] = useState<string>('');

  // --- Refs pour les inputs file ---
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

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
      format: 'pdf',          // PDF par défaut → comportement historique
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

  // ==================== CHARGEMENT TEMPS RÉEL ====================
  // Abonnement onSnapshot : les stats (vues, téléchargements, statut actif)
  // se mettent à jour automatiquement dès qu'un élève consulte / télécharge
  // un ebook, ou qu'un autre admin modifie la collection.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToAllEbooksAdmin(
      (data) => {
        setEbooks(data);
        setLoading(false);
      },
      (err) => {
        setError('Erreur lors du chargement des ebooks');
        console.error(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  /**
   * Force une lecture serveur (bypass du cache IndexedDB).
   * Utile si l'admin doute de la fraîcheur des compteurs après un long
   * fonctionnement hors-ligne. Ne casse pas l'abonnement onSnapshot.
   */
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await getAllEbooksAdmin(true);
      setEbooks(data);
    } catch (err: any) {
      setError('Erreur lors de l\'actualisation');
      console.error(err);
    } finally {
      setRefreshing(false);
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
    // Validation du contenu principal selon le format choisi.
    // À la création (pas d'editingEbook), une source de contenu est obligatoire.
    // À la modification, on n'exige rien : l'admin peut juste mettre à jour
    // les métadonnées sans toucher au fichier source.
    const fmt = formData.format || 'pdf';
    if (!editingEbook) {
      if (fmt === 'pdf' && !pdfFile) {
        setError('Le fichier PDF est obligatoire pour un ebook au format PDF.');
        return;
      }
      if (fmt === 'html' && !htmlFile && !htmlCode.trim()) {
        setError("Pour un ebook HTML, importez un fichier .html OU collez le code source dans la zone prévue.");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      // --- Timeout de sécurité : 2 min max pour un upload PDF ---
      // Évite que le bouton reste figé indéfiniment en cas d'échec
      // silencieux (CORS bloqué, réseau coupé, App Check refusé, etc.)
      const TIMEOUT_MS = 120_000;
      const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(
              () => reject(new Error(
                'Délai dépassé (2 min). Vérifiez votre connexion ou la configuration CORS du bucket Firebase Storage. Voir la console pour le détail.'
              )),
              TIMEOUT_MS
            )
          )
        ]);

      if (editingEbook) {
        // --- Mode modification ---
        // On transmet aussi htmlFile/htmlCode pour permettre la mise à jour
        // d'un contenu HTML (ou un changement de format PDF↔HTML).
        await withTimeout(
          updateEbook(editingEbook.id, formData, pdfFile, coverFile, previewFile, htmlFile, htmlCode)
        );
        setSuccessMessage(`✅ Ebook "${formData.titre}" modifié avec succès`);
      } else {
        // --- Mode ajout ---
        // pdfFile peut être null si le format est 'html' : la validation plus
        // haut garantit qu'au moins une source HTML est alors fournie.
        await withTimeout(
          addEbook(formData, pdfFile, coverFile, previewFile, undefined, htmlFile, htmlCode)
        );
        setSuccessMessage(`✅ Ebook "${formData.titre}" ajouté avec succès`);
      }

      // --- Réinitialisation (la liste se met à jour automatiquement via onSnapshot) ---
      resetForm();

      // Masquer le message après 4 secondes
      setTimeout(() => setSuccessMessage(null), 4000);

    } catch (err: any) {
      // Détection d'erreurs CORS / réseau pour message plus explicite
      const raw = err?.message || String(err) || 'Erreur lors de la sauvegarde';
      const code = err?.code || '';
      let msg = raw;
      if (code === 'storage/unauthorized' || /unauthorized/i.test(raw)) {
        msg = "Upload refusé : vérifiez les règles Firebase Storage (storage.rules) ou App Check.";
      } else if (/CORS|NetworkError|Failed to fetch|network-request-failed/i.test(raw)) {
        msg = "Échec réseau / CORS sur le bucket Firebase Storage. Vérifiez la configuration CORS du bucket (voir cors.json à la racine du projet).";
      }
      console.error('[AdminEbooks] handleSubmit error:', err);
      setError(msg);
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
      // Rétrocompatibilité : un ebook créé avant l'introduction du champ
      // `format` est implicitement un PDF.
      format: ebook.format || 'pdf',
      nombrePages: ebook.nombrePages,
      pagesApercu: ebook.pagesApercu,
      annee: ebook.annee || '',
      editeur: ebook.editeur || '',
      isbn: ebook.isbn || '',
      tags: ebook.tags || [],
      ordre: ebook.ordre,
      isActive: ebook.isActive
    });
    // Réinitialise les sources fichiers : l'admin doit re-uploader explicitement
    // s'il veut remplacer le contenu (sécurité contre une mise à jour
    // involontaire du fichier source).
    setPdfFile(null);
    setCoverFile(null);
    setPreviewFile(null);
    setHtmlFile(null);
    setHtmlCode('');
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
      // La liste est rafraîchie automatiquement par onSnapshot.
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  // ==================== ACTIVATION / DÉSACTIVATION ====================

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await toggleEbookActive(id, !currentState);
      // La liste est rafraîchie automatiquement par onSnapshot.
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
    setHtmlFile(null);
    setHtmlCode('');
    setShowForm(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (previewInputRef.current) previewInputRef.current.value = '';
    if (htmlInputRef.current) htmlInputRef.current.value = '';
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
        <div className="admin-ebooks-header-actions">
          <button
            className="btn-refresh-ebooks"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Forcer la récupération des dernières statistiques depuis le serveur"
          >
            {refreshing ? '⏳ Actualisation…' : '🔄 Actualiser'}
          </button>
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
                  {matieresOptions.map((m: any) => {
                    const val = typeof m === 'string' ? m : m.valeur;
                    const lbl = typeof m === 'string' ? m : m.label;
                    return (
                      <option key={val} value={val}>{lbl}</option>
                    );
                  })}
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

            {/* <!-- Ligne 4 : Pages + Aperçu + Ordre -->
                 Pour un ebook HTML, la notion de "pages" n'existe pas vraiment :
                 on garde 1 par défaut et on désactive l'aperçu partiel. */}
            <div className="form-row form-row-3">
              <div className="form-group">
                <label htmlFor="nombrePages">
                  {formData.format === 'html' ? 'Nombre de sections' : 'Nombre de pages *'}
                </label>
                <input
                  id="nombrePages"
                  name="nombrePages"
                  type="number"
                  value={formData.nombrePages}
                  onChange={handleInputChange}
                  min={formData.format === 'html' ? 0 : 1}
                  required={formData.format !== 'html'}
                />
                {formData.format === 'html' && (
                  <small>Optionnel — purement informatif pour les pages HTML.</small>
                )}
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
                  disabled={formData.format === 'html'}
                />
                <small>
                  {formData.format === 'html'
                    ? 'Non applicable au HTML (le contenu est servi en bloc).'
                    : 'Nombre de pages visibles sans Premium (1-20)'}
                </small>
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

            {/*
                ==============================================================
                SÉLECTEUR DE FORMAT (PDF ou HTML)
                --------------------------------------------------------------
                Détermine la nature du contenu principal de l'ebook :
                  - PDF  : flux historique (upload d'un fichier PDF complet
                           + éventuel PDF d'aperçu pour les non-Premium).
                  - HTML : intégration de code HTML autonome (page web
                           interactive). L'admin importe un fichier .html OU
                           colle directement le code source dans la textarea.
                Le choix est rétrocompatible : un ebook existant sans champ
                `format` est traité comme un PDF (cf. handleEdit).
                ============================================================== */}
            <div className="form-group">
              <label>Format de l'ebook *</label>
              <div className="format-radio-group" role="radiogroup" aria-label="Format de l'ebook">
                <label className={`format-radio ${(formData.format || 'pdf') === 'pdf' ? 'is-checked' : ''}`}>
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={(formData.format || 'pdf') === 'pdf'}
                    onChange={() => setFormData(prev => ({ ...prev, format: 'pdf' }))}
                  />
                  <span className="format-radio__icon">📄</span>
                  <span className="format-radio__title">PDF</span>
                  <span className="format-radio__desc">Manuel, annale ou document scanné</span>
                </label>
                <label className={`format-radio ${formData.format === 'html' ? 'is-checked' : ''}`}>
                  <input
                    type="radio"
                    name="format"
                    value="html"
                    checked={formData.format === 'html'}
                    onChange={() => setFormData(prev => ({ ...prev, format: 'html' }))}
                  />
                  <span className="format-radio__icon">🌐</span>
                  <span className="format-radio__title">HTML</span>
                  <span className="format-radio__desc">Page web interactive (fiche, infographie)</span>
                </label>
              </div>
            </div>

            {/* <!-- Upload fichiers — varie selon le format --> */}
            <div className="form-files-section">
              <h3>📁 Fichiers</h3>

              {/* ============================================================
                  Branche FORMAT === 'pdf' : champs historiques inchangés.
                  ============================================================ */}
              {(formData.format || 'pdf') === 'pdf' && (
                <>
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

                  {/* PDF aperçu (uniquement pertinent pour le format PDF) */}
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
                </>
              )}

              {/* ============================================================
                  Branche FORMAT === 'html' : import .html OU collage de code.
                  Les deux sources sont alternatives ; si l'admin renseigne les
                  deux, le fichier importé est prioritaire (cf. buildHtmlBlob).
                  ============================================================ */}
              {formData.format === 'html' && (
                <>
                  {/* Fichier .html à importer */}
                  <div className="form-group file-group">
                    <label>
                      Fichier HTML
                      <small>
                        {editingEbook
                          ? '(laisser vide ET la zone de code vide pour garder l\'actuel)'
                          : '(.html — alternative à la zone de code ci-dessous)'}
                      </small>
                    </label>
                    <input
                      ref={htmlInputRef}
                      type="file"
                      accept=".html,.htm,text/html"
                      onChange={(e) => setHtmlFile(e.target.files?.[0] || null)}
                      className="file-input"
                    />
                    {htmlFile && (
                      <span className="file-info">
                        🌐 {htmlFile.name} ({formatFileSize(htmlFile.size)})
                      </span>
                    )}
                  </div>

                  {/* Zone de saisie du code HTML brut */}
                  <div className="form-group">
                    <label htmlFor="htmlCode">
                      …ou collez le code HTML directement
                      <small>(autonome : doit contenir &lt;!DOCTYPE html&gt;, CSS et JS embarqués)</small>
                    </label>
                    <textarea
                      id="htmlCode"
                      name="htmlCode"
                      value={htmlCode}
                      onChange={(e) => setHtmlCode(e.target.value)}
                      placeholder={'<!DOCTYPE html>\n<html lang="fr">\n  <head>…</head>\n  <body>…</body>\n</html>'}
                      rows={12}
                      spellCheck={false}
                      className="html-code-textarea"
                    />
                    {htmlCode.trim() && (
                      <small className="file-info">
                        ✅ {(new Blob([htmlCode]).size / 1024).toFixed(1)} Ko de code prêts à être uploadés
                      </small>
                    )}
                  </div>

                  <div className="admin-alert info">
                    💡 Le contenu HTML sera affiché aux élèves dans une fenêtre
                    isolée (iframe sandbox) — assurez-vous qu'il est autonome
                    (CSS et scripts inline, ressources via CDN).
                  </div>
                </>
              )}

              {/* Image de couverture (commun aux deux formats) */}
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

                    {/* Titre + Auteur + petit badge de format */}
                    <td className="td-title">
                      <strong>{ebook.titre}</strong>
                      <span className="td-author">{ebook.auteur}</span>
                      {/* Badge format : visible uniquement pour HTML afin de ne
                          pas alourdir visuellement le cas dominant (PDF). */}
                      {ebook.format === 'html' && (
                        <span className="td-format-badge" title="Ebook HTML interactif">🌐 HTML</span>
                      )}
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
