// ============================================================
// PedaClic — Phase 22 + Phase 30 : ElveCahierPage
// Vue lecture seule pour les élèves des groupes liés.
// Route : /eleve/cahiers/:cahierId
// Filtres période (semaine, mois, mois choisi) + rubrique (Phase 30).
// Affiche uniquement les séances "réalisées", sans notes privées.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CahierTextes, EntreeCahier, RubriqueCahier } from '../types/cahierTextes.types';
import {
  COULEURS_RUBRIQUES,
  getCahierPartageById,
  getEntreesRealisees,
} from '../services/cahierTextesService';
import LienExterneEditor from '../components/prof/LienExterneEditor';
import EbookSelector from '../components/prof/EbookSelector';
import MediaPlayer from '../components/prof/MediaPlayer';
import ElveCahierFiltres, {
  FILTRES_DEFAUT,
  filtresActifs,
  type FiltresCahier,
} from '../components/eleve/ElveCahierFiltres';
// Phase 32 — Quiz rattachés à la séance (vue élève)
import QuizsDeSeance from '../components/eleve/QuizsDeSeance';

import '../styles/CahierEnrichi.css';
import '../styles/ElveCahierFiltres.css';
import '../styles/Phase32.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES DE DATE
// ─────────────────────────────────────────────────────────────

function tsToDate(ts: { toDate: () => Date }): Date {
  return ts.toDate();
}

/** ex: "Lundi 12 janvier 2025" */
function formatDateLongue(ts: { toDate: () => Date }): string {
  return tsToDate(ts).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function lundiDeLaSemaine(d: Date): Date {
  const date = new Date(d);
  const jour = date.getDay();
  const diff = jour === 0 ? -6 : 1 - jour;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dimancheDeLaSemaine(d: Date): Date {
  const lundi = lundiDeLaSemaine(d);
  const dim = new Date(lundi);
  dim.setDate(lundi.getDate() + 6);
  dim.setHours(23, 59, 59, 999);
  return dim;
}

function labelMois(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function cleMois(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function couleurRubrique(r: RubriqueCahier, idx: number): string {
  return r.couleur ?? COULEURS_RUBRIQUES[idx % COULEURS_RUBRIQUES.length];
}

// ─────────────────────────────────────────────────────────────
// FILTRAGE (client-side)
// ─────────────────────────────────────────────────────────────

/**
 * Construit l'ensemble des noms de titres "achevés" du cahier.
 * Normalise la casse et les espaces pour un matching robuste avec
 * le `chapitre` de chaque séance (qui peut être saisi librement).
 */
function buildTitresAchevesSet(rubriques: RubriqueCahier[]): Set<string> {
  const set = new Set<string>();
  rubriques.forEach((r) => {
    (r.titres ?? []).forEach((t) => {
      if (t.statut === 'acheve' && t.nom) {
        set.add(t.nom.trim().toLowerCase());
      }
    });
  });
  return set;
}

function filtrerEntrees(
  entrees: EntreeCahier[],
  filtres: FiltresCahier,
  titresAchevesNoms: Set<string>,
): EntreeCahier[] {
  const maintenant = new Date();

  return entrees.filter((e) => {
    const dateEntree = tsToDate(e.date as { toDate: () => Date });

    if (filtres.periode === 'semaine') {
      const debut = lundiDeLaSemaine(maintenant);
      const fin = dimancheDeLaSemaine(maintenant);
      if (dateEntree < debut || dateEntree > fin) return false;
    }

    if (filtres.periode === 'mois') {
      if (
        dateEntree.getFullYear() !== maintenant.getFullYear() ||
        dateEntree.getMonth() !== maintenant.getMonth()
      ) {
        return false;
      }
    }

    if (filtres.periode === 'mois_choisi' && filtres.moisChoisi) {
      const [an, mo] = filtres.moisChoisi.split('-').map(Number);
      if (dateEntree.getFullYear() !== an || dateEntree.getMonth() + 1 !== mo) return false;
    }

    if (filtres.rubriqueId !== null) {
      if (filtres.rubriqueId === '__sans_rubrique__') {
        if (e.rubriqueId) return false;
      } else if (e.rubriqueId !== filtres.rubriqueId) {
        return false;
      }
    }

    // Filtre « Titres réalisés uniquement » :
    //   on matche le chapitre (normalisé) avec la liste des titres achevés.
    if (filtres.titresAchevesSeuls) {
      const chapitreNorm = (e.chapitre ?? '').trim().toLowerCase();
      if (!chapitreNorm || !titresAchevesNoms.has(chapitreNorm)) return false;
    }

    return true;
  });
}

interface GroupeMois {
  cle: string;
  label: string;
  entrees: EntreeCahier[];
}

function grouperParMois(entrees: EntreeCahier[]): GroupeMois[] {
  const map = new Map<string, GroupeMois>();

  entrees.forEach((e) => {
    const d = tsToDate(e.date as { toDate: () => Date });
    const cle = cleMois(d);
    if (!map.has(cle)) {
      map.set(cle, { cle, label: labelMois(d), entrees: [] });
    }
    map.get(cle)!.entrees.push(e);
  });

  return [...map.values()].sort((a, b) => b.cle.localeCompare(a.cle));
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

const ElveCahierPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const navigate = useNavigate();

  const [cahier, setCahier] = useState<CahierTextes | null>(null);
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [entreeOuverte, setEntreeOuverte] = useState<string | null>(null);

  const [rubriques, setRubriques] = useState<RubriqueCahier[]>([]);
  const [filtres, setFiltres] = useState<FiltresCahier>(FILTRES_DEFAUT);

  useEffect(() => {
    async function charger() {
      if (!cahierId) return;
      setChargement(true);

      try {
        const c = await getCahierPartageById(cahierId);
        if (!c) {
          setErreur("Ce cahier n'est pas accessible ou n'existe pas.");
          return;
        }
        setCahier(c);
        setRubriques(c.rubriques ?? []);

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

  // Ensemble des titres "achevés" (normalisés) — recalculé à chaque
  // changement de rubriques pour prise en compte immédiate.
  const titresAchevesNoms = useMemo(
    () => buildTitresAchevesSet(rubriques),
    [rubriques],
  );

  const entreesFiltrees = useMemo(
    () => filtrerEntrees(entrees, filtres, titresAchevesNoms),
    [entrees, filtres, titresAchevesNoms],
  );

  const groupes = useMemo(() => grouperParMois(entreesFiltrees), [entreesFiltrees]);

  const rubriquesAvecCouleur = useMemo(
    () =>
      rubriques.map((r, idx) => ({
        ...r,
        couleur: couleurRubrique(r, idx),
      })),
    [rubriques],
  );

  const rubriquesMap = useMemo(() => {
    const m = new Map<string, RubriqueCahier & { couleur: string }>();
    rubriquesAvecCouleur.forEach((r) => {
      m.set(r.id, { ...r, couleur: r.couleur! });
    });
    return m;
  }, [rubriquesAvecCouleur]);

  function toggleEntree(id: string) {
    setEntreeOuverte((prev) => (prev === id ? null : id));
  }

  function renderSeance(entree: EntreeCahier) {
    const estOuverte = entreeOuverte === entree.id;
    const aMedias = (entree.piecesJointes?.length ?? 0) > 0;
    const aLiens = (entree.liens?.length ?? 0) > 0;
    const aEbooks = (entree.ebooksLies?.length ?? 0) > 0;
    const rubrique = entree.rubriqueId ? rubriquesMap.get(entree.rubriqueId) : undefined;

    const ligneDate =
      `📅 ${formatDateLongue(entree.date as { toDate: () => Date })}` +
      (entree.heureDebut
        ? ` · ${entree.heureDebut}${entree.heureFin ? ` → ${entree.heureFin}` : ''}`
        : '');

    return (
      <article key={entree.id} className="seance-card-eleve">
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
          <div className="seance-card-eleve-date">{ligneDate}</div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ margin: 0 }}>{entree.chapitre}</h3>

              {rubrique && (
                <span
                  className="seance-rubrique-badge"
                  style={{
                    backgroundColor: `${rubrique.couleur}1a`,
                    borderColor: rubrique.couleur,
                    color: rubrique.couleur,
                    marginTop: '0.35rem',
                    display: 'inline-flex',
                  }}
                >
                  <span
                    className="seance-rubrique-dot"
                    style={{ backgroundColor: rubrique.couleur }}
                    aria-hidden="true"
                  />
                  {rubrique.nom}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '1.1rem',
                transition: 'transform 0.2s',
                transform: estOuverte ? 'rotate(180deg)' : 'rotate(0)',
                display: 'inline-block',
                flexShrink: 0,
                paddingTop: 2,
              }}
              aria-hidden="true"
            >
              ▾
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
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

        {estOuverte && (
          <div
            id={`seance-corps-${entree.id}`}
            style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}
          >
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

            {entree.contenu && (
              <div
                className="seance-card-eleve-contenu rte-content rte-content--lecture"
                dangerouslySetInnerHTML={{ __html: entree.contenu }}
              />
            )}

            {/* Phase 34 — Exercices liés à la leçon (côté élève, lecture seule) */}
            {entree.exerciceJour && (
              <section
                style={{
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 12,
                }}
                aria-label="Exercice du jour"
              >
                <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#4338ca', fontWeight: 700 }}>
                  🎯 Exercice du jour (application)
                </h4>
                <div
                  className="rte-content rte-content--lecture"
                  dangerouslySetInnerHTML={{ __html: entree.exerciceJour }}
                />
              </section>
            )}

            {entree.exerciceDomicile && (
              <section
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 12,
                }}
                aria-label="Exercice à domicile"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#9a3412', fontWeight: 700 }}>
                    🏠 Exercice à domicile
                  </h4>
                  {/* Phase 35 — pastille d'échéance si définie */}
                  {entree.echeanceDomicile?.date && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontWeight: 600,
                      }}
                      title="Date et heure limite de remise"
                    >
                      📅 À rendre le {(() => {
                        const [y, m, d] = entree.echeanceDomicile.date.split('-');
                        return `${d}/${m}/${y}`;
                      })()}
                      {entree.echeanceDomicile.heure ? ` à ${entree.echeanceDomicile.heure}` : ''}
                    </span>
                  )}
                </div>
                <div
                  className="rte-content rte-content--lecture"
                  dangerouslySetInnerHTML={{ __html: entree.exerciceDomicile }}
                />
              </section>
            )}

            {aLiens && (
              <LienExterneEditor liens={entree.liens ?? []} onChange={() => {}} readonly />
            )}
            {aEbooks && (
              <EbookSelector ebooksLies={entree.ebooksLies ?? []} onChange={() => {}} readonly />
            )}
            {aMedias && (
              <MediaPlayer
                piecesJointes={entree.piecesJointes ?? []}
                entreeId={entree.id}
                profId={cahier.profId}
                onChange={() => {}}
                readonly
              />
            )}

            {/* Phase 32 — Quiz rattachés à cette séance.
                Le composant gère son propre état (loading/vide) :
                s'il n'y a aucun quiz, il ne rend rien. */}
            <QuizsDeSeance seanceId={entree.id} compact />
          </div>
        )}
      </article>
    );
  }

  if (chargement) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <p>Chargement du cahier de textes…</p>
      </div>
    );
  }

  if (erreur || !cahier) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '2.5rem' }}>🔒</div>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>{erreur || 'Accès non autorisé'}</p>
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

  const aFiltreActif = filtresActifs(filtres);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
      <header className="eleve-cahier-header">
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
        <span className="badge-lecture-seule">👁️ Lecture seule — Séances réalisées</span>
      </header>

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

      {entrees.length > 0 && (
        <ElveCahierFiltres
          filtres={filtres}
          onChangeFiltres={setFiltres}
          rubriques={rubriquesAvecCouleur}
          totalEntrees={entrees.length}
          entreesFiltrees={entreesFiltrees.length}
        />
      )}

      {!aFiltreActif && (
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 16 }}>
          {entrees.length === 0
            ? "Aucune séance réalisée pour l'instant."
            : `${entrees.length} séance${entrees.length > 1 ? 's' : ''} réalisée${entrees.length > 1 ? 's' : ''}`}
        </p>
      )}

      {entrees.length === 0 && (
        <div className="eleve-vide">
          <span className="emoji">📭</span>
          <p>Votre professeur n'a pas encore enregistré de séance réalisée.</p>
          <p style={{ fontSize: '0.8rem' }}>Revenez plus tard !</p>
        </div>
      )}

      {entrees.length > 0 && entreesFiltrees.length === 0 && (
        <div className="filtres-vide">
          <span className="filtres-vide-emoji">🔍</span>
          <p className="filtres-vide-titre">Aucune séance pour cette sélection</p>
          <p className="filtres-vide-sub">
            Aucune séance réalisée ne correspond à vos critères de filtrage. Essayez une autre période ou
            une autre rubrique.
          </p>
          <button type="button" className="filtres-vide-btn" onClick={() => setFiltres(FILTRES_DEFAUT)}>
            ✕ Effacer les filtres
          </button>
        </div>
      )}

      {entreesFiltrees.length > 0 && (
        <>
          {groupes.map((groupe, gi) => (
            <React.Fragment key={groupe.cle}>
              <div
                className="seances-mois-header"
                style={{ marginTop: gi === 0 ? 0 : undefined }}
                aria-label={`Séances de ${groupe.label}`}
              >
                <span>{groupe.label}</span>
              </div>
              {groupe.entrees.map((e) => renderSeance(e))}
            </React.Fragment>
          ))}
        </>
      )}
    </main>
  );
};

export default ElveCahierPage;
