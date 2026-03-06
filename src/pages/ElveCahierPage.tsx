// ============================================================
// PedaClic — Phase 22 : ElveCahierPage
// Vue lecture seule pour les élèves des groupes liés.
// Route : /eleve/cahiers/:cahierId
// Affiche uniquement les séances "réalisées", sans notes privées.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CahierTextes, EntreeCahier } from '../types/cahierTextes.types';
import {
  getCahierPartageById,
  getEntreesRealisees,
} from '../services/cahierTextesService';
import LienExterneEditor from '../components/prof/LienExterneEditor';
import EbookSelector from '../components/prof/EbookSelector';
import MediaPlayer from '../components/prof/MediaPlayer';
import '../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Formate une date Firestore Timestamp en chaîne longue lisible.
 * ex: "Lundi 12 janvier 2025"
 */
function formatDateLongue(ts: { toDate: () => Date }): string {
  return ts.toDate().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : ElveCahierPage
// ─────────────────────────────────────────────────────────────

const ElveCahierPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const navigate = useNavigate();

  // État du cahier et de ses entrées
  const [cahier, setCahier]         = useState<CahierTextes | null>(null);
  const [entrees, setEntrees]       = useState<EntreeCahier[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  // Contrôle l'expansion d'une séance (accordéon)
  const [entreeOuverte, setEntreeOuverte] = useState<string | null>(null);

  /* Charge le cahier et ses entrées réalisées */
  useEffect(() => {
    async function charger() {
      if (!cahierId) return;
      setChargement(true);

      try {
        // Récupère le cahier (retourne null s'il n'est pas partagé)
        const c = await getCahierPartageById(cahierId);
        if (!c) {
          setErreur('Ce cahier n\'est pas accessible ou n\'existe pas.');
          return;
        }
        setCahier(c);

        // Récupère uniquement les séances réalisées
        const e = await getEntreesRealisees(cahierId);
        setEntrees(e);
      } catch {
        setErreur('Une erreur est survenue lors du chargement.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [cahierId]);

  /**
   * Bascule l'accordéon d'une séance.
   */
  function toggleEntree(id: string) {
    setEntreeOuverte(prev => (prev === id ? null : id));
  }

  // ── Rendu chargement ──
  if (chargement) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <p>Chargement du cahier de textes…</p>
      </div>
    );
  }

  // ── Rendu erreur / accès refusé ──
  if (erreur || !cahier) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '2.5rem' }}>🔒</div>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>
          {erreur || 'Accès non autorisé'}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(-1)}
          style={{ marginTop: 12 }}
        >
          ← Retour
        </button>
      </div>
    );
  }

  // ── Rendu principal ──
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
      {/* ── En-tête du cahier ── */}
      <header className="eleve-cahier-header">
        {/* Bouton retour */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: '0.85rem',
            marginBottom: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Retour
        </button>

        <h1>{cahier.titre}</h1>
        <p>
          {cahier.matiere} · {cahier.classe} · {cahier.anneeScolaire}
        </p>

        {/* Badge lecture seule */}
        <span className="badge-lecture-seule">
          👁️ Lecture seule — Séances réalisées
        </span>
      </header>

      {/* ── Description du cahier ── */}
      {cahier.description && (
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 10,
            padding: 14,
            marginBottom: 20,
            fontSize: '0.9rem',
            color: '#0c4a6e',
          }}
        >
          {cahier.description}
        </div>
      )}

      {/* ── Compteur de séances ── */}
      <p
        style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginBottom: 16,
        }}
      >
        {entrees.length === 0
          ? 'Aucune séance réalisée pour l\'instant.'
          : `${entrees.length} séance${entrees.length > 1 ? 's' : ''} réalisée${entrees.length > 1 ? 's' : ''}`}
      </p>

      {/* ── Message vide ── */}
      {entrees.length === 0 && (
        <div className="eleve-vide">
          <span className="emoji">📭</span>
          <p>Votre professeur n'a pas encore enregistré de séance réalisée.</p>
          <p style={{ fontSize: '0.8rem' }}>Revenez plus tard !</p>
        </div>
      )}

      {/* ── Liste des séances réalisées (accordéon) ── */}
      {entrees.map(entree => {
        const estOuverte = entreeOuverte === entree.id;
        const aMedias    = (entree.piecesJointes?.length ?? 0) > 0;
        const aLiens     = (entree.liens?.length ?? 0) > 0;
        const aEbooks    = (entree.ebooksLies?.length ?? 0) > 0;

        return (
          <article key={entree.id} className="seance-card-eleve">
            {/* ── Entête cliquable de la séance ── */}
            <button
              type="button"
              onClick={() => toggleEntree(entree.id)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
              aria-expanded={estOuverte}
              aria-controls={`seance-corps-${entree.id}`}
            >
              {/* Date de la séance */}
              <div className="seance-card-eleve-date">
               📅 {formatDateLongue(entree.date as any)}{entree.heureDebut ? ` · ${entree.heureDebut}${entree.heureFin ? ` → ${entree.heureFin}` : ''}` : ''}
              </div>

              {/* Titre + chevron */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h3 style={{ margin: 0 }}>{entree.chapitre}</h3>
                <span
                  style={{
                    fontSize: '1.1rem',
                    transition: 'transform 0.2s',
                    transform: estOuverte ? 'rotate(180deg)' : 'rotate(0)',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>

              {/* Indicateurs de contenu enrichi */}
              <div
                style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}
              >
                {aLiens && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: '#eff6ff',
                      color: '#2563eb',
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    🔗 Ressources
                  </span>
                )}
                {aEbooks && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: '#fef3c7',
                      color: '#92400e',
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    📚 Ebooks
                  </span>
                )}
                {aMedias && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: '#f0fdf4',
                      color: '#16a34a',
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    🖼️ Médias
                  </span>
                )}
              </div>
            </button>

            {/* ── Contenu de la séance (dépliable) ── */}
            {estOuverte && (
              <div
                id={`seance-corps-${entree.id}`}
                style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}
              >
                {/* Objectifs */}
                {entree.objectifs && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      padding: 10,
                      fontSize: '0.875rem',
                      color: '#166534',
                      marginBottom: 12,
                    }}
                  >
                    <strong>🎯 Objectifs :</strong> {entree.objectifs}
                  </div>
                )}

                {/* Contenu de la séance (HTML enrichi depuis l'éditeur) */}
                {entree.contenu && (
                  <div
                    className="seance-card-eleve-contenu"
                    dangerouslySetInnerHTML={{ __html: entree.contenu }}
                  />
                )}

                {/* Liens externes (lecture seule) */}
                {aLiens && (
                  <LienExterneEditor
                    liens={entree.liens ?? []}
                    onChange={() => {}} /* Aucun changement possible */
                    readonly
                  />
                )}

                {/* Ebooks liés (lecture seule) */}
                {aEbooks && (
                  <EbookSelector
                    ebooksLies={entree.ebooksLies ?? []}
                    onChange={() => {}}
                    readonly
                  />
                )}

                {/* Médias (lecture seule) */}
                {aMedias && (
                  <MediaPlayer
                    piecesJointes={entree.piecesJointes ?? []}
                    entreeId={entree.id}
                    profId="" /* Pas utilisé en readonly */
                    onChange={() => {}}
                    readonly
                  />
                )}
              </div>
            )}
          </article>
        );
      })}
    </main>
  );
};

export default ElveCahierPage;
