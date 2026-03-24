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
  subscribeToEntreesCahier,
  deleteEntree,
  updateEntree,
  updateCahier,
  toggleArchiveCahier,
  COULEURS_RUBRIQUES,
  ajouterRubrique,
  modifierRubrique,
  supprimerRubrique,
  resoudreRubriqueIdPourEntree,
} from '../services/cahierTextesService';
import {
  TYPE_CONTENU_CONFIG,
  STATUT_CONFIG,
} from '../types/cahierTextes.types';
import {
  filtrerEntreesParPeriode,
  exportCahierPDF,
  type PeriodeExport,
} from '../utils/cahierExportPDF';
import type {
  CahierTextes, EntreeCahier, StatutSeance, RubriqueCahier,
} from '../types/cahierTextes.types';
import CahierCalendar from '../components/prof/CahierCalendar';
import RappelWidget from '../components/prof/RappelWidget';
import SignetFilter from '../components/prof/SignetFilter';
import CahierStats from '../components/prof/CahierStats';
import CahierProgressionWidget from '../components/prof/CahierProgressionWidget';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';

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
  const [rubriques, setRubriques] = useState<RubriqueCahier[]>([]);
  const [afficherFormRubrique, setAfficherFormRubrique] = useState(false);
  const [rubriqueEnEdition, setRubriqueEnEdition] = useState<RubriqueCahier | null>(null);
  const [formRubriqueNom, setFormRubriqueNom] = useState('');
  const [formRubriqueCouleur, setFormRubriqueCouleur] = useState(COULEURS_RUBRIQUES[0]);
  const [formRubriqueSeancesPrevu, setFormRubriqueSeancesPrevu] = useState<number | ''>(0);
  const [savingRubrique, setSavingRubrique] = useState(false);
  const [errorRubrique, setErrorRubrique] = useState('');
  const [loadingCahier, setLoadingCahier] = useState(true);
  const [loadingEntrees, setLoadingEntrees] = useState(true);
  const [vue, setVue] = useState<VueActive>('liste');

  // ── Filtres + tri ─────────────────────────────────────────
  const [filtreStatut, setFiltreStatut] = useState<StatutSeance | 'tous'>('tous');
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [filtreMois, setFiltreMois] = useState<string>('tous');
  const [filtreSemaine, setFiltreSemaine] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Phase 31 — Jours repliés (groupement séances par jour)
  const [joursReplies, setJoursReplies] = useState<Set<string>>(new Set());

  // ── Export PDF (contrôlé par l'admin) ────────────────────
  const [pdfEnabled, setPdfEnabled] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

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
        setRubriques(data.rubriques ?? []);
      } finally {
        setLoadingCahier(false);
      }
    };
    fetch();
  }, [cahierId, navigate]);

  // ── Abonnement temps réel aux entrées ──────────────────────
  // Utilise onSnapshot pour éviter les incohérences de cache (IndexedDB)
  // entre la carte (subscribeToCahiers) et la page détail.
  useEffect(() => {
    if (!cahierId) return;
    setLoadingEntrees(true);
    const unsub = subscribeToEntreesCahier(
      cahierId,
      (data) => {
        setEntrees(data);
        setLoadingEntrees(false);
      },
      (err) => {
        console.error('Erreur chargement entrées cahier:', err);
        setEntrees([]);
        setLoadingEntrees(false);
      }
    );
    return () => unsub();
  }, [cahierId]);

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

  // ── Phase 29 : Handlers rubriques ─────────────────────────
  const ouvrirAjoutRubrique = () => {
    setRubriqueEnEdition(null);
    setFormRubriqueNom('');
    setFormRubriqueCouleur(COULEURS_RUBRIQUES[rubriques.length % COULEURS_RUBRIQUES.length]);
    setFormRubriqueSeancesPrevu(0);
    setErrorRubrique('');
    setAfficherFormRubrique(true);
  };

  const ouvrirEditionRubrique = (r: RubriqueCahier) => {
    setRubriqueEnEdition(r);
    setFormRubriqueNom(r.nom);
    setFormRubriqueCouleur(r.couleur ?? COULEURS_RUBRIQUES[0]);
    setFormRubriqueSeancesPrevu(r.nombreSeancesPrevu ?? 0);
    setErrorRubrique('');
    setAfficherFormRubrique(true);
  };

  const fermerFormRubrique = () => {
    setAfficherFormRubrique(false);
    setRubriqueEnEdition(null);
    setFormRubriqueNom('');
    setFormRubriqueSeancesPrevu(0);
  };

  const handleSauvegarderRubrique = async () => {
    if (!formRubriqueNom.trim()) {
      setErrorRubrique('Le nom de la rubrique est obligatoire.');
      return;
    }
    if (!cahier || !cahierId) return;
    setSavingRubrique(true);
    setErrorRubrique('');
    try {
      let nouvelleListe: RubriqueCahier[];
      const nbPrevu = typeof formRubriqueSeancesPrevu === 'number'
        ? formRubriqueSeancesPrevu
        : parseInt(String(formRubriqueSeancesPrevu), 10) || 0;
      if (rubriqueEnEdition) {
        nouvelleListe = await modifierRubrique(
          cahierId,
          rubriques,
          rubriqueEnEdition.id,
          {
            nom: formRubriqueNom.trim(),
            couleur: formRubriqueCouleur,
            nombreSeancesPrevu: nbPrevu > 0 ? nbPrevu : undefined,
          }
        );
      } else {
        nouvelleListe = await ajouterRubrique(
          cahierId,
          rubriques,
          formRubriqueNom.trim(),
          formRubriqueCouleur,
          nbPrevu > 0 ? nbPrevu : undefined
        );
      }
      setRubriques(nouvelleListe);
      setCahier(prev => prev ? { ...prev, rubriques: nouvelleListe } : prev);
      fermerFormRubrique();
    } catch (err) {
      console.error('[CahierDetailPage] Erreur sauvegarde rubrique :', err);
      setErrorRubrique('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSavingRubrique(false);
    }
  };

  const handleSupprimerRubrique = async (rubriqueId: string, rubriqueNom: string) => {
    if (!cahierId) return;
    if (!window.confirm(`Supprimer la rubrique "${rubriqueNom}" ?\nLes séances liées passeront dans "Sans rubrique".`)) return;
    try {
      const nouvelleListe = await supprimerRubrique(cahierId, rubriques, rubriqueId);
      setRubriques(nouvelleListe);
      setCahier(prev => prev ? { ...prev, rubriques: nouvelleListe } : prev);
    } catch (err) {
      console.error('[CahierDetailPage] Erreur suppression rubrique :', err);
      alert('Erreur lors de la suppression.');
    }
  };

  // ── Export PDF (modale choix période) ──────────────────────
  const handleExportPDF = useCallback(() => {
    setShowPdfModal(true);
  }, []);

  const handleConfirmExportPDF = useCallback(async (periode: PeriodeExport, moisKey?: string) => {
    if (!cahier) return;
    setPdfExporting(true);
    setShowPdfModal(false);
    try {
      const entreesFiltrees = filtrerEntreesParPeriode(entrees, periode, moisKey);
      const now = new Date();
      let periodeLabel = '';
      if (periode === 'tout') periodeLabel = 'Tout le cahier';
      else if (periode === 'mois' && moisKey) {
        const [annee, mois] = moisKey.split('-').map(Number);
        periodeLabel = new Date(annee, mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (periode === 'trimestre') {
        const t = Math.floor(now.getMonth() / 3) + 1;
        periodeLabel = `Trimestre ${t} ${now.getFullYear()}`;
      } else if (periode === 'semestre') {
        const s = now.getMonth() < 6 ? 1 : 2;
        periodeLabel = `Semestre ${s} ${now.getFullYear()}`;
      }
      const filename = `Cahier_${cahier.titre.replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}`;
      await exportCahierPDF(cahier, entreesFiltrees, filename, periodeLabel);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'export PDF.');
    } finally {
      setPdfExporting(false);
    }
  }, [cahier, entrees]);

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

  // Phase 31 — Le nombre de séances globales est le cumul des séances par rubrique
  // (si des rubriques ont un nombreSeancesPrevu défini, on utilise la somme ; sinon on utilise cahier.nombreSeancesPrevu)
  const seancesPrevuesCumul = (() => {
    const rubriquesAvecPrevu = (cahier.rubriques ?? []).filter(r => r.nombreSeancesPrevu != null && r.nombreSeancesPrevu > 0);
    if (rubriquesAvecPrevu.length > 0) {
      return rubriquesAvecPrevu.reduce((sum, r) => sum + (r.nombreSeancesPrevu ?? 0), 0);
    }
    return cahier.nombreSeancesPrevu;
  })();

  const progressionPct = seancesPrevuesCumul > 0
    ? Math.round((entrees.filter(e => e.statut === 'realise').length / seancesPrevuesCumul) * 100)
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
              {entrees.filter(e => e.statut === 'realise').length} / {seancesPrevuesCumul} séances ({progressionPct}%)
              {seancesPrevuesCumul !== cahier.nombreSeancesPrevu && (
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 4 }}>(cumul rubriques)</span>
              )}
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
          {showPdfModal && cahier && (
            <div className="cahier-pdf-modal-overlay" onClick={() => setShowPdfModal(false)}>
              <div className="cahier-pdf-modal" onClick={e => e.stopPropagation()}>
                <h3>📄 Télécharger le cahier en PDF</h3>
                <p className="cahier-pdf-modal-desc">Choisissez la période à exporter :</p>
                <div className="cahier-pdf-modal-options">
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('tout')}>
                    <span className="cahier-pdf-option-icon">📚</span>
                    <span className="cahier-pdf-option-label">Tout le cahier</span>
                    <span className="cahier-pdf-option-count">{entrees.length} séance{entrees.length !== 1 ? 's' : ''}</span>
                  </button>
                  {moisDisponibles.length > 0 && moisDisponibles.map(mois => (
                    <button key={mois} className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('mois', mois)}>
                      <span className="cahier-pdf-option-icon">📅</span>
                      <span className="cahier-pdf-option-label">{formatMoisLabel(mois)}</span>
                      <span className="cahier-pdf-option-count">{countParMois.get(mois) || 0} séance{(countParMois.get(mois) || 0) !== 1 ? 's' : ''}</span>
                    </button>
                  ))}
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('trimestre')}>
                    <span className="cahier-pdf-option-icon">📆</span>
                    <span className="cahier-pdf-option-label">Trimestre en cours</span>
                  </button>
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('semestre')}>
                    <span className="cahier-pdf-option-icon">📆</span>
                    <span className="cahier-pdf-option-label">Semestre en cours</span>
                  </button>
                </div>
                <div className="cahier-pdf-modal-footer">
                  <button className="btn-secondary" onClick={() => setShowPdfModal(false)}>Annuler</button>
                </div>
              </div>
            </div>
          )}
          <button
            className="btn-primary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
          >
            + Nouvelle séance
          </button>
        </div>
      </div>

      {/* ── Phase 29 : Widget progression + Rubriques ── */}
      <div className="cahier-phase29-section no-print">
        <CahierProgressionWidget
          entrees={entrees}
          rubriques={rubriques}
          titre="Progression du cahier"
        />

        <section className="cahier-rubriques-section" aria-label="Gestion des rubriques">
          <div className="cahier-rubriques-header">
            <h3 className="cahier-rubriques-titre">
              📂 Rubriques
              <span className="cahier-rubriques-count">{rubriques.length}</span>
            </h3>
            <button
              className="cahier-btn-add-rubrique"
              onClick={ouvrirAjoutRubrique}
              title="Ajouter une rubrique"
            >
              + Ajouter
            </button>
          </div>

          {rubriques.length === 0 ? (
            <p className="cahier-rubriques-empty">
              Aucune rubrique définie. Créez des rubriques pour organiser et
              suivre la progression de vos séances.
            </p>
          ) : (
            <div className="cahier-rubriques-list">
              <div className="cahier-rubriques-list-header">
                <span className="cahier-rubriques-col-nom">Module</span>
                <span className="cahier-rubriques-col-seances">Séances prévues</span>
                <span className="cahier-rubriques-col-actions" />
              </div>
              {rubriques.map(r => (
                <div key={r.id} className="cahier-rubrique-item">
                  <span
                    className="cahier-rubrique-badge"
                    style={{
                      backgroundColor: (r.couleur ?? '#64748b') + '1a',
                      borderColor: r.couleur ?? '#64748b',
                      color: r.couleur ?? '#64748b',
                    }}
                  >
                    {r.nom}
                  </span>
                  <span className="cahier-rubrique-seances-prevu">
                    {r.nombreSeancesPrevu != null && r.nombreSeancesPrevu > 0
                      ? `${r.nombreSeancesPrevu} séance${r.nombreSeancesPrevu > 1 ? 's' : ''}`
                      : '—'}
                  </span>
                  <div className="cahier-rubrique-actions">
                    <button
                      className="cahier-rubrique-btn-edit"
                      onClick={() => ouvrirEditionRubrique(r)}
                      title="Modifier"
                      aria-label={`Modifier la rubrique "${r.nom}"`}
                    >
                      ✏️
                    </button>
                    <button
                      className="cahier-rubrique-btn-delete"
                      onClick={() => handleSupprimerRubrique(r.id, r.nom)}
                      title="Supprimer"
                      aria-label={`Supprimer la rubrique "${r.nom}"`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {afficherFormRubrique && (
            <div className="cahier-rubrique-form-wrapper">
              <h4 className="cahier-rubrique-form-titre">
                {rubriqueEnEdition ? 'Modifier la rubrique' : 'Nouvelle rubrique'}
              </h4>
              <div className="cahier-rubrique-form-field">
                <label htmlFor="rubrique-nom" className="cahier-rubrique-form-label">Nom *</label>
                <input
                  id="rubrique-nom"
                  type="text"
                  className="cahier-rubrique-form-input"
                  placeholder="Ex : Chapitre 1 – Les vecteurs"
                  value={formRubriqueNom}
                  onChange={e => setFormRubriqueNom(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="cahier-rubrique-form-field cahier-rubrique-form-row">
                <div className="cahier-rubrique-form-field">
                  <label htmlFor="rubrique-seances" className="cahier-rubrique-form-label">
                    Séances prévues pour ce module
                  </label>
                  <input
                    id="rubrique-seances"
                    type="number"
                    min={0}
                    max={200}
                    className="cahier-rubrique-form-input cahier-rubrique-form-input-narrow"
                    placeholder="Ex : 8"
                    value={formRubriqueSeancesPrevu === '' ? '' : formRubriqueSeancesPrevu}
                    onChange={e => {
                      const v = e.target.value;
                      setFormRubriqueSeancesPrevu(v === '' ? '' : Math.max(0, parseInt(v, 10) || 0));
                    }}
                  />
                  <span className="cahier-rubrique-form-hint">Optionnel — le pourcentage sera calculé par rapport à ce nombre</span>
                </div>
              </div>
              <div className="cahier-rubrique-form-field">
                <label className="cahier-rubrique-form-label">Couleur</label>
                <div className="cahier-couleur-swatches">
                  {COULEURS_RUBRIQUES.map(couleur => (
                    <button
                      key={couleur}
                      type="button"
                      className={`cahier-couleur-swatch${formRubriqueCouleur === couleur ? ' swatch-selected' : ''}`}
                      style={{ backgroundColor: couleur }}
                      onClick={() => setFormRubriqueCouleur(couleur)}
                      aria-label={`Couleur ${couleur}`}
                      title={couleur}
                    />
                  ))}
                </div>
                <span
                  className="cahier-couleur-apercu"
                  style={{
                    backgroundColor: formRubriqueCouleur + '1a',
                    borderColor: formRubriqueCouleur,
                    color: formRubriqueCouleur,
                  }}
                >
                  {formRubriqueNom || 'Aperçu'}
                </span>
              </div>
              {errorRubrique && (
                <p className="cahier-rubrique-error" role="alert">{errorRubrique}</p>
              )}
              <div className="cahier-rubrique-form-actions">
                <button
                  className="cahier-btn-save"
                  onClick={handleSauvegarderRubrique}
                  disabled={savingRubrique}
                >
                  {savingRubrique ? 'Enregistrement…' : rubriqueEnEdition ? 'Modifier' : 'Ajouter'}
                </button>
                <button
                  className="cahier-btn-cancel"
                  onClick={fermerFormRubrique}
                  disabled={savingRubrique}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
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
            ) : (() => {
              // Phase 31 — Groupement par jour : toujours construire la map,
              // puis activer le mode groupé dès qu'un jour contient 2+ séances
              // (ou si seancesParJour est explicitement > 1).
              const map = new Map<string, { entree: EntreeCahier; globalIdx: number }[]>();
              entreesFiltrees.forEach((entree, idx) => {
                const d = entree.date.toDate();
                const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!map.has(cle)) map.set(cle, []);
                map.get(cle)!.push({ entree, globalIdx: idx });
              });

              const groupesParJour: { cleJour: string; labelJour: string; entrees: { entree: EntreeCahier; globalIdx: number }[] }[] = [];
              map.forEach((items, cleJour) => {
                const d = items[0].entree.date.toDate();
                const labelJour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                groupesParJour.push({ cleJour, labelJour, entrees: items });
              });

              // Activer le groupement si le cahier le demande OU si au moins un jour a 2+ entrées
              const seancesParJourSetting = cahier.seancesParJour ?? 1;
              const auMoinsUnJourMultiple = groupesParJour.some(g => g.entrees.length > 1);
              const doitGrouper = seancesParJourSetting > 1 || auMoinsUnJourMultiple;

              const toggleJour = (cle: string) => {
                setJoursReplies(prev => {
                  const next = new Set(prev);
                  if (next.has(cle)) next.delete(cle); else next.add(cle);
                  return next;
                });
              };

              // Rendu d'une carte d'entrée (réutilisé dans les deux modes)
              const renderEntreeCard = (entree: EntreeCahier, idx: number, showDate: boolean) => {
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
                    <div className="entree-num">
                      <span style={{ background: typeCfg.color }}>
                        {sortDirection === 'asc' ? idx + 1 : entreesFiltrees.length - idx}
                      </span>
                    </div>

                    <div className="entree-card-inner">
                      <div className="entree-card-top">
                        <div className="entree-card-gauche">
                          {showDate && (
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
                          )}
                          {!showDate && entree.heureDebut && (
                            <div className="entree-date" style={{ fontSize: '0.78rem' }}>
                              🕐 {entree.heureDebut}{entree.heureFin ? ` → ${entree.heureFin}` : ''}
                            </div>
                          )}
                          <h3 className="entree-chapitre">{entree.chapitre}</h3>
                          <div className="entree-badges">
                            <span className="entree-type-badge" style={{ background: typeCfg.color }}>
                              {typeCfg.emoji} {typeCfg.label}
                            </span>
                            <span className="entree-statut-badge" style={{ background: statutCfg.bg, color: statutCfg.color }}>
                              {statutCfg.label}
                            </span>
                            {(() => {
                              const rid = resoudreRubriqueIdPourEntree(entree, rubriques);
                              const r = rid ? rubriques.find(x => x.id === rid) : null;
                              if (r) {
                                return (
                                  <span
                                    className="entree-card-rubrique-badge"
                                    style={{
                                      backgroundColor: (r.couleur ?? '#64748b') + '1a',
                                      borderColor: r.couleur ?? '#64748b',
                                      color: r.couleur ?? '#64748b',
                                    }}
                                  >
                                    {r.nom}
                                  </span>
                                );
                              }
                              if (entree.rubrique?.trim()) {
                                return <span className="entree-rubrique-badge">{entree.rubrique}</span>;
                              }
                              return null;
                            })()}
                            {entree.isMarqueEvaluation && (
                              <span className="signet-badge">📌 Évaluation</span>
                            )}
                            {entree.piecesJointes && entree.piecesJointes.length > 0 && (
                              <span className="badge-pj">📎 {entree.piecesJointes.length}</span>
                            )}
                          </div>
                        </div>
                        <div className="entree-actions no-print">
                          <button className="btn-icon" onClick={e => { e.stopPropagation(); navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`); }} title="Modifier">✏️</button>
                          <button className="btn-icon btn-icon--danger" onClick={e => { e.stopPropagation(); handleDeleteEntree(entree); }} title="Supprimer">🗑️</button>
                        </div>
                      </div>
                      {entree.contenu && (
                        <div className="entree-contenu-preview" dangerouslySetInnerHTML={{ __html: entree.contenu }} />
                      )}
                      {entree.objectifs && (
                        <div className="entree-objectifs">🎯 <em>{entree.objectifs}</em></div>
                      )}
                      <div className="entree-card-footer no-print">
                        <div className="entree-statuts-rapides">
                          {(['realise', 'planifie', 'annule'] as StatutSeance[]).map(s => {
                            const cfg = STATUT_CONFIG[s];
                            const isActive = entree.statut === s;
                            return (
                              <button
                                key={s}
                                className={`statut-quick-btn ${isActive ? 'active' : ''}`}
                                style={isActive ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color } : {}}
                                onClick={e => { e.stopPropagation(); handleStatutChange(entree, s); }}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        {entree.notesPrivees && (
                          <span className="entree-has-notes" title="Contient des notes privées">🔒 Notes privées</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return doitGrouper ? (
                <div className="entrees-list">
                  {groupesParJour.map(groupe => {
                    const nbSeances = groupe.entrees.length;

                    // Jour avec une seule séance → rendu normal (pas de header réductible)
                    if (nbSeances === 1) {
                      const { entree, globalIdx } = groupe.entrees[0];
                      return <React.Fragment key={groupe.cleJour}>{renderEntreeCard(entree, globalIdx, true)}</React.Fragment>;
                    }

                    // Jour avec 2+ séances → header réductible
                    const estReplie = joursReplies.has(groupe.cleJour);
                    return (
                      <div key={groupe.cleJour} className="entrees-jour-groupe" style={{ marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          className="entrees-jour-header"
                          onClick={() => toggleJour(groupe.cleJour)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.6rem 1rem',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: estReplie ? '8px' : '8px 8px 0 0',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: '#1e293b',
                            textAlign: 'left',
                          }}
                          aria-expanded={!estReplie}
                        >
                          <span style={{
                            display: 'inline-block',
                            transition: 'transform 0.2s',
                            transform: estReplie ? 'rotate(-90deg)' : 'rotate(0)',
                            fontSize: '0.85rem',
                          }}>
                            ▾
                          </span>
                          <span>📅 {groupe.labelJour}</span>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#6b7280',
                            background: '#e2e8f0',
                            padding: '2px 8px',
                            borderRadius: 9999,
                          }}>
                            {nbSeances} séances
                          </span>
                        </button>
                        {!estReplie && (
                          <div style={{ borderLeft: '2px solid #cbd5e1', marginLeft: '0.75rem', paddingLeft: '0.75rem', paddingTop: '0.25rem' }}>
                            {groupe.entrees.map(({ entree, globalIdx }) =>
                              renderEntreeCard(entree, globalIdx, false)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="entrees-list">
                  {entreesFiltrees.map((entree, idx) => renderEntreeCard(entree, idx, true))}
                </div>
              );
            })()}
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
