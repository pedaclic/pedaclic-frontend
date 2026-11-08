// ============================================================
// PedaClic — Phase 48 + Phase 52 : bandeau « Aujourd'hui » (/prof/cahiers)
// ------------------------------------------------------------
// Affiche les cours d'un jour, TOUS établissements confondus, dans
// l'ordre chronologique.
//
// Phase 52 :
//   • navigation « ‹ Semaine précédente / Semaine suivante › » + retour
//     à aujourd'hui, et onglets Lun → Sam pour choisir le jour ;
//   • chaque cours indique si la séance est déjà saisie dans le cahier :
//       - saisie      → un clic OUVRE la séance existante ;
//       - non saisie  → un clic ouvre une NOUVELLE séance pré-remplie
//                       (date du jour choisi + horaires du créneau).
// Rien n'est affiché si le professeur n'a aucun créneau.
//
// Phase 54 : code couleur du statut — bleu (à venir / en cours),
//   rouge (passée non saisie), orange (planifiée à l'avance).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { subscribeEmploisProfAnnee } from '../../services/emploiDuTempsService';
import { getEntreesCahierPeriode } from '../../services/cahierTextesService';
import type { EmploiDuTempsProf, JourSemaine } from '../../types/emploiDuTemps.types';
import { JOURS_SEMAINE } from '../../types/emploiDuTemps.types';
import type { EtablissementProf } from '../../types/etablissement.types';
import { libelleCourtEtablissement } from '../../types/etablissement.types';
import type { CahierTextes, EntreeCahier } from '../../types/cahierTextes.types';
import { aplatirCreneaux, trierCreneaux, enMinutes, jourCourant } from '../../utils/emploiDuTempsUtils';
import {
  lundiDeSemaine, dateDuJour, cleJourLocal, cleJourEntree,
  trouverCahierPourCreneau, associerSeancesAuxCreneaux,
} from '../../utils/liensSeances';
import type { OuvrirCahierInfo } from './EmploiDuTempsDrawer';
import '../../styles/EmploiDuTemps.css';

interface EdtAujourdhuiProps {
  profId: string;
  annee: string;
  etablissements: EtablissementProf[];
  /** Phase 52 — cahiers du professeur (pour savoir si la séance est saisie) */
  cahiers: CahierTextes[];
  onOuvrirCahier: (info: OuvrirCahierInfo) => void;
  onVoirSemaine: () => void;
}

/* Formats d'affichage (français) */
const fmtJourMois = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fmtJourComplet = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const EdtAujourdhui: React.FC<EdtAujourdhuiProps> = ({
  profId, annee, etablissements, cahiers, onOuvrirCahier, onVoirSemaine,
}) => {
  const [emplois, setEmplois] = useState<EmploiDuTempsProf[]>([]);

  // ── Phase 52 — Semaine affichée (0 = semaine en cours) et jour choisi ──
  const [semaineOffset, setSemaineOffset] = useState(0);
  const [jourSel, setJourSel] = useState<JourSemaine>(jourCourant());

  // Séances de la semaine affichée, par cahier (null = chargement en cours)
  const [seancesSemaine, setSeancesSemaine] = useState<Map<string, EntreeCahier[]> | null>(null);

  useEffect(() => {
    if (!profId || !annee) return;
    // Erreur silencieuse : le bandeau est un raccourci, pas un écran clé
    const unsub = subscribeEmploisProfAnnee(profId, annee, setEmplois, () => setEmplois([]));
    return () => unsub();
  }, [profId, annee]);

  const etabsParId = useMemo(() => new Map(etablissements.map(e => [e.id, e])), [etablissements]);
  const tousCreneaux = useMemo(() => aplatirCreneaux(emplois), [emplois]);

  // ── Bornes de la semaine affichée ──
  const lundi = useMemo(() => lundiDeSemaine(semaineOffset), [semaineOffset]);
  const samedi = useMemo(() => dateDuJour(lundi, 'samedi'), [lundi]);
  const dateSel = useMemo(() => dateDuJour(lundi, jourSel), [lundi, jourSel]);
  const cleAujourdhui = cleJourLocal(new Date());
  const cleSel = cleJourLocal(dateSel);
  const estAujourdhui = cleSel === cleAujourdhui;

  // ── Cours du jour choisi + cahier correspondant à chaque cours ──
  const coursDuJour = useMemo(
    () => trierCreneaux(tousCreneaux.filter(c => c.jour === jourSel)).map(c => ({
      creneau: c,
      cahier: trouverCahierPourCreneau(cahiers, {
        classe: c.classe, matiere: c.matiere, groupeId: c.groupeId, etablissementId: c.etablissementId,
      }),
    })),
    [tousCreneaux, jourSel, cahiers]
  );

  // Nombre de cours par jour (pastilles des onglets)
  const nbParJour = useMemo(() => {
    const m = new Map<JourSemaine, number>();
    tousCreneaux.forEach(c => m.set(c.jour, (m.get(c.jour) ?? 0) + 1));
    return m;
  }, [tousCreneaux]);

  // ── Phase 52 — Chargement des séances de la semaine (cahiers concernés uniquement) ──
  //    Requête par cahier (cahierId + profId + date) : index Firestore déjà présent.
  const cahiersSemaine = useMemo(() => {
    const ids = new Map<string, CahierTextes>();
    tousCreneaux.forEach(c => {
      const cah = trouverCahierPourCreneau(cahiers, {
        classe: c.classe, matiere: c.matiere, groupeId: c.groupeId, etablissementId: c.etablissementId,
      });
      if (cah) ids.set(cah.id, cah);
    });
    return [...ids.values()];
  }, [tousCreneaux, cahiers]);

  useEffect(() => {
    if (cahiersSemaine.length === 0) { setSeancesSemaine(new Map()); return; }
    let annule = false;
    setSeancesSemaine(null);
    // Marge d'un jour de chaque côté : les séances sont stockées à minuit UTC
    const debut = new Date(lundi); debut.setDate(debut.getDate() - 1);
    const fin = new Date(samedi); fin.setDate(fin.getDate() + 1); fin.setHours(23, 59, 59);
    Promise.all(cahiersSemaine.map(c =>
      getEntreesCahierPeriode(c.id, c.profId, debut, fin)
        .then(liste => [c.id, liste] as const)
        .catch(() => [c.id, [] as EntreeCahier[]] as const) // un cahier en erreur ne bloque pas les autres
    )).then(paires => { if (!annule) setSeancesSemaine(new Map(paires)); });
    return () => { annule = true; };
  }, [cahiersSemaine, lundi, samedi]);

  // ── Séance saisie pour chaque créneau du jour choisi (Map cle créneau → séance) ──
  const seanceParCreneau = useMemo(() => {
    const res = new Map<string, EntreeCahier>();
    if (!seancesSemaine) return res;
    // Regroupe les créneaux du jour par cahier, puis apparie avec les séances de ce jour
    const parCahier = new Map<string, typeof coursDuJour>();
    coursDuJour.forEach(x => {
      if (x.cahier) parCahier.set(x.cahier.id, [...(parCahier.get(x.cahier.id) ?? []), x]);
    });
    parCahier.forEach((liste, cahierId) => {
      const duJour = (seancesSemaine.get(cahierId) ?? []).filter(e => cleJourEntree(e) === cleSel);
      associerSeancesAuxCreneaux(liste.map(x => x.creneau), duJour).forEach((e, cle) => res.set(cle, e));
    });
    return res;
  }, [seancesSemaine, coursDuJour, cleSel]);

  // Aucun créneau du tout : le bandeau reste masqué (comportement Phase 48)
  if (tousCreneaux.length === 0) return null;

  // Heure actuelle en minutes : repère « maintenant » / « passé »
  const maintenant = new Date().getHours() * 60 + new Date().getMinutes();
  const estPasse = cleSel < cleAujourdhui; // comparaison lexicographique YYYY-MM-DD

  /** Revenir à la semaine et au jour courants */
  const allerAujourdhui = () => { setSemaineOffset(0); setJourSel(jourCourant()); };

  return (
    <section className="edt-aujourdhui" aria-label="Mes cours de la semaine">
      {/* ── Ligne 1 : titre du jour + raccourci « Ma semaine » ── */}
      <div className="edt-aujourdhui-titre">
        <span>
          {estAujourdhui ? '📍 Aujourd\'hui' : `📅 ${fmtJourComplet(dateSel).replace(/^./, m => m.toUpperCase())}`}
          {' — '}{coursDuJour.length} cours
        </span>
        <button type="button" className="edt-aujourdhui-lien" onClick={onVoirSemaine}>
          Ma semaine →
        </button>
      </div>

      {/* ── Ligne 2 (Phase 52) : navigation semaine + onglets des jours ── */}
      <nav className="edt-semaine-nav" aria-label="Navigation par semaine">
        <button
          type="button"
          className="edt-semaine-btn"
          onClick={() => setSemaineOffset(o => o - 1)}
          title="Semaine précédente"
          aria-label="Semaine précédente"
        >
          ‹ <span className="edt-semaine-btn-txt">Semaine préc.</span>
        </button>

        <span className="edt-semaine-libelle" aria-live="polite">
          Semaine du {fmtJourMois(lundi)} au {fmtJourMois(samedi)}
        </span>

        <button
          type="button"
          className="edt-semaine-btn"
          onClick={() => setSemaineOffset(o => o + 1)}
          title="Semaine suivante"
          aria-label="Semaine suivante"
        >
          <span className="edt-semaine-btn-txt">Semaine suiv.</span> ›
        </button>

        {/* Retour rapide, visible seulement si on s'est éloigné du jour courant */}
        {!estAujourdhui && (
          <button type="button" className="edt-semaine-btn edt-semaine-btn--auj" onClick={allerAujourdhui}>
            Aujourd'hui
          </button>
        )}

        {/* Onglets des jours (Lun → Sam) avec date et nombre de cours */}
        <div className="edt-semaine-jours" role="tablist" aria-label="Jours de la semaine">
          {JOURS_SEMAINE.map(j => {
            const d = dateDuJour(lundi, j.valeur);
            const nb = nbParJour.get(j.valeur) ?? 0;
            const actif = j.valeur === jourSel;
            const auj = cleJourLocal(d) === cleAujourdhui;
            return (
              <button
                key={j.valeur}
                type="button"
                role="tab"
                aria-selected={actif}
                className={`edt-semaine-jour${actif ? ' edt-semaine-jour--actif' : ''}${auj ? ' edt-semaine-jour--auj' : ''}`}
                onClick={() => setJourSel(j.valeur)}
                title={`${j.label} ${fmtJourMois(d)} — ${nb} cours`}
              >
                {j.court} {d.getDate()}
                {nb > 0 && <span className="edt-semaine-jour-nb">{nb}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Ligne 3 : cours du jour choisi ── */}
      {coursDuJour.length === 0 ? (
        <p className="edt-aujourdhui-vide">Aucun cours prévu ce jour-là.</p>
      ) : (
        <div className="edt-aujourdhui-liste">
          {coursDuJour.map(({ creneau: c, cahier }) => {
            const etab = c.etablissementId ? etabsParId.get(c.etablissementId) : undefined;
            const debut = enMinutes(c.heureDebut), fin = enMinutes(c.heureFin);
            // État visuel : relatif à l'heure actuelle UNIQUEMENT pour aujourd'hui
            const etat = estAujourdhui
              ? (maintenant >= fin ? 'passe' : maintenant >= debut ? 'maintenant' : 'avenir')
              : (estPasse ? 'passe' : 'avenir');
            const seance = seanceParCreneau.get(c.cle);

            // Libellé de statut de la séance (Phase 52 + Phase 54)
            //   Phase 54 — code couleur :
            //     • bleu   (a-saisir)   : séance non saisie, en cours ou à venir ;
            //     • rouge  (en-retard)  : séance non saisie dont l'horaire est PASSÉ ;
            //     • orange (planifiee)  : séance saisie à l'avance (statut « planifié ») ;
            //     • vert   (saisie)     : séance saisie (réalisée, annulée, reportée).
            const statut = !cahier
              ? { cls: 'sans-cahier', txt: '＋ Créer le cahier', aide: 'Aucun cahier pour cette classe — créer le cahier' }
              : seancesSemaine === null
                ? { cls: 'chargement', txt: '…', aide: 'Vérification de la séance' }
                : seance
                  ? seance.statut === 'planifie'
                    ? { cls: 'planifiee', txt: `🕒 ${seance.chapitre || 'Séance planifiée'}`, aide: `Séance planifiée « ${seance.chapitre} » — l'ouvrir pour la valider` }
                    : { cls: 'saisie', txt: `✓ ${seance.chapitre || 'Séance saisie'}`, aide: `Ouvrir la séance « ${seance.chapitre} »` }
                  : etat === 'passe'
                    ? { cls: 'en-retard', txt: '＋ Séance à saisir', aide: 'Séance passée non saisie — la saisir maintenant' }
                    : { cls: 'a-saisir', txt: '＋ Séance à saisir', aide: 'Créer la séance de ce cours' };

            return (
              <button
                key={c.cle}
                type="button"
                className={`edt-aujourdhui-item edt-aujourdhui-item--${etat}`}
                style={etab ? { borderLeftColor: etab.couleur } : undefined}
                onClick={() => onOuvrirCahier({
                  classe: c.classe,
                  matiere: c.matiere,
                  groupeId: c.groupeId,
                  groupeNom: c.groupeNom,
                  etablissementId: c.etablissementId,
                  // Phase 52 — contexte précis du cours cliqué
                  cahierId: cahier?.id,
                  date: cleSel,
                  heureDebut: c.heureDebut,
                  heureFin: c.heureFin,
                  entreeId: seance?.id,
                })}
                title={statut.aide}
              >
                <span>{estAujourdhui && etat === 'maintenant' ? '🟢 ' : ''}{c.heureDebut}–{c.heureFin}</span>
                <strong>{c.groupeNom ?? c.classe}{c.matiere ? ` · ${c.matiere}` : ''}</strong>
                <span>{etab ? libelleCourtEtablissement(etab) : (c.etablissementNom || '—')} · {c.salle}</span>
                <span className={`edt-aujourdhui-seance edt-aujourdhui-seance--${statut.cls}`}>{statut.txt}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default EdtAujourdhui;
