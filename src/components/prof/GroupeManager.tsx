/**
 * ============================================================
 * COMPOSANT GROUPE MANAGER — PedaClic Phase 11 (MAJ Phase 14)
 * ============================================================
 * 
 * Gère la création, MODIFICATION, suppression et archivage
 * des groupes-classes d'un professeur.
 * 
 * ★ MAJ Phase 14 :
 *   - Bouton "✏️ Modifier" sur chaque carte de groupe actif
 *   - Formulaire d'édition pré-rempli avec les données du groupe
 *   - Années scolaires dynamiques (générées automatiquement)
 * 
 * Fichier : src/components/prof/GroupeManager.tsx
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  creerGroupe,
  getGroupesProf,
  modifierGroupe,
  supprimerGroupe,
  archiverGroupe,
  regenererCode,
  getStatsGroupe
} from '../../services/profGroupeService';
import type { GroupeProf, GroupeFormData, StatsGroupe } from '../../types/prof';
import '../../styles/prof.css';


// ==================== CONSTANTES ====================

/**
 * ★ Années scolaires DYNAMIQUES
 * Génère automatiquement les années scolaires :
 *   - L'année en cours
 *   - L'année précédente
 *   - Les 3 années suivantes
 * Exemple en 2026 : 2024-2025, 2025-2026, 2026-2027, 2027-2028, 2028-2029
 */
const genererAnneesScolaires = (): string[] => {
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const mois = now.getMonth(); // 0 = janvier

  // Au Sénégal, l'année scolaire commence en octobre
  // Si on est entre janvier et septembre, l'année scolaire en cours
  // a commencé l'année civile précédente (ex: oct 2025 → sept 2026)
  const anneeDebut = mois >= 9 ? anneeActuelle : anneeActuelle - 1;

  const annees: string[] = [];
  // 1 année avant + année en cours + 3 années futures = 5 options
  for (let i = -1; i <= 3; i++) {
    const debut = anneeDebut + i;
    annees.push(`${debut}-${debut + 1}`);
  }
  return annees;
};

/** Années scolaires générées dynamiquement */
const ANNEES_SCOLAIRES = genererAnneesScolaires();

/** Année scolaire en cours (par défaut dans les formulaires) */
const getAnneeScolaireEnCours = (): string => {
  const now = new Date();
  const annee = now.getFullYear();
  const mois = now.getMonth();
  const debut = mois >= 9 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
};

/** Niveaux de classe disponibles */
const NIVEAUX_CLASSES = [
  { value: '6eme', label: '6ème' },
  { value: '5eme', label: '5ème' },
  { value: '4eme', label: '4ème' },
  { value: '3eme', label: '3ème' },
  { value: '2nde', label: '2nde' },
  { value: '1ere', label: '1ère' },
  { value: 'Terminale', label: 'Terminale' }
];


// ==================== INTERFACE PROPS ====================

interface GroupeManagerProps {
  /** Callback quand un groupe est sélectionné pour voir le détail */
  onSelectGroupe: (groupe: GroupeProf) => void;
}


// ==================== COMPOSANT PRINCIPAL ====================

const GroupeManager: React.FC<GroupeManagerProps> = ({ onSelectGroupe }) => {

  // ===== Hooks =====
  const { currentUser } = useAuth();

  // ===== États : données =====
  const [groupes, setGroupes] = useState<GroupeProf[]>([]);
  const [statsGroupes, setStatsGroupes] = useState<Map<string, StatsGroupe>>(new Map());

  // ===== États : UI =====
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormCreation, setShowFormCreation] = useState<boolean>(false);
  const [loadingCreation, setLoadingCreation] = useState<boolean>(false);
  const [codeCopie, setCodeCopie] = useState<string | null>(null);
  const [confirmSuppression, setConfirmSuppression] = useState<string | null>(null);

  // ★ États : modification de groupe
  const [groupeEnEdition, setGroupeEnEdition] = useState<GroupeProf | null>(null);
  const [loadingModification, setLoadingModification] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ===== États : formulaire de création =====
  const [formData, setFormData] = useState<GroupeFormData>({
    nom: '',
    description: '',
    matiereId: '',
    matiereNom: '',
    classeNiveau: '6eme',
    anneeScolaire: getAnneeScolaireEnCours()
  });

  // ★ États : formulaire de modification (séparé du formulaire de création)
  const [editFormData, setEditFormData] = useState<GroupeFormData>({
    nom: '',
    description: '',
    matiereId: '',
    matiereNom: '',
    classeNiveau: '6eme',
    anneeScolaire: getAnneeScolaireEnCours()
  });

  // ===== Filtre par statut =====
  const [filtreStatut, setFiltreStatut] = useState<'actif' | 'archive' | 'tous'>('actif');


  // ==================== CHARGEMENT DES DONNÉES ====================

  const chargerGroupes = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setLoading(true);
      setError(null);

      const mesGroupes = await getGroupesProf(currentUser.uid);
      setGroupes(mesGroupes);

      const statsMap = new Map<string, StatsGroupe>();
      for (const groupe of mesGroupes) {
        if (groupe.statut === 'actif') {
          try {
            const stats = await getStatsGroupe(groupe.id);
            statsMap.set(groupe.id, stats);
          } catch (err) {
            console.warn(`Stats indisponibles pour ${groupe.nom}`);
          }
        }
      }
      setStatsGroupes(statsMap);

    } catch (err) {
      console.error('Erreur chargement groupes:', err);
      setError('Impossible de charger vos groupes. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    chargerGroupes();
  }, [chargerGroupes]);


  // ==================== HANDLERS ====================

  /**
   * Crée un nouveau groupe-classe
   */
  const handleCreerGroupe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.uid || !formData.nom.trim()) return;

    try {
      setLoadingCreation(true);
      await creerGroupe(
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Professeur',
        formData
      );

      // Réinitialiser le formulaire
      setFormData({
        nom: '',
        description: '',
        matiereId: '',
        matiereNom: '',
        classeNiveau: '6eme',
        anneeScolaire: getAnneeScolaireEnCours()
      });
      setShowFormCreation(false);
      setSuccessMessage('Groupe créé avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);

      await chargerGroupes();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du groupe.');
    } finally {
      setLoadingCreation(false);
    }
  };

  /**
   * ★ Ouvre le formulaire de modification pré-rempli
   */
  const handleOuvrirModification = (groupe: GroupeProf) => {
    setGroupeEnEdition(groupe);
    setEditFormData({
      nom: groupe.nom,
      description: groupe.description || '',
      matiereId: groupe.matiereId,
      matiereNom: groupe.matiereNom,
      classeNiveau: groupe.classeNiveau,
      anneeScolaire: groupe.anneeScolaire
    });
    // Fermer le formulaire de création s'il est ouvert
    setShowFormCreation(false);
  };

  /**
   * ★ Annule la modification en cours
   */
  const handleAnnulerModification = () => {
    setGroupeEnEdition(null);
    setEditFormData({
      nom: '',
      description: '',
      matiereId: '',
      matiereNom: '',
      classeNiveau: '6eme',
      anneeScolaire: getAnneeScolaireEnCours()
    });
  };

  /**
   * ★ Enregistre les modifications du groupe
   */
  const handleEnregistrerModification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupeEnEdition || !editFormData.nom.trim()) return;

    try {
      setLoadingModification(true);

      await modifierGroupe(groupeEnEdition.id, {
        nom: editFormData.nom.trim(),
        description: editFormData.description?.trim() || '',
        matiereId: editFormData.matiereId.trim(),
        matiereNom: editFormData.matiereNom.trim(),
        classeNiveau: editFormData.classeNiveau,
        anneeScolaire: editFormData.anneeScolaire
      });

      setGroupeEnEdition(null);
      setSuccessMessage('Groupe modifié avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);

      await chargerGroupes();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification du groupe.');
    } finally {
      setLoadingModification(false);
    }
  };

  /**
   * ★ Met à jour un champ du formulaire d'édition
   */
  const handleEditFormChange = (
    field: keyof GroupeFormData,
    value: string
  ) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Copie le code d'invitation dans le presse-papiers
   */
  const handleCopierCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopie(code);
      setTimeout(() => setCodeCopie(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCodeCopie(code);
      setTimeout(() => setCodeCopie(null), 2000);
    }
  };

  /**
   * Supprime un groupe après confirmation
   */
  const handleSupprimer = async (groupeId: string) => {
    try {
      await supprimerGroupe(groupeId);
      setConfirmSuppression(null);
      await chargerGroupes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Archive un groupe
   */
  const handleArchiver = async (groupeId: string) => {
    try {
      await archiverGroupe(groupeId);
      await chargerGroupes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Régénère le code d'invitation d'un groupe
   */
  const handleRegenerCode = async (groupeId: string) => {
    try {
      await regenererCode(groupeId);
      await chargerGroupes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Met à jour un champ du formulaire de création
   */
  const handleFormChange = (
    field: keyof GroupeFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  // ==================== FILTRAGE ====================

  const groupesFiltres = groupes.filter(g => {
    if (filtreStatut === 'tous') return true;
    return g.statut === filtreStatut;
  });


  // ==================== RENDU : ÉTAT LOADING ====================

  if (loading) {
    return (
      <div className="prof-loading">
        <div className="spinner"></div>
        <p>Chargement de vos groupes-classes...</p>
      </div>
    );
  }


  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="groupe-manager">

      {/* ===== EN-TÊTE : TITRE + BOUTON CRÉER ===== */}
      <div className="groupe-manager-header">
        <div>
          <h2 className="groupe-manager-titre">Mes groupes-classes</h2>
          <p className="groupe-manager-subtitle">
            {groupes.length} groupe{groupes.length !== 1 ? 's' : ''} • Année {getAnneeScolaireEnCours()}
          </p>
        </div>
        <button
          className="prof-btn prof-btn-primary"
          onClick={() => {
            setShowFormCreation(!showFormCreation);
            // Fermer le formulaire de modification si ouvert
            if (groupeEnEdition) handleAnnulerModification();
          }}
        >
          {showFormCreation ? '✕ Annuler' : '➕ Nouveau groupe'}
        </button>
      </div>

      {/* ===== MESSAGE D'ERREUR ===== */}
      {error && (
        <div className="prof-alert prof-alert-error">
          <span>❌</span> {error}
          <button onClick={() => setError(null)} className="prof-alert-close">✕</button>
        </div>
      )}

      {/* ===== MESSAGE DE SUCCÈS ★ ===== */}
      {successMessage && (
        <div className="prof-alert prof-alert-success">
          <span>✅</span> {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="prof-alert-close">✕</button>
        </div>
      )}

      {/* ===== FORMULAIRE DE CRÉATION ===== */}
      {showFormCreation && (
        <div className="groupe-form-container">
          <h3>Créer un nouveau groupe-classe</h3>
          <form onSubmit={handleCreerGroupe} className="groupe-form">

            {/* Nom du groupe */}
            <div className="prof-form-group">
              <label htmlFor="groupe-nom">Nom du groupe *</label>
              <input
                id="groupe-nom"
                type="text"
                placeholder="Ex: 3ème A - Maths 2025"
                value={formData.nom}
                onChange={(e) => handleFormChange('nom', e.target.value)}
                required
                className="prof-input"
                maxLength={60}
              />
            </div>

            {/* Description */}
            <div className="prof-form-group">
              <label htmlFor="groupe-desc">Description (optionnelle)</label>
              <input
                id="groupe-desc"
                type="text"
                placeholder="Ex: Cours du mardi et jeudi matin"
                value={formData.description || ''}
                onChange={(e) => handleFormChange('description', e.target.value)}
                className="prof-input"
                maxLength={120}
              />
            </div>

            {/* Ligne : Niveau de classe + Année scolaire */}
            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="groupe-niveau">Niveau de classe *</label>
                <select
                  id="groupe-niveau"
                  value={formData.classeNiveau}
                  onChange={(e) => handleFormChange('classeNiveau', e.target.value)}
                  className="prof-select"
                >
                  {NIVEAUX_CLASSES.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div className="prof-form-group">
                <label htmlFor="groupe-annee">Année scolaire *</label>
                <select
                  id="groupe-annee"
                  value={formData.anneeScolaire}
                  onChange={(e) => handleFormChange('anneeScolaire', e.target.value)}
                  className="prof-select"
                >
                  {ANNEES_SCOLAIRES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne : Matière ID + Nom matière */}
            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="groupe-matiere-id">ID Matière *</label>
                <input
                  id="groupe-matiere-id"
                  type="text"
                  placeholder="Ex: maths_3eme"
                  value={formData.matiereId}
                  onChange={(e) => handleFormChange('matiereId', e.target.value)}
                  required
                  className="prof-input"
                />
              </div>
              <div className="prof-form-group">
                <label htmlFor="groupe-matiere-nom">Nom de la matière *</label>
                <input
                  id="groupe-matiere-nom"
                  type="text"
                  placeholder="Ex: Mathématiques"
                  value={formData.matiereNom}
                  onChange={(e) => handleFormChange('matiereNom', e.target.value)}
                  required
                  className="prof-input"
                />
              </div>
            </div>

            {/* Bouton de création */}
            <div className="prof-form-actions">
              <button
                type="submit"
                className="prof-btn prof-btn-primary"
                disabled={loadingCreation || !formData.nom.trim()}
              >
                {loadingCreation ? '⏳ Création...' : '✅ Créer le groupe'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ★ FORMULAIRE DE MODIFICATION (affiché quand un groupe est en édition)
          ═══════════════════════════════════════════════════════════ */}
      {groupeEnEdition && (
        <div className="groupe-form-container" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3>✏️ Modifier le groupe : {groupeEnEdition.nom}</h3>
          <form onSubmit={handleEnregistrerModification} className="groupe-form">

            {/* Nom du groupe */}
            <div className="prof-form-group">
              <label htmlFor="edit-groupe-nom">Nom du groupe *</label>
              <input
                id="edit-groupe-nom"
                type="text"
                placeholder="Ex: 3ème A - Maths 2025"
                value={editFormData.nom}
                onChange={(e) => handleEditFormChange('nom', e.target.value)}
                required
                className="prof-input"
                maxLength={60}
              />
            </div>

            {/* Description */}
            <div className="prof-form-group">
              <label htmlFor="edit-groupe-desc">Description (optionnelle)</label>
              <input
                id="edit-groupe-desc"
                type="text"
                placeholder="Ex: Cours du mardi et jeudi matin"
                value={editFormData.description || ''}
                onChange={(e) => handleEditFormChange('description', e.target.value)}
                className="prof-input"
                maxLength={120}
              />
            </div>

            {/* Ligne : Niveau de classe + Année scolaire */}
            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-niveau">Niveau de classe *</label>
                <select
                  id="edit-groupe-niveau"
                  value={editFormData.classeNiveau}
                  onChange={(e) => handleEditFormChange('classeNiveau', e.target.value)}
                  className="prof-select"
                >
                  {NIVEAUX_CLASSES.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-annee">Année scolaire *</label>
                <select
                  id="edit-groupe-annee"
                  value={editFormData.anneeScolaire}
                  onChange={(e) => handleEditFormChange('anneeScolaire', e.target.value)}
                  className="prof-select"
                >
                  {ANNEES_SCOLAIRES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne : Matière ID + Nom matière */}
            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-matiere-id">ID Matière *</label>
                <input
                  id="edit-groupe-matiere-id"
                  type="text"
                  placeholder="Ex: maths_3eme"
                  value={editFormData.matiereId}
                  onChange={(e) => handleEditFormChange('matiereId', e.target.value)}
                  required
                  className="prof-input"
                />
              </div>
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-matiere-nom">Nom de la matière *</label>
                <input
                  id="edit-groupe-matiere-nom"
                  type="text"
                  placeholder="Ex: Mathématiques"
                  value={editFormData.matiereNom}
                  onChange={(e) => handleEditFormChange('matiereNom', e.target.value)}
                  required
                  className="prof-input"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="prof-form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className="prof-btn prof-btn-primary"
                disabled={loadingModification || !editFormData.nom.trim()}
              >
                {loadingModification ? '⏳ Enregistrement...' : '✅ Enregistrer'}
              </button>
              <button
                type="button"
                className="prof-btn prof-btn-secondary"
                onClick={handleAnnulerModification}
                disabled={loadingModification}
              >
                ✕ Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== FILTRES PAR STATUT ===== */}
      <div className="groupe-filtres">
        <button
          className={`prof-filtre-btn ${filtreStatut === 'actif' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('actif')}
        >
          Actifs ({groupes.filter(g => g.statut === 'actif').length})
        </button>
        <button
          className={`prof-filtre-btn ${filtreStatut === 'archive' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('archive')}
        >
          Archivés ({groupes.filter(g => g.statut === 'archive').length})
        </button>
        <button
          className={`prof-filtre-btn ${filtreStatut === 'tous' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('tous')}
        >
          Tous ({groupes.length})
        </button>
      </div>

      {/* ===== LISTE DES GROUPES ===== */}
      {groupesFiltres.length === 0 ? (
        <div className="prof-empty-state">
          <div className="prof-empty-icon">📚</div>
          <h3>
            {filtreStatut === 'archive'
              ? 'Aucun groupe archivé'
              : 'Aucun groupe-classe créé'
            }
          </h3>
          <p>
            {filtreStatut === 'archive'
              ? 'Vos groupes archivés apparaîtront ici.'
              : 'Créez votre premier groupe-classe pour commencer à suivre vos élèves.'
            }
          </p>
          {filtreStatut !== 'archive' && (
            <button
              className="prof-btn prof-btn-primary"
              onClick={() => setShowFormCreation(true)}
            >
              ➕ Créer mon premier groupe
            </button>
          )}
        </div>
      ) : (
        <div className="groupe-grid">
          {groupesFiltres.map(groupe => {
            const stats = statsGroupes.get(groupe.id);
            const enEdition = groupeEnEdition?.id === groupe.id;

            return (
              <div
                key={groupe.id}
                className={`groupe-card ${groupe.statut === 'archive' ? 'groupe-card-archive' : ''} ${enEdition ? 'groupe-card-editing' : ''}`}
              >
                {/* En-tête de la carte */}
                <div className="groupe-card-header">
                  <div>
                    <h3 className="groupe-card-titre">{groupe.nom}</h3>
                    <span className="groupe-card-matiere">{groupe.matiereNom}</span>
                  </div>
                  <span className={`groupe-badge groupe-badge-${groupe.statut}`}>
                    {groupe.statut === 'actif' ? '🟢 Actif' : '📦 Archivé'}
                  </span>
                </div>

                {/* Description (si présente) */}
                {groupe.description && (
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0.5rem' }}>
                    {groupe.description}
                  </p>
                )}

                {/* Infos rapides */}
                <div className="groupe-card-infos">
                  <span>📅 {groupe.classeNiveau}</span>
                  <span>🎓 {groupe.anneeScolaire}</span>
                  <span>👥 {groupe.nombreInscrits} élève{groupe.nombreInscrits !== 1 ? 's' : ''}</span>
                </div>

                {/* Code d'invitation */}
                <div className="groupe-card-code">
                  <span className="groupe-code-label">Code d'invitation :</span>
                  <div className="groupe-code-box">
                    <code className="groupe-code-value">{groupe.codeInvitation}</code>
                    <button
                      className="prof-btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopierCode(groupe.codeInvitation);
                      }}
                      title="Copier le code"
                    >
                      {codeCopie === groupe.codeInvitation ? '✅' : '📋'}
                    </button>
                    {groupe.statut === 'actif' && (
                      <button
                        className="prof-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerCode(groupe.id);
                        }}
                        title="Régénérer le code"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>

                {/* Mini-stats (si disponibles) */}
                {stats && stats.nombreEleves > 0 && (
                  <div className="groupe-card-stats">
                    <div className="groupe-stat-item">
                      <span className="groupe-stat-value">{stats.moyenneClasse}</span>
                      <span className="groupe-stat-label">Moyenne</span>
                    </div>
                    <div className="groupe-stat-item">
                      <span className="groupe-stat-value">{stats.tauxReussite}%</span>
                      <span className="groupe-stat-label">Réussite</span>
                    </div>
                    <div className="groupe-stat-item">
                      <span className="groupe-stat-value">{stats.elevesEnDifficulte}</span>
                      <span className="groupe-stat-label">En difficulté</span>
                    </div>
                  </div>
                )}

                {/* ===== ACTIONS (★ bouton Modifier ajouté) ===== */}
                <div className="groupe-card-actions">
                  {groupe.statut === 'actif' && (
                    <>
                      <button
                        className="prof-btn prof-btn-primary prof-btn-sm"
                        onClick={() => onSelectGroupe(groupe)}
                      >
                        📊 Voir détails
                      </button>

                      {/* ★ Bouton Modifier */}
                      <button
                        className="prof-btn prof-btn-warning prof-btn-sm"
                        onClick={() => handleOuvrirModification(groupe)}
                        style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fbbf24'
                        }}
                      >
                        ✏️ Modifier
                      </button>

                      <button
                        className="prof-btn prof-btn-secondary prof-btn-sm"
                        onClick={() => handleArchiver(groupe.id)}
                      >
                        📦 Archiver
                      </button>
                    </>
                  )}

                  {/* Confirmation de suppression */}
                  {confirmSuppression === groupe.id ? (
                    <div className="groupe-confirm-suppression">
                      <span>Confirmer ?</span>
                      <button
                        className="prof-btn prof-btn-danger prof-btn-sm"
                        onClick={() => handleSupprimer(groupe.id)}
                      >
                        Oui, supprimer
                      </button>
                      <button
                        className="prof-btn prof-btn-secondary prof-btn-sm"
                        onClick={() => setConfirmSuppression(null)}
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      className="prof-btn prof-btn-danger prof-btn-sm"
                      onClick={() => setConfirmSuppression(groupe.id)}
                    >
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupeManager;
