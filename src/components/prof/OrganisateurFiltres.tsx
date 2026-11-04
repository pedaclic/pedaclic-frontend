// ============================================================
// PedaClic — Phase 46 : Barre de filtres de l'organisateur
// ------------------------------------------------------------
// Composant CONTRÔLÉ : l'état vit dans CahierTextesPage.
// Ligne 1 : recherche · regroupement · gestion · réinitialiser
// Ligne 2 : pastilles d'établissements (sélection multiple)
// Ligne 3 : cycle → classe · matière · étiquettes
// ============================================================

import React from 'react';
import { NIVEAUX_SCOLAIRES, CLASSES_PAR_NIVEAU, CLASSES } from '../../types/cahierTextes.types';
import type { NiveauScolaire } from '../../types/cahierTextes.types';
import {
  FILTRE_SANS_ETABLISSEMENT,
  libelleCourtEtablissement,
  type EtablissementProf,
} from '../../types/etablissement.types';
import {
  nombreFiltresActifs,
  normaliser,
  filtresVides,
  type FiltresOrganisateur,
  type Regroupement,
} from '../../utils/organisateurCahiers';

interface OrganisateurFiltresProps {
  filtres: FiltresOrganisateur;
  onChange: (f: FiltresOrganisateur) => void;
  /** Établissements à proposer (actifs + archivés ayant des cahiers) */
  etablissements: EtablissementProf[];
  /** Nombre de cahiers par établissement (+ FILTRE_SANS_ETABLISSEMENT) */
  compteurs: Map<string, number>;
  /** Matières présentes dans les cahiers chargés */
  matieres: string[];
  /** Étiquettes présentes dans les cahiers chargés */
  etiquettes: string[];
  onGererEtablissements: () => void;
  /** Ouvre le classement en lot */
  onClasserEnLot: () => void;
}

const OrganisateurFiltres: React.FC<OrganisateurFiltresProps> = ({
  filtres, onChange, etablissements, compteurs, matieres, etiquettes, onGererEtablissements, onClasserEnLot,
}) => {
  // Mise à jour partielle de l'état
  const maj = (partiel: Partial<FiltresOrganisateur>) => onChange({ ...filtres, ...partiel });

  // Bascule d'une valeur dans une liste (établissements, étiquettes)
  const basculer = (liste: string[], v: string) =>
    liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v];

  // Classes proposées : celles du cycle choisi, sinon toutes
  const classesProposees = filtres.cycle
    ? CLASSES_PAR_NIVEAU[filtres.cycle].map(o => o.valeur)
    : [...CLASSES];

  const nbActifs = nombreFiltresActifs(filtres);
  const nbSansEtab = compteurs.get(FILTRE_SANS_ETABLISSEMENT) ?? 0;

  return (
    <section className="org-filtres" aria-label="Filtrer et organiser les cahiers">
      {/* ── Ligne 1 : recherche + regroupement ─────────────── */}
      <div className="org-filtres-ligne">
        <div className="org-recherche">
          <span aria-hidden="true">🔎</span>
          <input
            type="search"
            value={filtres.recherche}
            onChange={e => maj({ recherche: e.target.value })}
            placeholder="Rechercher un cahier, un établissement, une étiquette…"
            aria-label="Rechercher"
          />
        </div>

        <label className="org-regroupement">
          <span>Regrouper par</span>
          <select
            className="filtre-select"
            value={filtres.regroupement}
            onChange={e => maj({ regroupement: e.target.value as Regroupement })}
          >
            <option value="etablissement">Établissement</option>
            <option value="niveau">Niveau</option>
            <option value="aucun">Aucun</option>
          </select>
        </label>

        <button type="button" className="btn-secondary org-btn-gerer" onClick={onGererEtablissements}>
          🏫 Mes établissements
        </button>
        <button type="button" className="btn-secondary org-btn-gerer" onClick={onClasserEnLot}>
          🗂️ Classer
        </button>

        {nbActifs > 0 && (
          <button
            type="button"
            className="org-btn-reinit"
            // On garde le mode de regroupement choisi
            onClick={() => onChange({ ...filtresVides(), regroupement: filtres.regroupement })}
          >
            ✕ Réinitialiser ({nbActifs})
          </button>
        )}
      </div>

      {/* ── Ligne 2 : pastilles d'établissements ───────────── */}
      {(etablissements.length > 0 || nbSansEtab > 0) && (
        <div className="org-filtres-ligne org-pastilles" role="group" aria-label="Établissements">
          <button
            type="button"
            className={`org-pastille ${filtres.etablissements.length === 0 ? 'active' : ''}`}
            onClick={() => maj({ etablissements: [] })}
            aria-pressed={filtres.etablissements.length === 0}
          >
            Tous
          </button>

          {etablissements.map(e => {
            const actif = filtres.etablissements.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                className={`org-pastille ${actif ? 'active' : ''} ${e.isArchived ? 'org-pastille--archivee' : ''}`}
                // La couleur de l'établissement est passée en variable CSS
                style={{ '--org-couleur': e.couleur } as React.CSSProperties}
                onClick={() => maj({ etablissements: basculer(filtres.etablissements, e.id) })}
                aria-pressed={actif}
                title={e.nom}
              >
                <span className="org-point" aria-hidden="true" />
                {libelleCourtEtablissement(e)}
                <span className="org-compteur">{compteurs.get(e.id) ?? 0}</span>
              </button>
            );
          })}

          {nbSansEtab > 0 && (
            <button
              type="button"
              className={`org-pastille org-pastille--aucun ${filtres.etablissements.includes(FILTRE_SANS_ETABLISSEMENT) ? 'active' : ''}`}
              onClick={() => maj({ etablissements: basculer(filtres.etablissements, FILTRE_SANS_ETABLISSEMENT) })}
              aria-pressed={filtres.etablissements.includes(FILTRE_SANS_ETABLISSEMENT)}
            >
              Non classés
              <span className="org-compteur">{nbSansEtab}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Ligne 3 : niveau, classe, matière, étiquettes ──── */}
      <div className="org-filtres-ligne">
        <select
          className="filtre-select"
          value={filtres.cycle}
          // Changer de cycle réinitialise la classe (cascade)
          onChange={e => maj({ cycle: e.target.value as NiveauScolaire | '', classe: '' })}
          aria-label="Cycle"
        >
          <option value="">Tous les cycles</option>
          {NIVEAUX_SCOLAIRES.map(n => (
            <option key={n.valeur} value={n.valeur}>{n.emoji} {n.label}</option>
          ))}
        </select>

        <select
          className="filtre-select"
          value={filtres.classe}
          onChange={e => maj({ classe: e.target.value })}
          aria-label="Classe"
        >
          <option value="">Toutes les classes</option>
          {classesProposees.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="filtre-select"
          value={filtres.matiere}
          onChange={e => maj({ matiere: e.target.value })}
          aria-label="Matière"
        >
          <option value="">Toutes les matières</option>
          {matieres.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Étiquettes : cliquer pour filtrer (ET logique) */}
        {etiquettes.length > 0 && (
          <div className="org-etiquettes-filtre" role="group" aria-label="Étiquettes">
            {etiquettes.map(t => {
              const actif = filtres.etiquettes.some(x => normaliser(x) === normaliser(t));
              return (
                <button
                  key={t}
                  type="button"
                  className={`org-puce-filtre ${actif ? 'active' : ''}`}
                  onClick={() => maj({
                    etiquettes: actif
                      ? filtres.etiquettes.filter(x => normaliser(x) !== normaliser(t))
                      : [...filtres.etiquettes, t],
                  })}
                  aria-pressed={actif}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default OrganisateurFiltres;
