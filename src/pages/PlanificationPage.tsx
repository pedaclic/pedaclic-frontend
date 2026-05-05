import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCahierById,
  getEntreesCahier,
} from '../services/cahierTextesService';
import type {
  CahierTextes,
  EntreeCahier,
  StatutSeance,
} from '../types/cahierTextes.types';
import { STATUT_CONFIG } from '../types/cahierTextes.types';
import PlanificationWidget from '../components/prof/PlanificationWidget';

// ─────────────────────────────────────────────────────────────────────────────
// PlanificationPage
// ─────────────────────────────────────────────────────────────────────────────
// Page autonome listant la planification (séances) d'un cahier de textes.
// Route : /prof/cahiers/:cahierId/planification (cf. App.tsx)
//
// Fonctionnalités :
//   1. Chargement du cahier + de ses entrées via les services existants
//   2. Filtre par statut de séance (Tous / Planifié / Réalisé / Annulé / Reporté)
//   3. Regroupement chronologique par mois pour une lecture rapide
//   4. Bouton « Retour » et raccourci « Nouvelle séance »
//
// On réutilise PlanificationWidget pour conserver une présentation cohérente
// avec l'onglet Planification du tableau de bord d'un groupe (GroupeDetail).
// ─────────────────────────────────────────────────────────────────────────────

type FiltreStatut = 'tous' | StatutSeance;

const FILTRES: Array<{ valeur: FiltreStatut; label: string; emoji: string }> = [
  { valeur: 'tous', label: 'Toutes', emoji: '📋' },
  { valeur: 'planifie', label: 'Planifiées', emoji: '⏳' },
  { valeur: 'realise', label: 'Réalisées', emoji: '✅' },
  { valeur: 'annule', label: 'Annulées', emoji: '🚫' },
  { valeur: 'reporte', label: 'Reportées', emoji: '🔁' },
];

// ── Utilitaire : clé « Mois Année » utilisée pour grouper les séances ──────
function moisLabel(entree: EntreeCahier): string {
  const d = entree?.date?.toDate?.();
  if (!d) return 'Date à définir';
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

const PlanificationPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const navigate = useNavigate();

  // ── États ───────────────────────────────────────────────────────────────
  const [cahier, setCahier] = useState<CahierTextes | null>(null);
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreStatut>('tous');

  // ── Chargement initial ──────────────────────────────────────────────────
  useEffect(() => {
    if (!cahierId) {
      setError('Identifiant du cahier manquant.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getCahierById(cahierId), getEntreesCahier(cahierId)])
      .then(([c, list]) => {
        if (cancelled) return;
        if (!c) {
          setError("Ce cahier de textes n'existe pas ou a été supprimé.");
          setCahier(null);
          setEntrees([]);
        } else {
          setCahier(c);
          setEntrees(list);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError('Impossible de charger la planification.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cahierId]);

  // ── Filtrage + regroupement par mois ────────────────────────────────────
  const groupesParMois = useMemo(() => {
    const filtrees =
      filtre === 'tous'
        ? entrees
        : entrees.filter((e) => e.statut === filtre);
    // Regroupement par étiquette « Mois Année »
    const map = new Map<string, EntreeCahier[]>();
    for (const e of filtrees) {
      const key = moisLabel(e);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    // Tri chronologique des groupes (le 1er du mois fait foi)
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const da = a[0]?.date?.toDate?.()?.getTime() ?? 0;
      const db = b[0]?.date?.toDate?.()?.getTime() ?? 0;
      return da - db;
    });
  }, [entrees, filtre]);

  // ── Statistiques (pour les badges des filtres) ──────────────────────────
  const compteurs = useMemo(() => {
    const c = { tous: entrees.length, planifie: 0, realise: 0, annule: 0, reporte: 0 };
    for (const e of entrees) {
      if (e.statut === 'planifie') c.planifie += 1;
      else if (e.statut === 'realise') c.realise += 1;
      else if (e.statut === 'annule') c.annule += 1;
      else if (e.statut === 'reporte') c.reporte += 1;
    }
    return c;
  }, [entrees]);

  // ── Rendus conditionnels ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="prof-loading">
          <div className="spinner"></div>
          <p>Chargement de la planification…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      // Message d'erreur + bouton retour
      <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: 8,
          }}
        >
          ⚠️ {error}
        </div>
        <button
          type="button"
          /* Phase 40 — `?vue=liste` empêche la redirection auto vers
             le dernier cahier ouvert (boucle non désirée depuis ce
             bouton de retour à la liste). */
          onClick={() => navigate('/prof/cahiers?vue=liste')}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            border: '1px solid #e5e7eb',
            background: '#fff',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          ← Retour aux cahiers
        </button>
      </div>
    );
  }

  return (
    /* Conteneur principal — largeur lisible sur desktop */
    <div
      className="planification-page"
      style={{ padding: 'var(--spacing-lg, 1.5rem)', maxWidth: 1100, margin: '0 auto' }}
    >
      {/* ===== En-tête : titre + actions ===== */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate(`/prof/cahiers/${cahierId}`)}
            style={{
              fontSize: '0.85rem',
              border: '1px solid #e5e7eb',
              background: '#fff',
              padding: '0.4rem 0.75rem',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: '0.6rem',
            }}
          >
            ← Retour au cahier
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 700,
              color: '#2563eb',
            }}
          >
            📅 Planification
          </h1>
          {cahier && (
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
              {cahier.titre} · {cahier.matiere} · {cahier.classe} ·{' '}
              {cahier.anneeScolaire}
            </p>
          )}
        </div>

        {/* Bouton Nouvelle séance — réutilise la route existante de l'éditeur */}
        <button
          type="button"
          onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.6rem 1rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ➕ Nouvelle séance
        </button>
      </header>

      {/* ===== Barre de filtres ===== */}
      <div
        role="tablist"
        aria-label="Filtre par statut de séance"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {FILTRES.map((f) => {
          const isActive = filtre === f.valeur;
          // Couleurs cohérentes avec STATUT_CONFIG quand le filtre n'est pas « tous »
          const cfg =
            f.valeur !== 'tous' ? STATUT_CONFIG[f.valeur] : null;
          const compte =
            f.valeur === 'tous'
              ? compteurs.tous
              : (compteurs as any)[f.valeur] || 0;

          return (
            <button
              key={f.valeur}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setFiltre(f.valeur)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 999,
                border: `1px solid ${isActive ? (cfg?.color || '#2563eb') : '#e5e7eb'}`,
                background: isActive ? (cfg?.bg || '#dbeafe') : '#fff',
                color: isActive ? (cfg?.color || '#1d4ed8') : '#374151',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden>{f.emoji}</span>
              {f.label}
              <span
                style={{
                  background: isActive ? '#fff' : '#f3f4f6',
                  color: '#374151',
                  borderRadius: 999,
                  padding: '0 0.5rem',
                  fontSize: '0.75rem',
                  minWidth: 20,
                  textAlign: 'center',
                }}
              >
                {compte}
              </span>
            </button>
          );
        })}
      </div>

      {/* ===== Liste des séances groupées par mois ===== */}
      {entrees.length === 0 ? (
        // Aucune séance dans le cahier
        <div
          style={{
            background: '#f9fafb',
            border: '1px dashed #d1d5db',
            borderRadius: 12,
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>📅</div>
          <h3 style={{ margin: '0.5rem 0' }}>Aucune séance planifiée</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Commencez par créer votre première séance pour ce cahier.
          </p>
        </div>
      ) : groupesParMois.length === 0 ? (
        // Filtre actif sans résultats
        <div
          style={{
            background: '#f9fafb',
            border: '1px dashed #d1d5db',
            borderRadius: 12,
            padding: '1.5rem',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.9rem',
          }}
        >
          Aucune séance ne correspond à ce filtre.
        </div>
      ) : (
        // Affichage : un PlanificationWidget par mois pour conserver l'aspect visuel
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {groupesParMois.map(([mois, items]) => (
            <section key={mois} aria-label={`Séances de ${mois}`}>
              {/* En-tête du mois */}
              <h2
                style={{
                  margin: '0 0 0.5rem',
                  fontSize: '0.95rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  fontWeight: 700,
                }}
              >
                {mois} · {items.length} séance{items.length !== 1 ? 's' : ''}
              </h2>
              {/* Réutilisation du widget partagé */}
              <PlanificationWidget cahier={cahier} entrees={items} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanificationPage;
