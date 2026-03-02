/**
 * ============================================================
 * COMPOSANT GROUPE MANAGER — PedaClic Phase 11 (MAJ Phase 14b)
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
 * ★ MAJ Phase 14b :
 *   - Sélection de discipline via DROPDOWN (au lieu de saisie manuelle)
 *   - Le matiereId correspond maintenant aux vrais IDs Firestore
 *   - Les quiz s'affichent correctement dans le détail du groupe
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
  restaurerGroupe,
  regenererCode,
  getStatsGroupe
} from '../../services/profGroupeService';
import DisciplineService from '../../services/disciplineService';
import type { GroupeProf, GroupeFormData, StatsGroupe } from '../../types/prof';
import { CLASSES_OPTIONS, CLASSES, normaliserClassePourComparaison } from '../../types/cahierTextes.types';
import '../../styles/prof.css';


// ==================== CONSTANTES ====================

/**
 * ★ Années scolaires DYNAMIQUES
 * Génère automatiquement 5 options basées sur la date actuelle
 * et le calendrier scolaire sénégalais (rentrée en octobre).
 */
const genererAnneesScolaires = (): string[] => {
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const mois = now.getMonth();
  const anneeDebut = mois >= 9 ? anneeActuelle : anneeActuelle - 1;

  const annees: string[] = [];
  for (let i = -1; i <= 3; i++) {
    const debut = anneeDebut + i;
    annees.push(`${debut}-${debut + 1}`);
  }
  return annees;
};

const ANNEES_SCOLAIRES = genererAnneesScolaires();

const getAnneeScolaireEnCours = (): string => {
  const now = new Date();
  const annee = now.getFullYear();
  const mois = now.getMonth();
  const debut = mois >= 9 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
};

// Niveaux/classes : source unique (cahierTextes, médiathèque, premium)
const NIVEAUX_CLASSES = CLASSES_OPTIONS.map((c) => ({ value: c.valeur, label: c.label }));


// ==================== INTERFACES ====================

interface GroupeManagerProps {
  onSelectGroupe: (groupe: GroupeProf) => void;
}

/** ★ Discipline chargée depuis Firestore */
interface DisciplineOption {
  id: string;
  nom: string;
  classe?: string;
}


// ==================== COMPOSANT PRINCIPAL ====================

const GroupeManager: React.FC<GroupeManagerProps> = ({ onSelectGroupe }) => {

  const { currentUser } = useAuth();

  // ===== États : données =====
  const [groupes, setGroupes] = useState<GroupeProf[]>([]);
  const [statsGroupes, setStatsGroupes] = useState<Map<string, StatsGroupe>>(new Map());
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);

  // ===== États : UI =====
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormCreation, setShowFormCreation] = useState<boolean>(false);
  const [loadingCreation, setLoadingCreation] = useState<boolean>(false);
  const [codeCopie, setCodeCopie] = useState<string | null>(null);
  const [confirmSuppression, setConfirmSuppression] = useState<string | null>(null);
  const [groupeEnEdition, setGroupeEnEdition] = useState<GroupeProf | null>(null);
  const [loadingModification, setLoadingModification] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ===== États : formulaires =====
  const [formData, setFormData] = useState<GroupeFormData>({
    nom: '', description: '', matiereId: '', matiereNom: '',
    classeNiveau: CLASSES[0], anneeScolaire: getAnneeScolaireEnCours()
  });

  const [editFormData, setEditFormData] = useState<GroupeFormData>({
    nom: '', description: '', matiereId: '', matiereNom: '',
    classeNiveau: CLASSES[0], anneeScolaire: getAnneeScolaireEnCours()
  });

  const [filtreStatut, setFiltreStatut] = useState<'actif' | 'archive' | 'tous'>('actif');


  // ==================== CHARGEMENT DES DONNÉES ====================

  /** ★ Charge les disciplines depuis Firestore pour les dropdowns */
  useEffect(() => {
    const chargerDisciplines = async () => {
      try {
        const allDisciplines = await DisciplineService.getAll();
        setDisciplines(
          allDisciplines.map((d: any) => ({
            id: d.id,
            nom: d.nom,
            classe: d.classe || ''
          }))
        );
      } catch (err) {
        console.warn('⚠️ Impossible de charger les disciplines:', err);
      }
    };
    chargerDisciplines();
  }, []);

  /** Charge les groupes du professeur et leurs statistiques */
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
   * ★ Quand le prof sélectionne une discipline dans le dropdown,
   * on met à jour automatiquement matiereId ET matiereNom
   */
  const handleDisciplineChange = (disciplineId: string, isEdit: boolean = false) => {
    const disc = disciplines.find(d => d.id === disciplineId);
    const nom = disc ? `${disc.nom}${disc.classe ? ` (${disc.classe})` : ''}` : '';

    if (isEdit) {
      setEditFormData(prev => ({ ...prev, matiereId: disciplineId, matiereNom: nom }));
    } else {
      setFormData(prev => ({ ...prev, matiereId: disciplineId, matiereNom: nom }));
    }
  };

  const handleCreerGroupe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid || !formData.nom.trim() || !formData.matiereId) return;

    try {
      setLoadingCreation(true);
      await creerGroupe(
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Professeur',
        formData
      );
      setFormData({
        nom: '', description: '', matiereId: '', matiereNom: '',
        classeNiveau: CLASSES[0], anneeScolaire: getAnneeScolaireEnCours()
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

  const handleOuvrirModification = (groupe: GroupeProf) => {
    setGroupeEnEdition(groupe);
    const classeNorm = normaliserClassePourComparaison(groupe.classeNiveau) || CLASSES[0];
    setEditFormData({
      nom: groupe.nom,
      description: groupe.description || '',
      matiereId: groupe.matiereId,
      matiereNom: groupe.matiereNom,
      classeNiveau: classeNorm,
      anneeScolaire: groupe.anneeScolaire
    });
    setShowFormCreation(false);
  };

  const handleAnnulerModification = () => {
    setGroupeEnEdition(null);
    setEditFormData({
      nom: '', description: '', matiereId: '', matiereNom: '',
      classeNiveau: CLASSES[0], anneeScolaire: getAnneeScolaireEnCours()
    });
  };

  const handleEnregistrerModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupeEnEdition || !editFormData.nom.trim() || !editFormData.matiereId) return;

    try {
      setLoadingModification(true);
      await modifierGroupe(groupeEnEdition.id, {
        nom: editFormData.nom.trim(),
        description: editFormData.description?.trim() || '',
        matiereId: editFormData.matiereId,
        matiereNom: editFormData.matiereNom,
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

  const handleSupprimer = async (groupeId: string) => {
    try {
      await supprimerGroupe(groupeId);
      setConfirmSuppression(null);
      await chargerGroupes();
    } catch (err: any) { setError(err.message); }
  };

  const handleArchiver = async (groupeId: string) => {
    try {
      await archiverGroupe(groupeId);
      await chargerGroupes();
    } catch (err: any) { setError(err.message); }
  };

  const handleRegenerCode = async (groupeId: string) => {
    try {
      await regenererCode(groupeId);
      await chargerGroupes();
    } catch (err: any) { setError(err.message); }
  };

  const handleFormChange = (field: keyof GroupeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditFormChange = (field: keyof GroupeFormData, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };


  // ==================== FILTRAGE ====================

  const groupesFiltres = groupes.filter(g => {
    if (filtreStatut === 'tous') return true;
    return g.statut === filtreStatut;
  });


  // ==================== COMPOSANT : SÉLECTEUR DE DISCIPLINE ====================

  /**
   * ★ Dropdown de sélection de discipline (remplace les 2 inputs manuels)
   * Charge les vraies disciplines Firestore → matiereId = disciplineId réel
   */
  const renderDisciplineSelect = (
    id: string, value: string,
    onChange: (disciplineId: string) => void
  ) => (
    <div className="prof-form-group">
      <label htmlFor={id}>Discipline / Matière *</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="prof-select"
        required
      >
        <option value="">— Sélectionner une discipline —</option>
        {disciplines.map(d => (
          <option key={d.id} value={d.id}>
            {d.nom}{d.classe ? ` (${d.classe})` : ''}
          </option>
        ))}
      </select>
      {disciplines.length === 0 && (
        <small style={{ color: '#f59e0b', marginTop: '0.25rem', display: 'block' }}>
          ⚠️ Aucune discipline trouvée. Créez des disciplines dans l'espace admin.
        </small>
      )}
    </div>
  );


  // ==================== RENDU ====================

  if (loading) {
    return (
      <div className="prof-loading">
        <div className="spinner"></div>
        <p>Chargement de vos groupes-classes...</p>
      </div>
    );
  }

  return (
    <div className="groupe-manager">

      {/* ===== EN-TÊTE ===== */}
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
            if (groupeEnEdition) handleAnnulerModification();
          }}
        >
          {showFormCreation ? '✕ Annuler' : '➕ Nouveau groupe'}
        </button>
      </div>

      {/* ===== MESSAGES ===== */}
      {error && (
        <div className="prof-alert prof-alert-error">
          <span>❌</span> {error}
          <button onClick={() => setError(null)} className="prof-alert-close">✕</button>
        </div>
      )}
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

            <div className="prof-form-group">
              <label htmlFor="groupe-nom">Nom du groupe *</label>
              <input id="groupe-nom" type="text" placeholder="Ex: 3ème A - Maths 2025"
                value={formData.nom} onChange={(e) => handleFormChange('nom', e.target.value)}
                required className="prof-input" maxLength={60} />
            </div>

            <div className="prof-form-group">
              <label htmlFor="groupe-desc">Description (optionnelle)</label>
              <input id="groupe-desc" type="text" placeholder="Ex: Cours du mardi et jeudi matin"
                value={formData.description || ''} onChange={(e) => handleFormChange('description', e.target.value)}
                className="prof-input" maxLength={120} />
            </div>

            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="groupe-niveau">Niveau de classe *</label>
                <select id="groupe-niveau" value={formData.classeNiveau}
                  onChange={(e) => handleFormChange('classeNiveau', e.target.value)} className="prof-select">
                  {NIVEAUX_CLASSES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div className="prof-form-group">
                <label htmlFor="groupe-annee">Année scolaire *</label>
                <select id="groupe-annee" value={formData.anneeScolaire}
                  onChange={(e) => handleFormChange('anneeScolaire', e.target.value)} className="prof-select">
                  {ANNEES_SCOLAIRES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* ★ Dropdown discipline (remplace matiereId + matiereNom manuels) */}
            {renderDisciplineSelect('groupe-discipline', formData.matiereId, (id) => handleDisciplineChange(id, false))}

            <div className="prof-form-actions">
              <button type="submit" className="prof-btn prof-btn-primary"
                disabled={loadingCreation || !formData.nom.trim() || !formData.matiereId}>
                {loadingCreation ? '⏳ Création...' : '✅ Créer le groupe'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== FORMULAIRE DE MODIFICATION ★ ===== */}
      {groupeEnEdition && (
        <div className="groupe-form-container" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3>✏️ Modifier le groupe : {groupeEnEdition.nom}</h3>
          <form onSubmit={handleEnregistrerModification} className="groupe-form">

            <div className="prof-form-group">
              <label htmlFor="edit-groupe-nom">Nom du groupe *</label>
              <input id="edit-groupe-nom" type="text" value={editFormData.nom}
                onChange={(e) => handleEditFormChange('nom', e.target.value)}
                required className="prof-input" maxLength={60} />
            </div>

            <div className="prof-form-group">
              <label htmlFor="edit-groupe-desc">Description (optionnelle)</label>
              <input id="edit-groupe-desc" type="text" value={editFormData.description || ''}
                onChange={(e) => handleEditFormChange('description', e.target.value)}
                className="prof-input" maxLength={120} />
            </div>

            <div className="prof-form-row">
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-niveau">Niveau de classe *</label>
                <select id="edit-groupe-niveau" value={editFormData.classeNiveau}
                  onChange={(e) => handleEditFormChange('classeNiveau', e.target.value)} className="prof-select">
                  {NIVEAUX_CLASSES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div className="prof-form-group">
                <label htmlFor="edit-groupe-annee">Année scolaire *</label>
                <select id="edit-groupe-annee" value={editFormData.anneeScolaire}
                  onChange={(e) => handleEditFormChange('anneeScolaire', e.target.value)} className="prof-select">
                  {ANNEES_SCOLAIRES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* ★ Dropdown discipline */}
            {renderDisciplineSelect('edit-groupe-discipline', editFormData.matiereId, (id) => handleDisciplineChange(id, true))}

            <div className="prof-form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="prof-btn prof-btn-primary"
                disabled={loadingModification || !editFormData.nom.trim() || !editFormData.matiereId}>
                {loadingModification ? '⏳ Enregistrement...' : '✅ Enregistrer'}
              </button>
              <button type="button" className="prof-btn prof-btn-secondary"
                onClick={handleAnnulerModification} disabled={loadingModification}>
                ✕ Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== FILTRES ===== */}
      <div className="groupe-filtres">
        <button className={`prof-filtre-btn ${filtreStatut === 'actif' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('actif')}>
          Actifs ({groupes.filter(g => g.statut === 'actif').length})
        </button>
        <button className={`prof-filtre-btn ${filtreStatut === 'archive' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('archive')}>
          Archivés ({groupes.filter(g => g.statut === 'archive').length})
        </button>
        <button className={`prof-filtre-btn ${filtreStatut === 'tous' ? 'active' : ''}`}
          onClick={() => setFiltreStatut('tous')}>
          Tous ({groupes.length})
        </button>
      </div>

      {/* ===== LISTE DES GROUPES ===== */}
      {groupesFiltres.length === 0 ? (
        <div className="prof-empty-state">
          <div className="prof-empty-icon">📚</div>
          <h3>{filtreStatut === 'archive' ? 'Aucun groupe archivé' : 'Aucun groupe-classe créé'}</h3>
          <p>{filtreStatut === 'archive'
            ? 'Vos groupes archivés apparaîtront ici.'
            : 'Créez votre premier groupe-classe pour commencer à suivre vos élèves.'}</p>
          {filtreStatut !== 'archive' && (
            <button className="prof-btn prof-btn-primary" onClick={() => setShowFormCreation(true)}>
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
              <div key={groupe.id}
                className={`groupe-card ${groupe.statut === 'archive' ? 'groupe-card-archive' : ''} ${enEdition ? 'groupe-card-editing' : ''}`}>

                <div className="groupe-card-header">
                  <div>
                    <h3 className="groupe-card-titre">{groupe.nom}</h3>
                    <span className="groupe-card-matiere">{groupe.matiereNom}</span>
                  </div>
                  <span className={`groupe-badge groupe-badge-${groupe.statut}`}>
                    {groupe.statut === 'actif' ? '🟢 Actif' : '📦 Archivé'}
                  </span>
                </div>

                {groupe.description && (
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0.25rem 0 0.5rem' }}>
                    {groupe.description}
                  </p>
                )}

                <div className="groupe-card-infos">
                  <span>📅 {groupe.classeNiveau}</span>
                  <span>🎓 {groupe.anneeScolaire}</span>
                  <span>👥 {groupe.nombreInscrits} élève{groupe.nombreInscrits !== 1 ? 's' : ''}</span>
                </div>

                <div className="groupe-card-code">
                  <span className="groupe-code-label">Code d'invitation :</span>
                  <div className="groupe-code-box">
                    <code className="groupe-code-value">{groupe.codeInvitation}</code>
                    <button className="prof-btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleCopierCode(groupe.codeInvitation); }}
                      title="Copier le code">
                      {codeCopie === groupe.codeInvitation ? '✅' : '📋'}
                    </button>
                    {groupe.statut === 'actif' && (
                      <button className="prof-btn-icon"
                        onClick={(e) => { e.stopPropagation(); handleRegenerCode(groupe.id); }}
                        title="Régénérer le code">🔄</button>
                    )}
                  </div>
                </div>

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

                <div className="groupe-card-actions">
                  {groupe.statut === 'actif' && (
                    <>
                      <button className="prof-btn prof-btn-primary prof-btn-sm"
                        onClick={() => onSelectGroupe(groupe)}>📊 Voir détails</button>
                      <button className="prof-btn prof-btn-warning prof-btn-sm"
                        onClick={() => handleOuvrirModification(groupe)}
                        style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' }}>
                        ✏️ Modifier</button>
                      <button className="prof-btn prof-btn-secondary prof-btn-sm"
                        onClick={() => handleArchiver(groupe.id)}>📦 Archiver</button>
                    </>
                  )}
                  {groupe.statut === 'archive' && (
                    <button className="prof-btn prof-btn-primary prof-btn-sm"
                      onClick={() => handleRestaurer(groupe.id)}>↩️ Restaurer</button>
                  )}

                  {confirmSuppression === groupe.id ? (
                    <div className="groupe-confirm-suppression">
                      <span>Confirmer ?</span>
                      <button className="prof-btn prof-btn-danger prof-btn-sm"
                        onClick={() => handleSupprimer(groupe.id)}>Oui, supprimer</button>
                      <button className="prof-btn prof-btn-secondary prof-btn-sm"
                        onClick={() => setConfirmSuppression(null)}>Non</button>
                    </div>
                  ) : (
                    <button className="prof-btn prof-btn-danger prof-btn-sm"
                      onClick={() => setConfirmSuppression(groupe.id)}>🗑️ Supprimer</button>
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
