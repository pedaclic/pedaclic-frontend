/**
 * Service : Travaux à faire (avec échéance).
 * Visible côté élèves et parents pour le suivi.
 * PedaClic — Groupes-classes (prof)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TravailAFaire } from '../types/groupeAbsences.types';

const COL_TRAVAUX = 'travaux_a_faire';

/** Supprime récursivement toute valeur `undefined` (Firestore les rejette). */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date)) {
      cleaned[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as any).seconds, (val as any).nanoseconds || 0).toDate();
  }
  return new Date(val as string);
}

/**
 * Crée un travail à faire.
 */
export async function creerTravailAFaire(
  data: Omit<TravailAFaire, 'id' | 'createdAt'>
): Promise<TravailAFaire> {
  // Construire le payload en excluant les champs undefined
  // (Firestore rejette les valeurs undefined — ex. rubriqueId, rubriqueNom)
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  // Convertir la date d'échéance en Timestamp Firestore
  if (payload.dateEcheance instanceof Date) {
    payload.dateEcheance = Timestamp.fromDate(payload.dateEcheance as Date);
  }
  payload.createdAt = Timestamp.now();

  const ref = await addDoc(collection(db, COL_TRAVAUX), stripUndefined(payload));
  const snap = await getDoc(ref);
  return {
    id: ref.id,
    ...snap.data(),
    dateEcheance: toDate(snap.data()!.dateEcheance),
    createdAt: toDate(snap.data()!.createdAt),
  } as TravailAFaire;
}

/**
 * Met à jour un travail à faire.
 *
 * Phase 36 — la liste des champs modifiables inclut maintenant
 * `corrigeDate` (YYYY-MM-DD) et `corrigeHeure` (HH:mm) pour permettre
 * à l'enseignant de régler finement le moment de la correction.
 */
export async function modifierTravailAFaire(
  id: string,
  updates: Partial<Pick<TravailAFaire,
    | 'titre' | 'description' | 'dateEcheance' | 'matiere' | 'heureEcheance'
    | 'cahierId' | 'rubriqueId' | 'rubriqueNom'
    | 'corrige' | 'corrigeDate' | 'corrigeHeure'
  >>
): Promise<void> {
  const ref = doc(db, COL_TRAVAUX, id);
  // Exclure les champs undefined pour éviter le rejet Firestore
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }
  if (data.dateEcheance instanceof Date) {
    data.dateEcheance = Timestamp.fromDate(data.dateEcheance as Date);
  }
  await updateDoc(ref, stripUndefined(data));
}

/**
 * Retourne un couple [YYYY-MM-DD, HH:mm] représentant l'instant présent
 * en fuseau local — utilisé pour auto-dater la clôture d'un exercice.
 *
 * Exposé (pas seulement interne) pour permettre à la UI d'initialiser
 * des inputs date/time quand l'utilisateur édite la date de correction.
 */
export function maintenantDateHeure(): { date: string; heure: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const heure = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { date, heure };
}

/**
 * Bascule le statut corrigé d'un travail.
 *
 * Phase 36 :
 *   - À la cochée (corrige=true) : on estampille `corrigeDate` et
 *     `corrigeHeure` avec l'instant local courant SAUF si l'appelant
 *     fournit une date/heure explicite (ex. édition manuelle du prof).
 *   - À la décochée (corrige=false) : on efface date & heure en
 *     écrivant une chaîne vide (Firestore ne connaît pas delete côté
 *     client sans FieldValue.delete() ; ici, chaîne vide = "non
 *     renseigné", cohérent avec la lecture dans l'UI).
 *
 * L'appelant peut passer un 3e argument pour forcer une valeur
 * (utile quand l'enseignant ajuste après coup).
 */
export async function toggleCorrigeTravail(
  id: string,
  corrige: boolean,
  options?: { date?: string; heure?: string }
): Promise<{ corrige: boolean; corrigeDate: string; corrigeHeure: string }> {
  const ref = doc(db, COL_TRAVAUX, id);
  if (corrige) {
    // Auto-remplissage si la UI n'a pas fourni de valeur explicite
    const auto = maintenantDateHeure();
    const corrigeDate = options?.date ?? auto.date;
    const corrigeHeure = options?.heure ?? auto.heure;
    await updateDoc(ref, { corrige, corrigeDate, corrigeHeure });
    return { corrige, corrigeDate, corrigeHeure };
  }
  // Décoché : reset des méta-données pour éviter d'afficher un
  // horodatage orphelin dans la UI.
  await updateDoc(ref, { corrige, corrigeDate: '', corrigeHeure: '' });
  return { corrige, corrigeDate: '', corrigeHeure: '' };
}

/**
 * Supprime un travail à faire.
 */
export async function supprimerTravailAFaire(id: string): Promise<void> {
  await deleteDoc(doc(db, COL_TRAVAUX, id));
}

/**
 * Récupère les travaux à faire d'un groupe (pour le prof).
 */
export async function getTravauxByGroupe(groupeId: string): Promise<TravailAFaire[]> {
  const q = query(
    collection(db, COL_TRAVAUX),
    where('groupeId', '==', groupeId),
    orderBy('dateEcheance', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dateEcheance: toDate(d.data().dateEcheance),
    createdAt: toDate(d.data().createdAt),
  })) as TravailAFaire[];
}

/**
 * Récupère les travaux à faire pour un élève (tous ses groupes).
 *
 * Par défaut, ne retourne que les travaux dont l'échéance est aujourd'hui
 * ou ultérieure. L'option `lookbackDays` permet d'inclure aussi les
 * travaux passés des N derniers jours — utile pour que l'élève puisse
 * consulter les exercices à domicile récemment échus (et voir leur
 * statut corrigé) depuis son tableau de bord.
 */
export async function getTravauxForEleve(
  groupeIds: string[],
  options?: { lookbackDays?: number }
): Promise<TravailAFaire[]> {
  if (groupeIds.length === 0) return [];
  const all: TravailAFaire[] = [];
  const lookbackDays = Math.max(0, options?.lookbackDays ?? 0);
  const borneMin = new Date();
  borneMin.setHours(0, 0, 0, 0);
  if (lookbackDays > 0) {
    borneMin.setDate(borneMin.getDate() - lookbackDays);
  }
  // ⚠️ Stratégie de requête :
  //
  //   - L'ancienne version faisait `orderBy(dateEcheance asc) + limit(50)`
  //     SANS filtre de date → pour un groupe avec beaucoup d'historique,
  //     les 50 plus anciens travaux étaient tous antérieurs à `borneMin`
  //     et éliminés en mémoire → liste vide à tort.
  //
  //   - Tenter `where('dateEcheance', '>=', borneTs) + orderBy(asc)` passait
  //     à côté des travaux dont le champ `dateEcheance` n'est pas un
  //     Timestamp Firestore (anciens docs saisis avec un format différent)
  //     car ni `where` ni `orderBy` ne les renvoient.
  //
  //   - Solution retenue : `orderBy(dateEcheance desc) + limit(50)` SANS
  //     `where` sur la date → on ramène les 50 travaux les plus récents
  //     par groupe, puis on filtre en mémoire. Cela couvre largement le
  //     besoin de la vue élève/parent (au plus 50 travaux actifs/récents
  //     par classe) et reste robuste aux données hétérogènes.
  //
  //   Si un élève devait vraiment voir > 50 travaux récents, il faudrait
  //   paginer — pas notre cas d'usage actuel.
  const debug: Array<{ gid: string; fetched: number; kept: number }> = [];
  for (const gid of groupeIds.slice(0, 10)) {
    const q2 = query(
      collection(db, COL_TRAVAUX),
      where('groupeId', '==', gid),
      orderBy('dateEcheance', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q2);
    let kept = 0;
    snap.docs.forEach((d) => {
      const t = {
        id: d.id,
        ...d.data(),
        dateEcheance: toDate(d.data().dateEcheance),
        createdAt: toDate(d.data().createdAt),
      } as TravailAFaire;
      if (t.dateEcheance >= borneMin) {
        all.push(t);
        kept++;
      }
    });
    debug.push({ gid, fetched: snap.size, kept });
  }
  // Diagnostic console : combien de travaux trouvés vs. retenus après
  // filtrage par la borne `lookbackDays`. Utile pour différencier
  // "pas de travail en base" de "travail trop ancien".
  // À retirer une fois la situation stabilisée.
  if (typeof console !== 'undefined' && console.info) {
    console.info('[getTravauxForEleve] borne >=', borneMin.toISOString(), '— par groupe :', debug);
  }
  all.sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
  return all;
}

/**
 * Récupère les travaux à faire liés à un cahier de textes.
 */
export async function getTravauxByCahier(cahierId: string): Promise<TravailAFaire[]> {
  const q = query(
    collection(db, COL_TRAVAUX),
    where('cahierId', '==', cahierId),
    orderBy('dateEcheance', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dateEcheance: toDate(d.data().dateEcheance),
    createdAt: toDate(d.data().createdAt),
  })) as TravailAFaire[];
}

/**
 * Récupère les travaux à faire pour un parent (groupes de ses enfants).
 */
export async function getTravauxForParent(groupeIdsEnfants: string[]): Promise<TravailAFaire[]> {
  return getTravauxForEleve(groupeIdsEnfants);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 35 — Synchronisation automatique depuis « Exercice à domicile »
// ═══════════════════════════════════════════════════════════════

/**
 * Récupère les travaux à faire générés automatiquement pour une séance
 * donnée (reconnus par le champ `seanceId`).
 */
export async function getTravauxBySeance(seanceId: string): Promise<TravailAFaire[]> {
  const q = query(
    collection(db, COL_TRAVAUX),
    where('seanceId', '==', seanceId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    dateEcheance: toDate(d.data().dateEcheance),
    createdAt: toDate(d.data().createdAt),
  })) as TravailAFaire[];
}

/**
 * Convertit une chaîne HTML (issue de RichTextEditor) en texte brut.
 * Utilisé pour alimenter le champ `description` du TravailAFaire —
 * les élèves verront une version lisible même sans rendu HTML.
 */
function htmlVersTexte(html: string, maxChars = 500): string {
  if (!html) return '';
  // Retire les balises, remplace les retours par des espaces, coalesce
  const sansBalises = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (sansBalises.length <= maxChars) return sansBalises;
  return sansBalises.slice(0, maxChars - 1).trimEnd() + '…';
}

export interface UpsertTravauxDomicileParams {
  seanceId: string;
  chapitre: string;
  exerciceDomicile: string | undefined | null;
  echeanceDomicile: { date: string; heure: string } | null | undefined;
  cahier: {
    id: string;
    profId: string;
    matiere?: string;
    groupeIds: string[];
    groupeNoms: string[];
  };
  rubriqueId?: string | null;
  rubriqueNom?: string | null;
  profNom?: string | null;
}

/**
 * Synchronise les travaux à faire dérivés d'un exercice à domicile :
 *
 *   - Si `exerciceDomicile` est vide OU `echeanceDomicile` absent/invalide
 *     → supprime tous les travaux auto-créés pour cette séance.
 *   - Sinon → upsert un travail par groupe du cahier (un par `groupeId`),
 *     reconnaissable par la paire (seanceId, groupeId).
 *
 * Implémentée en best-effort : toute erreur Firestore est capturée et
 * loguée, sans remonter à l'appelant (la sauvegarde de la séance ne
 * doit jamais être compromise par un souci de synchronisation annexe).
 */
export async function upsertTravailDepuisExerciceDomicile(
  p: UpsertTravauxDomicileParams
): Promise<void> {
  try {
    const existants = await getTravauxBySeance(p.seanceId);

    const aPasDExercice = !p.exerciceDomicile || !p.exerciceDomicile.trim();
    const aPasDEcheance =
      !p.echeanceDomicile ||
      !p.echeanceDomicile.date ||
      !p.echeanceDomicile.heure;

    // Cas "retrait" : on nettoie tous les travaux auto-créés pour la séance
    if (aPasDExercice || aPasDEcheance) {
      await Promise.all(
        existants.map((t) =>
          deleteDoc(doc(db, COL_TRAVAUX, t.id)).catch(() => null)
        )
      );
      return;
    }

    // Construction de la date d'échéance (fuseau local)
    const [annee, mois, jour] = p.echeanceDomicile!.date.split('-').map(Number);
    const [hh, mm] = p.echeanceDomicile!.heure.split(':').map(Number);
    const dateEcheance = new Date(annee, (mois || 1) - 1, jour || 1, hh || 23, mm || 59, 0, 0);
    if (Number.isNaN(dateEcheance.getTime())) {
      // Échéance invalide → on nettoie les travaux existants pour éviter les résidus
      await Promise.all(
        existants.map((t) =>
          deleteDoc(doc(db, COL_TRAVAUX, t.id)).catch(() => null)
        )
      );
      return;
    }

    const titre = `🏠 Exercice à domicile — ${p.chapitre || 'Séance'}`;
    const description = htmlVersTexte(p.exerciceDomicile || '');

    // Map des travaux existants par groupeId → pour upsert ciblé
    const parGroupe = new Map<string, TravailAFaire>();
    for (const t of existants) parGroupe.set(t.groupeId, t);

    const groupeIds = p.cahier.groupeIds || [];
    const groupeNoms = p.cahier.groupeNoms || [];

    // Upsert par groupe du cahier
    await Promise.all(
      groupeIds.map(async (gid, idx) => {
        const groupeNom = groupeNoms[idx] || '';
        const existant = parGroupe.get(gid);
        if (existant) {
          // Update : on ne touche pas `corrige` (initiative prof)
          await modifierTravailAFaire(existant.id, {
            titre,
            description,
            dateEcheance,
            heureEcheance: p.echeanceDomicile!.heure,
            matiere: p.cahier.matiere,
            cahierId: p.cahier.id,
            rubriqueId: p.rubriqueId || undefined,
            rubriqueNom: p.rubriqueNom || undefined,
          }).catch((err) =>
            console.warn('[upsertTravauxDomicile] update a échoué:', err)
          );
          parGroupe.delete(gid); // marque comme traité
        } else {
          const payload: Omit<TravailAFaire, 'id' | 'createdAt'> = {
            groupeId: gid,
            groupeNom,
            titre,
            description,
            dateEcheance,
            heureEcheance: p.echeanceDomicile!.heure,
            matiere: p.cahier.matiere,
            cahierId: p.cahier.id,
            seanceId: p.seanceId,
            profId: p.cahier.profId,
            corrige: false,
          };
          if (p.rubriqueId) {
            payload.rubriqueId = p.rubriqueId;
            payload.rubriqueNom = p.rubriqueNom || undefined;
          }
          if (p.profNom) {
            payload.profNom = p.profNom;
          }
          await creerTravailAFaire(payload).catch((err) =>
            console.warn('[upsertTravauxDomicile] create a échoué:', err)
          );
        }
      })
    );

    // Nettoyage : travaux résiduels dont le groupe n'est plus dans le cahier
    await Promise.all(
      Array.from(parGroupe.values()).map((t) =>
        deleteDoc(doc(db, COL_TRAVAUX, t.id)).catch(() => null)
      )
    );
  } catch (err) {
    console.warn('[upsertTravauxDomicile] erreur non bloquante :', err);
  }
}
