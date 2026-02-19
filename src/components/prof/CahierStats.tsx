// ============================================================
// PHASE 21 — COMPOSANT : CahierStats
// Statistiques et indicateurs d'un cahier de textes
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import { getStatsCahier } from '../../services/cahierTextesService';
import { TYPE_CONTENU_CONFIG } from '../../types/cahierTextes.types';
import type { StatsCahier } from '../../services/cahierTextesService';
import type { CahierTextes } from '../../types/cahierTextes.types';

// ─── Props ───────────────────────────────────────────────────
interface CahierStatsProps {
  cahier: CahierTextes;
}

// ─── Composant ───────────────────────────────────────────────
const CahierStats: React.FC<CahierStatsProps> = ({ cahier }) => {
  const [stats, setStats] = useState<StatsCahier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getStatsCahier(cahier.id);
        setStats(data);
      } catch {
        // Silencieux
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [cahier.id]);

  // Progression % du programme
  const progressionPct = cahier.nombreSeancesPrevu > 0
    ? Math.min(100, Math.round((cahier.nombreSeancesRealise / cahier.nombreSeancesPrevu) * 100))
    : 0;

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Chargement des stats...</div>;
  }
  if (!stats) return null;

  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '1.25rem' }}>
      {/* Titre */}
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        📊 Statistiques du cahier
      </div>

      {/* KPIs principaux */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatCard
          value={stats.total}
          label="Séances total"
          color="#2563eb"
          bg="#dbeafe"
        />
        <StatCard
          value={stats.realises}
          label="Réalisées"
          color="#059669"
          bg="#d1fae5"
        />
        <StatCard
          value={stats.planifies}
          label="Planifiées"
          color="#d97706"
          bg="#fef3c7"
        />
        <StatCard
          value={`${stats.heuresTotal.toFixed(1)}h`}
          label="Heures d'enseignement"
          color="#7c3aed"
          bg="#ede9fe"
        />
      </div>

      {/* Progression programme */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>
          <span>Progression du programme</span>
          <span style={{ fontWeight: 700, color: cahier.couleur }}>{progressionPct}%</span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressionPct}%`, background: cahier.couleur, borderRadius: 10, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.3rem' }}>
          {cahier.nombreSeancesRealise} / {cahier.nombreSeancesPrevu} séances prévues
        </div>
      </div>

      {/* Répartition par type */}
      {Object.keys(stats.parType).length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Répartition par type
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.entries(stats.parType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const cfg = TYPE_CONTENU_CONFIG[type as keyof typeof TYPE_CONTENU_CONFIG];
                if (!cfg) return null;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                      <span>{cfg.emoji} {cfg.label}</span>
                      <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 10 }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sous-composant KPI ───────────────────────────────────────
interface StatCardProps {
  value: number | string;
  label: string;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, color, bg }) => (
  <div style={{ background: bg, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.15rem' }}>{label}</div>
  </div>
);

export default CahierStats;
