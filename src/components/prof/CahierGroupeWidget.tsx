// ============================================================
// PedaClic — Phase 22 : CahierGroupeWidget
// Widget à intégrer dans la vue détail d'un groupe classe.
// Affiche les cahiers liés et permet d'en créer un nouveau.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CahierTextes, GroupeProf } from '../../types/cahierTextes.types';
import { getCahiersForGroupe } from '../../services/cahierTextesService';
import '../../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Formate une date Firestore Timestamp en chaîne lisible.
 * ex: "12 jan. 2025"
 */
function formatDate(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '';
  return ts.toDate().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : CahierGroupeWidget
// ─────────────────────────────────────────────────────────────

interface CahierGroupeWidgetProps {
  /** Groupe classe pour lequel afficher les cahiers liés */
  groupe: GroupeProf;
}

const CahierGroupeWidget: React.FC<CahierGroupeWidgetProps> = ({ groupe }) => {
  const navigate = useNavigate();

  // Cahiers liés à ce groupe
  const [cahiers, setCahiers]       = useState<CahierTextes[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  /* Charge les cahiers liés au montage et si le groupe change */
  useEffect(() => {
    async function charger() {
      setChargement(true);
      try {
        const liste = await getCahiersForGroupe(groupe.id);
        setCahiers(liste);
      } catch {
        setErreur('Impossible de charger les cahiers.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [groupe.id]);

  /**
   * Navigue vers la page de création d'un cahier,
   * en pré-remplissant la classe et le groupe via les query params.
   */
  function handleCreerCahier() {
    const params = new URLSearchParams({
      classe:    groupe.classe,
      groupeId:  groupe.id,
      groupeNom: groupe.nom,
    });
    navigate(`/prof/cahiers/nouveau?${params.toString()}`);
  }

  /**
   * Navigue vers la page de détail d'un cahier.
   */
  function handleOuvrirCahier(cahierId: string) {
    navigate(`/prof/cahiers/${cahierId}`);
  }

  return (
    /* Widget complet : header bleu clair + corps */
    <article className="cahier-groupe-widget" aria-label={`Cahiers liés au groupe ${groupe.nom}`}>
      {/* ── En-tête ── */}
      <div className="cahier-groupe-widget-header">
        <h4>📓 Cahiers de textes liés</h4>

        {/* Bouton création rapide */}
        <button
          type="button"
          className="btn-pedaclic"
          onClick={handleCreerCahier}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          ➕ Créer un cahier
        </button>
      </div>

      {/* ── Corps ── */}
      <div className="cahier-groupe-widget-body">
        {/* Chargement */}
        {chargement && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
            ⏳ Chargement…
          </p>
        )}

        {/* Erreur */}
        {erreur && (
          <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>{erreur}</p>
        )}

        {/* Liste vide */}
        {!chargement && !erreur && cahiers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af' }}>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              Aucun cahier lié à ce groupe.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
              Créez-en un ou liez un cahier existant depuis ses paramètres.
            </p>
          </div>
        )}

        {/* Liste des cahiers */}
        {!chargement &&
          cahiers.map(cahier => (
            <div key={cahier.id} className="cahier-widget-ligne">
              {/* Informations du cahier */}
              <div>
                <div className="cahier-widget-titre">{cahier.titre}</div>
                <div className="cahier-widget-meta">
                  {cahier.matiere} · Modifié le {formatDate(cahier.updatedAt as any)}
                </div>

                {/* Badge partagé / non partagé */}
                <span
                  className={`badge-partage ${cahier.isPartage ? 'actif' : ''}`}
                  style={{ marginTop: 4, display: 'inline-flex' }}
                >
                  {cahier.isPartage ? '👁️ Visible élèves' : '🔒 Non partagé'}
                </span>
              </div>

              {/* Bouton accès rapide */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleOuvrirCahier(cahier.id)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', whiteSpace: 'nowrap' }}
                aria-label={`Ouvrir le cahier ${cahier.titre}`}
              >
                Ouvrir →
              </button>
            </div>
          ))}
      </div>
    </article>
  );
};

export default CahierGroupeWidget;
