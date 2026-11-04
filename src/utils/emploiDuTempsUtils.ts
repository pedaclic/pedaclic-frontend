// ============================================================
// PedaClic — Phase 48 : logique PURE de l'emploi du temps
// ------------------------------------------------------------
// • Aplatit les emplois du temps personnels en une liste de
//   créneaux « en contexte » (classe + établissement).
// • Détecte deux types d'alertes, jour par jour :
//     - chevauchement : deux créneaux se recouvrent ;
//     - battement     : moins de 30 min pour passer d'un
//                       établissement à un autre.
// ============================================================

import {
  BATTEMENT_MIN_ETABLISSEMENTS,
  JOURS_SEMAINE,
  type Creneau,
  type CreneauContexte,
  type EmploiDuTempsProf,
  type JourSemaine,
} from '../types/emploiDuTemps.types';

/** « 08:30 » → 510 (minutes depuis minuit) */
export function enMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Tri chronologique (heure de début puis de fin) */
export function trierCreneaux<T extends Creneau>(liste: T[]): T[] {
  return [...liste].sort((a, b) =>
    a.heureDebut.localeCompare(b.heureDebut) || a.heureFin.localeCompare(b.heureFin)
  );
}

/** Tous les créneaux de tous les emplois du temps, avec leur contexte */
export function aplatirCreneaux(emplois: EmploiDuTempsProf[]): CreneauContexte[] {
  return emplois.flatMap(e =>
    (e.creneaux ?? []).map(c => ({
      ...c,
      cle: `${e.id}:${c.id}`,
      emploiId: e.id,
      classe: e.classe,
      etablissementId: e.etablissementId ?? null,
      etablissementNom: e.etablissementNom ?? '',
    }))
  );
}

export interface AlerteCreneau {
  type: 'chevauchement' | 'battement';
  message: string;
}

/** Libellé court d'un créneau pour les messages */
function libelle(c: CreneauContexte): string {
  return `${c.classe}${c.etablissementNom ? ` (${c.etablissementNom})` : ''} ${c.heureDebut}–${c.heureFin}`;
}

/**
 * Calcule les alertes de chaque créneau (Map cle → alertes).
 * Complexité O(n²) par jour : négligeable (quelques dizaines de créneaux).
 */
export function detecterAlertes(creneaux: CreneauContexte[]): Map<string, AlerteCreneau[]> {
  const alertes = new Map<string, AlerteCreneau[]>();
  const ajouter = (cle: string, a: AlerteCreneau) =>
    alertes.set(cle, [...(alertes.get(cle) ?? []), a]);

  for (const { valeur: jour } of JOURS_SEMAINE) {
    const duJour = trierCreneaux(creneaux.filter(c => c.jour === jour));
    for (let i = 0; i < duJour.length; i++) {
      for (let j = i + 1; j < duJour.length; j++) {
        const a = duJour[i];
        const b = duJour[j];
        const debutA = enMinutes(a.heureDebut), finA = enMinutes(a.heureFin);
        const debutB = enMinutes(b.heureDebut), finB = enMinutes(b.heureFin);

        // 1. Chevauchement : [debutA, finA[ ∩ [debutB, finB[ non vide
        if (debutA < finB && debutB < finA) {
          ajouter(a.cle, { type: 'chevauchement', message: `Chevauche ${libelle(b)}` });
          ajouter(b.cle, { type: 'chevauchement', message: `Chevauche ${libelle(a)}` });
          continue;
        }

        // 2. Battement trop court entre DEUX établissements différents
        const memeEtab = (a.etablissementId ?? '') === (b.etablissementId ?? '');
        const ecart = debutB - finA; // b commence après a (liste triée)
        if (!memeEtab && ecart >= 0 && ecart < BATTEMENT_MIN_ETABLISSEMENTS) {
          ajouter(b.cle, {
            type: 'battement',
            message: `Seulement ${ecart} min pour venir de ${a.etablissementNom || 'l\'autre établissement'}`,
          });
        }
      }
    }
  }
  return alertes;
}

/**
 * Créneaux qui chevaucheraient un créneau candidat (avant ajout).
 * `ignorerCle` : exclut le créneau lui-même en cas de modification.
 */
export function chevauchementsAvec(
  candidat: Pick<Creneau, 'jour' | 'heureDebut' | 'heureFin'>,
  existants: CreneauContexte[],
  ignorerCle?: string
): CreneauContexte[] {
  const d = enMinutes(candidat.heureDebut), f = enMinutes(candidat.heureFin);
  return existants.filter(c =>
    c.cle !== ignorerCle &&
    c.jour === candidat.jour &&
    d < enMinutes(c.heureFin) && enMinutes(c.heureDebut) < f
  );
}

/** Jour courant (dimanche → lundi) */
export function jourCourant(): JourSemaine {
  const map: Record<number, JourSemaine> = {
    1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi',
  };
  return map[new Date().getDay()] ?? 'lundi';
}

/** true si aujourd'hui est un dimanche (aucun cours) */
export function estDimanche(): boolean {
  return new Date().getDay() === 0;
}
