// ============================================================
// PHASE 21+ — PAGE : CahierDetailPage (refonte UX v2)
// Vue détaillée d'un cahier : panneau nav semaine/mois,
// tri chronologique, export PDF, design amélioré.
// Route : /prof/cahiers/:cahierId
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
  getCahierById,
  getEntreesByCahier,
  deleteEntree,
  updateEntree,
  updateCahier,
  toggleArchiveCahier,
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
type SortDirection = 'asc' | 'desc';

// ─── Utilitaires semaine ──────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun…
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(weekStartStr: string): string {
  const start = new Date(weekStartStr);
  const end = getWeekEnd(start);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`;
}

function formatMoisLabel(moisKey: string): string {
  const [annee, moisNum] = moisKey.split('-');
  return new Date(Number(annee), Number(moisNum) - 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ─── Composant principal ─────────────────────────────────────
const CahierDetailPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [cahier, setCahier] = useState<CahierTextes | null>(null);
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [loadingCahier, setLoadingCahier] = useState(true);
  const [loadingEntrees, setLoadingEntrees] = useState(true);
  const [vue, setVue] = useState<VueActive>('liste');

  // ── Filtres + tri ─────────────────────────────────────────
  const [filtreStatut, setFiltreStatut] = useState<StatutSeance | 'tous'>('tous');
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [filtreMois, setFiltreMois] = useState<string>('tous');
  const [filtreSemaine, setFiltreSemaine] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ── Export PDF (contrôlé par l'admin) ────────────────────
  const [pdfEnabled, setPdfEnabled] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);

  // ── Charger le paramètre PDF depuis les settings admin ───
  useEffect(() => {
    getDoc(doc(db, 'settings', 'platform'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          // Par défaut activé si la clé n'existe pas encore
          setPdfEnabled(data.cahierPdfExport !== false);
        }
      })
      .catch(() => { /* silencieux si settings non configuré */ });
  }, []);

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
  }, [cahierId, navigate]);

  // ── Charger les entrées ───────────────────────────────────
  const chargerEntrees = useCallback(async () => {
    if (!cahierId) return;
    setLoadingEntrees(true);
    try {
      const data = await getEntreesByCahier(cahierId);
      setEntrees(data);
    } finally {
      setLoadingEntrees(false);
    }
  }, [cahierId]);

  useEffect(() => { chargerEntrees(); }, [chargerEntrees]);

  // ── Supprimer une entrée ──────────────────────────────────
  const handleDeleteEntree = async (entree: EntreeCahier) => {
    if (!confirm(`Supprimer la séance "${entree.chapitre}" ?`)) return;
    try {
      await deleteEntree(entree.id);
      const nouvellesEntrees = entrees.filter(e => e.id !== entree.id);
      setEntrees(nouvellesEntrees);
      const nbRealise = nouvellesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId!, { nombreSeancesRealise: nbRealise });
      setCahier(prev => prev ? { ...prev, nombreSeancesRealise: nbRealise } : prev);
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  // ── Changer statut rapide ─────────────────────────────────
  const handleStatutChange = async (entree: EntreeCahier, statut: StatutSeance) => {
    try {
      await updateEntree(entree.id, { statut });
      const nouvellesEntrees = entrees.map(e =>
        e.id === entree.id ? { ...e, statut } : e
      );
      setEntrees(nouvellesEntrees);
      const nbRealise = nouvellesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId!, { nombreSeancesRealise: nbRealise });
      setCahier(prev => prev ? { ...prev, nombreSeancesRealise: nbRealise } : prev);
    } catch {
      alert('Erreur mise à jour statut.');
    }
  };

  // ── Export PDF ────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    setPdfExporting(true);
    // Légère temporisation pour que le state se mette à jour
    setTimeout(() => {
      window.print();
      setPdfExporting(false);
    }, 100);
  }, []);

  // ── Calcul des mois disponibles ───────────────────────────
  const moisDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        entrees.map(e => {
          const d = e.date.toDate();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })
      )
    ).sort();
  }, [entrees]);

  // ── Calcul des semaines disponibles pour le mois sélectionné
  const semainesDisponibles = useMemo(() => {
    const base = filtreMois === 'tous' ? entrees : entrees.filter(e => {
      const d = e.date.toDate();
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mois === filtreMois;
    });

    const weekMap = new Map<string, number>();
    base.forEach(e => {
      const weekStart = getWeekStart(e.date.toDate());
      const key = weekStart.toISOString().slice(0, 10);
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, count]) => ({ start, count }));
  }, [entrees, filtreMois]);

  // ── Comptage par mois ─────────────────────────────────────
  const countParMois = useMemo(() => {
    const map = new Map<string, number>();
    entrees.forEach(e => {
      const d = e.date.toDate();
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(mois, (map.get(mois) || 0) + 1);
    });
    return map;
  }, [entrees]);

  // ── Filtrage + tri ────────────────────────────────────────
  const entreesFiltrees = useMemo(() => {
    return entrees
      .filter(e => {
        const d = e.date.toDate();
        const okStatut = filtreStatut === 'tous' || e.statut === filtreStatut;
        const okType = filtreType === 'tous' || e.typeContenu === filtreType;

        let okMois = true;
        if (filtreMois !== 'tous') {
          const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          okMois = mois === filtreMois;
        }

        let okSemaine = true;
        if (filtreSemaine) {
          const weekStartKey = getWeekStart(d).toISOString().slice(0, 10);
          okSemaine = weekStartKey === filtreSemaine;
        }

        return okStatut && okType && okMois && okSemaine;
      })
      .sort((a, b) => {
        const diff = a.date.toMillis() - b.date.toMillis();
        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [entrees, filtreStatut, filtreType, filtreMois, filtreSemaine, sortDirection]);

  // ─────────────────────────────────────────────────────────
  if (loadingCahier) {
    return (
      <div className="loading-spinner">
        <div className="spinner-circle" />
      </div>
    );
  }
  if (!cahier) return null;

  const progressionPct = cahier.nombreSeancesPrevu > 0
    ? Math.round((entrees.filter(e => e.statut === 'realise').length / cahier.nombreSeancesPrevu) * 100)
    : 0;

  return (
    <div className="cahier-detail-page" id="cahier-detail-print-zone">

      {/* ── En-tête ── */}
      <div className="cahier-detail-header">
        <button
          className="btn-retour no-print"
          onClick={() => navigate('/prof/cahiers')}
          title="Retour à la liste"
        >
          ← Retour
        </button>

        <div
          className="cahier-detail-couleur-barre"
          style={{ background: cahier.couleur }}
        />

        <div className="cahier-detail-info">
          <h1 className="cahier-detail-titre">{cahier.titre}</h1>
          <div className="cahier-detail-badges">
            <span className="badge-classe" title="Classe liée">📋 {cahier.classe}</span>
            <span className="badge-matiere">{cahier.matiere}</span>
            <span className="badge-annee">{cahier.anneeScolaire}</span>
            {cahier.isPartage && (
              <span className="badge-partage">👥 Partagé</span>
            )}
            {(cahier.isArchived ?? false) && (
              <span className="badge-archive">📦 Archivé</span>
            )}
          </div>
          {cahier.description && (
            <p className="cahier-detail-description">{cahier.description}</p>
          )}
          {/* Progression */}
          <div className="cahier-detail-progression">
            <div className="progression-bar-bg" style={{ width: 200 }}>
              <div
                className="progression-bar-fill"
                style={{
                  width: `${progressionPct}%`,
                  background: cahier.couleur,
                }}
              />
            </div>
            <span className="progression-pct">
              {entrees.filter(e => e.statut === 'realise').length} / {cahier.nombreSeancesPrevu} séances ({progressionPct}%)
            </span>
          </div>
        </div>

        {/* Actions en-tête */}
        <div className="cahier-detail-actions no-print">
          <button
            className="btn-secondary"
            onClick={async () => {
              const nouvelEtat = !(cahier.isArchived ?? false);
              try {
                await toggleArchiveCahier(cahier.id, nouvelEtat);
                setCahier(prev => prev ? { ...prev, isArchived: nouvelEtat } : null);
              } catch { alert('Erreur lors de l\'opération.'); }
            }}
            title={(cahier.isArchived ?? false) ? 'Restaurer le cahier' : 'Archiver le cahier'}
          >
            {(cahier.isArchived ?? false) ? '↩️ Restaurer' : '📦 Archiver'}
          </button>
          {pdfEnabled && (
            <button
              className="btn-pdf"
              onClick={handleExportPDF}
              disabled={pdfExporting}
              title="Télécharger en PDF"
            >
              {pdfExporting ? '⏳' : '📄'} PDF
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
          >
            + Nouvelle séance
          </button>
        </div>
      </div>

      {/* ── Tabs de vue ── */}
      <div className="view-tabs no-print">
        {([
          { id: 'liste', label: '📋 Liste' },
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

      {/* ── Vue Calendrier ── */}
      {vue === 'calendrier' && (
        <div className="cahier-detail-layout">
          <div><CahierCalendar cahierId={cahier.id} /></div>
          <div><RappelWidget profId={currentUser!.uid} cahierId={cahier.id} /></div>
        </div>
      )}

      {/* ── Vue Signets ── */}
      {vue === 'signets' && (
        <div className="cahier-detail-layout">
          <SignetFilter profId={currentUser!.uid} cahierId={cahier.id} />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {/* ── Vue Statistiques ── */}
      {vue === 'stats' && (
        <div className="cahier-detail-layout">
          <CahierStats
            cahier={{
              ...cahier,
              nombreSeancesRealise: entrees.filter(e => e.statut === 'realise').length,
            }}
          />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {/* ── Vue Liste (3 colonnes) ── */}
      {vue === 'liste' && (
        <div className="cahier-three-col-layout">

          {/* ─── Colonne gauche : navigation ─────────────── */}
          <aside className="cahier-nav-sidebar no-print">
            <div className="nav-sidebar-header">
              <span className="nav-sidebar-icon">🗓️</span>
              <span className="nav-sidebar-title">Navigation</span>
            </div>

            {/* Tout afficher */}
            <button
              className={`nav-month-item ${filtreMois === 'tous' ? 'active' : ''}`}
              onClick={() => { setFiltreMois('tous'); setFiltreSemaine(null); }}
            >
              <span>Tout afficher</span>
              <span className="nav-count-badge">{entrees.length}</span>
            </button>

            {/* Liste des mois */}
            {moisDisponibles.length > 0 && (
              <div className="nav-months-list">
                {moisDisponibles.map(mois => (
                  <button
                    key={mois}
                    className={`nav-month-item ${filtreMois === mois ? 'active' : ''}`}
                    onClick={() => { setFiltreMois(mois); setFiltreSemaine(null); }}
                  >
                    <span className="nav-month-label">{formatMoisLabel(mois)}</span>
                    <span className="nav-count-badge">{countParMois.get(mois) || 0}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Semaines du mois sélectionné */}
            {filtreMois !== 'tous' && semainesDisponibles.length > 0 && (
              <div className="nav-weeks-section">
                <div className="nav-weeks-header">Semaines</div>
                {/* Option "tout le mois" */}
                <button
                  className={`nav-week-item ${filtreSemaine === null ? 'active' : ''}`}
                  onClick={() => setFiltreSemaine(null)}
                >
                  <span>Tout le mois</span>
                  <span className="nav-count-badge nav-count-badge--sm">
                    {countParMois.get(filtreMois) || 0}
                  </span>
                </button>
                {semainesDisponibles.map(sem => (
                  <button
                    key={sem.start}
                    className={`nav-week-item ${filtreSemaine === sem.start ? 'active' : ''}`}
                    onClick={() => setFiltreSemaine(sem.start)}
                  >
                    <span className="nav-week-label">{formatWeekLabel(sem.start)}</span>
                    <span className="nav-count-badge nav-count-badge--sm">{sem.count}</span>
                  </button>
                ))}
              </div>
            )}

            {entrees.length === 0 && (
              <p className="nav-sidebar-empty">Aucune séance pour l'instant</p>
            )}
          </aside>

          {/* ─── Colonne centrale : liste des entrées ─────── */}
          <div className="cahier-content-col">
            {/* Barre filtres + tri */}
            <div className="entrees-controls no-print">
              {/* Filtres statut */}
              <div className="entrees-statut-filters">
                {(['tous', 'realise', 'planifie', 'annule', 'reporte'] as const).map(s => {
                  const cfg = s === 'tous' ? null : STATUT_CONFIG[s];
                  return (
                    <button
                      key={s}
                      className={`statut-chip ${filtreStatut === s ? 'active' : ''}`}
                      style={filtreStatut === s && cfg ? {
                        borderColor: cfg.color,
                        background: cfg.bg,
                        color: cfg.color,
                      } : {}}
                      onClick={() => setFiltreStatut(s)}
                    >
                      {s === 'tous' ? 'Tous' : cfg?.label}
                    </button>
                  );
                })}
              </div>

              {/* Filtre type + sort */}
              <div className="entrees-right-controls">
                <select
                  className="filtre-select"
                  value={filtreType}
                  onChange={e => setFiltreType(e.target.value)}
                >
                  <option value="tous">Tous types</option>
                  {Object.entries(TYPE_CONTENU_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                  ))}
                </select>

                {/* Bouton tri chronologique */}
                <button
                  className="btn-sort"
                  onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                  title={sortDirection === 'asc' ? 'Ordre croissant (cliquer pour inverser)' : 'Ordre décroissant (cliquer pour inverser)'}
                >
                  {sortDirection === 'asc' ? '↑ Plus ancien' : '↓ Plus récent'}
                </button>
              </div>
            </div>

            {/* Indicateur de filtre actif */}
            {(filtreMois !== 'tous' || filtreSemaine || filtreStatut !== 'tous' || filtreType !== 'tous') && (
              <div className="filtre-actif-bar no-print">
                <span className="filtre-actif-label">
                  {entreesFiltrees.length} séance{entreesFiltrees.length !== 1 ? 's' : ''}
                  {filtreSemaine ? ` • Semaine du ${formatWeekLabel(filtreSemaine)}` : ''}
                  {filtreMois !== 'tous' && !filtreSemaine ? ` • ${formatMoisLabel(filtreMois)}` : ''}
                </span>
                <button
                  className="filtre-actif-reset"
                  onClick={() => {
                    setFiltreStatut('tous');
                    setFiltreType('tous');
                    setFiltreMois('tous');
                    setFiltreSemaine(null);
                  }}
                >
                  ✕ Réinitialiser
                </button>
              </div>
            )}

            {/* ── Liste des entrées ── */}
            {loadingEntrees && entreesFiltrees.length === 0 ? (
              <div className="loading-spinner"><div className="spinner-circle" /></div>
            ) : entreesFiltrees.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: '0.5rem' }}>📝</div>
                <h3>
                  {filtreStatut !== 'tous' || filtreType !== 'tous' || filtreMois !== 'tous'
                    ? 'Aucune séance correspondant aux filtres'
                    : 'Aucune séance pour l\'instant'}
                </h3>
                {filtreStatut === 'tous' && filtreType === 'tous' && filtreMois === 'tous' && (
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
                    style={{ marginTop: '1rem' }}
                  >
                    + Ajouter la première séance
                  </button>
                )}
              </div>
            ) : (
              <div className="entrees-list">
                {entreesFiltrees.map((entree, idx) => {
                  const typeCfg = TYPE_CONTENU_CONFIG[entree.typeContenu];
                  const statutCfg = STATUT_CONFIG[entree.statut];
                  const dateSeance = entree.date.toDate();

                  return (
                    <div
                      key={entree.id}
                      className="entree-card"
                      style={{ borderLeftColor: typeCfg.color }}
                      onClick={() => navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`)}
                    >
                      {/* Numéro de séance */}
                      <div className="entree-num">
                        <span style={{ background: typeCfg.color }}>
                          {sortDirection === 'asc' ? idx + 1 : entreesFiltrees.length - idx}
                        </span>
                      </div>

                      <div className="entree-card-inner">
                        <div className="entree-card-top">
                          <div className="entree-card-gauche">
                            {/* Date + horaire */}
                            <div className="entree-date">
                              📅 {dateSeance.toLocaleDateString('fr-FR', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                              })}
                              {entree.heureDebut && (
                                <span className="entree-heure">
                                  🕐 {entree.heureDebut}{entree.heureFin ? ` → ${entree.heureFin}` : ''}
                                </span>
                              )}
                            </div>
                            {/* Titre séance */}
                            <h3 className="entree-chapitre">{entree.chapitre}</h3>
                            {/* Badges */}
                            <div className="entree-badges">
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
                              {entree.piecesJointes && entree.piecesJointes.length > 0 && (
                                <span className="badge-pj">
                                  📎 {entree.piecesJointes.length}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions (cachées en print) */}
                          <div className="entree-actions no-print">
                            <button
                              className="btn-icon"
                              onClick={e => { e.stopPropagation(); navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`); }}
                              title="Modifier"
                            >✏️</button>
                            <button
                              className="btn-icon btn-icon--danger"
                              onClick={e => { e.stopPropagation(); handleDeleteEntree(entree); }}
                              title="Supprimer"
                            >🗑️</button>
                          </div>
                        </div>

                        {/* Contenu enrichi */}
                        {entree.contenu && (
                          <div
                            className="entree-contenu-preview"
                            dangerouslySetInnerHTML={{ __html: entree.contenu }}
                          />
                        )}

                        {/* Objectifs */}
                        {entree.objectifs && (
                          <div className="entree-objectifs">
                            🎯 <em>{entree.objectifs}</em>
                          </div>
                        )}

                        {/* Footer statuts rapides */}
                        <div className="entree-card-footer no-print">
                          <div className="entree-statuts-rapides">
                            {(['realise', 'planifie', 'annule'] as StatutSeance[]).map(s => {
                              const cfg = STATUT_CONFIG[s];
                              const isActive = entree.statut === s;
                              return (
                                <button
                                  key={s}
                                  className={`statut-quick-btn ${isActive ? 'active' : ''}`}
                                  style={isActive ? {
                                    borderColor: cfg.color,
                                    background: cfg.bg,
                                    color: cfg.color,
                                  } : {}}
                                  onClick={e => { e.stopPropagation(); handleStatutChange(entree, s); }}
                                >
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                          {entree.notesPrivees && (
                            <span className="entree-has-notes" title="Contient des notes privées">
                              🔒 Notes privées
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Colonne droite : rappels ─────────────────── */}
          <div className="cahier-sidebar-right no-print">
            <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CahierDetailPage;
