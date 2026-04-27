/**
 * ============================================================
 * PedaClic — Modale "Bulletin de suivi des absences/retards"
 * Phase 38
 * ============================================================
 *
 * Ouvre une fenêtre modale dans laquelle le professeur peut :
 *   1. Choisir la PÉRIODE (jour, semaine, mois, scolaire, personnalisée)
 *   2. Choisir le PÉRIMÈTRE (tout le groupe ou un élève précis)
 *   3. Choisir le MODE DE GÉNÉRATION (PDF unique groupé ou individuel)
 *   4. Lancer la génération via `genererBulletinAbsencesPDF()`
 *
 * Composant contrôlé par un état booléen `ouvert` côté parent.
 *
 * Fichier : src/components/prof/BulletinAbsencesModal.tsx
 * ============================================================
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { GroupeProf, EleveGroupeStats } from '../../types/prof';
import { getAbsencesByPeriod } from '../../services/groupeAbsencesService';
import {
  genererBulletinAbsencesPDF,
  type BulletinPeriode,
  type BulletinEleveInfo,
} from '../../utils/bulletinAbsencesPDF';
import { formatEleveNom, compareParNomFamille } from '../../utils/formatNom';

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface BulletinAbsencesModalProps {
  /** État ouvert/fermé contrôlé par le parent */
  ouvert: boolean;
  /** Callback de fermeture */
  onFermer: () => void;
  /** Groupe-classe concerné (titre, matière, classe, année…) */
  groupe: GroupeProf;
  /** Liste des élèves du groupe (déjà chargée par le parent) */
  eleves: EleveGroupeStats[];
  /** ID du professeur (pour les requêtes Firestore filtrées) */
  profId: string;
  /** Nom affiché du professeur (signature en pied de page) */
  profNom?: string;
}

// Type local : période avec champ identifiant
type PeriodePreset =
  | 'jour'
  | 'semaine'
  | 'mois'
  | 'trimestre'
  | 'scolaire'
  | 'personnalisee';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES — calcul des bornes selon le preset
// ─────────────────────────────────────────────────────────────

/** Format YYYY-MM-DD à partir d'une Date locale. */
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

/** Calcule les bornes (debut, fin) en YYYY-MM-DD selon le preset. */
function bornesPeriode(preset: PeriodePreset, datePerso?: { debut: string; fin: string }): { debut: string; fin: string; label: string } {
  const aujourdhui = new Date();
  switch (preset) {
    case 'jour': {
      const iso = isoLocal(aujourdhui);
      return { debut: iso, fin: iso, label: 'Aujourd’hui' };
    }
    case 'semaine': {
      // 7 jours glissants (incluant aujourd'hui)
      const debut = new Date(aujourdhui);
      debut.setDate(debut.getDate() - 6);
      return { debut: isoLocal(debut), fin: isoLocal(aujourdhui), label: '7 derniers jours' };
    }
    case 'mois': {
      const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
      const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0);
      const moisLabel = aujourdhui.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { debut: isoLocal(debut), fin: isoLocal(fin), label: moisLabel };
    }
    case 'trimestre': {
      // Trimestre civil simplifié : 3 derniers mois
      const debut = new Date(aujourdhui);
      debut.setMonth(debut.getMonth() - 3);
      return {
        debut: isoLocal(debut),
        fin: isoLocal(aujourdhui),
        label: 'Trimestre (3 derniers mois)',
      };
    }
    case 'scolaire': {
      // Année scolaire = sept (année courante - 1 si avant sept) → août suivant
      const annee = aujourdhui.getMonth() < 8 // janv–août = année précédente
        ? aujourdhui.getFullYear() - 1
        : aujourdhui.getFullYear();
      const debut = new Date(annee, 8, 1); // 1er septembre
      const fin = new Date(annee + 1, 7, 31); // 31 août
      return {
        debut: isoLocal(debut),
        fin: isoLocal(fin),
        label: `Année scolaire ${annee}-${annee + 1}`,
      };
    }
    case 'personnalisee': {
      const dD = datePerso?.debut || isoLocal(aujourdhui);
      const dF = datePerso?.fin || isoLocal(aujourdhui);
      return { debut: dD, fin: dF, label: `Du ${dD} au ${dF}` };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

const BulletinAbsencesModal: React.FC<BulletinAbsencesModalProps> = ({
  ouvert,
  onFermer,
  groupe,
  eleves,
  profId,
  profNom,
}) => {
  // ── État local ──
  const [preset, setPreset] = useState<PeriodePreset>('mois');
  const [datePerso, setDatePerso] = useState<{ debut: string; fin: string }>({
    debut: isoLocal(new Date()),
    fin: isoLocal(new Date()),
  });
  /** Périmètre : 'tous' ou eleveId */
  const [perimetre, setPerimetre] = useState<string>('tous');
  /** Génération en cours */
  const [generation, setGeneration] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Reset à chaque ouverture
  useEffect(() => {
    if (ouvert) {
      setPreset('mois');
      setPerimetre('tous');
      setErreur(null);
    }
  }, [ouvert]);

  /** Élèves triés alphabétiquement (NOM de famille) pour le select. */
  const elevesTries = useMemo(() => {
    return [...eleves].sort((a, b) => compareParNomFamille(a.eleveNom, b.eleveNom));
  }, [eleves]);

  /** Calcul de la période active (libellé + bornes). */
  const periodeActive: BulletinPeriode = useMemo(() => {
    const { debut, fin, label } = bornesPeriode(preset, datePerso);
    return { debut, fin, label };
  }, [preset, datePerso]);

  // ── Lancement de la génération ──
  const handleGenerer = async () => {
    try {
      setGeneration(true);
      setErreur(null);

      // 1. Charger les appels de la période (filtre Firestore)
      const absences = await getAbsencesByPeriod(
        groupe.id,
        periodeActive.debut,
        periodeActive.fin,
        profId,
      );

      // 2. Sélectionner les élèves à inclure
      const elevesInfos: BulletinEleveInfo[] = elevesTries
        .filter((e) => perimetre === 'tous' || e.eleveId === perimetre)
        .map((e) => ({
          eleveId: e.eleveId,
          eleveNom: e.eleveNom,
          eleveEmail: e.eleveEmail,
        }));

      if (elevesInfos.length === 0) {
        setErreur("Aucun élève à inclure dans le bulletin.");
        return;
      }

      // 3. Mode (groupe = synthèse + détail / individuel = juste détail)
      const mode = perimetre === 'tous' ? 'groupe' : 'individuel';

      // 4. Génération du PDF
      await genererBulletinAbsencesPDF({
        groupe: {
          nom: groupe.nom,
          matiere: groupe.matiereNom,
          classe: groupe.classeNiveau,
          anneeScolaire: groupe.anneeScolaire,
          profNom,
        },
        eleves: elevesInfos,
        absences,
        periode: periodeActive,
        mode,
      });

      onFermer();
    } catch (err: any) {
      console.error('Erreur génération bulletin:', err);
      setErreur(err?.message || 'Impossible de générer le bulletin. Veuillez réessayer.');
    } finally {
      setGeneration(false);
    }
  };

  if (!ouvert) return null;

  return (
    <div
      className="rte-modale-overlay"
      onClick={onFermer}
      role="presentation"
      aria-hidden="false"
    >
      <div
        className="rte-modale"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Générer un bulletin de suivi"
        style={{ maxWidth: 520 }}
      >
        <div className="rte-modale__header">
          <h3 className="rte-modale__titre">📄 Bulletin de suivi des absences & retards</h3>
          <button
            type="button"
            className="rte-modale__fermer"
            onClick={onFermer}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="rte-modale__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* ── Bloc 1 : Période ── */}
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a', padding: '0 0.4rem' }}>
              📅 Période couverte
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {([
                { v: 'jour' as PeriodePreset, label: 'Aujourd’hui' },
                { v: 'semaine' as PeriodePreset, label: '7 jours' },
                { v: 'mois' as PeriodePreset, label: 'Ce mois' },
                { v: 'trimestre' as PeriodePreset, label: 'Trimestre' },
                { v: 'scolaire' as PeriodePreset, label: 'Année scolaire' },
                { v: 'personnalisee' as PeriodePreset, label: 'Personnalisée' },
              ]).map((opt) => {
                const actif = preset === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setPreset(opt.v)}
                    style={{
                      padding: '0.35rem 0.7rem',
                      border: `1px solid ${actif ? '#2563eb' : '#d1d5db'}`,
                      borderRadius: 6,
                      background: actif ? '#eff6ff' : '#ffffff',
                      color: actif ? '#1e40af' : '#374151',
                      fontWeight: actif ? 600 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* Champs de date personnalisée */}
            {preset === 'personnalisee' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', color: '#475569', flex: 1 }}>
                  Du
                  <input
                    type="date"
                    value={datePerso.debut}
                    onChange={(e) => setDatePerso((p) => ({ ...p, debut: e.target.value }))}
                    style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', color: '#475569', flex: 1 }}>
                  Au
                  <input
                    type="date"
                    value={datePerso.fin}
                    onChange={(e) => setDatePerso((p) => ({ ...p, fin: e.target.value }))}
                    style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}
                  />
                </label>
              </div>
            )}
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              📊 Période active : <strong>{periodeActive.label}</strong>
            </p>
          </fieldset>

          {/* ── Bloc 2 : Périmètre ── */}
          <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a', padding: '0 0.4rem' }}>
              👥 Élève(s) concerné(s)
            </legend>
            <select
              value={perimetre}
              onChange={(e) => setPerimetre(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: '0.86rem',
                background: '#ffffff',
              }}
            >
              <option value="tous">📋 Tout le groupe ({eleves.length} élève{eleves.length > 1 ? 's' : ''})</option>
              {elevesTries.map((e) => (
                <option key={e.eleveId} value={e.eleveId}>
                  {formatEleveNom(e.eleveNom)}
                </option>
              ))}
            </select>
            <p style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#6b7280' }}>
              {perimetre === 'tous'
                ? 'Le PDF contiendra une page de synthèse + une page de détail par élève.'
                : 'Le PDF ne contiendra que le détail de l’élève sélectionné.'}
            </p>
          </fieldset>

          {/* ── Erreur éventuelle ── */}
          {erreur && (
            <div
              role="alert"
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.82rem',
              }}
            >
              ⚠️ {erreur}
            </div>
          )}
        </div>

        {/* ── Footer : actions ── */}
        <div className="rte-modale__footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onFermer}
            disabled={generation}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-pedaclic"
            onClick={handleGenerer}
            disabled={generation}
          >
            {generation ? '⏳ Génération…' : '📄 Générer le bulletin'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulletinAbsencesModal;
