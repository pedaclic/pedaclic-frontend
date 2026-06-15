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
import { subscribeEmploi, creerOuMajEmploi, getTousEmplois } from '../../services/emploiDuTempsService';
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

/**
 * Modes de consultation de l'emploi du temps (point d'optimisation demandé) :
 *   - 'classe'        : grille hebdomadaire d'UNE classe + édition (comportement existant, inchangé)
 *   - 'semaine-toutes': filtre hebdomadaire sur l'ENSEMBLE des classes (lecture seule)
 *   - 'jour-toutes'   : filtre journalier exhaustif sur l'ENSEMBLE des classes (lecture seule)
 */
type VueEmploi = 'classe' | 'semaine-toutes' | 'jour-toutes';

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

/**
 * Détermine le jour de la semaine courant (pour pré-sélectionner le filtre
 * journalier sur « aujourd'hui »). getDay() : 0=dimanche … 6=samedi.
 * Le dimanche (absent de l'emploi du temps) bascule sur 'lundi'.
 */
function jourCourant(): JourSemaine {
  const map: Record<number, JourSemaine> = {
    1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi',
  };
  return map[new Date().getDay()] ?? 'lundi';
}

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

  // ── Optimisation : mode de consultation + données agrégées ──────
  const [vue, setVue] = useState<VueEmploi>('classe');           // vue active
  const [jourFiltre, setJourFiltre] = useState<JourSemaine>(jourCourant()); // jour du filtre journalier
  const [tousEmplois, setTousEmplois] = useState<EmploiDuTemps[]>([]);      // tous les EDT (vues agrégées)
  const [loadingTous, setLoadingTous] = useState(false);

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
  // (inchangé — sert la vue 'classe' et l'édition).
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

  // Chargement des vues agrégées (toutes classes) : uniquement quand
  // une vue agrégée est active. Rechargé à l'ouverture, au changement
  // de vue ou d'année scolaire.
  useEffect(() => {
    if (!open || vue === 'classe') return;
    let actif = true;
    setLoadingTous(true);
    setErreur('');
    getTousEmplois(annee)
      .then((liste) => { if (actif) setTousEmplois(liste); })
      .catch(() => { if (actif) setErreur('Lecture des emplois du temps impossible.'); })
      .finally(() => { if (actif) setLoadingTous(false); });
    return () => { actif = false; };
  }, [open, vue, annee]);

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
  // `classeCtx` = classe à laquelle appartient le créneau. En vue 'classe'
  // c'est la classe sélectionnée ; en vues agrégées, la classe du bloc affiché.
  const handleClickCreneau = (c: Creneau, classeCtx: Classe = classe) => {
    if (!estLie(c)) return;
    onOuvrirCahier!({
      classe: classeCtx,
      matiere: c.matiere,
      groupeId: c.groupeId,
      groupeNom: c.groupeNom,
    });
  };

  // ── Rendu d'une carte « créneau » (factorisé pour toutes les vues) ─
  //   classeCtx   : classe d'appartenance (pour le lien au cahier + l'info-bulle)
  //   lectureSeule: masque le bouton de suppression (vues agrégées = consultation)
  const renderCreneau = (c: Creneau, classeCtx: Classe, lectureSeule: boolean) => (
    <div
      key={c.id}
      className={`edt-creneau${estLie(c) ? ' edt-creneau--link' : ''}`}
      onClick={() => handleClickCreneau(c, classeCtx)}
      title={estLie(c) ? `Ouvrir le Cahier de textes (${c.groupeNom ?? classeCtx}${c.matiere ? ' · ' + c.matiere : ''})` : undefined}
    >
      <div className="edt-creneau-head">
        <span className="edt-creneau-heure">{c.heureDebut}–{c.heureFin}</span>
        {!lectureSeule && (
          <button
            className="edt-creneau-del"
            onClick={(e) => { e.stopPropagation(); handleSupprimer(c.id); }}
            disabled={busy}
            aria-label="Supprimer le créneau"
          >🗑</button>
        )}
      </div>
      <div className="edt-creneau-act">
        {c.activite}{estLie(c) ? ' →' : ''}
      </div>
      {c.groupeNom && <div className="edt-creneau-salle">👥 {c.groupeNom}</div>}
      {c.matiere && <div className="edt-creneau-salle">📘 {c.matiere}</div>}
      <div className="edt-creneau-salle">🏫 {c.salle}</div>
    </div>
  );

  // Liste des classes possédant au moins un créneau (vues agrégées),
  // triée selon l'ordre pédagogique officiel (PS → Terminale).
  const emploisNonVides = CLASSES
    .map((cls) => tousEmplois.find((e) => e.classe === cls))
    .filter((e): e is EmploiDuTemps => !!e && Array.isArray(e.creneaux) && e.creneaux.length > 0);

  return (
    <div className="edt-overlay" onClick={onClose}>
      <div className="edt-drawer" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="edt-drawer-header">
          <span className="edt-drawer-title">📅 Emploi du temps</span>
          <button className="edt-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="edt-drawer-body">
          {/* Sélecteurs : Vue (filtre) / Classe / Jour / Année */}
          <div className="edt-selectors">
            {/* Filtre principal : choix du mode de consultation */}
            <label>
              Vue
              <select value={vue} onChange={(e) => setVue(e.target.value as VueEmploi)}>
                <option value="classe">Par classe (semaine)</option>
                <option value="semaine-toutes">Toutes les classes (semaine)</option>
                <option value="jour-toutes">Toutes les classes (jour)</option>
              </select>
            </label>

            {/* Sélecteur de classe : utile uniquement en vue 'classe' (+ édition) */}
            {vue === 'classe' && (
              <label>
                Classe
                <select value={classe} onChange={(e) => setClasse(e.target.value as Classe)}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}

            {/* Sélecteur de jour : utile uniquement pour le filtre journalier */}
            {vue === 'jour-toutes' && (
              <label>
                Jour
                <select value={jourFiltre} onChange={(e) => setJourFiltre(e.target.value as JourSemaine)}>
                  {JOURS_SEMAINE.map((j) => <option key={j.valeur} value={j.valeur}>{j.label}</option>)}
                </select>
              </label>
            )}

            <label>
              Année scolaire
              <select value={annee} onChange={(e) => setAnnee(e.target.value as AnneeScolaire)}>
                {ANNEES_SCOLAIRES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          {/* ════════════════════════════════════════════════════════
              VUE 1 — PAR CLASSE (semaine) : grille + édition.
              Comportement existant, strictement préservé.
              ════════════════════════════════════════════════════════ */}
          {vue === 'classe' && (
            <>
              {/* Grille hebdomadaire : une colonne par jour */}
              <div className="edt-grid">
                {JOURS_SEMAINE.map((j) => {
                  const duJour = creneaux
                    .filter((c) => c.jour === j.valeur)
                    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
                  return (
                    <div className="edt-day-col" key={j.valeur}>
                      <div className="edt-day-head">{j.court}</div>
                      {duJour.map((c) => renderCreneau(c, classe, false))}
                    </div>
                  );
                })}
              </div>

              {creneaux.length === 0 && (
                <div className="edt-empty">Aucun créneau pour cette classe. Ajoutez-en ci-dessous.</div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              VUE 2 — TOUTES LES CLASSES (semaine), lecture seule.
              Un bloc par classe ; chaque bloc = grille hebdomadaire.
              ════════════════════════════════════════════════════════ */}
          {vue === 'semaine-toutes' && (
            <div className="edt-agg">
              {erreur && <div className="edt-error">{erreur}</div>}
              {loadingTous && <div className="edt-empty">Chargement…</div>}
              {!loadingTous && emploisNonVides.length === 0 && (
                <div className="edt-empty">Aucun emploi du temps renseigné pour {annee}.</div>
              )}
              {!loadingTous && emploisNonVides.map((e) => (
                <div className="edt-class-block" key={e.id}>
                  <div className="edt-class-title">{e.classe}</div>
                  <div className="edt-grid">
                    {JOURS_SEMAINE.map((j) => {
                      const duJour = e.creneaux
                        .filter((c) => c.jour === j.valeur)
                        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
                      return (
                        <div className="edt-day-col" key={j.valeur}>
                          <div className="edt-day-head">{j.court}</div>
                          {duJour.map((c) => renderCreneau(c, e.classe, true))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              VUE 3 — TOUTES LES CLASSES (jour choisi), lecture seule.
              Affichage exhaustif des cours du jour, groupés par classe.
              ════════════════════════════════════════════════════════ */}
          {vue === 'jour-toutes' && (
            <div className="edt-agg">
              {erreur && <div className="edt-error">{erreur}</div>}
              {loadingTous && <div className="edt-empty">Chargement…</div>}
              {!loadingTous && (() => {
                // Pour chaque classe (ordre officiel), créneaux du jour filtré.
                const blocs = emploisNonVides
                  .map((e) => ({
                    classe: e.classe,
                    creneaux: e.creneaux
                      .filter((c) => c.jour === jourFiltre)
                      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
                  }))
                  .filter((b) => b.creneaux.length > 0);

                if (blocs.length === 0) {
                  const label = JOURS_SEMAINE.find((j) => j.valeur === jourFiltre)?.label ?? '';
                  return <div className="edt-empty">Aucun cours le {label.toLowerCase()} pour {annee}.</div>;
                }
                return blocs.map((b) => (
                  <div className="edt-class-block" key={b.classe}>
                    <div className="edt-class-title">{b.classe}</div>
                    {/* Liste horizontale des créneaux du jour pour cette classe */}
                    <div className="edt-day-list">
                      {b.creneaux.map((c) => renderCreneau(c, b.classe, true))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              ÉDITION — Ajout d'un créneau. Réservé à la vue 'classe'
              (les vues agrégées sont en consultation seule).
              ════════════════════════════════════════════════════════ */}
          {vue === 'classe' && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploiDuTempsDrawer;
