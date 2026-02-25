// ============================================================
// PedaClic — Phase 24 : ProfCoursPage.tsx — Mes cours (prof)
// Route : /prof/cours
// Accès : Professeurs uniquement
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoursProf,
  deleteCours,
  archiverCours,
  publierCours,
} from '../services/coursService';
import { getProgressionsCours, calculerStatsProgression } from '../services/progressionCoursService';
import type { CoursEnLigne } from '../cours_types';
import { CONFIG_STATUT_COURS, NIVEAUX_COURS } from '../cours_types';
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
          {cours.statut === 'brouillon' && (
            <button
              className="btn-icon btn-icon--success"
              onClick={onPublier}
              title="Publier"
              aria-label={`Publier ${cours.titre}`}
            >🚀</button>
          )}
          {cours.statut === 'publie' && (
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

        {/* Tags matière / niveau */}
        <div className="prof-cours-card__meta">
          <span className="badge badge--matiere">{cours.matiere}</span>
          <span className="badge badge--niveau">{niveauLabel}</span>
          {cours.classe && <span className="badge badge--classe">{cours.classe}</span>}
        </div>
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

  // ── État ──────────────────────────────────────────────────
  const [cours, setCours] = useState<CoursEnLigne[]>([]);
  const [coursFiltres, setCoursFiltres] = useState<CoursEnLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [coursStats, setCoursStats] = useState<CoursEnLigne | null>(null);

  // ── Chargement ────────────────────────────────────────────
  useEffect(() => {
    if (user) charger();
  }, [user]);

  async function charger() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCoursProf(user.uid);
      setCours(data);
      setCoursFiltres(data);
    } catch (err) {
      setError('Impossible de charger vos cours.');
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
    if (!confirm('Publier ce cours dans le catalogue ?')) return;
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
    if (!confirm('Archiver ce cours ? Il ne sera plus visible dans le catalogue.')) return;
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
    if (!confirm(`Supprimer définitivement le cours "${titreCours}" et tout son contenu ? Cette action est irréversible.`)) return;
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
            Créez, gérez et publiez vos cours pour vos élèves.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/prof/cours/nouveau')}
        >
          ✨ Créer un cours
        </button>
      </header>

      {/* Banners */}
      {error   && <div className="error-banner"   role="alert">⚠️ {error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}

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
              {cours.filter(c => c.statut === 'publie').length}
            </span>
            <span>Publiés</span>
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
            { val: 'publie',    label: `Publiés (${cours.filter(c => c.statut === 'publie').length})` },
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
        {!loading && coursFiltres.length === 0 && (
          <div className="prof-cours-page__vide" role="status">
            <span aria-hidden="true">📭</span>
            <h3>
              {cours.length === 0
                ? 'Vous n\'avez pas encore créé de cours.'
                : 'Aucun cours dans cette catégorie.'}
            </h3>
            {cours.length === 0 && (
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
