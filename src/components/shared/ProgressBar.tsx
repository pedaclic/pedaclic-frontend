/**
 * ============================================================
 * PedaClic — Phase 14 : ProgressBar.tsx
 * ============================================================
 * Barre de progression réutilisable avec :
 *  - Pourcentage affiché
 *  - Couleur adaptative selon le niveau
 *  - Taille configurable (sm, md, lg)
 *  - Label optionnel
 *  - Animation au montage
 *
 * Placement : src/components/shared/ProgressBar.tsx
 * ============================================================
 */

import React, { useState, useEffect } from 'react';

/* ──────────────────────────────────────────────
   Props du composant
   ────────────────────────────────────────────── */
interface ProgressBarProps {
  /** Pourcentage de progression (0–100) */
  pourcentage: number;

  /** Label affiché à gauche de la barre (optionnel) */
  label?: string;

  /** Taille de la barre : sm (4px), md (8px), lg (12px) */
  size?: 'sm' | 'md' | 'lg';

  /** Afficher le pourcentage en texte ? (défaut : true) */
  showPercent?: boolean;

  /** Couleur personnalisée (sinon auto selon le %) */
  color?: string;

  /** Afficher une icône de complétion à 100% ? */
  showCheck?: boolean;

  /** Classe CSS additionnelle */
  className?: string;
}

/* ──────────────────────────────────────────────
   Utilitaire : couleur selon le %
   ────────────────────────────────────────────── */
const getBarColor = (pct: number): string => {
  if (pct >= 80) return '#10b981'; /* Vert — Excellent */
  if (pct >= 60) return '#3b82f6'; /* Bleu — Bien */
  if (pct >= 40) return '#f59e0b'; /* Orange — Passable */
  if (pct > 0) return '#ef4444';   /* Rouge — À améliorer */
  return '#d1d5db';                 /* Gris — Pas commencé */
};

/* ══════════════════════════════════════════════
   COMPOSANT : ProgressBar
   ══════════════════════════════════════════════ */
const ProgressBar: React.FC<ProgressBarProps> = ({
  pourcentage,
  label,
  size = 'md',
  showPercent = true,
  color,
  showCheck = true,
  className = '',
}) => {
  /* ── Animation de remplissage au montage ── */
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    /* Petit délai pour permettre l'animation CSS */
    const timer = setTimeout(() => {
      setAnimatedWidth(Math.min(100, Math.max(0, pourcentage)));
    }, 100);
    return () => clearTimeout(timer);
  }, [pourcentage]);

  /* ── Hauteur selon la taille ── */
  const heightMap = { sm: '4px', md: '8px', lg: '12px' };
  const barHeight = heightMap[size];

  /* ── Couleur de la barre ── */
  const barColor = color || getBarColor(pourcentage);

  /* ── Complet à 100% ? ── */
  const isComplete = pourcentage >= 100;

  return (
    /* <!-- Conteneur principal de la barre de progression --> */
    <div className={`progress-bar-wrapper ${className}`}>

      {/* <!-- Ligne supérieure : label + pourcentage --> */}
      {(label || showPercent) && (
        <div className="progress-bar-header">
          {/* <!-- Label optionnel à gauche --> */}
          {label && <span className="progress-bar-label">{label}</span>}

          {/* <!-- Pourcentage ou icône de complétion --> */}
          {showPercent && (
            <span
              className="progress-bar-percent"
              style={{ color: barColor }}
            >
              {isComplete && showCheck ? '✅ ' : ''}
              {pourcentage}%
            </span>
          )}
        </div>
      )}

      {/* <!-- Barre de fond (track grise) --> */}
      <div
        className="progress-bar-track"
        style={{ height: barHeight }}
      >
        {/* <!-- Barre de remplissage animée --> */}
        <div
          className="progress-bar-fill"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: barColor,
            height: '100%',
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
