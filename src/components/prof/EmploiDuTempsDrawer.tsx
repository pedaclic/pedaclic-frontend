// ============================================================
// PedaClic — Emploi du Temps (fenêtre flottante / drawer)
// Affiche la grille hebdomadaire d'une classe (emploi du temps
// partagé par classe + année), permet d'ajouter/supprimer des
// créneaux, et ouvre directement la saisie du Cahier de textes
// du GROUPE/section correspondant.
//
// Sources de référence (corrige les anomalies signalées) :
//   - Matières : useDisciplinesOptions() (collection `disciplines`,
//     EXACTEMENT la même source que le Cahier de textes).
//   - Classe réelle : le GROUPE du prof (4PIB, 4PFA…), qui assure
//     une liaison rigoureuse au bon cahier (résolution par groupeId).
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  CLASSES,
  ANNEES_SCOLAIRES,
  normaliserClassePourComparaison,
} from '../../types/cahierTextes.types';
import type { Classe, AnneeScolaire, GroupeProf } from '../../types/cahierTextes.types';
import {
  JOURS_SEMAINE,
  genererCreneauId,
} from '../../types/emploiDuTemps.types';
import type { Creneau, JourSemaine, EmploiDuTemps } from '../../types/emploiDuTemps.types';
import { subscribeEmploi, creerOuMajEmploi } from '../../services/emploiDuTempsService';
import { useDisciplinesOptions } from '../../hooks/useDisciplinesOptions';
import '../../styles/EmploiDuTemps.css';

/** Données transmises au parent quand on clique un créneau (point 4). */
export interface OuvrirCahierInfo {
  classe: Classe;
  matiere?: string;
  groupeId?: string;
  groupeNom?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profId: string;
  profNom: string;
  /** Groupes/sections du prof (source de la liaison rigoureuse au cahier) */
  groupes: GroupeProf[];
  /** Classe pré-sélectionnée (ex. depuis le conditionnement de création) */
  initialClasse?: Classe;
  /** Année pré-sélectionnée */
  initialAnnee?: AnneeScolaire;
  /** Clic sur un créneau lié → ouvrir la saisie du cahier correspondant */
  onOuvrirCahier?: (info: OuvrirCahierInfo) => void;
}

interface NouveauCreneau {
  jour: JourSemaine;
  heureDebut: string;
  heureFin: string;
  activite: string;
  salle: string;
  matiere: string;     // valeur issue de `disciplines` ('' = aucune)
  groupeId: string;    // id du groupe sélectionné ('' = aucun)
}

const creneauVide: NouveauCreneau = {
  jour: 'lundi',
  heureDebut: '08:00',
  heureFin: '09:00',
  activite: '',
  salle: '',
  matiere: '',
  groupeId: '',
};

const EmploiDuTempsDrawer: React.FC<Props> = ({
  open,
  onClose,
  profId,
  profNom,
  groupes,
  initialClasse,
  initialAnnee,
  onOuvrirCahier,
}) => {
  const [classe, setClasse] = useState<Classe>(initialClasse ?? '6ème');
  const [annee, setAnnee] = useState<AnneeScolaire>(initialAnnee ?? '2025-2026');
  const [emploi, setEmploi] = useState<EmploiDuTemps | null>(null);
  const [nouveau, setNouveau] = useState<NouveauCreneau>(creneauVide);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  // BUG 1 — matières issues de la MÊME source que le Cahier de textes
  const { matieres: matieresDispos, loading: loadingMatieres } = useDisciplinesOptions();

  // Resynchronise la classe/année quand on (ré)ouvre le panneau
  useEffect(() => {
    if (open) {
      if (initialClasse) setClasse(initialClasse);
      if (initialAnnee) setAnnee(initialAnnee);
    }
  }, [open, initialClasse, initialAnnee]);

  // Écoute temps réel de l'emploi du temps de la classe sélectionnée
  useEffect(() => {
    if (!open) return;
    const unsub = subscribeEmploi(
      classe,
      annee,
      (e) => setEmploi(e),
      () => setErreur('Lecture de l\'emploi du temps impossible.')
    );
    return () => unsub();
  }, [open, classe, annee]);

  if (!open) return null;

  const creneaux: Creneau[] = emploi?.creneaux ?? [];

  // BUG 2 — groupes du prof correspondant à la classe affichée (4PIB, 4PFA…)
  const groupesClasse = groupes.filter(
    (g) => normaliserClassePourComparaison(g.classe) === normaliserClassePourComparaison(classe)
  );
  const groupesProposes = groupesClasse.length > 0 ? groupesClasse : groupes;

  // ── Ajouter un créneau ────────────────────────────────────
  const handleAjouter = async () => {
    setErreur('');
    if (!nouveau.activite.trim() || !nouveau.salle.trim()) {
      setErreur('Activité et salle sont requises.');
      return;
    }
    if (nouveau.heureFin <= nouveau.heureDebut) {
      setErreur('L\'heure de fin doit suivre l\'heure de début.');
      return;
    }
    const groupeSel = groupes.find((g) => g.id === nouveau.groupeId);
    const creneau: Creneau = {
      id: genererCreneauId(),
      jour: nouveau.jour,
      heureDebut: nouveau.heureDebut,
      heureFin: nouveau.heureFin,
      activite: nouveau.activite.trim(),
      salle: nouveau.salle.trim(),
      ...(nouveau.matiere ? { matiere: nouveau.matiere } : {}),
      ...(groupeSel ? { groupeId: groupeSel.id, groupeNom: groupeSel.nom } : {}),
      profId,
      profNom,
    };
    setBusy(true);
    try {
      await creerOuMajEmploi(classe, annee, [...creneaux, creneau], profId, profNom);
      // Conserve jour + horaires pour enchaîner, vide le reste
      setNouveau((n) => ({ ...n, activite: '', salle: '', matiere: '', groupeId: '' }));
    } catch {
      setErreur('Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ── Supprimer un créneau ──────────────────────────────────
  const handleSupprimer = async (id: string) => {
    setBusy(true);
    setErreur('');
    try {
      await creerOuMajEmploi(
        classe,
        annee,
        creneaux.filter((c) => c.id !== id),
        profId,
        profNom
      );
    } catch {
      setErreur('Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ── Clic créneau → saisie du cahier (lien rigoureux par groupe) ─
  const estLie = (c: Creneau) => !!(c.groupeId || c.matiere) && !!onOuvrirCahier;
  const handleClickCreneau = (c: Creneau) => {
    if (!estLie(c)) return;
    onOuvrirCahier!({
      classe,
      matiere: c.matiere,
      groupeId: c.groupeId,
      groupeNom: c.groupeNom,
    });
  };

  return (
    <div className="edt-overlay" onClick={onClose}>
      <div className="edt-drawer" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="edt-drawer-header">
          <span className="edt-drawer-title">📅 Emploi du temps</span>
          <button className="edt-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="edt-drawer-body">
          {/* Sélecteurs classe / année */}
          <div className="edt-selectors">
            <label>
              Classe
              <select value={classe} onChange={(e) => setClasse(e.target.value as Classe)}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Année scolaire
              <select value={annee} onChange={(e) => setAnnee(e.target.value as AnneeScolaire)}>
                {ANNEES_SCOLAIRES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          {/* Grille hebdomadaire : une colonne par jour */}
          <div className="edt-grid">
            {JOURS_SEMAINE.map((j) => {
              const duJour = creneaux
                .filter((c) => c.jour === j.valeur)
                .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
              return (
                <div className="edt-day-col" key={j.valeur}>
                  <div className="edt-day-head">{j.court}</div>
                  {duJour.map((c) => (
                    <div
                      key={c.id}
                      className={`edt-creneau${estLie(c) ? ' edt-creneau--link' : ''}`}
                      onClick={() => handleClickCreneau(c)}
                      title={estLie(c) ? `Ouvrir le Cahier de textes (${c.groupeNom ?? classe}${c.matiere ? ' · ' + c.matiere : ''})` : undefined}
                    >
                      <div className="edt-creneau-head">
                        <span className="edt-creneau-heure">{c.heureDebut}–{c.heureFin}</span>
                        <button
                          className="edt-creneau-del"
                          onClick={(e) => { e.stopPropagation(); handleSupprimer(c.id); }}
                          disabled={busy}
                          aria-label="Supprimer le créneau"
                        >🗑</button>
                      </div>
                      <div className="edt-creneau-act">
                        {c.activite}{estLie(c) ? ' →' : ''}
                      </div>
                      {c.groupeNom && <div className="edt-creneau-salle">👥 {c.groupeNom}</div>}
                      {c.matiere && <div className="edt-creneau-salle">📘 {c.matiere}</div>}
                      <div className="edt-creneau-salle">🏫 {c.salle}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {creneaux.length === 0 && (
            <div className="edt-empty">Aucun créneau pour cette classe. Ajoutez-en ci-dessous.</div>
          )}

          {/* Ajout d'un créneau : jour / horaire / activité / salle (+ matière, + groupe) */}
          <div className="edt-add">
            <div className="edt-add-title">Ajouter un créneau</div>
            <div className="edt-add-grid">
              <label>
                Jour
                <select
                  value={nouveau.jour}
                  onChange={(e) => setNouveau((n) => ({ ...n, jour: e.target.value as JourSemaine }))}
                >
                  {JOURS_SEMAINE.map((j) => <option key={j.valeur} value={j.valeur}>{j.label}</option>)}
                </select>
              </label>
              <label>
                Salle
                <input
                  type="text"
                  value={nouveau.salle}
                  placeholder="Ex : Salle 12"
                  onChange={(e) => setNouveau((n) => ({ ...n, salle: e.target.value }))}
                />
              </label>
              <label>
                Heure de début
                <input
                  type="time"
                  value={nouveau.heureDebut}
                  onChange={(e) => setNouveau((n) => ({ ...n, heureDebut: e.target.value }))}
                />
              </label>
              <label>
                Heure de fin
                <input
                  type="time"
                  value={nouveau.heureFin}
                  onChange={(e) => setNouveau((n) => ({ ...n, heureFin: e.target.value }))}
                />
              </label>
              <label>
                Activité
                <input
                  type="text"
                  value={nouveau.activite}
                  placeholder="Ex : Cours, TP…"
                  onChange={(e) => setNouveau((n) => ({ ...n, activite: e.target.value }))}
                />
              </label>
              <label>
                Matière (optionnel)
                <select
                  value={nouveau.matiere}
                  disabled={loadingMatieres}
                  onChange={(e) => setNouveau((n) => ({ ...n, matiere: e.target.value }))}
                >
                  <option value="">— Aucune —</option>
                  {matieresDispos.map((m) => <option key={m.valeur} value={m.valeur}>{m.label}</option>)}
                </select>
              </label>
              {/* BUG 2 — liaison rigoureuse : groupe/section exact du prof */}
              <label style={{ gridColumn: '1 / -1' }}>
                Classe / groupe (recommandé pour le lien au cahier)
                <select
                  value={nouveau.groupeId}
                  onChange={(e) => setNouveau((n) => ({ ...n, groupeId: e.target.value }))}
                >
                  <option value="">— Aucun —</option>
                  {groupesProposes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
              </label>
            </div>

            {erreur && (
              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.6rem' }}>{erreur}</div>
            )}

            <div className="edt-add-actions">
              <button className="btn-primary" onClick={handleAjouter} disabled={busy}>
                {busy ? 'Enregistrement…' : '+ Ajouter le créneau'}
              </button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.6rem' }}>
              Renseigner le groupe (ex. 4PFA) rend le créneau cliquable et ouvre exactement le Cahier de textes de cette section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmploiDuTempsDrawer;
