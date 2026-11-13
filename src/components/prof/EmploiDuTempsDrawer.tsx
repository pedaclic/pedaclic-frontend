// ============================================================
// PedaClic — Emploi du Temps (fenêtre flottante / drawer)
// ------------------------------------------------------------
// PHASE 48 — Emploi du temps PERSONNEL, par établissement.
//   • Vue « Par classe »  : grille + édition pour (établissement, classe)
//   • Vue « Ma semaine »  : TOUS mes créneaux, tous établissements,
//                           avec alertes de chevauchement / battement
//   • Vue « Mon jour »    : les créneaux d'un jour, dans l'ordre
//   • Reprise : les créneaux saisis par ce professeur dans l'ancien
//     emploi du temps commun peuvent être importés en un clic.
//
// Inchangé : matières issues de `disciplines`, liaison rigoureuse
// au cahier par groupe (4PFA…), clic créneau → saisie du cahier.
//
// PHASE 55 — Créneaux DATÉS (l'emploi du temps peut évoluer) :
//   • ✏️ « Modifier » un créneau À PARTIR D'UNE DATE : l'ancien
//     horaire est conservé pour les semaines passées (les séances
//     déjà saisies ne sont jamais touchées) ;
//   • « Arrêter » un créneau à partir d'une date ;
//   • les anciens créneaux sont masqués par défaut (case à cocher
//     « Afficher les anciens créneaux »).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  CLASSES,
  normaliserClassePourComparaison,
} from '../../types/cahierTextes.types';
import type { Classe, AnneeScolaire, GroupeProf } from '../../types/cahierTextes.types';
import {
  JOURS_SEMAINE,
  genererCreneauId,
  emploiProfId,
} from '../../types/emploiDuTemps.types';
import type {
  Creneau,
  CreneauContexte,
  JourSemaine,
  EmploiDuTempsProf,
} from '../../types/emploiDuTemps.types';
import {
  subscribeEmploiProf,
  subscribeEmploisProfAnnee,
  enregistrerEmploiProf,
  creneauxHeritesDuProf,
} from '../../services/emploiDuTempsService';
import {
  aplatirCreneaux,
  detecterAlertes,
  chevauchementsAvec,
  trierCreneaux,
  enMinutes,
  jourCourant,
  // Phase 55 — créneaux datés
  cleDate,
  formaterCleDate,
  creneauValideLe,
  situationCreneau,
  modifierCreneauAPartirDu,
  arreterCreneauAPartirDu,
  type AlerteCreneau,
} from '../../utils/emploiDuTempsUtils';
import type { EtablissementProf } from '../../types/etablissement.types';
import { libelleCourtEtablissement } from '../../types/etablissement.types';
import { useDisciplinesOptions } from '../../hooks/useDisciplinesOptions';
import { useConfirm } from '../../contexts/ConfirmContext';
import { messageErreurFirestore } from '../../utils/messageErreurFirestore';
// Phase 45 — années scolaires administrables
import { useAnneesScolaires } from '../../hooks/useAnneesScolaires';
import { anneesPourSelect, calculerAnneeScolaireEnCours } from '../../types/anneesScolaires.types';
import '../../styles/EmploiDuTemps.css';

/** Données transmises au parent quand on clique un créneau. */
export interface OuvrirCahierInfo {
  classe: Classe;
  matiere?: string;
  groupeId?: string;
  groupeNom?: string;
  /** Phase 48 — établissement du créneau (cahier du bon établissement) */
  etablissementId?: string | null;
  // ── Phase 52 — champs optionnels envoyés par le bandeau « Aujourd'hui » ──
  //    (le tiroir de l'emploi du temps ne les fournit pas → comportement inchangé)
  /** Date précise du cours « YYYY-MM-DD » (pré-remplit la nouvelle séance) */
  date?: string;
  /** Horaires du créneau « HH:mm » (pré-remplissent la nouvelle séance) */
  heureDebut?: string;
  heureFin?: string;
  /** Cahier déjà résolu par le bandeau (évite une seconde recherche) */
  cahierId?: string;
  /** Séance déjà saisie pour ce créneau → ouverture directe de la séance */
  entreeId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profId: string;
  profNom: string;
  /** Groupes/sections du prof (source de la liaison rigoureuse au cahier) */
  groupes: GroupeProf[];
  /** Phase 48 — établissements actifs du carnet du professeur (Phase 46) */
  etablissements: EtablissementProf[];
  /** Classe pré-sélectionnée (ex. depuis le conditionnement de création) */
  initialClasse?: Classe;
  /** Année pré-sélectionnée */
  initialAnnee?: AnneeScolaire;
  /** Phase 48 — établissement pré-sélectionné (null = sans établissement) */
  initialEtablissementId?: string | null;
  /** Phase 48 — onglet affiché à l'ouverture (défaut : « Par classe ») */
  initialVue?: VueEmploi;
  /** Clic sur un créneau lié → ouvrir la saisie du cahier correspondant */
  onOuvrirCahier?: (info: OuvrirCahierInfo) => void;
}

/** Modes de consultation (Phase 48 : vues personnelles) */
export type VueEmploi = 'classe' | 'ma-semaine' | 'mon-jour';

/** Valeur des <select> pour « Sans établissement » */
const OPTION_SANS_ETAB = '';

interface NouveauCreneau {
  jour: JourSemaine;
  heureDebut: string;
  heureFin: string;
  activite: string;
  salle: string;
  matiere: string;     // valeur issue de `disciplines` ('' = aucune)
  groupeId: string;    // id du groupe sélectionné ('' = aucun)
  /** Phase 55 — « YYYY-MM-DD » ('' = valable toute l'année) */
  valideDu: string;
}

/**
 * Phase 55 — créneau en cours de MODIFICATION.
 * `dateEffet` : date à partir de laquelle le changement s'applique
 * ('' = simple correction, valable sur toute la période du créneau).
 */
interface EditionCreneau extends NouveauCreneau {
  id: string;
  dateEffet: string;
}

const creneauVide: NouveauCreneau = {
  jour: 'lundi',
  heureDebut: '08:00',
  heureFin: '09:00',
  activite: '',
  salle: '',
  matiere: '',
  groupeId: '',
  valideDu: '',
};

/** Durée totale d'une liste de créneaux, au format « 12 h 30 » */
function dureeTotale(liste: Creneau[]): string {
  const min = liste.reduce((t, c) => t + Math.max(0, enMinutes(c.heureFin) - enMinutes(c.heureDebut)), 0);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

const EmploiDuTempsDrawer: React.FC<Props> = ({
  open,
  onClose,
  profId,
  profNom,
  groupes,
  etablissements,
  initialClasse,
  initialAnnee,
  initialEtablissementId,
  initialVue,
  onOuvrirCahier,
}) => {
  const confirmDialog = useConfirm();
  const [classe, setClasse] = useState<Classe>(initialClasse ?? '6ème');
  // Phase 45 : année en cours par défaut
  const { config: anneesConfig, anneeCourante } = useAnneesScolaires();
  const [annee, setAnnee] = useState<AnneeScolaire>(initialAnnee ?? calculerAnneeScolaireEnCours());
  // Phase 48 : établissement de l'emploi du temps édité (null = sans)
  const [etabId, setEtabId] = useState<string | null>(
    initialEtablissementId !== undefined ? initialEtablissementId : (etablissements[0]?.id ?? null)
  );
  const [emploi, setEmploi] = useState<EmploiDuTempsProf | null>(null);
  const [tousMesEmplois, setTousMesEmplois] = useState<EmploiDuTempsProf[]>([]);
  const [herites, setHerites] = useState<Creneau[]>([]);
  const [nouveau, setNouveau] = useState<NouveauCreneau>(creneauVide);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  const [vue, setVue] = useState<VueEmploi>('classe');
  const [jourFiltre, setJourFiltre] = useState<JourSemaine>(jourCourant());
  /** Filtre des vues agrégées : 'tous' | id d'établissement | '' (sans) */
  const [filtreEtab, setFiltreEtab] = useState<string>('tous');

  // ── Phase 55 — créneaux datés ──
  /** Créneau en cours de modification (null = formulaire d'ajout) */
  const [edition, setEdition] = useState<EditionCreneau | null>(null);
  /** Afficher aussi les créneaux dont la période est terminée */
  const [afficherAnciens, setAfficherAnciens] = useState(false);
  /** Date du jour « YYYY-MM-DD » : repère ancien / actuel / à venir */
  const aujourdhui = cleDate();

  // Matières issues de la MÊME source que le Cahier de textes
  const { matieres: matieresDispos, loading: loadingMatieres } = useDisciplinesOptions();

  const etabsParId = useMemo(() => new Map(etablissements.map(e => [e.id, e])), [etablissements]);
  const etabCourant = etabId ? etabsParId.get(etabId) ?? null : null;

  // Si aucun établissement n'était choisi et que le carnet se charge
  // après l'ouverture, on sélectionne le premier établissement.
  useEffect(() => {
    if (initialEtablissementId === undefined && etabId === null && etablissements.length > 0) {
      setEtabId(etablissements[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etablissements.length]);

  // Resynchronise classe / année / établissement à la (ré)ouverture
  useEffect(() => {
    if (!open) return;
    if (initialClasse) setClasse(initialClasse);
    if (initialAnnee) setAnnee(initialAnnee);
    if (initialEtablissementId !== undefined) setEtabId(initialEtablissementId);
    setVue(initialVue ?? 'classe');
  }, [open, initialClasse, initialAnnee, initialEtablissementId, initialVue]);

  // ── Emploi du temps personnel (établissement + classe) ─────
  useEffect(() => {
    if (!open || !profId) return;
    const unsub = subscribeEmploiProf(
      profId, etabId, classe, annee,
      (e) => setEmploi(e),
      (err) => setErreur(messageErreurFirestore(err, 'Lecture de l\'emploi du temps'))
    );
    return () => unsub();
  }, [open, profId, etabId, classe, annee]);

  // ── Tous mes emplois du temps de l'année (vues + alertes) ──
  useEffect(() => {
    if (!open || !profId) return;
    const unsub = subscribeEmploisProfAnnee(
      profId, annee,
      (liste) => setTousMesEmplois(liste),
      (err) => setErreur(messageErreurFirestore(err, 'Lecture des emplois du temps'))
    );
    return () => unsub();
  }, [open, profId, annee]);

  // ── Reprise : anciens créneaux de ce prof pour cette classe ─
  useEffect(() => {
    if (!open || !profId || vue !== 'classe') return;
    let actif = true;
    creneauxHeritesDuProf(profId, classe, annee).then(liste => { if (actif) setHerites(liste); });
    return () => { actif = false; };
  }, [open, profId, classe, annee, vue]);

  // Phase 55 — on quitte le mode « modification » dès que le contexte change
  useEffect(() => { setEdition(null); }, [open, classe, etabId, annee, vue]);

  // ── Données dérivées (calculées AVANT le retour anticipé) ──
  const tousCreneaux: CreneauContexte[] = useMemo(() => aplatirCreneaux(tousMesEmplois), [tousMesEmplois]);
  // Phase 55 — créneaux en vigueur ou à venir (les anciens ne servent qu'à l'historique)
  const creneauxEnCours: CreneauContexte[] = useMemo(
    () => tousCreneaux.filter(c => situationCreneau(c, aujourdhui) !== 'ancien'),
    [tousCreneaux, aujourdhui]
  );
  const alertes = useMemo(() => detecterAlertes(creneauxEnCours), [creneauxEnCours]);
  const nbConflits = useMemo(
    () => Array.from(alertes.values()).filter(l => l.some(a => a.type === 'chevauchement')).length,
    [alertes]
  );

  if (!open) return null;

  const creneaux: Creneau[] = emploi?.creneaux ?? [];
  // Phase 55 — grille « Par classe » : anciens créneaux masqués par défaut
  const nbAnciens = creneaux.filter(c => situationCreneau(c, aujourdhui) === 'ancien').length;
  const creneauxVisibles = afficherAnciens
    ? creneaux
    : creneaux.filter(c => situationCreneau(c, aujourdhui) !== 'ancien');
  const emploiIdCourant = emploiProfId(profId, etabId, classe, annee);

  // Créneaux hérités pas encore repris dans AUCUN de mes emplois du temps
  const idsDejaRepris = new Set(tousCreneaux.map(c => c.id));
  const heritesAReprendre = herites.filter(c => !idsDejaRepris.has(c.id));

  // Groupes du prof correspondant à la classe affichée (4PIB, 4PFA…)
  const groupesClasse = groupes.filter(
    (g) => normaliserClassePourComparaison(g.classe) === normaliserClassePourComparaison(classe)
  );
  const groupesProposes = groupesClasse.length > 0 ? groupesClasse : groupes;

  /** Enregistre la liste complète des créneaux de (établissement, classe) */
  const enregistrer = (liste: Creneau[]) =>
    enregistrerEmploiProf(
      profId,
      etabCourant ? { id: etabCourant.id, nom: etabCourant.nom } : null,
      classe,
      annee,
      liste
    );

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
    // Phase 48 — contrôle des chevauchements avec TOUS mes créneaux
    //   (Phase 55 : uniquement ceux dont la période croise celle du nouveau)
    const conflits = chevauchementsAvec(
      { ...nouveau, valideDu: nouveau.valideDu || undefined },
      creneauxEnCours
    );
    if (conflits.length) {
      const ok = await confirmDialog({
        title: 'Chevauchement d\'horaires',
        message: `Ce créneau chevauche : ${conflits
          .map(c => `${c.classe}${c.etablissementNom ? ` (${c.etablissementNom})` : ''} ${c.heureDebut}–${c.heureFin}`)
          .join(' ; ')}. L'ajouter quand même ?`,
        confirmLabel: 'Ajouter quand même',
        variant: 'warning',
      });
      if (!ok) return;
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
      // Phase 55 — créneau ajouté en cours d'année : pas d'effet rétroactif
      ...(nouveau.valideDu ? { valideDu: nouveau.valideDu } : {}),
      profId,
      profNom,
    };
    setBusy(true);
    try {
      await enregistrer([...creneaux, creneau]);
      // Conserve jour + horaires pour enchaîner, vide le reste
      setNouveau((n) => ({ ...n, activite: '', salle: '', matiere: '', groupeId: '' }));
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Enregistrement'));
    } finally {
      setBusy(false);
    }
  };

  // ── Supprimer un créneau ──────────────────────────────────
  //   Phase 55 : confirmation, car la suppression est RÉTROACTIVE (le
  //   créneau disparaît aussi des semaines passées). Pour un changement
  //   d'horaire, on utilise ✏️ « Modifier » ou « Arrêter ».
  const handleSupprimer = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Supprimer définitivement ce créneau ?',
      message: 'Il disparaîtra aussi des semaines passées (les séances déjà saisies restent dans le cahier). '
        + 'Pour un simple changement d\'horaire, utilisez plutôt ✏️ Modifier.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    if (edition?.id === id) setEdition(null);
    setBusy(true);
    setErreur('');
    try {
      await enregistrer(creneaux.filter((c) => c.id !== id));
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Suppression'));
    } finally {
      setBusy(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PHASE 55 — MODIFIER / ARRÊTER un créneau à partir d'une date
  // ═══════════════════════════════════════════════════════════

  /** Ouvre le formulaire en mode « modification », pré-rempli */
  const handleEditer = (c: Creneau) => {
    setErreur('');
    setEdition({
      id: c.id,
      jour: c.jour,
      heureDebut: c.heureDebut,
      heureFin: c.heureFin,
      activite: c.activite,
      salle: c.salle,
      matiere: c.matiere ?? '',
      groupeId: c.groupeId ?? '',
      valideDu: c.valideDu ?? '',
      // Par défaut : le changement s'applique dès aujourd'hui (ou dès le
      // début du créneau s'il n'a pas encore commencé)
      dateEffet: c.valideDu && c.valideDu > aujourdhui ? c.valideDu : aujourdhui,
    });
  };

  /** Enregistre la modification (datée, ou simple correction si date vide) */
  const handleModifier = async () => {
    if (!edition) return;
    const ancien = creneaux.find(c => c.id === edition.id);
    if (!ancien) { setEdition(null); return; }
    setErreur('');
    if (!edition.activite.trim() || !edition.salle.trim()) {
      setErreur('Activité et salle sont requises.');
      return;
    }
    if (edition.heureFin <= edition.heureDebut) {
      setErreur('L\'heure de fin doit suivre l\'heure de début.');
      return;
    }
    if (edition.dateEffet && ancien.valideJusquAu && edition.dateEffet > ancien.valideJusquAu) {
      setErreur(`Ce créneau s'arrête déjà le ${formaterCleDate(ancien.valideJusquAu)} : choisissez une date antérieure.`);
      return;
    }
    // Chevauchements du NOUVEL horaire, sur sa période d'application
    const debutNouveau = edition.dateEffet && (!ancien.valideDu || edition.dateEffet > ancien.valideDu)
      ? edition.dateEffet
      : ancien.valideDu;
    const conflits = chevauchementsAvec(
      { jour: edition.jour, heureDebut: edition.heureDebut, heureFin: edition.heureFin,
        valideDu: debutNouveau, valideJusquAu: ancien.valideJusquAu },
      creneauxEnCours,
      `${emploiIdCourant}:${ancien.id}`
    );
    if (conflits.length) {
      const ok = await confirmDialog({
        title: 'Chevauchement d\'horaires',
        message: `Le nouvel horaire chevauche : ${conflits
          .map(c => `${c.classe}${c.etablissementNom ? ` (${c.etablissementNom})` : ''} ${c.heureDebut}–${c.heureFin}`)
          .join(' ; ')}. Enregistrer quand même ?`,
        confirmLabel: 'Enregistrer quand même',
        variant: 'warning',
      });
      if (!ok) return;
    }
    const groupeSel = groupes.find((g) => g.id === edition.groupeId);
    setBusy(true);
    try {
      await enregistrer(modifierCreneauAPartirDu(
        creneaux,
        ancien.id,
        {
          jour: edition.jour,
          heureDebut: edition.heureDebut,
          heureFin: edition.heureFin,
          activite: edition.activite.trim(),
          salle: edition.salle.trim(),
          matiere: edition.matiere || undefined,
          // Groupe introuvable dans la liste (ex. archivé) → on garde le lien d'origine
          groupeId: groupeSel?.id ?? (edition.groupeId || undefined),
          groupeNom: groupeSel?.nom ?? ancien.groupeNom,
        },
        edition.dateEffet || undefined
      ));
      setEdition(null);
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Modification'));
    } finally {
      setBusy(false);
    }
  };

  /** Arrête le créneau à la date choisie (l'historique est conservé) */
  const handleArreter = async () => {
    if (!edition) return;
    setErreur('');
    if (!edition.dateEffet) {
      setErreur('Indiquez la date à partir de laquelle ce cours n\'a plus lieu.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Arrêter ce créneau ?',
      message: `Ce cours n'apparaîtra plus à partir du ${formaterCleDate(edition.dateEffet)}. `
        + 'Les semaines précédentes et les séances déjà saisies sont conservées.',
      confirmLabel: 'Arrêter le créneau',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await enregistrer(arreterCreneauAPartirDu(creneaux, edition.id, edition.dateEffet));
      setEdition(null);
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Arrêt du créneau'));
    } finally {
      setBusy(false);
    }
  };

  // ── Formulaire partagé « Ajouter » / « Modifier » (Phase 55) ──
  const form: NouveauCreneau = edition ?? nouveau;
  const majForm = (patch: Partial<EditionCreneau>) => {
    if (edition) setEdition(e => (e ? { ...e, ...patch } : e));
    else setNouveau(n => ({ ...n, ...patch }));
  };

  // ── Reprise des anciens créneaux ──────────────────────────
  const handleReprendre = async () => {
    setBusy(true);
    setErreur('');
    try {
      await enregistrer([...creneaux, ...heritesAReprendre]);
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Reprise'));
    } finally {
      setBusy(false);
    }
  };

  // ── Clic créneau → saisie du cahier (lien rigoureux par groupe) ─
  const estLie = (c: Creneau) => !!(c.groupeId || c.matiere) && !!onOuvrirCahier;
  const handleClickCreneau = (c: Creneau, classeCtx: Classe, etabCtx: string | null) => {
    if (!estLie(c)) return;
    onOuvrirCahier!({
      classe: classeCtx,
      matiere: c.matiere,
      groupeId: c.groupeId,
      groupeNom: c.groupeNom,
      etablissementId: etabCtx,
    });
  };

  // ── Carte « créneau » (toutes les vues) ───────────────────
  //   ctx              : classe / établissement / clé d'alerte
  //   lectureSeule     : masque la suppression (vues agrégées)
  //   afficherContexte : affiche classe + établissement (vues agrégées)
  const renderCreneau = (
    c: Creneau,
    ctx: { classe: Classe; etablissementId: string | null; etablissementNom: string; cle: string },
    lectureSeule: boolean,
    afficherContexte: boolean
  ) => {
    const etab = ctx.etablissementId ? etabsParId.get(ctx.etablissementId) : undefined;
    const sesAlertes: AlerteCreneau[] = alertes.get(ctx.cle) ?? [];
    const enConflit = sesAlertes.some(a => a.type === 'chevauchement');
    // Phase 55 — situation du créneau (ancien / actuel / à venir)
    const situation = situationCreneau(c, aujourdhui);
    const enEdition = !lectureSeule && edition?.id === c.id;
    return (
      <div
        key={ctx.cle}
        className={`edt-creneau${estLie(c) ? ' edt-creneau--link' : ''}${enConflit ? ' edt-creneau--conflit' : ''}${situation !== 'actuel' ? ` edt-creneau--${situation}` : ''}${enEdition ? ' edt-creneau--edition' : ''}`}
        // Liseré gauche = couleur de l'établissement (Phase 48)
        style={etab ? { borderLeftColor: etab.couleur } : undefined}
        onClick={() => handleClickCreneau(c, ctx.classe, ctx.etablissementId)}
        title={estLie(c) ? `Ouvrir le Cahier de textes (${c.groupeNom ?? ctx.classe}${c.matiere ? ' · ' + c.matiere : ''})` : undefined}
      >
        <div className="edt-creneau-head">
          <span className="edt-creneau-heure">{c.heureDebut}–{c.heureFin}</span>
          {!lectureSeule && (
            <span className="edt-creneau-actions">
              {/* Phase 55 — modifier à partir d'une date (pas sur un ancien créneau) */}
              {situation !== 'ancien' && (
                <button
                  className="edt-creneau-edit"
                  onClick={(e) => { e.stopPropagation(); handleEditer(c); }}
                  disabled={busy}
                  title="Modifier ce créneau à partir d'une date"
                  aria-label="Modifier le créneau"
                >✏️</button>
              )}
              <button
                className="edt-creneau-del"
                onClick={(e) => { e.stopPropagation(); handleSupprimer(c.id); }}
                disabled={busy}
                title="Supprimer définitivement"
                aria-label="Supprimer le créneau"
              >🗑</button>
            </span>
          )}
        </div>
        {/* Phase 55 — période d'application du créneau */}
        {(c.valideDu && situation === 'a-venir') && (
          <div className="edt-validite edt-validite--a-venir">⏳ dès le {formaterCleDate(c.valideDu)}</div>
        )}
        {c.valideJusquAu && (
          <div className={`edt-validite edt-validite--${situation === 'ancien' ? 'ancien' : 'fin'}`}>
            {situation === 'ancien' && c.valideDu ? `du ${formaterCleDate(c.valideDu)} ` : ''}
            jusqu'au {formaterCleDate(c.valideJusquAu)}
          </div>
        )}
        {/* Vues agrégées : classe + établissement en tête de carte */}
        {afficherContexte && (
          <div className="edt-creneau-ctx">
            <strong>{c.groupeNom ?? ctx.classe}</strong>
            {(etab || ctx.etablissementNom) && (
              <span className="edt-etab-badge" style={etab ? { background: etab.couleur } : undefined}>
                {etab ? libelleCourtEtablissement(etab) : ctx.etablissementNom}
              </span>
            )}
          </div>
        )}
        <div className="edt-creneau-act">
          {c.activite}{estLie(c) ? ' →' : ''}
        </div>
        {!afficherContexte && c.groupeNom && <div className="edt-creneau-salle">👥 {c.groupeNom}</div>}
        {c.matiere && <div className="edt-creneau-salle">📘 {c.matiere}</div>}
        <div className="edt-creneau-salle">🏫 {c.salle}</div>
        {/* Alertes : chevauchement (rouge) / battement court (ambre) */}
        {sesAlertes.map((a, i) => (
          <div key={i} className={`edt-alerte edt-alerte--${a.type}`}>
            {a.type === 'chevauchement' ? '⚠️' : '⏱️'} {a.message}
          </div>
        ))}
      </div>
    );
  };

  // Créneaux des vues agrégées, filtrés par établissement
  //   (Phase 55 : créneaux en vigueur ou à venir ; les anciens sont exclus)
  const creneauxAgreges = creneauxEnCours.filter(c =>
    filtreEtab === 'tous' ? true : (c.etablissementId ?? OPTION_SANS_ETAB) === filtreEtab
  );
  const ctxDe = (c: CreneauContexte) => ({
    classe: c.classe, etablissementId: c.etablissementId, etablissementNom: c.etablissementNom, cle: c.cle,
  });

  // Établissements présents dans mes emplois du temps (légende)
  // Phase 55 — la synthèse hebdomadaire ne compte que les créneaux valables aujourd'hui
  const creneauxDuMoment = creneauxAgreges.filter(c => creneauValideLe(c, aujourdhui));
  const nbAVenir = creneauxAgreges.length - creneauxDuMoment.length;

  const etabsPresents = Array.from(new Set(creneauxEnCours.map(c => c.etablissementId ?? OPTION_SANS_ETAB)));

  return (
    <div className="edt-overlay" onClick={onClose}>
      <div className="edt-drawer edt-drawer--large" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="edt-drawer-header">
          <span className="edt-drawer-title">📅 Mon emploi du temps</span>
          <button className="edt-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="edt-drawer-body">
          {/* Onglets de vue */}
          <div className="edt-onglets" role="tablist" aria-label="Vue de l'emploi du temps">
            {([
              ['classe', '✏️ Par classe'],
              ['ma-semaine', '🗓️ Ma semaine'],
              ['mon-jour', '📍 Mon jour'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vue === v}
                className={`edt-onglet ${vue === v ? 'active' : ''}`}
                onClick={() => setVue(v)}
              >
                {label}
                {v === 'ma-semaine' && nbConflits > 0 && (
                  <span className="edt-onglet-alerte" title="Créneaux en chevauchement">{nbConflits}</span>
                )}
              </button>
            ))}
          </div>

          {/* Sélecteurs */}
          <div className="edt-selectors">
            {vue === 'classe' ? (
              <>
                <label>
                  Établissement
                  <select
                    value={etabId ?? OPTION_SANS_ETAB}
                    onChange={(e) => setEtabId(e.target.value || null)}
                  >
                    {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                    <option value={OPTION_SANS_ETAB}>— Sans établissement —</option>
                  </select>
                </label>
                <label>
                  Classe
                  <select value={classe} onChange={(e) => setClasse(e.target.value as Classe)}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <label>
                Établissement
                <select value={filtreEtab} onChange={(e) => setFiltreEtab(e.target.value)}>
                  <option value="tous">Tous</option>
                  {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  <option value={OPTION_SANS_ETAB}>Sans établissement</option>
                </select>
              </label>
            )}

            {vue === 'mon-jour' && (
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
                {anneesPourSelect(anneesConfig, anneeCourante, [annee]).map((a) => (
                  <option key={a} value={a}>{a}{a === anneeCourante ? ' (en cours)' : ''}</option>
                ))}
              </select>
            </label>
          </div>

          {erreur && <div className="edt-error" role="alert">{erreur}</div>}

          {/* ════════════════════════════════════════════════════════
              VUE 1 — PAR CLASSE : grille + édition
              ════════════════════════════════════════════════════════ */}
          {vue === 'classe' && (
            <>
              {/* Reprise des créneaux de l'ancien emploi du temps commun */}
              {heritesAReprendre.length > 0 && (
                <div className="edt-reprise">
                  <span>
                    📥 <strong>{heritesAReprendre.length} créneau(x)</strong> que vous aviez saisi(s) pour
                    la {classe} dans l'ancien emploi du temps commun.
                  </span>
                  <button type="button" className="btn-primary" onClick={handleReprendre} disabled={busy}>
                    Les reprendre ici{etabCourant ? ` (${libelleCourtEtablissement(etabCourant)})` : ''}
                  </button>
                </div>
              )}

              {/* Phase 55 — anciens créneaux (périodes terminées), masqués par défaut */}
              {nbAnciens > 0 && (
                <label className="edt-anciens-toggle">
                  <input
                    type="checkbox"
                    checked={afficherAnciens}
                    onChange={(e) => setAfficherAnciens(e.target.checked)}
                  />
                  Afficher les anciens créneaux ({nbAnciens})
                </label>
              )}

              <div className="edt-grid">
                {JOURS_SEMAINE.map((j) => (
                  <div className="edt-day-col" key={j.valeur}>
                    <div className="edt-day-head">{j.court}</div>
                    {trierCreneaux(creneauxVisibles.filter((c) => c.jour === j.valeur)).map((c) =>
                      renderCreneau(
                        c,
                        { classe, etablissementId: etabId, etablissementNom: etabCourant?.nom ?? '', cle: `${emploiIdCourant}:${c.id}` },
                        false,
                        false
                      )
                    )}
                  </div>
                ))}
              </div>

              {creneauxVisibles.length === 0 && (
                <div className="edt-empty">
                  Aucun créneau pour la {classe}{etabCourant ? ` — ${etabCourant.nom}` : ''}. Ajoutez-en ci-dessous.
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              VUE 2 — MA SEMAINE : tous mes établissements
              ════════════════════════════════════════════════════════ */}
          {vue === 'ma-semaine' && (
            <>
              {/* Synthèse + légende des établissements */}
              <div className="edt-synthese">
                <span>
                  <strong>{creneauxDuMoment.length}</strong> créneau(x) ·{' '}
                  <strong>{dureeTotale(creneauxDuMoment)}</strong> par semaine
                  {/* Phase 55 — changements d'horaire déjà programmés */}
                  {nbAVenir > 0 && <> · ⏳ {nbAVenir} à venir</>}
                </span>
                {nbConflits > 0 && <span className="edt-synthese-alerte">⚠️ {nbConflits} créneau(x) en chevauchement</span>}
              </div>
              {etabsPresents.length > 1 && (
                <div className="edt-legende">
                  {etabsPresents.map(id => {
                    const e = id ? etabsParId.get(id) : undefined;
                    return (
                      <span key={id || 'aucun'} className="edt-legende-item">
                        <span className="edt-legende-point" style={{ background: e?.couleur ?? '#9ca3af' }} />
                        {e ? e.nom : 'Sans établissement'}
                      </span>
                    );
                  })}
                </div>
              )}

              {creneauxAgreges.length === 0 ? (
                <div className="edt-empty">Aucun créneau pour {annee}. Commencez par l'onglet « Par classe ».</div>
              ) : (
                <div className="edt-grid">
                  {JOURS_SEMAINE.map((j) => (
                    <div className="edt-day-col" key={j.valeur}>
                      <div className="edt-day-head">{j.court}</div>
                      {trierCreneaux(creneauxAgreges.filter(c => c.jour === j.valeur)).map(c =>
                        renderCreneau(c, ctxDe(c), true, true)
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              VUE 3 — MON JOUR : chronologie d'une journée
              ════════════════════════════════════════════════════════ */}
          {vue === 'mon-jour' && (() => {
            const duJour = trierCreneaux(creneauxAgreges.filter(c => c.jour === jourFiltre));
            if (duJour.length === 0) {
              const label = JOURS_SEMAINE.find((j) => j.valeur === jourFiltre)?.label ?? '';
              return <div className="edt-empty">Aucun cours le {label.toLowerCase()} pour {annee}.</div>;
            }
            return (
              <div className="edt-day-list edt-day-list--chrono">
                {duJour.map(c => renderCreneau(c, ctxDe(c), true, true))}
              </div>
            );
          })()}

          {/* ════════════════════════════════════════════════════════
              ÉDITION — Ajout d'un créneau (onglet « Par classe »)
              ════════════════════════════════════════════════════════ */}
          {vue === 'classe' && (
          <div className={`edt-add${edition ? ' edt-add--edition' : ''}`}>
            <div className="edt-add-title">
              {edition ? '✏️ Modifier le créneau' : 'Ajouter un créneau'} — {classe}{etabCourant ? ` · ${etabCourant.nom}` : ''}
            </div>
            <div className="edt-add-grid">
              <label>
                Jour
                <select
                  value={form.jour}
                  onChange={(e) => majForm({ jour: e.target.value as JourSemaine })}
                >
                  {JOURS_SEMAINE.map((j) => <option key={j.valeur} value={j.valeur}>{j.label}</option>)}
                </select>
              </label>
              <label>
                Salle
                <input
                  type="text"
                  value={form.salle}
                  placeholder="Ex : Salle 12"
                  onChange={(e) => majForm({ salle: e.target.value })}
                />
              </label>
              <label>
                Heure de début
                <input
                  type="time"
                  value={form.heureDebut}
                  onChange={(e) => majForm({ heureDebut: e.target.value })}
                />
              </label>
              <label>
                Heure de fin
                <input
                  type="time"
                  value={form.heureFin}
                  onChange={(e) => majForm({ heureFin: e.target.value })}
                />
              </label>
              <label>
                Activité
                <input
                  type="text"
                  value={form.activite}
                  placeholder="Ex : Cours, TP…"
                  onChange={(e) => majForm({ activite: e.target.value })}
                />
              </label>
              <label>
                Matière (optionnel)
                <select
                  value={form.matiere}
                  disabled={loadingMatieres}
                  onChange={(e) => majForm({ matiere: e.target.value })}
                >
                  <option value="">— Aucune —</option>
                  {matieresDispos.map((m) => <option key={m.valeur} value={m.valeur}>{m.label}</option>)}
                </select>
              </label>
              {/* Liaison rigoureuse : groupe/section exact du prof */}
              <label style={{ gridColumn: '1 / -1' }}>
                Classe / groupe (recommandé pour le lien au cahier)
                <select
                  value={form.groupeId}
                  onChange={(e) => majForm({ groupeId: e.target.value })}
                >
                  <option value="">— Aucun —</option>
                  {groupesProposes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
              </label>
              {/* Phase 55 — date d'application (pleine largeur) */}
              {edition ? (
                <label className="edt-add-date" style={{ gridColumn: '1 / -1' }}>
                  Applicable à partir du
                  <input
                    type="date"
                    value={edition.dateEffet}
                    onChange={(e) => majForm({ dateEffet: e.target.value })}
                  />
                  <small>
                    {edition.dateEffet
                      ? `Avant le ${formaterCleDate(edition.dateEffet)}, l'ancien horaire est conservé : les séances déjà saisies ne changent pas.`
                      : 'Sans date : simple correction d\'une erreur de saisie, appliquée aussi aux semaines passées.'}
                  </small>
                </label>
              ) : (
                <label className="edt-add-date" style={{ gridColumn: '1 / -1' }}>
                  Valable à partir du (optionnel)
                  <input
                    type="date"
                    value={nouveau.valideDu}
                    onChange={(e) => majForm({ valideDu: e.target.value })}
                  />
                  <small>À renseigner pour un cours ajouté en cours d'année ; vide = toute l'année.</small>
                </label>
              )}
            </div>

            <div className="edt-add-actions">
              {edition ? (
                <>
                  {/* Phase 55 — actions du mode « modification » */}
                  <button type="button" className="edt-btn-secondaire" onClick={() => { setEdition(null); setErreur(''); }} disabled={busy}>
                    Annuler
                  </button>
                  <button type="button" className="edt-btn-secondaire edt-btn-secondaire--arret" onClick={handleArreter} disabled={busy}
                    title="Le cours n'a plus lieu à partir de cette date (historique conservé)">
                    ⏹ Arrêter à cette date
                  </button>
                  <button type="button" className="btn-primary" onClick={handleModifier} disabled={busy}>
                    {busy ? 'Enregistrement…' : 'Enregistrer la modification'}
                  </button>
                </>
              ) : (
                <button className="btn-primary" onClick={handleAjouter} disabled={busy}>
                  {busy ? 'Enregistrement…' : '+ Ajouter le créneau'}
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.6rem' }}>
              Renseigner le groupe (ex. 4PFA) rend le créneau cliquable et ouvre exactement le Cahier de textes
              de cette section. Cet emploi du temps est personnel : vos collègues ne le voient pas.
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploiDuTempsDrawer;
