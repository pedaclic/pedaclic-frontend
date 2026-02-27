// ============================================================
// PedaClic — Phase 23 : Page liste — Séquences Pédagogiques
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Point d'entrée : /prof/sequences
// Affiche la liste des séquences du prof avec filtres, stats,
// et boutons d'action (créer, dupliquer, supprimer).
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate }                              from 'react-router-dom';
import { useAuth }                                  from '../hooks/useAuth'; // Adapter selon votre config
import {
  getSequencesProf,
  deleteSequence,
  dupliquerSequence,
  filtrerSequences,
} from '../services/sequencePedagogiqueService';
import type {
  SequencePedagogique,
  SequenceFilters,
  StatutSequence,
} from '../types/sequencePedagogique.types';
import {
  LABELS_TYPE_ACTIVITE,
  CONFIG_STATUT,
  MATIERES_SENEGAL,
  NIVEAUX_SCOLAIRES,
} from '../types/sequencePedagogique.types';
import '../styles/SequencesPedagogiques.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Badge de statut
// ─────────────────────────────────────────────────────────────

interface StatutBadgeProps {
  statut: StatutSequence;
}

const StatutBadge: React.FC<StatutBadgeProps> = ({ statut }) => {
  const { label } = CONFIG_STATUT[statut];
  return (
    <span className={`statut-badge statut-badge--${statut}`}>
      {/* Pastille colorée */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Carte séquence
// ─────────────────────────────────────────────────────────────

interface SequenceCardProps {
  sequence:    SequencePedagogique;
  onView:      () => void;
  onEdit:      () => void;
  onDuplicate: () => void;
  onDelete:    () => void;
}

const SequenceCard: React.FC<SequenceCardProps> = ({
  sequence,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  // Compter les séances par type
  const nbEvaluations = sequence.seances.filter((s) => s.estEvaluation).length;

  return (
    <article className="sequence-card" onClick={onView} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onView()}>

      {/* ── Badges statut + IA ── */}
      <div className="sequence-card__badges">
        <StatutBadge statut={sequence.statut} />
        {sequence.genereeParIA && (
          <span className="badge-ia">✨ IA</span>
        )}
      </div>

      {/* ── Titre ── */}
      <h3 className="sequence-card__title">{sequence.titre}</h3>

      {/* ── Meta-infos ── */}
      <div className="sequence-card__meta">
        <span className="sequence-card__meta-chip">{sequence.matiere}</span>
        <span className="sequence-card__meta-chip sequence-card__meta-chip--grey">
          {NIVEAUX_SCOLAIRES.find((n) => n.valeur === sequence.niveau)?.label ?? sequence.niveau}
        </span>
        {sequence.trimestre && (
          <span className="sequence-card__meta-chip sequence-card__meta-chip--grey">
            T{sequence.trimestre}
          </span>
        )}
      </div>

      {/* ── Description courte ── */}
      {sequence.description && (
        <p className="sequence-card__desc">{sequence.description}</p>
      )}

      {/* ── Pied de carte ── */}
      <div className="sequence-card__footer">
        <span className="sequence-card__seances-count">
          📋 {sequence.seances.length} séance{sequence.seances.length > 1 ? 's' : ''}
          {nbEvaluations > 0 && ` · 📝 ${nbEvaluations} éval.`}
        </span>
        {sequence.groupeClasseNom && (
          <span className="sequence-card__groupe">
            👥 {sequence.groupeClasseNom}
          </span>
        )}
      </div>

      {/* ── Actions (stopPropagation pour ne pas déclencher onView) ── */}
      <div className="sequence-card__actions" onClick={(e) => e.stopPropagation()}>
        {/* Modifier */}
        <button
          className="sequence-card__action-btn"
          onClick={onEdit}
          title="Modifier"
          aria-label="Modifier la séquence"
        >✏️</button>

        {/* Dupliquer */}
        <button
          className="sequence-card__action-btn"
          onClick={onDuplicate}
          title="Dupliquer"
          aria-label="Dupliquer la séquence"
        >📋</button>

        {/* Supprimer */}
        <button
          className="sequence-card__action-btn sequence-card__action-btn--danger"
          onClick={onDelete}
          title="Supprimer"
          aria-label="Supprimer la séquence"
        >🗑️</button>
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : SequencesPage
// ─────────────────────────────────────────────────────────────

const SequencesPage: React.FC = () => {
  const navigate            = useNavigate();
  const { currentUser }     = useAuth();

  // ── État des données ────────────────────────────────────────
  const [sequences,     setSequences]     = useState<SequencePedagogique[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // ID en cours d'action

  // ── Filtres ─────────────────────────────────────────────────
  const [filtres, setFiltres] = useState<SequenceFilters>({
    matiere:   '',
    niveau:    '',
    statut:    '',
    recherche: '',
  });

  // ── Chargement initial ──────────────────────────────────────
  const chargerSequences = useCallback(async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSequencesProf(currentUser.uid);
      setSequences(data);
    } catch (err) {
      console.error('[SequencesPage] Chargement:', err);
      setError('Impossible de charger vos séquences. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    chargerSequences();
  }, [chargerSequences]);

  // ── Gate Premium (les admins sont toujours exemptés) ────────
  if (!currentUser?.isPremium && currentUser?.role !== 'admin') {
    return (
      <div className="premium-gate">
        <span className="premium-gate__icon">🔒</span>
        <h2 className="premium-gate__title">Fonctionnalité Premium</h2>
        <p className="premium-gate__text">
          Le Générateur de Séquences Pédagogiques est réservé aux enseignants Premium.
          Passez à Premium pour créer des séquences structurées et les exporter vers
          votre Cahier de Textes.
        </p>
        <button className="btn-primary" onClick={() => navigate('/prof/premium')}>
          🌟 Passer à Premium — 2 000 FCFA/mois
        </button>
      </div>
    );
  }

  // ── Séquences filtrées ──────────────────────────────────────
  const sequencesFiltrees = filtrerSequences(sequences, filtres);

  // Matières distinctes présentes (pour les filtres)
  const matieresPresentees = [...new Set(sequences.map((s) => s.matiere))].sort();

  // ── Handlers ────────────────────────────────────────────────

  /** Supprime une séquence après confirmation */
  const handleDelete = async (seq: SequencePedagogique) => {
    const confirme = window.confirm(
      `Supprimer la séquence "${seq.titre}" ?\n\nCette action est irréversible.`
    );
    if (!confirme) return;

    setActionLoading(seq.id);
    try {
      await deleteSequence(seq.id);
      setSequences((prev) => prev.filter((s) => s.id !== seq.id));
    } catch (err) {
      console.error('[SequencesPage] Suppression:', err);
      setError('Erreur lors de la suppression. Réessayez.');
    } finally {
      setActionLoading(null);
    }
  };

  /** Duplique une séquence */
  const handleDuplicate = async (seq: SequencePedagogique) => {
    if (!currentUser?.uid) return;
    setActionLoading(seq.id);
    try {
      const newId = await dupliquerSequence(seq.id, currentUser.uid);
      // Rediriger vers l'éditeur du duplicata
      navigate(`/prof/sequences/${newId}/modifier`);
    } catch (err) {
      console.error('[SequencesPage] Duplication:', err);
      setError('Erreur lors de la duplication. Réessayez.');
      setActionLoading(null);
    }
  };

  // ── Statistiques rapides ────────────────────────────────────
  const stats = {
    total:    sequences.length,
    active:   sequences.filter((s) => s.statut === 'active').length,
    terminee: sequences.filter((s) => s.statut === 'terminee').length,
    ia:       sequences.filter((s) => s.genereeParIA).length,
  };

  // ────────────────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────────────────
  return (
    <div className="sequences-page">

      {/* ── En-tête ── */}
      <div className="sequences-page__header">
        <div>
          <h1 className="sequences-page__title">📚 Séquences Pédagogiques</h1>
          <p className="sequences-page__subtitle">
            {stats.total} séquence{stats.total > 1 ? 's' : ''}
            {stats.active > 0 && ` · ${stats.active} en cours`}
            {stats.ia > 0 && ` · ${stats.ia} assistée${stats.ia > 1 ? 's' : ''} par IA`}
          </p>
        </div>
        <button
          className="sequences-page__btn-new"
          onClick={() => navigate('/prof/sequences/nouvelle')}
        >
          + Nouvelle séquence
        </button>
      </div>

      {/* ── Message d'erreur ── */}
      {error && (
        <div className="error-banner" role="alert">
          ⚠️ {error}
          <button
            onClick={chargerSequences}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="sequences-filters" role="search">

        {/* Recherche textuelle */}
        <input
          type="search"
          className="sequences-filters__search"
          placeholder="🔍 Rechercher une séquence..."
          value={filtres.recherche ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, recherche: e.target.value }))}
          aria-label="Rechercher une séquence"
        />

        {/* Filtre matière */}
        <select
          className="sequences-filters__select"
          value={filtres.matiere ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, matiere: e.target.value }))}
          aria-label="Filtrer par matière"
        >
          <option value="">Toutes les matières</option>
          {matieresPresentees.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Filtre niveau */}
        <select
          className="sequences-filters__select"
          value={filtres.niveau ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, niveau: e.target.value }))}
          aria-label="Filtrer par niveau"
        >
          <option value="">Tous les niveaux</option>
          {NIVEAUX_SCOLAIRES.map((n) => (
            <option key={n.valeur} value={n.valeur}>{n.label}</option>
          ))}
        </select>

        {/* Filtre statut */}
        <select
          className="sequences-filters__select"
          value={filtres.statut ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, statut: e.target.value as StatutSequence | '' }))}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(CONFIG_STATUT).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* ── Grille des séquences ── */}
      {loading ? (
        /* Skeleton loading */
        <div className="sequences-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sequence-card" style={{ minHeight: 180 }}>
              <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 22, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="sequences-grid" role="list">
          {sequencesFiltrees.length === 0 ? (
            /* État vide */
            <div className="sequences-empty">
              <span className="sequences-empty__icon">📋</span>
              <p className="sequences-empty__text">
                {sequences.length === 0
                  ? 'Aucune séquence pour l\'instant'
                  : 'Aucune séquence ne correspond à vos filtres'}
              </p>
              <p className="sequences-empty__hint">
                {sequences.length === 0
                  ? 'Cliquez sur "+ Nouvelle séquence" pour commencer'
                  : 'Modifiez ou effacez les filtres pour voir plus de résultats'}
              </p>
            </div>
          ) : (
            sequencesFiltrees.map((seq) => (
              <div key={seq.id} role="listitem" style={{ opacity: actionLoading === seq.id ? 0.6 : 1 }}>
                <SequenceCard
                  sequence={seq}
                  onView={() => navigate(`/prof/sequences/${seq.id}`)}
                  onEdit={() => navigate(`/prof/sequences/${seq.id}/modifier`)}
                  onDuplicate={() => handleDuplicate(seq)}
                  onDelete={() => handleDelete(seq)}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SequencesPage;
