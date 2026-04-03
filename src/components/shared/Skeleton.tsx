import React from 'react';

// ── Barre de skeleton animée ───────────────────────────────────────────────
const SkeletonBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// ── SkeletonDashboard : placeholder de chargement pour les pages ───────────
export const SkeletonDashboard: React.FC = () => (
  <div className="p-6 space-y-4">
    {/* En-tête */}
    <SkeletonBar className="h-8 w-1/3" />
    {/* Ligne de sous-titre */}
    <SkeletonBar className="h-4 w-1/2" />
    {/* Bloc de contenu principal */}
    <div className="space-y-3 pt-4">
      <SkeletonBar className="h-4 w-full" />
      <SkeletonBar className="h-4 w-5/6" />
      <SkeletonBar className="h-4 w-4/6" />
    </div>
    {/* Cartes */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
      {[1, 2, 3].map(i => (
        <SkeletonBar key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

export default SkeletonDashboard;
