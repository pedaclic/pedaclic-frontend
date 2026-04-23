// ============================================================
// PedaClic – Phase 30 : ElveCahierFiltres.tsx
// Barre de filtres (période + rubrique) pour la vue élève
// du Cahier de Textes.
//
// Ce composant est STATELESS côté données : il reçoit tout
// en props et remonte les changements via onChangeFiltres.
// Il ne fait aucun appel Firestore.
// ============================================================

import React, { useId } from 'react';
import type { RubriqueCahier } from '../../types/cahierTextes.types';
import '../../styles/ElveCahierFiltres.css';

// ─────────────────────────────────────────────────────────────
// CONSTANTES & TYPES PUBLICS
// ─────────────────────────────────────────────────────────────

/** Identifiants des filtres de période prédéfinis */
export type PeriodeId = 'tout' | 'semaine' | 'mois' | 'mois_choisi';

/** État complet des filtres — utilisé par ElveCahierPage */
export interface FiltresCahier {
  /** Filtre de période actif */
  periode: PeriodeId;
  /**
   * Valeur du picker mois/année (format "YYYY-MM").
   * Utilisée uniquement quand periode === 'mois_choisi'.
   */
  moisChoisi: string;
  /**
   * ID de la rubrique filtrée.
   * null = "Toutes les rubriques"
   * '__sans_rubrique__' = entrées sans rubrique
   */
  rubriqueId: string | null;
  /**
   * Filtre « Titres réalisés uniquement »
   *   true  → ne garder que les séances dont le chapitre correspond
   *           à un TitreRubrique dont le statut vaut 'acheve'
   *   false → comportement normal (toutes les séances sont montrées)
   * Utile pour l'élève : vue d'ensemble des leçons déjà bouclées.
   */
  titresAchevesSeuls: boolean;
}

/** Valeurs par défaut (aucun filtre actif) */
export const FILTRES_DEFAUT: FiltresCahier = {
  periode: 'tout',
  moisChoisi: '',
  rubriqueId: null,
  titresAchevesSeuls: false,
};

/** Options de période fixes */
const PERIODES: { id: PeriodeId; label: string; emoji: string }[] = [
  { id: 'tout', label: 'Tout', emoji: '📋' },
  { id: 'semaine', label: 'Cette semaine', emoji: '🗓️' },
  { id: 'mois', label: 'Ce mois', emoji: '📅' },
];

// ─────────────────────────────────────────────────────────────
// UTILITAIRE : valeur initiale du picker mois
// ─────────────────────────────────────────────────────────────

/** Retourne le mois courant au format "YYYY-MM" pour l'input[type=month] */
export function moisCourant(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRE : teste si un filtre est actif (différent du défaut)
// ─────────────────────────────────────────────────────────────

export function filtresActifs(f: FiltresCahier): boolean {
  // Un filtre est actif dès qu'une seule dimension s'écarte du défaut
  return f.periode !== 'tout' || f.rubriqueId !== null || f.titresAchevesSeuls;
}

// ─────────────────────────────────────────────────────────────
// PROPS DU COMPOSANT
// ─────────────────────────────────────────────────────────────

interface ElveCahierFiltresProps {
  /** Filtres courants (contrôlés par le parent) */
  filtres: FiltresCahier;
  /** Callback quand les filtres changent */
  onChangeFiltres: (f: FiltresCahier) => void;
  /** Rubriques définies sur le cahier (peut être vide) */
  rubriques: RubriqueCahier[];
  /** Nombre total de séances (avant filtrage) */
  totalEntrees: number;
  /** Nombre de séances après filtrage */
  entreesFiltrees: number;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

const ElveCahierFiltres: React.FC<ElveCahierFiltresProps> = ({
  filtres,
  onChangeFiltres,
  rubriques,
  totalEntrees,
  entreesFiltrees,
}) => {
  const pickerId = useId();

  const setPeriode = (p: PeriodeId) => {
    onChangeFiltres({
      ...filtres,
      periode: p,
      moisChoisi: p === 'mois_choisi' ? filtres.moisChoisi || moisCourant() : filtres.moisChoisi,
    });
  };

  const setMoisChoisi = (valeur: string) => {
    onChangeFiltres({ ...filtres, periode: 'mois_choisi', moisChoisi: valeur });
  };

  const setRubrique = (id: string | null) => {
    onChangeFiltres({ ...filtres, rubriqueId: id });
  };

  // Bascule le filtre « Titres réalisés uniquement » (toggle booléen)
  const toggleTitresAcheves = () => {
    onChangeFiltres({ ...filtres, titresAchevesSeuls: !filtres.titresAchevesSeuls });
  };

  const reinitialiser = () => onChangeFiltres(FILTRES_DEFAUT);

  const aFiltre = filtresActifs(filtres);

  const descPeriode = (() => {
    if (filtres.periode === 'semaine') return 'cette semaine';
    if (filtres.periode === 'mois') return 'ce mois';
    if (filtres.periode === 'mois_choisi' && filtres.moisChoisi) {
      const [an, mo] = filtres.moisChoisi.split('-');
      return new Date(Number(an), Number(mo) - 1, 1).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
    }
    return null;
  })();

  const descRubrique = (() => {
    if (filtres.rubriqueId === '__sans_rubrique__') return 'Sans rubrique';
    const r = rubriques.find((r) => r.id === filtres.rubriqueId);
    return r?.nom ?? null;
  })();

  // Le toggle « Titres réalisés » ne s'affiche que si au moins une rubrique
  // du cahier possède des titres (sinon le filtre n'a pas de sens).
  const aDesTitres = rubriques.some((r) => (r.titres?.length ?? 0) > 0);

  return (
    <>
      <div className="filtres-bar" role="search" aria-label="Filtrer les séances">
        <div className="filtres-bar-titre">
          <span className="filtres-bar-label">🔍 Filtrer les séances</span>
          {aFiltre && (
            <button
              type="button"
              className="filtres-reset-btn"
              onClick={reinitialiser}
              aria-label="Réinitialiser les filtres"
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>

        <div className="filtres-groupe" role="group" aria-label="Filtrer par période">
          <span className="filtres-groupe-label">📆 Période</span>
          <div className="filtres-pills">
            {PERIODES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`filtre-pill${filtres.periode === p.id ? ' actif' : ''}`}
                onClick={() => setPeriode(p.id)}
                aria-pressed={filtres.periode === p.id}
              >
                <span aria-hidden="true">{p.emoji}</span>
                {p.label}
              </button>
            ))}

            <span className="filtres-sep" aria-hidden="true" />

            <label htmlFor={pickerId} className="sr-only">
              Choisir un mois
            </label>
            <input
              id={pickerId}
              type="month"
              className={`filtres-mois-picker${filtres.periode === 'mois_choisi' ? ' actif' : ''}`}
              value={filtres.moisChoisi || moisCourant()}
              onChange={(e) => setMoisChoisi(e.target.value)}
              aria-label="Choisir un mois spécifique"
              title="Choisir un mois"
            />
          </div>
        </div>

        {rubriques.length > 0 && (
          <div className="filtres-groupe" role="group" aria-label="Filtrer par rubrique">
            <span className="filtres-groupe-label">📂 Rubrique</span>
            <div className="filtres-pills">
              <button
                type="button"
                className={`filtre-pill${filtres.rubriqueId === null ? ' actif-tout actif' : ''}`}
                onClick={() => setRubrique(null)}
                aria-pressed={filtres.rubriqueId === null}
              >
                Toutes
              </button>

              {rubriques.map((r) => {
                const couleur = r.couleur ?? '#64748b';
                const estActif = filtres.rubriqueId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="filtre-pill"
                    style={
                      estActif
                        ? {
                            backgroundColor: `${couleur}1a`,
                            borderColor: couleur,
                            color: couleur,
                          }
                        : undefined
                    }
                    onClick={() => setRubrique(estActif ? null : r.id)}
                    aria-pressed={estActif}
                  >
                    <span
                      className="filtre-pill-dot"
                      style={{ backgroundColor: couleur }}
                      aria-hidden="true"
                    />
                    {r.nom}
                  </button>
                );
              })}

              <button
                type="button"
                className={`filtre-pill${filtres.rubriqueId === '__sans_rubrique__' ? ' actif' : ''}`}
                onClick={() =>
                  setRubrique(filtres.rubriqueId === '__sans_rubrique__' ? null : '__sans_rubrique__')
                }
                aria-pressed={filtres.rubriqueId === '__sans_rubrique__'}
              >
                <span
                  className="filtre-pill-dot"
                  style={{ backgroundColor: '#94a3b8' }}
                  aria-hidden="true"
                />
                Sans rubrique
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            Filtre « Titres réalisés uniquement » (avancement)
            Masqué si aucune rubrique du cahier n'a de titres.
            ═══════════════════════════════════════════════════════ */}
        {aDesTitres && (
          <div className="filtres-groupe" role="group" aria-label="Filtrer par avancement">
            <span className="filtres-groupe-label">🏁 Avancement</span>
            <div className="filtres-pills">
              <button
                type="button"
                className={`filtre-pill${filtres.titresAchevesSeuls ? ' actif' : ''}`}
                onClick={toggleTitresAcheves}
                aria-pressed={filtres.titresAchevesSeuls}
                title="N'afficher que les séances dont le titre est marqué « Achevé »"
              >
                <span aria-hidden="true">✅</span>
                Titres réalisés uniquement
              </button>
            </div>
          </div>
        )}
      </div>

      {aFiltre && (
        <div className="filtres-resultats" role="status" aria-live="polite">
          <div>
            <span className="filtres-resultats-count">
              {entreesFiltrees} séance{entreesFiltrees > 1 ? 's' : ''}
            </span>
            <span className="filtres-resultats-detail"> sur {totalEntrees} au total</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {descPeriode && <span className="filtres-badge-actif">📆 {descPeriode}</span>}
            {descRubrique && <span className="filtres-badge-actif">📂 {descRubrique}</span>}
            {/* Badge récapitulatif du filtre Avancement */}
            {filtres.titresAchevesSeuls && (
              <span className="filtres-badge-actif">✅ Titres réalisés</span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ElveCahierFiltres;
