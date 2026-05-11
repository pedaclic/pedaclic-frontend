/**
 * ============================================================
 * SERVICE : Suivi élève par séance (mai 2026)
 * ============================================================
 *
 * Objectif :
 *   Conserver, séance par séance, une trace fine du comportement et
 *   du travail de chaque élève (au-delà de la simple présence) :
 *     • absence à la séance précédente (auto-renseignée)
 *     • observation qualitative (positive / négative / neutre)
 *     • matériel non amené
 *     • travail non fait
 *
 *   Toutes ces données sont LIÉES au compte parent / tuteur via
 *   le service de notifications PedaClic afin d'informer la
 *   famille en TEMPS RÉEL (in-app + email, selon préférences).
 *
 * Stockage :
 *   - Collection Firestore : `suivi_seance`
 *   - id stable : `${groupeId}_${date}_${eleveId}`
 *   - Une seule écriture par élève / séance ; `setDoc({ merge: true })`
 *     pour respecter les autres champs déjà persistés et éviter
 *     d'effacer accidentellement une mise à jour parallèle.
 *
 * Compat. :
 *   Ce service NE TOUCHE PAS aux collections existantes
 *   (`absences_groupe`, `observations_eleve`, `feuilles_notes`,
 *   `cahiers_textes`, …). Les fonctionnalités antérieures
 *   continuent à fonctionner à l'identique.
 *
 * Fichier : src/services/suiviSeanceService.ts
 * ============================================================
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SuiviSeanceEleve, AbsenceGroupe } from '../types/groupeAbsences.types';
import { getAbsencesByPeriod } from './groupeAbsencesService';
// Notifications temps réel : on s'appuie sur le service existant
// (Phase 26) qui gère déjà la duplication in-app + email.
import { envoyerNotification } from './notificationService';
// Liens parent ↔ enfant : on récupère les parents/tuteurs liés à
// l'élève concerné par l'observation pour les notifier.
import { getLiensForEleve } from './parentService';

/** Nom de la collection Firestore. */
const COL = 'suivi_seance';

/** Helper : conversion Timestamp → Date JS (tolérant). */
function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp(
      (val as { seconds: number }).seconds,
      (val as { nanoseconds?: number }).nanoseconds ?? 0,
    ).toDate();
  }
  return new Date(String(val));
}

/** Helper : Firestore rejette `undefined` — on assainit avant écriture. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** ID stable d'un document de suivi par (groupe, date, élève). */
function suiviDocId(groupeId: string, date: string, eleveId: string): string {
  return `${groupeId}_${date}_${eleveId}`;
}

// =============================================================
// LECTURE
// =============================================================

/**
 * Récupère tous les suivis de séance d'un groupe pour une date donnée.
 * Utile pour pré-remplir la feuille de suivi du jour.
 */
export async function getSuivisJour(
  groupeId: string,
  date: string,
  profId: string,
): Promise<SuiviSeanceEleve[]> {
  const q = query(
    collection(db, COL),
    where('groupeId', '==', groupeId),
    where('date', '==', date),
    where('profId', '==', profId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      ...(data as Omit<SuiviSeanceEleve, 'id' | 'updatedAt'>),
      updatedAt: toDate(data.updatedAt),
    } as SuiviSeanceEleve;
  });
}

/**
 * Récupère un suivi précis pour (groupe, date, élève) — ou `null`.
 * Servira aux composants qui doivent afficher l'historique d'un élève.
 */
export async function getSuiviEleve(
  groupeId: string,
  date: string,
  eleveId: string,
): Promise<SuiviSeanceEleve | null> {
  const ref = doc(db, COL, suiviDocId(groupeId, date, eleveId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    ...(data as Omit<SuiviSeanceEleve, 'id' | 'updatedAt'>),
    updatedAt: toDate(data.updatedAt),
  } as SuiviSeanceEleve;
}

// =============================================================
// CALCUL « ABSENCE À LA SÉANCE PRÉCÉDENTE »
// =============================================================

/**
 * Détermine, pour CHAQUE élève d'un groupe, s'il était absent à la
 * dernière séance qui a précédé la date courante.
 *
 *   - On regarde les documents `absences_groupe` du groupe sur les 30
 *     derniers jours (fenêtre large pour couvrir vacances scolaires).
 *   - On retient la séance LA PLUS RÉCENTE strictement antérieure à
 *     `dateActuelle` qui contient au moins un appel.
 *   - L'élève est considéré « absent à la séance précédente » s'il
 *     figure dans `eleveIdsAbsents` (ou granulaire `seancesAbsentsPar`).
 *
 *   Si aucune séance antérieure n'est trouvée, on renvoie une map vide
 *   (rétro-compat : la colonne « Abs. séance préc. » affichera « — »).
 *
 * @returns map `eleveId → boolean`
 */
export async function calculerAbsencesSeancePrecedente(
  groupeId: string,
  dateActuelle: string,
  profId: string,
): Promise<Record<string, boolean>> {
  // Fenêtre de 30 jours avant la date courante
  const dateRef = new Date(dateActuelle);
  const debut = new Date(dateRef);
  debut.setDate(debut.getDate() - 30);
  const debutStr = debut.toISOString().slice(0, 10);

  // Fin = veille (on exclut la date du jour, qui n'a pas encore eu lieu)
  const finRef = new Date(dateRef);
  finRef.setDate(finRef.getDate() - 1);
  const finStr = finRef.toISOString().slice(0, 10);

  if (finStr < debutStr) return {};

  const absences = await getAbsencesByPeriod(groupeId, debutStr, finStr, profId);
  if (absences.length === 0) return {};

  // Tri décroissant par date pour retenir la PLUS RÉCENTE
  const triees = [...absences].sort((a, b) => (a.date < b.date ? 1 : -1));
  const derniere: AbsenceGroupe = triees[0];

  // Construction de la map d'absents — on union le legacy
  // `eleveIdsAbsents` avec la version granulaire `seancesAbsentsPar`.
  const absents = new Set<string>(derniere.eleveIdsAbsents || []);
  if (derniere.seancesAbsentsPar) {
    for (const ids of Object.values(derniere.seancesAbsentsPar)) {
      ids.forEach((id) => absents.add(id));
    }
  }

  const result: Record<string, boolean> = {};
  absents.forEach((id) => { result[id] = true; });
  return result;
}

// =============================================================
// ÉCRITURE
// =============================================================

/**
 * Persiste (ou met à jour) un suivi pour un élève sur une séance.
 *
 *   - `setDoc({ merge: true })` : on écrase UNIQUEMENT les champs
 *     fournis ; tout autre champ déjà présent est conservé.
 *   - Les champs `undefined` sont retirés du payload pour ne pas
 *     déclencher l'erreur Firestore "Unsupported field value".
 *
 * @param patch Champs à mettre à jour (les autres restent inchangés).
 */
export async function upsertSuiviSeance(
  groupeId: string,
  date: string,
  eleveId: string,
  eleveNom: string,
  profId: string,
  patch: Partial<Omit<SuiviSeanceEleve, 'id' | 'groupeId' | 'date' | 'eleveId' | 'profId' | 'updatedAt'>>,
): Promise<void> {
  const id = suiviDocId(groupeId, date, eleveId);
  const ref = doc(db, COL, id);
  const payload = stripUndefined({
    groupeId,
    date,
    eleveId,
    eleveNom,
    profId,
    ...patch,
    updatedAt: Timestamp.now(),
  });
  await setDoc(ref, payload, { merge: true });
}

// =============================================================
// NOTIFICATIONS PARENTS — TEMPS RÉEL
// =============================================================

/**
 * Notifie en temps réel le(s) parent(s) / tuteur(s) d'un élève d'un
 * événement consigné dans la feuille de suivi.
 *
 *   - Récupère la liste des liens `parent ↔ enfant` (`getLiensForEleve`).
 *   - Pour chaque parent lié : `envoyerNotification` (canal `les_deux`)
 *     → notification in-app + email transactionnel.
 *   - Les erreurs sont remontées dans la console mais ne bloquent
 *     pas l'enregistrement du suivi côté prof (résilience UX).
 *
 *   Exemple d'appel :
 *     await notifierParents({
 *       eleveId: 'XYZ',
 *       eleveNom: 'Diop Awa',
 *       profNom: 'M. Sow',
 *       sujet: 'Travail non fait',
 *       message: 'Awa n\'a pas rendu l\'exercice de maths du 10/05.',
 *       type: 'travail_non_fait',
 *     });
 */
export async function notifierParents(params: {
  eleveId: string;
  eleveNom: string;
  profNom: string;
  sujet: string;
  message: string;
  type:
    | 'absence_seance_precedente'
    | 'observation_positive'
    | 'observation_negative'
    | 'materiel_non_amene'
    | 'travail_non_fait';
}): Promise<void> {
  try {
    const liens = await getLiensForEleve(params.eleveId);
    if (!liens || liens.length === 0) return; // Aucun parent lié — sortie silencieuse

    // ── Mapping vers les types officiels de TypeNotification ──
    //   Le service `envoyerNotification` n'accepte que les valeurs
    //   listées dans `src/types/notification_types.ts`. Pour les
    //   observations / oublis on retombe sur `message_prof` (message
    //   direct du prof à la famille), qui est le canal le plus
    //   sémantiquement proche. Cela évite d'étendre le type
    //   (et donc d'impacter les templates d'email existants).
    const typeNotif: 'message_prof' | 'annonce' =
      params.type === 'observation_positive' ? 'annonce' : 'message_prof';

    await Promise.all(
      liens.map((lien) =>
        envoyerNotification({
          destinataireId: lien.parentId,
          destinataireRole: 'parent',
          // Identifiants & métadonnées du message
          emetteurId: 'system_suivi',
          emetteurNom: params.profNom,
          type: typeNotif,
          titre: params.sujet,
          message: params.message,
          // Canal `in_app` par défaut : le `LienParentEnfant` ne porte
          // pas l'email du parent (cf. `src/types/parent.ts`). On ne
          // tente donc PAS l'email (qui nécessite `emailDestinataire`)
          // pour ne pas multiplier les appels Railway pour rien. Le
          // parent recevra une notification in-app, et la cloche
          // (NotificationBell) clignote en temps réel via le listener
          // Firestore existant.
          canal: 'in_app',
        }),
      ),
    );
  } catch (err) {
    // On ne lève pas l'erreur : un échec d'email ne doit pas
    // empêcher le prof d'enregistrer son suivi.
    console.error('[suiviSeanceService] notifierParents — erreur :', err);
  }
}

// =============================================================
// HELPERS D'AGRÉGATION (statistiques rapides)
// =============================================================

/**
 * Compte, sur une période donnée, le nombre de séances où :
 *   - matériel non amené
 *   - travail non fait
 *   - observations (positives / négatives)
 *
 * Utilisé par l'UI pour afficher des compteurs cumulés et
 * éventuellement déclencher des alertes (3 oublis = vigilance).
 */
export async function getStatsSuivi(
  groupeId: string,
  profId: string,
  debut: string,
  fin: string,
): Promise<Record<string, {
  materielNonAmene: number;
  travailNonFait: number;
  observationsPositives: number;
  observationsNegatives: number;
}>> {
  const q = query(
    collection(db, COL),
    where('groupeId', '==', groupeId),
    where('profId', '==', profId),
    where('date', '>=', debut),
    where('date', '<=', fin),
    orderBy('date'),
    limit(1000),
  );
  const snap = await getDocs(q);
  const stats: Record<string, {
    materielNonAmene: number;
    travailNonFait: number;
    observationsPositives: number;
    observationsNegatives: number;
  }> = {};
  snap.docs.forEach((d) => {
    const data = d.data() as SuiviSeanceEleve;
    if (!stats[data.eleveId]) {
      stats[data.eleveId] = {
        materielNonAmene: 0,
        travailNonFait: 0,
        observationsPositives: 0,
        observationsNegatives: 0,
      };
    }
    if (data.materielNonAmene) stats[data.eleveId].materielNonAmene++;
    if (data.travailNonFait) stats[data.eleveId].travailNonFait++;
    if (data.tonaliteObservation === 'positive') stats[data.eleveId].observationsPositives++;
    if (data.tonaliteObservation === 'negative') stats[data.eleveId].observationsNegatives++;
  });
  return stats;
}
