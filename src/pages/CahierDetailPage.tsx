// ============================================================
// PHASE 21 — PAGE : CahierDetailPage
// Vue détaillée d'un cahier (entrées, calendrier, signets)
// Route : /prof/cahiers/:cahierId
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getCahierById,
  getEntreesByCahier,
  deleteEntree,
  updateEntree,
} from '../services/cahierTextesService';
import {
  TYPE_CONTENU_CONFIG,
  STATUT_CONFIG,
} from '../types/cahierTextes.types';
import type {
  CahierTextes, EntreeCahier, StatutSeance,
} from '../types/cahierTextes.types';
import CahierCalendar from '../components/prof/CahierCalendar';
import RappelWidget from '../components/prof/RappelWidget';
import SignetFilter from '../components/prof/SignetFilter';
import CahierStats from '../components/prof/CahierStats';
import '../styles/CahierTextes.css';

// ─── Types ───────────────────────────────────────────────────
type VueActive = 'liste' | 'calendrier' | 'signets' | 'stats';

// ─── Composant principal ─────────────────────────────────────
const CahierDetailPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [cahier, setCahier] = useState<CahierTextes | null>(null);
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingCahier, setLoadingCahier] = useState(true);
  const [loadingEntrees, setLoadingEntrees] = useState(true);
  const [vue, setVue] = useState<VueActive>('liste');
  const [filtreStatut, setFiltreStatut] = useState<StatutSeance | 'tous'>('tous');
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [filtreMois, setFiltreMois] = useState<string>('tous');

  // ── Charger le cahier ─────────────────────────────────────
  useEffect(() => {
    if (!cahierId) return;
    const fetch = async () => {
      setLoadingCahier(true);
      try {
        const data = await getCahierById(cahierId);
        if (!data) { navigate('/prof/cahiers'); return; }
        setCahier(data);
      } finally {
        setLoadingCahier(false);
      }
    };
    fetch();
  }, [cahierId]);

  // ── Charger les entrées ───────────────────────────────────
  const chargerEntrees = useCallback(async () => {
  if (!cahierId) return;
  setLoadingEntrees(true);
  try {
    const data = await getEntreesByCahier(cahierId);
    setEntrees(data);
    setHasMore(false);
  } finally {
    setLoadingEntrees(false);
    }
   }, [cahierId]);

   useEffect(() => { chargerEntrees(); }, [cahierId]);

  // ── Supprimer une entrée ──────────────────────────────────
  const handleDeleteEntree = async (entree: EntreeCahier) => {
    if (!confirm(`Supprimer la séance "${entree.chapitre}" ?`)) return;
    try {
      await deleteEntree(entree.id);
      setEntrees(prev => prev.filter(e => e.id !== entree.id));
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };
// ── Recalculer la progression ──────────────────────────────
  const recalculerProgression = useCallback(async () => {
  if (!cahierId) return;
  const data = await getCahierById(cahierId);
  if (data) setCahier(data);
}, [cahierId]);
  // ── Changer statut rapide ─────────────────────────────────
  const handleStatutChange = async (entree: EntreeCahier, statut: StatutSeance) => {
  try {
    await updateEntree(entree.id, { statut });
    setEntrees(prev => prev.map(e => e.id === entree.id ? { ...e, statut } : e));
    await recalculerProgression(); // ← mise à jour barre de progression
  } catch {
    alert('Erreur mise à jour statut.');
  }
};

  // ── Filtrage côté client ───────────────────────────────────
const moisDisponibles = Array.from(
  new Set(
    entrees.map(e => {
      const d = e.date.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })
  )
).sort().reverse();

const entreesFiltrees = entrees.filter(e => {
  const okStatut = filtreStatut === 'tous' || e.statut === filtreStatut;
  const okType   = filtreType   === 'tous' || e.typeContenu === filtreType;
  const okMois   = filtreMois   === 'tous' || (() => {
    const d = e.date.toDate();
    const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return mois === filtreMois;
  })();
  return okStatut && okType && okMois;
});

  // ─────────────────────────────────────────────────────────
  if (loadingCahier) {
    return <div className="loading-spinner"><div className="spinner-circle" /></div>;
  }
  if (!cahier) return null;

  return (
    <div className="cahier-detail-page">
      {/* ── En-tête cahier ── */}
      <div className="cahier-detail-header">
        <button
          onClick={() => navigate('/prof/cahiers')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.2rem', padding: '0 0.5rem' }}
          title="Retour"
        >
          ←
        </button>
        <div style={{ width: 6, minHeight: 60, borderRadius: 4, background: cahier.couleur, alignSelf: 'stretch' }} />
        <div className="cahier-detail-info">
          <h1 className="cahier-detail-titre">{cahier.titre}</h1>
          <div className="cahier-detail-badges">
            <span className="badge-classe">{cahier.classe}</span>
            <span className="badge-matiere">{cahier.matiere}</span>
            <span className="badge-annee">{cahier.anneeScolaire}</span>
          </div>
          {cahier.description && (
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>{cahier.description}</p>
          )}
        </div>
        <div className="cahier-detail-actions">
          <button
            className="btn-primary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
          >
            + Nouvelle séance
          </button>
        </div>
      </div>

      {/* ── Tabs de vue ── */}
      <div className="view-tabs">
        {([
          { id: 'liste', label: '📋 Liste', },
          { id: 'calendrier', label: '📅 Calendrier' },
          { id: 'signets', label: '📌 Signets' },
          { id: 'stats', label: '📊 Statistiques' },
        ] as { id: VueActive; label: string }[]).map(tab => (
          <button
            key={tab.id}
            className={`view-tab ${vue === tab.id ? 'active' : ''}`}
            onClick={() => setVue(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenu selon vue ── */}
      {vue === 'calendrier' && (
        <div className="cahier-detail-layout">
          <div>
            <CahierCalendar cahierId={cahier.id} />
          </div>
          <div>
            <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
          </div>
        </div>
      )}

      {vue === 'signets' && (
        <div className="cahier-detail-layout">
          <SignetFilter profId={currentUser!.uid} cahierId={cahier.id} />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {vue === 'stats' && (
        <div className="cahier-detail-layout">
          <CahierStats cahier={cahier} />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {vue === 'liste' && (
        <div className="cahier-detail-layout">
          {/* Colonne principale : liste des entrées */}
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {/* Filtre statut */}
              {(['tous', 'realise', 'planifie', 'annule', 'reporte'] as const).map(s => {
                const cfg = s === 'tous' ? null : STATUT_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setFiltreStatut(s)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: 20,
                      border: `1.5px solid ${filtreStatut === s ? (cfg?.color || '#2563eb') : '#e5e7eb'}`,
                      background: filtreStatut === s ? (cfg?.bg || '#dbeafe') : 'white',
                      color: filtreStatut === s ? (cfg?.color || '#2563eb') : '#4b5563',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {s === 'tous' ? 'Tous' : cfg?.label}
                  </button>
                );
              })}
              <select
                className="filtre-select"
                value={filtreType}
                onChange={e => setFiltreType(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
              >
                <option value="tous">Tous types</option>
                {Object.entries(TYPE_CONTENU_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Liste */}
            {loadingEntrees && entreesFiltrees.length === 0 ? (
              <div className="loading-spinner"><div className="spinner-circle" /></div>
            ) : entreesFiltrees.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: '0.5rem' }}>📝</div>
                <h3>Aucune séance{filtreStatut !== 'tous' || filtreType !== 'tous' ? ' (avec ce filtre)' : ''}</h3>
                <button className="btn-primary" onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)} style={{ marginTop: '1rem' }}>
                  + Ajouter la première séance
                </button>
              </div>
            ) : (
              <div className="entrees-list">
                {entreesFiltrees.map(entree => {
                  const typeCfg = TYPE_CONTENU_CONFIG[entree.typeContenu];
                  const statutCfg = STATUT_CONFIG[entree.statut];
                  const dateSeance = entree.date.toDate();

                  return (
                    <div
                    key={entree.id}
                    className="entree-card"
                    style={{ borderLeftColor: typeCfg.color, cursor: 'pointer' }}
                    onClick={() => navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`)}
>
                      <div className="entree-card-top">
                        <div className="entree-card-gauche">
                          {/* Date + horaire */}
                          <div className="entree-date">
                            📅 {dateSeance.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            {entree.heureDebut && (
                              <span style={{ marginLeft: '0.5rem' }}>
                                🕐 {entree.heureDebut}{entree.heureFin ? ` → ${entree.heureFin}` : ''}
                              </span>
                            )}
                          </div>
                          {/* Chapitre */}
                          <h3 className="entree-chapitre">{entree.chapitre}</h3>
                          {/* Badges */}
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span
                              className="entree-type-badge"
                              style={{ background: typeCfg.color }}
                            >
                              {typeCfg.emoji} {typeCfg.label}
                            </span>
                            <span
                              className="entree-statut-badge"
                              style={{ background: statutCfg.bg, color: statutCfg.color }}
                            >
                              {statutCfg.label}
                            </span>
                            {entree.isMarqueEvaluation && (
                              <span className="signet-badge">📌 Évaluation</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`);
                            }}
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={(e) => { e.stopPropagation(); handleDeleteEntree(entree); }}
                            title="Supprimer"
                            style={{ color: '#ef4444' }}
                          >🗑️</button>
                        </div>
                      </div>

                      {/* Prévisualisation contenu */}
                      {entree.contenu && (
                        <div
                          className="entree-contenu-preview"
                          dangerouslySetInnerHTML={{ __html: entree.contenu }}
                        />
                      )}

                      {/* Objectifs */}
                      {entree.objectifs && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.4rem', fontStyle: 'italic' }}>
                          🎯 {entree.objectifs}
                        </div>
                      )}

                      {/* Pièces jointes */}
                      {entree.piecesJointes && entree.piecesJointes.length > 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '0.4rem' }}>
                          📎 {entree.piecesJointes.length} pièce(s) jointe(s)
                        </div>
                      )}

                      {/* Changement de statut rapide */}
                      <div className="entree-card-footer">
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {(['realise', 'planifie', 'annule'] as StatutSeance[]).map(s => {
                            const cfg = STATUT_CONFIG[s];
                            const isActive = entree.statut === s;
                            return (
                              <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); handleStatutChange(entree, s); }}
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 20,
                                  border: `1.5px solid ${isActive ? cfg.color : '#e5e7eb'}`,
                                  background: isActive ? cfg.bg : 'white',
                                  color: isActive ? cfg.color : '#9ca3af',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Charger plus */}
                {hasMore && (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => chargerEntrees()}
                      disabled={loadingEntrees}
                    >
                      {loadingEntrees ? 'Chargement...' : 'Charger plus de séances'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CahierDetailPage;
