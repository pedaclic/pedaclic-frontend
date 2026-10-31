// ============================================================
// PedaClic — Phase 24 : ProfCoursPage.tsx — Mes cours (prof)
// Route : /prof/cours
// Accès : Professeurs uniquement
// Phase 43 : onglets « Catalogue PedaClic » (lecture des cours publiés)
//            et « Mes cours » (conception réservée aux profs Premium,
//            partage avec leurs classes). Vue admin inchangée.
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoursProf,
  getAllCours,
  deleteCours,
  archiverCours,
  publierCours,
  getCoursPublies,
} from '../services/coursService';
// Phase 43 — carte du catalogue réutilisée pour l'onglet « Catalogue »
import { CoursCatalogCard } from './CoursPage';
import { getProgressionsCours, calculerStatsProgression } from '../services/progressionCoursService';
import type { CoursEnLigne } from '../types/cours_types';
import { CONFIG_STATUT_COURS, NIVEAUX_COURS, estCoursProf } from '../types/cours_types';
import { NIVEAUX_LABELS } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import '../styles/CoursEnLigne.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Carte cours dans le dashboard prof
// ─────────────────────────────────────────────────────────────

interface ProfCoursCardProps {
  cours: CoursEnLigne;
  onModifier: () => void;
  onPublier: () => void;
  onArchiver: () => void;
  onSupprimer: () => void;
  onVoirStats: () => void;
}

function ProfCoursCard({
  cours, onModifier, onPublier, onArchiver, onSupprimer, onVoirStats,
}: ProfCoursCardProps) {
  const statutConfig = CONFIG_STATUT_COURS[cours.statut];
  const niveauLabel = NIVEAUX_COURS.find(n => n.valeur === cours.niveau)?.label ?? cours.niveau;

  return (
    <article className="prof-cours-card">
      {/* En-tête : titre + statut */}
      <div className="prof-cours-card__header">
        <div className="prof-cours-card__header-left">
          {/* Badge statut */}
          <span
            className="prof-cours-card__statut"
            style={{ color: statutConfig.couleur, background: statutConfig.bg }}
          >
            {statutConfig.label}
          </span>
          {cours.isPremium && (
            <span className="badge badge--premium">⭐ Premium</span>
          )}
        </div>
        {/* Menu actions */}
        <div className="prof-cours-card__actions">
          <button
            className="btn-icon"
            onClick={onModifier}
            title="Modifier"
            aria-label={`Modifier ${cours.titre}`}
          >✏️</button>
          {cours.statut === 'brouillon' && !estCoursProf(cours) && (
            <button
              className="btn-icon btn-icon--success"
              onClick={onPublier}
              title="Publier"
              aria-label={`Publier ${cours.titre}`}
            >🚀</button>
          )}
          {cours.statut === 'publie' && !estCoursProf(cours) && (
            <button
              className="btn-icon"
              onClick={onArchiver}
              title="Archiver"
              aria-label={`Archiver ${cours.titre}`}
            >📦</button>
          )}
          <button
            className="btn-icon btn-icon--info"
            onClick={onVoirStats}
            title="Voir les statistiques"
            aria-label={`Statistiques de ${cours.titre}`}
          >📊</button>
          <button
            className="btn-icon btn-icon--danger"
            onClick={onSupprimer}
            title="Supprimer"
            aria-label={`Supprimer ${cours.titre}`}
          >🗑</button>
        </div>
      </div>

      {/* Corps */}
      <div className="prof-cours-card__body">
        <h3 className="prof-cours-card__titre">{cours.titre}</h3>
        <p className="prof-cours-card__description">{cours.description}</p>

        {/* Tags matière / niveau / cycle */}
        <div className="prof-cours-card__meta">
          <span className="badge badge--matiere">{cours.matiere}</span>
          {cours.niveauScolaire && (
            <span className="badge badge--cycle">
              {NIVEAUX_LABELS[cours.niveauScolaire] ?? cours.niveauScolaire}
            </span>
          )}
          <span className="badge badge--niveau">{niveauLabel}</span>
          {cours.serie && <span className="badge badge--serie">{cours.serie}</span>}
          {cours.classe && <span className="badge badge--classe">{cours.classe}</span>}
        </div>

        {/* Phase 43 — classes destinataires d'un cours de prof */}
        {estCoursProf(cours) && (
          <p className="prof-cours-card__classes">
            {cours.statut === 'partage' && (cours.groupeNoms?.length ?? 0) > 0
              ? <>👥 Partagé avec : {cours.groupeNoms!.join(', ')}</>
              : <>⚪ Non partagé — ouvrez le cours pour choisir vos classes</>}
          </p>
        )}
      </div>

      {/* Pied : statistiques rapides */}
      <div className="prof-cours-card__footer">
        <span title="Sections">📋 {cours.nombreSections} section{cours.nombreSections > 1 ? 's' : ''}</span>
        <span title="Durée estimée">⏱ {cours.dureeEstimee} min</span>
        <span title="Élèves inscrits">👥 {cours.nombreInscrits} élève{cours.nombreInscrits > 1 ? 's' : ''}</span>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Modal statistiques d'un cours
// ─────────────────────────────────────────────────────────────

interface StatsModalProps {
  cours: CoursEnLigne;
  onClose: () => void;
}

function StatsModal({ cours, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<ReturnType<typeof calculerStatsProgression> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerStats();
  }, [cours.id]);

  async function chargerStats() {
    try {
      const progressions = await getProgressionsCours(cours.id);
      setStats(calculerStatsProgression(progressions));
    } catch (err) {
      console.error('[StatsModal] Erreur :', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Overlay de la modale */
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Statistiques du cours : ${cours.titre}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>📊 Statistiques — {cours.titre}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="spinner spinner--blue" />
              <p>Chargement des statistiques...</p>
            </div>
          ) : stats ? (
            <div className="stats-grid">
              {/* Stat : inscrits */}
              <div className="stats-card">
                <span className="stats-card__val">{stats.nombreInscrits}</span>
                <span className="stats-card__label">Élèves inscrits</span>
              </div>
              {/* Stat : terminés */}
              <div className="stats-card stats-card--success">
                <span className="stats-card__val">{stats.nombreTermines}</span>
                <span className="stats-card__label">Cours terminés</span>
              </div>
              {/* Stat : taux completion */}
              <div className="stats-card stats-card--info">
                <span className="stats-card__val">{stats.tauxCompletion}%</span>
                <span className="stats-card__label">Taux de complétion</span>
              </div>
              {/* Stat : progression moyenne */}
              <div className="stats-card">
                <span className="stats-card__val">{stats.progressionMoyenne}%</span>
                <span className="stats-card__label">Progression moyenne</span>
              </div>
              {/* Stat : score quiz */}
              <div className="stats-card stats-card--primary">
                <span className="stats-card__val">{stats.scoreMoyen}%</span>
                <span className="stats-card__label">Score moyen aux quiz</span>
              </div>

              {/* Barre de progression globale */}
              <div className="stats-progress-bar-wrapper">
                <label>Progression globale des élèves</label>
                <div className="progression-bar">
                  <div
                    className="progression-bar__fill"
                    style={{ width: `${stats.progressionMoyenne}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="modal-vide">Aucune donnée disponible pour ce cours.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Dashboard "Mes cours"
// ─────────────────────────────────────────────────────────────

export default function ProfCoursPage() {
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const { toast } = useToast();
  const confirmDlg = useConfirm();

  // ── État ──────────────────────────────────────────────────
  const [cours, setCours] = useState<CoursEnLigne[]>([]);
  const [coursFiltres, setCoursFiltres] = useState<CoursEnLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [coursStats, setCoursStats] = useState<CoursEnLigne | null>(null);

  // ── Phase 43 — Espace professeur ──────────────────────────
  const estProf = user?.role === 'prof';
  const profPremium = estProf && !!user?.isPremium;
  const peutCreer = user?.role === 'admin' || profPremium;
  const [vue, setVue] = useState<'catalogue' | 'mes-cours'>('catalogue');
  const [catalogue, setCatalogue] = useState<CoursEnLigne[]>([]);
  const [catalogueCharge, setCatalogueCharge] = useState(false);
  const [rechercheCatalogue, setRechercheCatalogue] = useState('');
  const [matiereCatalogue, setMatiereCatalogue] = useState('');

  // Catalogue chargé à la 1ère ouverture de l'onglet (prof uniquement)
  useEffect(() => {
    if (!estProf || vue !== 'catalogue' || catalogueCharge) return;
    getCoursPublies()
      .then(setCatalogue)
      .catch(() => setError('Impossible de charger le catalogue.'))
      .finally(() => setCatalogueCharge(true));
  }, [estProf, vue, catalogueCharge]);

  const matieresCatalogue = Array.from(new Set(catalogue.map(c => c.matiere))).sort((a, b) => a.localeCompare(b, 'fr'));
  const catalogueFiltre = catalogue.filter(c => {
    if (matiereCatalogue && c.matiere !== matiereCatalogue) return false;
    const t = rechercheCatalogue.trim().toLowerCase();
    if (!t) return true;
    return c.titre.toLowerCase().includes(t)
      || c.description.toLowerCase().includes(t)
      || (c.tags ?? []).some(tag => tag.toLowerCase().includes(t));
  });

  // ── Chargement ────────────────────────────────────────────
  useEffect(() => {
    if (user) charger();
  }, [user]);

  async function charger() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = user.role === 'admin'
        ? await getAllCours()
        : await getCoursProf(user.uid);
      setCours(data);
      setCoursFiltres(data);
    } catch (err) {
      setError('Impossible de charger les cours.');
    } finally {
      setLoading(false);
    }
  }

  // ── Filtre par statut ─────────────────────────────────────
  function filtrerParStatut(statut: string) {
    setFiltreStatut(statut);
    setCoursFiltres(statut ? cours.filter(c => c.statut === statut) : cours);
  }

  // ── Actions ───────────────────────────────────────────────

  async function handlePublier(coursId: string) {
    if (!await confirmDlg({ title: 'Publier le cours ?', message: 'Publier ce cours dans le catalogue ?', confirmLabel: 'Publier', variant: 'info' })) return;
    try {
      await publierCours(coursId);
      setCours(prev => prev.map(c => c.id === coursId ? { ...c, statut: 'publie' } : c));
      setCoursFiltres(prev => prev.map(c => c.id === coursId ? { ...c, statut: 'publie' } : c));
      afficherSucces('🚀 Cours publié dans le catalogue !');
    } catch {
      setError('Erreur lors de la publication.');
    }
  }

  async function handleArchiver(coursId: string) {
    if (!await confirmDlg({ title: 'Archiver le cours ?', message: 'Archiver ce cours ? Il ne sera plus visible dans le catalogue.', confirmLabel: 'Archiver', variant: 'warning' })) return;
    try {
      await archiverCours(coursId);
      setCours(prev => prev.map(c => c.id === coursId ? { ...c, statut: 'archive' } : c));
      setCoursFiltres(prev => prev.map(c => c.id === coursId ? { ...c, statut: 'archive' } : c));
      afficherSucces('📦 Cours archivé.');
    } catch {
      setError('Erreur lors de l\'archivage.');
    }
  }

  async function handleSupprimer(coursId: string, titreCours: string) {
    if (!await confirmDlg({ title: 'Supprimer le cours ?', message: `Supprimer définitivement le cours "${titreCours}" et tout son contenu ? Cette action est irréversible.`, confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await deleteCours(coursId);
      const filtered = cours.filter(c => c.id !== coursId);
      setCours(filtered);
      setCoursFiltres(filtered.filter(c => !filtreStatut || c.statut === filtreStatut));
      afficherSucces('✅ Cours supprimé.');
    } catch {
      setError('Erreur lors de la suppression.');
    }
  }

  function afficherSucces(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  return (
    <div className="prof-cours-page">

      {/* ══════════════════════════════════════════════════════
          EN-TÊTE
      ══════════════════════════════════════════════════════ */}
      <header className="prof-cours-page__header">
        <div>
          <h1 className="prof-cours-page__titre">📚 Mes cours en ligne</h1>
          <p className="prof-cours-page__sous-titre">
            {user?.role === 'admin'
              ? 'Gérez tous les cours de la plateforme. Seul l\'admin peut créer des cours.'
              : profPremium
                ? 'Consultez le catalogue PedaClic et concevez vos propres cours pour vos classes.'
                : 'Consultez les cours publiés sur PedaClic.'}
          </p>
        </div>
        {peutCreer && (
          <button
            className="btn-primary"
            onClick={() => navigate('/prof/cours/nouveau')}
          >
            {user?.role === 'admin' ? '✨ Créer un cours' : '✨ Concevoir un cours'}
          </button>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════
          Phase 43 — ONGLETS (professeur uniquement)
      ══════════════════════════════════════════════════════ */}
      {estProf && (
        <div className="prof-cours-onglets" role="tablist" aria-label="Espace cours">
          <button
            role="tab"
            aria-selected={vue === 'catalogue'}
            className={`prof-cours-onglets__btn ${vue === 'catalogue' ? 'is-actif' : ''}`}
            onClick={() => setVue('catalogue')}
          >
            📚 Catalogue PedaClic
          </button>
          <button
            role="tab"
            aria-selected={vue === 'mes-cours'}
            className={`prof-cours-onglets__btn ${vue === 'mes-cours' ? 'is-actif' : ''}`}
            onClick={() => setVue('mes-cours')}
          >
            ✍️ Mes cours {cours.length > 0 && <span className="prof-cours-onglets__badge">{cours.length}</span>}
          </button>
        </div>
      )}

      {/* Banners */}
      {error   && <div className="error-banner"   role="alert">⚠️ {error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}

      {/* ══════════════════════════════════════════════════════
          Phase 43 — ONGLET CATALOGUE (lecture des cours publiés)
      ══════════════════════════════════════════════════════ */}
      {estProf && vue === 'catalogue' && (
        <section className="prof-cours-catalogue" aria-label="Catalogue des cours publiés">
          <div className="prof-cours-catalogue__filtres">
            <input
              type="search"
              className="prof-cours-catalogue__recherche"
              placeholder="🔍 Rechercher un cours, un thème…"
              value={rechercheCatalogue}
              onChange={e => setRechercheCatalogue(e.target.value)}
              aria-label="Rechercher dans le catalogue"
            />
            <select
              className="prof-cours-catalogue__select"
              value={matiereCatalogue}
              onChange={e => setMatiereCatalogue(e.target.value)}
              aria-label="Filtrer par matière"
            >
              <option value="">Toutes les matières</option>
              {matieresCatalogue.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {!profPremium && (
            <p className="prof-cours-catalogue__info">
              ⭐ Avec Premium, lisez l'intégralité des cours et concevez les vôtres pour vos classes.{' '}
              <button className="btn-link" onClick={() => navigate('/premium')}>Découvrir Premium</button>
            </p>
          )}
          {!catalogueCharge ? (
            <div className="cours-catalogue__grille" aria-busy="true">
              {[1, 2, 3].map(i => (
                <div key={i} className="cours-card cours-card--skeleton">
                  <div className="skeleton" style={{ height: 120 }} />
                </div>
              ))}
            </div>
          ) : catalogueFiltre.length === 0 ? (
            <div className="prof-cours-page__vide" role="status">
              <span aria-hidden="true">🔎</span>
              <h3>Aucun cours ne correspond à votre recherche.</h3>
            </div>
          ) : (
            <div className="cours-catalogue__grille">
              {catalogueFiltre.map(c => (
                <CoursCatalogCard key={c.id} cours={c} onClick={() => navigate(`/cours/${c.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          « MES COURS » — vue historique (admin : tous les cours)
          Phase 43 : pour un prof, affichée dans l'onglet « Mes cours »
      ══════════════════════════════════════════════════════ */}
      {(!estProf || vue === 'mes-cours') && (<>

      {/* Phase 43 — prof non Premium : invitation */}
      {estProf && !profPremium && (
        <div className="prof-cours-gate prof-cours-gate--inline" role="status">
          <span className="prof-cours-gate__icone" aria-hidden="true">⭐</span>
          <h2>Concevez vos propres cours avec Premium</h2>
          <p>Créez des cours dans votre matière et partagez-les uniquement avec les élèves de vos classes.</p>
          <div className="prof-cours-gate__actions">
            <button className="btn-primary" onClick={() => navigate('/premium')}>Découvrir Premium</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STATISTIQUES GLOBALES
      ══════════════════════════════════════════════════════ */}
      {!loading && cours.length > 0 && (
        <div className="prof-cours-page__stats" aria-label="Résumé de mes cours">
          <div className="prof-cours-page__stat">
            <span className="prof-cours-page__stat-val">{cours.length}</span>
            <span>Total</span>
          </div>
          <div className="prof-cours-page__stat">
            <span className="prof-cours-page__stat-val" style={{ color: '#16a34a' }}>
              {cours.filter(c => c.statut === (estProf ? 'partage' : 'publie')).length}
            </span>
            <span>{estProf ? 'Partagés' : 'Publiés'}</span>
          </div>
          <div className="prof-cours-page__stat">
            <span className="prof-cours-page__stat-val" style={{ color: '#ca8a04' }}>
              {cours.filter(c => c.statut === 'brouillon').length}
            </span>
            <span>Brouillons</span>
          </div>
          <div className="prof-cours-page__stat">
            <span className="prof-cours-page__stat-val" style={{ color: '#2563eb' }}>
              {cours.reduce((acc, c) => acc + c.nombreInscrits, 0)}
            </span>
            <span>Élèves inscrits</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FILTRES PAR STATUT
      ══════════════════════════════════════════════════════ */}
      {!loading && cours.length > 0 && (
        <div className="prof-cours-page__filtres" role="tablist" aria-label="Filtrer par statut">
          {[
            { val: '',          label: `Tous (${cours.length})` },
            // Phase 43 — le prof « partage » ; l'admin « publie »
            estProf
              ? { val: 'partage', label: `Partagés (${cours.filter(c => c.statut === 'partage').length})` }
              : { val: 'publie',  label: `Publiés (${cours.filter(c => c.statut === 'publie').length})` },
            { val: 'brouillon', label: `Brouillons (${cours.filter(c => c.statut === 'brouillon').length})` },
            { val: 'archive',   label: `Archivés (${cours.filter(c => c.statut === 'archive').length})` },
          ].map(f => (
            <button
              key={f.val}
              className={`prof-cours-page__filtre-btn ${filtreStatut === f.val ? 'prof-cours-page__filtre-btn--active' : ''}`}
              onClick={() => filtrerParStatut(f.val)}
              role="tab"
              aria-selected={filtreStatut === f.val}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          GRILLE DES COURS
      ══════════════════════════════════════════════════════ */}
      <main className="prof-cours-page__grille">

        {/* Skeleton loader */}
        {loading && (
          <div className="prof-cours-page__grille-inner" aria-busy="true">
            {[1, 2, 3].map(i => (
              <div key={i} className="prof-cours-card prof-cours-card--skeleton">
                <div className="skeleton" style={{ height: 20, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '80%' }} />
              </div>
            ))}
          </div>
        )}

        {!loading && coursFiltres.length > 0 && (
          <div className="prof-cours-page__grille-inner">
            {coursFiltres.map(c => (
              <ProfCoursCard
                key={c.id}
                cours={c}
                onModifier={() => navigate(`/prof/cours/${c.id}/modifier`)}
                onPublier={() => handlePublier(c.id)}
                onArchiver={() => handleArchiver(c.id)}
                onSupprimer={() => handleSupprimer(c.id, c.titre)}
                onVoirStats={() => setCoursStats(c)}
              />
            ))}
          </div>
        )}

        {/* État vide */}
        {/* (Phase 43 : masqué pour un prof non Premium — l'invitation suffit) */}
        {!loading && coursFiltres.length === 0 && !(estProf && !profPremium && cours.length === 0) && (
          <div className="prof-cours-page__vide" role="status">
            <span aria-hidden="true">📭</span>
            <h3>
              {cours.length === 0
                ? (user?.role === 'admin'
                    ? 'Aucun cours sur la plateforme.' 
                    : estProf
                      ? 'Vous n\'avez pas encore conçu de cours.'
                      : 'Aucun cours dans cette catégorie.')
                : 'Aucun cours dans cette catégorie.'}
            </h3>
            {cours.length === 0 && peutCreer && (
              <button
                className="btn-primary"
                onClick={() => navigate('/prof/cours/nouveau')}
              >
                ✨ Créer mon premier cours
              </button>
            )}
          </div>
        )}
      </main>

      </>)}

      {/* Modale statistiques */}
      {coursStats && (
        <StatsModal
          cours={coursStats}
          onClose={() => setCoursStats(null)}
        />
      )}
    </div>
  );
}
