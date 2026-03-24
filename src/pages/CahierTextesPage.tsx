// ============================================================
// PHASE 21 + 22 — PAGE : CahierTextesPage
// Liste de tous les cahiers d'un enseignant Premium
// Phase 22 : liaison groupes classes + badge partagé
// Route : /prof/cahiers
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

import {
  subscribeToCahiers,
  createCahier,
  updateCahier,
  deleteCahier,
  toggleArchiveCahier,
  getGroupesProf,
} from '../services/cahierTextesService';

import {
  ANNEES_SCOLAIRES,
  COULEURS_CAHIER,
  CLASSES,
} from '../types/cahierTextes.types';

import type {
  CahierTextes, CahierFormData, GroupeProf,
  Classe, Matiere, AnneeScolaire,
} from '../types/cahierTextes.types';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';

import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';

// ─── Formulaire vide ─────────────────────────────────────────
const emptyForm = (): CahierFormData => ({
  classe:               '3ème',
  matiere:              'Mathématiques',
  anneeScolaire:        '2025-2026',
  titre:                '',
  description:          '',
  couleur:              '#2563eb',
  nombreSeancesPrevu:   30,
  // Phase 22
  groupeIds:            [],
  groupeNoms:           [],
  isPartage:            false,
  // Phase 31
  seancesParJour:       1,
});

// ─── Composant principal ─────────────────────────────────────
const CahierTextesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Phase 22 — pré-remplissage depuis widget groupe

  // ── États principaux ─────────────────────────────────────
  const [cahiers, setCahiers]       = useState<CahierTextes[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filtreAnnee, setFiltreAnnee] = useState<string>('2025-2026');
  const [filtreArchive, setFiltreArchive] = useState<'actif' | 'archive' | 'tous'>('actif');
  const [showModal, setShowModal]   = useState(false);
  const [editCahier, setEditCahier] = useState<CahierTextes | null>(null);
  const [form, setForm]             = useState<CahierFormData>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Matières et niveaux dynamiques depuis Firestore
  const { matieres: matieresDispos, niveaux: niveauxDispos, loading: loadingDisciplines } = useDisciplinesOptions();
  


  // ── Phase 22 — états groupes ─────────────────────────────
  const [groupesDispos, setGroupesDispos]             = useState<GroupeProf[]>([]);
  const [groupesSelectionnes, setGroupesSelectionnes] = useState<string[]>([]);

  // ── Vérification Premium (les admins sont toujours exemptés) ─
  if (!currentUser?.isPremium && currentUser?.role !== 'admin') {
    return (
      <div className="cahier-textes-page">
        <div className="premium-gate">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📒</div>
          <h2>Cahier de Textes Numérique</h2>
          <p>
            Cette fonctionnalité est réservée aux enseignants Premium.<br />
            Passez au Premium pour organiser, planifier et suivre votre enseignement.
          </p>
          <button className="btn-primary" onClick={() => navigate('/premium')}>
            🚀 Passer au Premium — 2 000 FCFA/mois
          </button>
        </div>
      </div>
    );
  }

  // ── Abonnement temps réel aux cahiers ────────────────────
  // onSnapshot contourne le cache IndexedDB de persistentLocalCache :
  // toute écriture Firestore (changement de statut, etc.) déclenche
  // immédiatement une mise à jour de la liste et des barres de progression.
  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const unsubscribe = subscribeToCahiers(
      currentUser.uid,
      filtreAnnee || undefined,
      (data) => {
        setCahiers(data);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur chargement cahiers:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser?.uid, filtreAnnee]);

  // ── Phase 22 — chargement des groupes + pré-remplissage ──
  useEffect(() => {
    if (!currentUser?.uid) return;
    // Charge les groupes disponibles pour le sélecteur
    getGroupesProf(currentUser.uid)
      .then(setGroupesDispos)
      .catch(err => console.error('Erreur chargement groupes:', err));

    // Pré-remplissage si on vient depuis CahierGroupeWidget
    const groupeIdParam  = searchParams.get('groupeId');
    const groupeNomParam = searchParams.get('groupeNom');
    const classeParam    = searchParams.get('classe');

    if (groupeIdParam && groupeNomParam) {
      // Ouvre directement la modale pré-remplie
      setGroupesSelectionnes([groupeIdParam]);
      setForm(f => ({
        ...f,
        classe:     (classeParam as Classe) || f.classe,
        groupeIds:  [groupeIdParam],
        groupeNoms: [groupeNomParam],
      }));
      setEditCahier(null);
      setError('');
      setShowModal(true);
    }
  }, [currentUser?.uid]);

  // ── Ouvrir modal création ─────────────────────────────────
  const handleNouveauCahier = () => {
    setEditCahier(null);
    setForm(emptyForm());
    setGroupesSelectionnes([]);
    setError('');
    setShowModal(true);
  };

  // ── Ouvrir modal édition ──────────────────────────────────
  const handleEditCahier = (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCahier(cahier);
    setGroupesSelectionnes(cahier.groupeIds ?? []);
    setForm({
      classe:               cahier.classe as Classe,
      matiere:              cahier.matiere as Matiere,
      anneeScolaire:        cahier.anneeScolaire as AnneeScolaire,
      titre:                cahier.titre,
      description:          cahier.description || '',
      couleur:              cahier.couleur,
      nombreSeancesPrevu:   cahier.nombreSeancesPrevu,
      // Phase 22
      groupeIds:            cahier.groupeIds  ?? [],
      groupeNoms:           cahier.groupeNoms ?? [],
      isPartage:            cahier.isPartage  ?? false,
      // Phase 31
      seancesParJour:       cahier.seancesParJour ?? 1,
    });
    setError('');
    setShowModal(true);
  };

  // ── Phase 22 — toggle groupe dans la sélection ───────────
  const handleToggleGroupe = (groupeId: string) => {
    setGroupesSelectionnes(prev => {
      const next = prev.includes(groupeId)
        ? prev.filter(id => id !== groupeId)
        : [...prev, groupeId];
      // Synchronise aussi dans le form
      const noms = next
        .map(id => groupesDispos.find(g => g.id === id)?.nom ?? '')
        .filter(Boolean);
      setForm(f => ({ ...f, groupeIds: next, groupeNoms: noms }));
      return next;
    });
  };

  // ── Soumettre le formulaire ───────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    setSaving(true);
    setError('');
    try {
      if (editCahier) {
        await updateCahier(editCahier.id, form);
      } else {
        await createCahier(currentUser.uid, form);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Erreur : ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer un cahier ───────────────────────────────────
  const handleDelete = async (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le cahier "${cahier.titre}" et toutes ses entrées ?`)) return;
    try {
      await deleteCahier(cahier.id);
      setCahiers(prev => prev.filter(c => c.id !== cahier.id));
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  const handleToggleArchive = async (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    const nouvelEtat = !(cahier.isArchived ?? false);
    try {
      await toggleArchiveCahier(cahier.id, nouvelEtat);
      setCahiers(prev => prev.map(c =>
        c.id === cahier.id ? { ...c, isArchived: nouvelEtat } : c
      ));
    } catch {
      alert('Erreur lors de l\'opération.');
    }
  };

  // ── Filtrage par statut archive ───────────────────────────
  const cahiersFiltres = cahiers.filter(c => {
    const archived = c.isArchived ?? false;
    if (filtreArchive === 'actif') return !archived;
    if (filtreArchive === 'archive') return archived;
    return true;
  });

  // ── Progression ───────────────────────────────────────────
  const progressionPct = (cahier: CahierTextes) =>
    cahier.nombreSeancesPrevu > 0
      ? Math.min(100, Math.round((cahier.nombreSeancesRealise / cahier.nombreSeancesPrevu) * 100))
      : 0;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="cahier-textes-page">
      {/* ── En-tête ── */}
      <div className="cahier-page-header">
        <div>
          <h1 className="cahier-page-title">📒 Cahier de Textes</h1>
          <p className="cahier-page-subtitle">Organisez et planifiez votre enseignement</p>
        </div>
        <button className="btn-primary" onClick={handleNouveauCahier}>
          + Nouveau cahier
        </button>
      </div>

      {/* ── Filtres ── */}
      <div className="cahier-filtres">
        <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>Année scolaire :</label>
        <select
          className="filtre-select"
          value={filtreAnnee}
          onChange={e => setFiltreAnnee(e.target.value)}
        >
          <option value="">Toutes les années</option>
          {ANNEES_SCOLAIRES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="cahier-filtres-archive" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '1.5rem' }}>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'actif' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('actif')}
          >
            Actifs ({cahiers.filter(c => !(c.isArchived ?? false)).length})
          </button>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'archive' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('archive')}
          >
            Archivés ({cahiers.filter(c => c.isArchived ?? false).length})
          </button>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'tous' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('tous')}
          >
            Tous ({cahiers.length})
          </button>
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner-circle" /></div>
      ) : cahiersFiltres.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>📒</div>
          <h3>{filtreArchive === 'archive' ? 'Aucun cahier archivé' : 'Aucun cahier pour ' + (filtreAnnee || 'cette période')}</h3>
          <p>{filtreArchive === 'archive'
            ? 'Vos cahiers archivés apparaîtront ici.'
            : 'Créez votre premier cahier de textes pour commencer à planifier votre enseignement.'}</p>
          <button className="btn-primary" onClick={handleNouveauCahier} style={{ marginTop: '1rem' }}>
            + Créer mon premier cahier
          </button>
        </div>
      ) : (
        <div className="cahiers-grid">
          {cahiersFiltres.map(cahier => {
            const pct = progressionPct(cahier);
            const isArchived = cahier.isArchived ?? false;
            return (
              <div
                key={cahier.id}
                className={`cahier-card ${isArchived ? 'cahier-card-archived' : ''}`}
                onClick={() => navigate(`/prof/cahiers/${cahier.id}`)}
              >
                {/* Bande couleur */}
                <div style={{ height: 4, background: cahier.couleur, borderRadius: '12px 12px 0 0' }} />

                <div className="cahier-card-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="cahier-card-titre">{cahier.titre}</h3>
                    <div className="cahier-card-meta">
                      <span className="badge-classe" title="Classe liée">{cahier.classe}</span>
                      <span className="badge-matiere">{cahier.matiere}</span>
                      <span className="badge-annee">{cahier.anneeScolaire}</span>
                      {isArchived && <span className="badge-archive">📦 Archivé</span>}
                    </div>

                    {/* ── Phase 22 : badge groupes liés ── */}
                    {(cahier.groupeIds?.length ?? 0) > 0 && (
                      <span
                        className={`badge-partage ${cahier.isPartage ? 'actif' : ''}`}
                        style={{ marginTop: 6, display: 'inline-flex' }}
                      >
                        {cahier.isPartage ? '👁️ Partagé avec' : '🔒 Lié à'}{' '}
                        {cahier.groupeIds.length} groupe{cahier.groupeIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="cahier-card-body">
                  {cahier.description && (
                    <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                      {cahier.description.substring(0, 80)}{cahier.description.length > 80 ? '...' : ''}
                    </p>
                  )}
                  <div className="progression-bar-wrap">
                    <div className="progression-label">
                      <span>Progression</span>
                      <span style={{ fontWeight: 700, color: cahier.couleur }}>{pct}%</span>
                    </div>
                    <div className="progression-bar-bg">
                      <div
                        className="progression-bar-fill"
                        style={{ width: `${pct}%`, background: cahier.couleur }}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                      {cahier.nombreSeancesRealise} / {cahier.nombreSeancesPrevu} séances réalisées
                    </div>
                  </div>
                </div>

                <div className="cahier-card-footer">
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Mis à jour le {cahier.updatedAt?.toDate().toLocaleDateString('fr-FR') || '—'}
                  </span>
                  <div className="cahier-actions">
                    <button
                      className="btn-icon"
                      onClick={e => handleToggleArchive(cahier, e)}
                      title={isArchived ? 'Restaurer' : 'Archiver'}
                    >
                      {isArchived ? '↩️' : '📦'}
                    </button>
                    <button className="btn-icon" onClick={e => handleEditCahier(cahier, e)} title="Modifier">
                      ✏️
                    </button>
                    <button className="btn-icon" onClick={e => handleDelete(cahier, e)} title="Supprimer" style={{ color: '#ef4444' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal création/édition ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              📒 {editCahier ? 'Modifier le cahier' : 'Nouveau cahier de textes'}
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Classe + Matière */}
              
              {/* Classe + Matière */}
<div className="form-row">
  {/* Classe : liste STATIQUE (référentiel fixe) */}
  <div className="form-group">
    <label className="form-label">Classe *</label>
    <select
      className="form-select"
      value={form.classe}
      onChange={e => setForm(f => ({ ...f, classe: e.target.value as Classe }))}
      required
    >
      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>

  {/* Matière : liste DYNAMIQUE depuis Firestore (admin) */}
  <div className="form-group">
    <label className="form-label">Matière *</label>
    <select
      className="form-select"
      value={form.matiere}
      onChange={e => setForm(f => ({ ...f, matiere: e.target.value as Matiere }))}
      required
      disabled={loadingDisciplines}
    >
      <option value="">
        {loadingDisciplines ? 'Chargement…' : '— Sélectionner —'}
      </option>
      {matieresDispos.map(o => (
        <option key={o.valeur} value={o.valeur}>{o.label}</option>
      ))}
      {/* Fallback : matière existante absente de Firestore */}
      {form.matiere && !matieresDispos.find(o => o.valeur === form.matiere) && (
        <option value={form.matiere}>{form.matiere}</option>
      )}
    </select>
  </div>
</div>

              {/* Année scolaire */}
              <div className="form-group">
                <label className="form-label">Année scolaire *</label>
                <select
                  className="form-select"
                  value={form.anneeScolaire}
                  onChange={e => setForm(f => ({ ...f, anneeScolaire: e.target.value as AnneeScolaire }))}
                >
                  {ANNEES_SCOLAIRES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Titre */}
              <div className="form-group">
                <label className="form-label">Titre personnalisé</label>
                <input
                  className="form-input"
                  placeholder={`Ex: Maths 3ème A - ${form.anneeScolaire}`}
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                />
              </div>

              {/* Séances prévues + séances par jour */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre de séances prévues</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="200"
                    value={form.nombreSeancesPrevu}
                    onChange={e => setForm(f => ({ ...f, nombreSeancesPrevu: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Séances par jour</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="6"
                    value={form.seancesParJour ?? 1}
                    onChange={e => setForm(f => ({ ...f, seancesParJour: Math.max(1, Math.min(6, Number(e.target.value))) }))}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                    {(form.seancesParJour ?? 1) > 1
                      ? `${form.seancesParJour} séances par jour — les entrées seront regroupées`
                      : '1 séance par jour (défaut)'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description / Objectifs (optionnel)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Objectifs généraux, groupe classe, notes..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Couleur */}
              <div className="form-group">
                <label className="form-label">Couleur du cahier</label>
                <div className="couleur-picker">
                  {COULEURS_CAHIER.map(c => (
                    <div
                      key={c}
                      className={`couleur-option ${form.couleur === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setForm(f => ({ ...f, couleur: c }))}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* ── Phase 22 : Sélecteur groupes classes ── */}
              <div className="form-group">
                <label className="form-label">
                  Groupes classes liés{' '}
                  <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel)</span>
                </label>

                {groupesDispos.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
                    Aucun groupe créé.{' '}
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.82rem' }}
                      onClick={() => navigate('/prof/groupes')}
                    >
                      Créer un groupe →
                    </button>
                  </p>
                ) : (
                  /* Liste déroulante multi-sélection */
                  <div className="groupe-selector">
                    {groupesDispos.map(groupe => {
                      const selectionne = groupesSelectionnes.includes(groupe.id);
                      return (
                        <div
                          key={groupe.id}
                          className={`groupe-option ${selectionne ? 'selected' : ''}`}
                          onClick={() => handleToggleGroupe(groupe.id)}
                        >
                          <input type="checkbox" checked={selectionne} readOnly tabIndex={-1} />
                          <span>
                            <strong>{groupe.nom}</strong> — {groupe.classe} ({groupe.anneeScolaire})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tags des groupes sélectionnés */}
                {groupesSelectionnes.length > 0 && (
                  <div className="groupes-tags">
                    {groupesSelectionnes.map(gId => {
                      const g = groupesDispos.find(x => x.id === gId);
                      return g ? (
                        <span key={gId} className="groupe-tag">
                          {g.nom}
                          <button
                            type="button"
                            onClick={() => handleToggleGroupe(gId)}
                            aria-label={`Retirer ${g.nom}`}
                          >
                            ✕
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Toggle visibilité élèves */}
                {groupesSelectionnes.length > 0 && (
                  <label className="toggle-partage" style={{ marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.isPartage ?? false}
                      onChange={e => setForm(f => ({ ...f, isPartage: e.target.checked }))}
                    />
                    <span>👁️ Rendre visible aux élèves des groupes liés</span>
                  </label>
                )}
              </div>
              {/* ── fin Phase 22 ── */}

              {/* Erreur */}
              {error && (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editCahier ? 'Mettre à jour' : 'Créer le cahier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CahierTextesPage;
