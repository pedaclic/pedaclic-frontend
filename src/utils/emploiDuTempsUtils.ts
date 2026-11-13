// ============================================================
// PedaClic — Phase 48 : logique PURE de l'emploi du temps
// ------------------------------------------------------------
// • Aplatit les emplois du temps personnels en une liste de
//   créneaux « en contexte » (classe + établissement).
// • Détecte deux types d'alertes, jour par jour :
//     - chevauchement : deux créneaux se recouvrent ;
//     - battement     : moins de 30 min pour passer d'un
//                       établissement à un autre.
//
// Phase 55 — créneaux DATÉS (valideDu / valideJusquAu) :
//   • un créneau n'est affiché que pour les dates où il s'applique ;
//   • « modifier à partir du… » clôt l'ancien créneau et en ouvre
//     un nouveau, sans toucher aux séances déjà saisies ;
//   • deux créneaux dont les périodes ne se croisent pas ne sont
//     jamais signalés en chevauchement.
// ============================================================

import {
  BATTEMENT_MIN_ETABLISSEMENTS,
  JOURS_SEMAINE,
  genererCreneauId,
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

        // Phase 55 — périodes de validité disjointes (ancien horaire /
        // nouvel horaire) : les deux créneaux ne coexistent jamais.
        if (!periodesSeCroisent(a, b)) continue;

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
  candidat: Pick<Creneau, 'jour' | 'heureDebut' | 'heureFin' | 'valideDu' | 'valideJusquAu'>,
  existants: CreneauContexte[],
  ignorerCle?: string
): CreneauContexte[] {
  const d = enMinutes(candidat.heureDebut), f = enMinutes(candidat.heureFin);
  return existants.filter(c =>
    c.cle !== ignorerCle &&
    c.jour === candidat.jour &&
    periodesSeCroisent(candidat, c) && // Phase 55 — même période seulement
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

// ═════════════════════════════════════════════════════════════
// PHASE 55 — CRÉNEAUX DATÉS
// ─────────────────────────────────────────────────────────────
// Toutes les dates sont des clés « YYYY-MM-DD » : elles se comparent
// directement comme des chaînes (ordre lexicographique = ordre
// chronologique), sans aucun calcul de fuseau horaire.
// ═════════════════════════════════════════════════════════════

/** Bornes de validité d'un créneau (sous-ensemble de `Creneau`) */
type Periode = Pick<Creneau, 'valideDu' | 'valideJusquAu'>;

/** Clé « YYYY-MM-DD » d'une date, en composantes LOCALES */
export function cleDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Veille d'une clé « YYYY-MM-DD » (ex. « 2026-11-16 » → « 2026-11-15 ») */
export function veille(cle: string): string {
  const [a, m, j] = cle.split('-').map(Number);
  return cleDate(new Date(a, (m || 1) - 1, (j || 1) - 1));
}

/** « 2026-11-16 » → « 16 nov. » (affichage des badges) */
export function formaterCleDate(cle: string): string {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, (m || 1) - 1, j || 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** true si le créneau s'applique à la date donnée (bornes incluses) */
export function creneauValideLe(c: Periode, cleJour: string): boolean {
  return (!c.valideDu || c.valideDu <= cleJour) && (!c.valideJusquAu || cleJour <= c.valideJusquAu);
}

/**
 * Situation d'un créneau par rapport à une date de référence :
 *   'ancien'  : sa période est terminée (conservé pour l'historique) ;
 *   'a-venir' : il ne s'applique pas encore ;
 *   'actuel'  : il s'applique à cette date.
 */
export type SituationCreneau = 'ancien' | 'actuel' | 'a-venir';
export function situationCreneau(c: Periode, cleRef: string = cleDate()): SituationCreneau {
  if (c.valideJusquAu && c.valideJusquAu < cleRef) return 'ancien';
  if (c.valideDu && c.valideDu > cleRef) return 'a-venir';
  return 'actuel';
}

/** true si les périodes de validité de deux créneaux ont au moins un jour commun */
export function periodesSeCroisent(a: Periode, b: Periode): boolean {
  const debut = (a.valideDu ?? '') > (b.valideDu ?? '') ? (a.valideDu ?? '') : (b.valideDu ?? '');
  const finA = a.valideJusquAu ?? '9999-12-31';
  const finB = b.valideJusquAu ?? '9999-12-31';
  return debut <= (finA < finB ? finA : finB);
}

/** Champs qu'un professeur peut changer en modifiant un créneau */
export type ModifsCreneau = Pick<Creneau, 'jour' | 'heureDebut' | 'heureFin' | 'activite' | 'salle'>
  & Pick<Partial<Creneau>, 'matiere' | 'groupeId' | 'groupeNom'>;

/** Applique les modifications ; un champ optionnel vidé est RETIRÉ (Firestore refuse `undefined`) */
function appliquerModifs(base: Creneau, modifs: ModifsCreneau): Creneau {
  const { matiere: _m, groupeId: _g, groupeNom: _n, ...reste } = base;
  return {
    ...reste,
    jour: modifs.jour,
    heureDebut: modifs.heureDebut,
    heureFin: modifs.heureFin,
    activite: modifs.activite,
    salle: modifs.salle,
    ...(modifs.matiere ? { matiere: modifs.matiere } : {}),
    ...(modifs.groupeId ? { groupeId: modifs.groupeId, groupeNom: modifs.groupeNom ?? '' } : {}),
  };
}

/**
 * MODIFIER un créneau — retourne la nouvelle liste complète à enregistrer.
 *
 *   • `dateEffet` vide → simple CORRECTION : le créneau est modifié tel quel,
 *     pour toute sa période (à réserver aux erreurs de saisie).
 *   • `dateEffet` renseignée → CHANGEMENT D'HORAIRE daté :
 *       - l'ancien créneau est clos la veille (il reste visible dans les
 *         semaines passées, avec ses séances) ;
 *       - un nouveau créneau prend le relais à partir de `dateEffet`.
 *     Si le créneau ne s'appliquait pas encore avant `dateEffet`, il est
 *     modifié sur place (inutile de garder un historique vide).
 *
 * Aucune séance du cahier de textes n'est lue ni modifiée ici.
 */
export function modifierCreneauAPartirDu(
  creneaux: Creneau[],
  id: string,
  modifs: ModifsCreneau,
  dateEffet?: string
): Creneau[] {
  const ancien = creneaux.find(c => c.id === id);
  if (!ancien) return creneaux;

  // 1. Correction simple, créneau qui commence au plus tôt à la date d'effet,
  //    ou créneau déjà clos avant cette date (on ne rouvre jamais un ancien)
  if (
    !dateEffet ||
    (ancien.valideDu && ancien.valideDu >= dateEffet) ||
    (ancien.valideJusquAu && ancien.valideJusquAu < dateEffet)
  ) {
    return creneaux.map(c => (c.id === id ? appliquerModifs(c, modifs) : c));
  }

  // 2. Changement daté : clôture de l'ancien + ouverture du nouveau
  const { valideJusquAu: finInitiale, ...ancienSansFin } = ancien;
  const clos: Creneau = { ...ancienSansFin, valideJusquAu: veille(dateEffet) };
  const nouveau: Creneau = {
    ...appliquerModifs(ancienSansFin, modifs),
    id: genererCreneauId(),
    valideDu: dateEffet,
    // Une fin déjà programmée et postérieure à la date d'effet est conservée
    ...(finInitiale && finInitiale >= dateEffet ? { valideJusquAu: finInitiale } : {}),
  };
  return creneaux.flatMap(c => (c.id === id ? [clos, nouveau] : [c]));
}

/**
 * ARRÊTER un créneau à partir d'une date (le cours disparaît de l'emploi
 * du temps) en conservant l'historique. S'il ne s'était encore jamais
 * appliqué avant cette date, il est simplement retiré.
 */
export function arreterCreneauAPartirDu(creneaux: Creneau[], id: string, dateEffet: string): Creneau[] {
  const ancien = creneaux.find(c => c.id === id);
  if (!ancien) return creneaux;
  if (ancien.valideDu && ancien.valideDu >= dateEffet) return creneaux.filter(c => c.id !== id);
  if (ancien.valideJusquAu && ancien.valideJusquAu < dateEffet) return creneaux; // déjà clos avant
  return creneaux.map(c => (c.id === id ? { ...c, valideJusquAu: veille(dateEffet) } : c));
}
