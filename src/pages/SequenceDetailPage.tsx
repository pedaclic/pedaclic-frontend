// ============================================================
// PedaClic — Phase 23 : Détail — Séquence Pédagogique
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Route : /prof/sequences/:id
// Affiche la séquence en lecture avec :
//   - Informations générales
//   - Timeline des séances (onglet)
//   - Évaluations prévues (onglet)
//   - Modal d'export vers le Cahier de Textes
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams }      from 'react-router-dom';
import { Timestamp }                   from 'firebase/firestore';
import { useAuth }                     from '../hooks/useAuth';
import {
  getSequenceById,
  deleteSequence,
  updateStatutSequence,
  exporterVersCahier,
}                                      from '../services/sequencePedagogiqueService';
import { getCahiersProf }              from '../services/cahierTextesService';
import type {
  SequencePedagogique,
  SeancePedagogique,
  StatutSequence,
}                                      from '../types/sequencePedagogique.types';
import type { CahierTextes }           from '../types/cahierTextes.types';
import {
  LABELS_TYPE_ACTIVITE,
  LABELS_TYPE_EVALUATION,
  CONFIG_STATUT,
  NIVEAUX_SCOLAIRES,
}                                      from '../types/sequencePedagogique.types';
import Breadcrumbs from '../components/shared/Breadcrumbs';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import '../styles/SequencesPedagogiques.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Badge statut
// ─────────────────────────────────────────────────────────────

const StatutBadge: React.FC<{ statut: StatutSequence }> = ({ statut }) => {
  const { label } = CONFIG_STATUT[statut];
  return (
    <span className={`statut-badge statut-badge--${statut}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Modal d'export vers le Cahier de Textes
// ─────────────────────────────────────────────────────────────

interface ExportModalProps {
  sequence: SequencePedagogique;
  cahiers:  CahierTextes[];
  profId:   string;
  onClose:  () => void;
  onSuccess: (nbExportees: number) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  sequence,
  cahiers,
  profId,
  onClose,
  onSuccess,
}) => {
  // Cahier cible (pré-sélectionné si déjà lié)
  const [cahierId, setCahierId] = useState<string>(
    sequence.cahierDeTextesId ?? (cahiers.length === 1 ? cahiers[0].id : '')
  );

  // Map séanceId → date ISO string (YYYY-MM-DD) choisie par le prof
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const today = new Date().toISOString().split('T')[0];
    const init: Record<string, string> = {};
    sequence.seances.forEach((s) => { init[s.id] = today; });
    return init;
  });

  // Map séanceId → coché pour export
  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    sequence.seances.forEach((s) => {
      // Pré-cocher les séances marquées exporterVersCahier et pas encore exportées
      init[s.id] = s.exporterVersCahier && (!s.entreesCahierIds || s.entreesCahierIds.length === 0);
    });
    return init;
  });

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const nbSelectionnes = Object.values(selection).filter(Boolean).length;

  const handleExport = async () => {
    if (!cahierId) {
      setError('Veuillez sélectionner un Cahier de Textes.');
      return;
    }
    if (nbSelectionnes === 0) {
      setError('Sélectionnez au moins une séance à exporter.');
      return;
    }

    setLoading(true);
    setError(null);

    // Construire la map séanceId → Timestamp
    const datesParSeance: Record<string, Timestamp> = {};
    sequence.seances
      .filter((s) => selection[s.id])
      .forEach((s) => {
        const d = dates[s.id];
        if (d) {
          const ts = Timestamp.fromDate(new Date(d + 'T08:00:00'));
          datesParSeance[s.id] = ts;
        }
      });

    try {
      const resultat = await exporterVersCahier({
        sequenceId:       sequence.id,
        cahierDeTextesId: cahierId,
        profId,
        datesParSeance,
      });

      if (resultat.erreurs.length > 0) {
        setError(`${resultat.erreurs.length} séance(s) n'ont pas pu être exportées.`);
      }

      onSuccess(resultat.nbExportees);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur d'export : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Fermeture clavier ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="export-modal__overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="export-modal" role="dialog" aria-modal="true"
        aria-labelledby="export-modal-title">

        {/* ── En-tête ── */}
        <div className="export-modal__header">
          <h2 className="export-modal__title" id="export-modal-title">
            📤 Exporter vers le Cahier de Textes
          </h2>
          <button className="export-modal__close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* ── Corps ── */}
        <div className="export-modal__body">

          {/* Sélection du cahier */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Cahier de Textes cible <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {cahiers.length === 0 ? (
              <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                Aucun Cahier de Textes trouvé. Créez-en un d'abord.
              </p>
            ) : (
              <select
                className="form-control"
                value={cahierId}
                onChange={(e) => setCahierId(e.target.value)}
              >
                <option value="">Sélectionner un cahier...</option>
                {cahiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre} — {c.classe} ({c.anneeScolaire})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Instructions */}
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 12 }}>
            Sélectionnez les séances à exporter et assignez leur une date.
            Chaque séance deviendra une entrée dans le Cahier de Textes.
          </p>

          {/* Liste des séances */}
          {sequence.seances.map((seance) => {
            const dejaExportee = (seance.entreesCahierIds?.length ?? 0) > 0;
            return (
              <div key={seance.id} className="export-seance-row">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  className="export-seance-row__check"
                  checked={!!selection[seance.id]}
                  onChange={(e) => setSelection((s) => ({ ...s, [seance.id]: e.target.checked }))}
                  id={`export-${seance.id}`}
                  aria-label={`Exporter la séance ${seance.numero}`}
                />

                {/* Infos */}
                <div className="export-seance-row__info">
                  <label htmlFor={`export-${seance.id}`} style={{ cursor: 'pointer' }}>
                    <div className="export-seance-row__titre">
                      {seance.numero}. {seance.titre || `Séance ${seance.numero}`}
                    </div>
                  </label>
                  <div className="export-seance-row__type">
                    {LABELS_TYPE_ACTIVITE[seance.typeActivite]} · {seance.dureeMinutes}min
                    {dejaExportee && (
                      <span className="export-seance-row__exported" style={{ marginLeft: 6 }}>
                        ✅ Déjà exportée
                      </span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <input
                  type="date"
                  className="export-seance-row__date"
                  value={dates[seance.id] ?? ''}
                  onChange={(e) => setDates((d) => ({ ...d, [seance.id]: e.target.value }))}
                  disabled={!selection[seance.id]}
                  aria-label={`Date pour la séance ${seance.numero}`}
                />
              </div>
            );
          })}

          {/* Erreur */}
          {error && <div className="error-banner" style={{ marginTop: 12 }}>⚠️ {error}</div>}
        </div>

        {/* ── Pied ── */}
        <div className="export-modal__footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-success"
            onClick={handleExport}
            disabled={loading || nbSelectionnes === 0 || !cahierId}
          >
            {loading
              ? <><span className="spinner" /> Export en cours...</>
              : `📤 Exporter ${nbSelectionnes} séance${nbSelectionnes > 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : SequenceDetailPage
// ─────────────────────────────────────────────────────────────

type TabId = 'seances' | 'evaluations' | 'infos';

const SequenceDetailPage: React.FC = () => {
  const navigate        = useNavigate();
  const { id }          = useParams<{ id: string }>();
  const { currentUser } = useAuth();

  // ── État ────────────────────────────────────────────────────
  const [sequence,     setSequence]     = useState<SequencePedagogique | null>(null);
  const [cahiers,      setCahiers]      = useState<CahierTextes[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<TabId>('seances');
  const [showExport,   setShowExport]   = useState(false);

  // ── Chargement ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!currentUser?.uid || !id) return;
      setLoading(true);
      try {
        const [seq, cah] = await Promise.all([
          getSequenceById(id),
          getCahiersProf(currentUser.uid),
        ]);
        if (!seq) { setError('Séquence introuvable.'); return; }
        if (seq.profId !== currentUser.uid) { setError('Accès non autorisé.'); return; }
        setSequence(seq);
        setCahiers(cah);
      } catch (err) {
        setError('Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.uid, id]);

  // ── Handlers ────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!sequence) return;
    const ok = window.confirm(`Supprimer "${sequence.titre}" ?\nCette action est irréversible.`);
    if (!ok) return;
    try {
      await deleteSequence(sequence.id);
      navigate('/prof/sequences');
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  const handleStatutChange = async (statut: StatutSequence) => {
    if (!sequence) return;
    try {
      await updateStatutSequence(sequence.id, statut);
      setSequence((s) => s ? { ...s, statut } : null);
    } catch {
      setError('Erreur de mise à jour du statut.');
    }
  };

  const handleExportSuccess = (nb: number) => {
    setShowExport(false);
    setSuccessMsg(`✅ ${nb} séance${nb > 1 ? 's' : ''} exportée${nb > 1 ? 's' : ''} vers le Cahier de Textes !`);
    // Recharger pour voir les séances marquées
    if (id) getSequenceById(id).then((s) => s && setSequence(s)).catch(() => null);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // ────────────────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────────────────

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error || !sequence) {
    return (
      <div className="sequence-detail">
        <div className="error-banner">⚠️ {error ?? 'Séquence introuvable.'}</div>
        <button className="btn-secondary" onClick={() => navigate('/prof/sequences')}>
          ← Retour
        </button>
      </div>
    );
  }

  const niveauLabel = NIVEAUX_SCOLAIRES.find((n) => n.valeur === sequence.niveau)?.label ?? sequence.niveau;

  return (
    <div className="sequence-detail">

      {/* ── Fil d'Ariane ── */}
      <Breadcrumbs items={[
        { label: 'Séquences', path: '/prof/sequences' },
        { label: sequence.titre || 'Séquence' },
      ]} />

      {/* ── Modal export ── */}
      {showExport && (
        <ExportModal
          sequence={sequence}
          cahiers={cahiers}
          profId={currentUser!.uid}
          onClose={() => setShowExport(false)}
          onSuccess={handleExportSuccess}
        />
      )}

      {/* ── Bannières ── */}
      {error      && <div className="error-banner" role="alert">⚠️ {error}</div>}
      {successMsg && <div className="success-banner" role="status">{successMsg}</div>}

      {/* ════════════════════════════════════════════════════════
          EN-TÊTE — Titre, meta, actions
      ════════════════════════════════════════════════════════ */}
      <div className="sequence-detail__header">

        {/* Fil d'Ariane */}
        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 8 }}>
          <a onClick={() => navigate('/prof/sequences')} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
            📚 Séquences
          </a>
          {' / '}
          {sequence.titre}
        </p>

        <div className="sequence-detail__header-top">
          {/* Titre + statut */}
          <div>
            <h1 className="sequence-detail__title">{sequence.titre}</h1>
            <div className="sequence-detail__meta" style={{ marginTop: 8 }}>
              <StatutBadge statut={sequence.statut} />
              {sequence.genereeParIA && <span className="badge-ia">✨ IA</span>}
              <span className="sequence-card__meta-chip">{sequence.matiere}</span>
              <span className="sequence-card__meta-chip sequence-card__meta-chip--grey">{niveauLabel}</span>
              {sequence.trimestre && (
                <span className="sequence-card__meta-chip sequence-card__meta-chip--grey">
                  T{sequence.trimestre}
                </span>
              )}
              {sequence.groupeClasseNom && (
                <span className="sequence-card__meta-chip sequence-card__meta-chip--grey">
                  👥 {sequence.groupeClasseNom}
                </span>
              )}
            </div>
          </div>

          {/* Boutons actions */}
          <div className="sequence-detail__actions">
            {/* Modifier le statut */}
            <select
              className="form-control"
              style={{ width: 'auto', fontSize: '0.8rem' }}
              value={sequence.statut}
              onChange={(e) => handleStatutChange(e.target.value as StatutSequence)}
              aria-label="Changer le statut"
            >
              {Object.entries(CONFIG_STATUT).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            {/* Export */}
            <button
              className="btn-success"
              onClick={() => setShowExport(true)}
              title="Exporter les séances vers le Cahier de Textes"
            >
              📤 Exporter
            </button>

            {/* Modifier */}
            <button
              className="btn-secondary"
              onClick={() => navigate(`/prof/sequences/${sequence.id}/modifier`)}
            >
              ✏️ Modifier
            </button>

            {/* Supprimer */}
            <button className="btn-danger" onClick={handleDelete}>🗑️</button>
          </div>
        </div>

        {/* Objectif général */}
        {sequence.objectifGeneral && (
          <div className="sequence-detail__objectif">
            <strong>🎯 Objectif :</strong> {sequence.objectifGeneral}
          </div>
        )}

        {/* Infos rapides */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: '0.8125rem', color: '#64748b' }}>
          <span>📋 {sequence.seances.length} séances</span>
          <span>📝 {sequence.evaluationsPrevues.length} évaluation{sequence.evaluationsPrevues.length > 1 ? 's' : ''}</span>
          <span>⏱️ {sequence.seances.reduce((acc, s) => acc + s.dureeMinutes, 0)} min total</span>
          {sequence.cahierDeTextesNom && <span>📒 {sequence.cahierDeTextesNom}</span>}
          {sequence.exporteAt && (
            <span>
              📤 Exporté le {sequence.exporteAt.toDate().toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="sequence-tabs" role="tablist">
        <button
          role="tab"
          className={`sequence-tab${activeTab === 'seances' ? ' sequence-tab--active' : ''}`}
          onClick={() => setActiveTab('seances')}
          aria-selected={activeTab === 'seances'}
        >
          📅 Séances ({sequence.seances.length})
        </button>
        <button
          role="tab"
          className={`sequence-tab${activeTab === 'evaluations' ? ' sequence-tab--active' : ''}`}
          onClick={() => setActiveTab('evaluations')}
          aria-selected={activeTab === 'evaluations'}
        >
          📝 Évaluations ({sequence.evaluationsPrevues.length})
        </button>
        <button
          role="tab"
          className={`sequence-tab${activeTab === 'infos' ? ' sequence-tab--active' : ''}`}
          onClick={() => setActiveTab('infos')}
          aria-selected={activeTab === 'infos'}
        >
          ℹ️ Détails
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          ONGLET : Séances — Timeline
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'seances' && (
        <div role="tabpanel">
          {sequence.seances.length === 0 ? (
            <div className="sequences-empty">
              <span className="sequences-empty__icon">📅</span>
              <p className="sequences-empty__text">Aucune séance planifiée</p>
              <button
                className="btn-primary"
                onClick={() => navigate(`/prof/sequences/${sequence.id}/modifier`)}
              >
                ✏️ Ajouter des séances
              </button>
            </div>
          ) : (
            <div className="sequence-timeline">
              {sequence.seances.map((seance) => (
                <TimelineItem key={seance.id} seance={seance} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET : Évaluations
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'evaluations' && (
        <div role="tabpanel" className="evaluations-panel">
          <h3 className="evaluations-panel__title">📝 Évaluations prévues</h3>

          {sequence.evaluationsPrevues.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Aucune évaluation marquée dans cette séquence.
              Modifiez une séance et cochez "Cette séance est une évaluation".
            </p>
          ) : (
            sequence.evaluationsPrevues.map((ev) => (
              <div key={ev.id} className="evaluation-row">
                <div className="evaluation-row__numero">S{ev.seanceNumero}</div>
                <div className="evaluation-row__info">
                  <div className="evaluation-row__titre">{ev.titre}</div>
                  <div className="evaluation-row__type">
                    {LABELS_TYPE_EVALUATION[ev.type]}
                    {ev.datePrevue && ` · ${ev.datePrevue.toDate().toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
                <div>
                  <div className="evaluation-row__note">/{ev.noteMax}</div>
                  <div className="evaluation-row__coeff">Coeff. {ev.coefficient}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET : Détails / Infos générales
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'infos' && (
        <div role="tabpanel">
          <div className="editor-section">

            {/* Compétences */}
            {sequence.competences.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  Compétences visées
                </h4>
                <div className="competences-list">
                  {sequence.competences.map((c, i) => (
                    <span key={i} className="competence-tag">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Prérequis */}
            {sequence.prerequis && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Prérequis
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                  {sequence.prerequis}
                </p>
              </div>
            )}

            {/* Description */}
            {sequence.description && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Description
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                  {sequence.description}
                </p>
              </div>
            )}

            {/* Métadonnées */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, fontSize: '0.8rem', color: '#94a3b8' }}>
              <p>Créée le {sequence.createdAt.toDate().toLocaleDateString('fr-FR')}</p>
              <p>Modifiée le {sequence.updatedAt.toDate().toLocaleDateString('fr-FR')}</p>
              {sequence.genereeParIA && <p>✨ Générée avec l'IA Claude</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Item de la timeline
// ─────────────────────────────────────────────────────────────

const TimelineItem: React.FC<{ seance: SeancePedagogique }> = ({ seance }) => {
  const [expanded, setExpanded] = useState(false);
  const dejaExportee = (seance.entreesCahierIds?.length ?? 0) > 0;

  return (
    <div className={`timeline-item${seance.estEvaluation ? ' timeline-item--eval' : ''}`}>
      <div className="timeline-card">
        {/* En-tête (cliquable) */}
        <div
          className="timeline-card__header"
          onClick={() => setExpanded((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <h3 className="timeline-card__title">
            {seance.numero}. {seance.titre || `Séance ${seance.numero}`}
          </h3>
          <div className="timeline-card__meta">
            <span className={`type-activite-badge type-activite-badge--${seance.typeActivite}`}>
              {LABELS_TYPE_ACTIVITE[seance.typeActivite]}
            </span>
            <span className="timeline-card__duree">{seance.dureeMinutes}min</span>
            {dejaExportee && (
              <span className="export-seance-row__exported">✅ Exportée</span>
            )}
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Objectif spécifique (toujours visible) */}
        {seance.objectifSpecifique && (
          <p className="timeline-card__objectif">
            🎯 {seance.objectifSpecifique}
          </p>
        )}

        {/* Contenu détaillé (dépliable) */}
        {expanded && (
          <>
            {seance.contenu && (
              <p className="timeline-card__contenu" style={{ marginTop: 8 }}>
                {seance.contenu}
              </p>
            )}

            {/* Ressources */}
            {seance.ressources.length > 0 && (
              <div className="timeline-card__ressources">
                {seance.ressources.map((r, i) => (
                  <span key={i} className="ressource-chip">{r}</span>
                ))}
              </div>
            )}

            {/* Détails évaluation */}
            {seance.estEvaluation && seance.typeEvaluation && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: '#fef2f2',
                borderRadius: 6,
                fontSize: '0.8rem',
                color: '#dc2626',
              }}>
                📝 {LABELS_TYPE_EVALUATION[seance.typeEvaluation]}
                {seance.noteMax && ` · /${seance.noteMax}`}
                {seance.coefficient && ` · Coeff. ${seance.coefficient}`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SequenceDetailPage;
