// ============================================================
// PHASE 21 — COMPOSANT : SignetFilter
// Filtre et liste des entrées marquées pour évaluation
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntreesMarqueesEvaluation, updateEntree } from '../../services/cahierTextesService';
import {
  TYPE_CONTENU_CONFIG, TYPE_EVAL_LABELS,
  STATUT_CONFIG,
} from '../../types/cahierTextes.types';
import type { EntreeCahier, StatutEvaluation } from '../../types/cahierTextes.types';

// ─── Props ───────────────────────────────────────────────────
interface SignetFilterProps {
  profId: string;
  cahierId: string;
}

// ─── Composant ───────────────────────────────────────────────
const SignetFilter: React.FC<SignetFilterProps> = ({ profId, cahierId }) => {
  const navigate = useNavigate();
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState<StatutEvaluation | 'tous'>('tous');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getEntreesMarqueesEvaluation(profId, cahierId);
        setEntrees(data);
      } catch (err) {
        console.error('Erreur signets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [profId, cahierId]);

  // Mettre à jour le statut d'évaluation
  const handleStatutChange = async (entree: EntreeCahier, statut: StatutEvaluation) => {
    try {
      await updateEntree(entree.id, cahierId, { statutEvaluation: statut });
      setEntrees(prev => prev.map(e => e.id === entree.id ? { ...e, statutEvaluation: statut } : e));
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
    }
  };

  // Filtrage
  const entreesFiltrees = filtreStatut === 'tous'
    ? entrees
    : entrees.filter(e => e.statutEvaluation === filtreStatut);

  const STATUTS_EVAL: { value: StatutEvaluation | 'tous'; label: string; color: string }[] = [
    { value: 'tous', label: 'Tous', color: '#6b7280' },
    { value: 'a_evaluer', label: 'À évaluer', color: '#d97706' },
    { value: 'evaluation_creee', label: 'Créée', color: '#2563eb' },
    { value: 'evaluation_terminee', label: 'Terminée', color: '#059669' },
  ];

  return (
    <div>
      {/* Sous-titre */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
          📌 Signets d'évaluation ({entrees.length})
        </h3>
      </div>

      {/* Filtres statuts */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STATUTS_EVAL.map(s => (
          <button
            key={s.value}
            onClick={() => setFiltreStatut(s.value)}
            style={{
              padding: '0.3rem 0.85rem',
              borderRadius: 20,
              border: `1.5px solid ${filtreStatut === s.value ? s.color : '#e5e7eb'}`,
              background: filtreStatut === s.value ? s.color : 'white',
              color: filtreStatut === s.value ? 'white' : '#4b5563',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Chargement...</div>
      ) : entreesFiltrees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📌</div>
          <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Aucun signet trouvé</div>
          <div style={{ fontSize: '0.85rem' }}>
            Marquez des entrées pour évaluation depuis l'éditeur de séance.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entreesFiltrees.map(entree => {
            const cfg = TYPE_CONTENU_CONFIG[entree.typeContenu];
            const statutSeance = STATUT_CONFIG[entree.statut];
            return (
              <div
                key={entree.id}
                style={{
                  background: 'white',
                  borderRadius: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  padding: '1rem',
                  borderLeft: '4px solid #f59e0b',
                }}
              >
                {/* En-tête */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937' }}>
                      {entree.chapitre}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                      {entree.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    ✏️ Modifier
                  </button>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span style={{
                    padding: '0.15rem 0.6rem',
                    borderRadius: 20,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: cfg.color + '22',
                    color: cfg.color,
                  }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  {entree.typeEvaluation && (
                    <span style={{ padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                      📊 {TYPE_EVAL_LABELS[entree.typeEvaluation]}
                    </span>
                  )}
                  {entree.dateEvaluationPrevue && (
                    <span style={{ padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', background: '#f3f4f6', color: '#4b5563' }}>
                      📅 {entree.dateEvaluationPrevue.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>

                {/* Changement statut évaluation */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(['a_evaluer', 'evaluation_creee', 'evaluation_terminee'] as StatutEvaluation[]).map(s => {
                    const isActive = entree.statutEvaluation === s;
                    const labels: Record<StatutEvaluation, string> = {
                      a_evaluer: 'À évaluer',
                      evaluation_creee: 'Créée',
                      evaluation_terminee: '✅ Terminée',
                    };
                    const colors: Record<StatutEvaluation, string> = {
                      a_evaluer: '#d97706',
                      evaluation_creee: '#2563eb',
                      evaluation_terminee: '#059669',
                    };
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatutChange(entree, s)}
                        style={{
                          padding: '0.25rem 0.7rem',
                          borderRadius: 20,
                          border: `1.5px solid ${isActive ? colors[s] : '#e5e7eb'}`,
                          background: isActive ? colors[s] : 'white',
                          color: isActive ? 'white' : '#6b7280',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SignetFilter;
