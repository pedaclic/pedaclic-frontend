import React, { useMemo } from 'react';
import {
  TYPE_CONTENU_CONFIG,
  STATUT_CONFIG,
} from '../../types/cahierTextes.types';
import type { TypeContenu, StatutSeance } from '../../types/cahierTextes.types';

// ─────────────────────────────────────────────────────────────────────────────
// PlanificationWidget
// ─────────────────────────────────────────────────────────────────────────────
// Widget réutilisable affichant la planification (séances) d'un cahier de
// textes. Utilisé :
//   - dans l'onglet « Planification » du tableau de bord d'un groupe
//     (GroupeDetail.tsx)
//   - dans la page autonome PlanificationPage (route
//     /prof/cahiers/:cahierId/planification)
//
// Les props sont volontairement typées en « any » pour rester rétro-compatible
// avec les appels existants (anciennes Phases) et les futurs où le cahier
// pourrait n'être pas encore chargé. Le widget consomme les vrais champs
// d'EntreeCahier : chapitre, date, heureDebut, heureFin, typeContenu, statut.
// ─────────────────────────────────────────────────────────────────────────────

interface PlanificationWidgetProps {
  /** Cahier de textes parent (facultatif — utilisé pour l'en-tête) */
  cahier?: any;
  /** Liste des entrées (séances) à afficher */
  entrees?: any[];
  /** Mode compact : ne montre qu'un résumé sur une ligne (utile en aperçu) */
  compact?: boolean;
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Convertit un Timestamp Firestore (ou un objet exposant `.toDate()`) ainsi
 * qu'un éventuel champ heureDebut « HH:mm » en Date JS pour le tri
 * chronologique. Retourne 0 si la donnée est invalide.
 */
function toMillis(entree: any): number {
  const d: Date | null = entree?.date?.toDate?.() ?? null;
  if (!d) return 0;
  // Si on a une heure « HH:mm », on l'applique pour un tri intra-journée.
  const h = entree?.heureDebut;
  if (typeof h === 'string' && /^\d{1,2}:\d{2}$/.test(h)) {
    const [hh, mm] = h.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
  }
  return d.getTime();
}

/** Formate une date en français court : « lun. 27 avr. 2026 » */
function formatDateFr(entree: any): string {
  const d: Date | null = entree?.date?.toDate?.() ?? null;
  if (!d) return 'Date à définir';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Formate le créneau horaire « 08:00 – 09:30 » (omet la fin si absente). */
function formatCreneau(entree: any): string {
  const debut = entree?.heureDebut;
  const fin = entree?.heureFin;
  if (debut && fin) return `${debut} – ${fin}`;
  if (debut) return debut;
  return '';
}

// ── Composant ────────────────────────────────────────────────────────────────

const PlanificationWidget: React.FC<PlanificationWidgetProps> = ({
  cahier,
  entrees = [],
  compact = false,
}) => {
  // Tri chronologique stable : on duplique le tableau pour ne pas muter la prop.
  const entreesTriees = useMemo(
    () => [...entrees].sort((a, b) => toMillis(a) - toMillis(b)),
    [entrees],
  );

  // ── Mode compact (utilisé en aperçu, listes dense) ──────────────────────
  if (compact) {
    return (
      // Carte bleue claire — résumé sur une ligne
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <p className="text-sm font-medium text-blue-700">
          📅 Planification — {entrees.length} séance
          {entrees.length !== 1 ? 's' : ''}
          {cahier?.titre ? ` · ${cahier.titre}` : ''}
        </p>
      </div>
    );
  }

  // ── Mode complet ─────────────────────────────────────────────────────────
  return (
    // Conteneur principal du widget — bordure + radius cohérents avec le DS
    <div
      className="planification-widget"
      style={{
        background: 'var(--color-bg, #fff)',
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: 'var(--radius-xl, 12px)',
        padding: 'var(--spacing-lg, 1rem)',
      }}
    >
      {/* En-tête : titre + sous-titre cahier */}
      <header style={{ marginBottom: '0.75rem' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span aria-hidden>📅</span> Planification pédagogique
        </h3>
        {cahier?.titre && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '0.85rem',
              color: '#6b7280',
            }}
          >
            {cahier.titre}
            {cahier.matiere ? ` · ${cahier.matiere}` : ''}
            {entrees.length > 0
              ? ` · ${entrees.length} séance${entrees.length !== 1 ? 's' : ''}`
              : ''}
          </p>
        )}
      </header>

      {/* État vide */}
      {entreesTriees.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
          Aucune séance planifiée pour ce cahier.
        </p>
      ) : (
        // Liste des séances — pas de puces, on stylise via la bordure gauche
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {entreesTriees.map((entree: any, i: number) => {
            // Lookup configuration type/statut — fallback safe si valeurs inconnues
            const typeKey = entree?.typeContenu as TypeContenu | undefined;
            const typeCfg = typeKey ? TYPE_CONTENU_CONFIG[typeKey] : null;
            const statutKey = entree?.statut as StatutSeance | undefined;
            const statutCfg = statutKey ? STATUT_CONFIG[statutKey] : null;

            // Couleur d'accent : type de contenu, sinon bleu PedaClic par défaut
            const accent = typeCfg?.color || '#2563eb';

            return (
              // Carte d'une séance — bordure gauche colorée selon le type
              <li
                key={entree?.id || i}
                style={{
                  borderLeft: `3px solid ${accent}`,
                  paddingLeft: '0.75rem',
                  paddingTop: '0.4rem',
                  paddingBottom: '0.4rem',
                  background: '#fafafa',
                  borderRadius: '4px',
                }}
              >
                {/* Ligne 1 : date + créneau horaire + badge statut */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#374151',
                  }}
                >
                  <strong>{formatDateFr(entree)}</strong>
                  {formatCreneau(entree) && (
                    <span style={{ color: '#6b7280' }}>
                      · {formatCreneau(entree)}
                    </span>
                  )}
                  {statutCfg && (
                    /* Badge statut — couleurs issues de STATUT_CONFIG */
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        color: statutCfg.color,
                        background: statutCfg.bg,
                      }}
                    >
                      {statutCfg.label}
                    </span>
                  )}
                </div>

                {/* Ligne 2 : type (emoji + label) + chapitre */}
                <div
                  style={{
                    marginTop: '2px',
                    fontSize: '0.9rem',
                    color: '#111827',
                    fontWeight: 500,
                  }}
                >
                  {typeCfg && (
                    <span style={{ marginRight: '0.35rem' }} aria-hidden>
                      {typeCfg.emoji}
                    </span>
                  )}
                  {entree?.chapitre || 'Séance sans chapitre'}
                </div>

                {/* Ligne 3 (optionnelle) : objectifs résumés */}
                {entree?.objectifs && (
                  <div
                    style={{
                      marginTop: '2px',
                      fontSize: '0.78rem',
                      color: '#6b7280',
                      fontStyle: 'italic',
                      // tronque à ~2 lignes pour rester compact
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {entree.objectifs}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PlanificationWidget;
