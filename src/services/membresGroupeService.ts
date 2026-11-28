// ============================================================
// PedaClic — Phase 61 : membresGroupeService.ts
// ------------------------------------------------------------
// Collection d'APPARTENANCE aux groupes, à identifiant DÉTERMINISTE :
//
//     membres_groupe/{groupeId}_{eleveId}
//         groupeId        : string   (id du groupe dans groupes_prof)
//         eleveId         : string   (uid Firebase de l'élève)
//         source          : 'code' | 'direct' | 'reactivation' | 'migration'
//         codeInvitation? : string   (uniquement pour une inscription par code :
//                                     la règle Firestore vérifie ce code)
//         dateAjout       : Timestamp serveur
//
// Pourquoi ? Les règles Firestore ne peuvent pas « chercher » une inscription
// dans `inscriptions_groupe` (identifiants aléatoires). Avec un identifiant
// calculable, une règle peut écrire :
//     exists(/databases/$(database)/documents/membres_groupe/$(gid + '_' + uid))
// et réserver la lecture d'un quiz de classe aux seuls élèves inscrits.
//
// Principes :
//   • `inscriptions_groupe` reste la SOURCE DE VÉRITÉ (affichage prof, notes,
//     appel…). `membres_groupe` n'en est qu'un reflet, utilisé par les règles.
//   • Les écritures ici ne BLOQUENT JAMAIS une inscription : en cas d'échec,
//     un avertissement est journalisé et le bouton admin « Migration Phase 61 »
//     (idempotent) remet tout en ordre.
//   • Les élèves sans compte (« offline: », Phase 34) n'ont pas d'appartenance :
//     ils ne se connectent jamais, donc ne lisent aucun quiz.
// ============================================================

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
  limit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

export const COL_MEMBRES = 'membres_groupe';
const COL_INSCRIPTIONS = 'inscriptions_groupe';
const COL_QUIZZES = 'quizzes';
const COL_QUIZZES_V2 = 'quizzes_v2';

/** Taille maximale d'un lot d'écritures (Firestore : 500 opérations). */
const TAILLE_LOT = 400;

export type SourceMembre = 'code' | 'direct' | 'reactivation' | 'migration';

// ─────────────────────────────────────────────────────────────
// OUTILS
// ─────────────────────────────────────────────────────────────

/** Identifiant déterministe du document d'appartenance. */
export function idMembre(groupeId: string, eleveId: string): string {
  return `${groupeId}_${eleveId}`;
}

/**
 * Indique si l'élève doit avoir une appartenance :
 *   - pas d'élève « offline » (pas de compte) ;
 *   - pas de « / » (interdit dans un identifiant Firestore) ;
 *   - pas de « _ » (séparateur de l'identifiant : un uid Firebase n'en
 *     contient jamais, on se protège quand même d'une donnée anormale).
 */
export function eleveAvecCompte(eleveId: string | undefined | null): eleveId is string {
  return (
    typeof eleveId === 'string' &&
    eleveId.length > 0 &&
    !eleveId.startsWith('offline:') &&
    !eleveId.includes('/') &&
    !eleveId.includes('_')
  );
}

// ─────────────────────────────────────────────────────────────
// ÉCRITURES UNITAIRES (appelées à chaque inscription / retrait)
// ─────────────────────────────────────────────────────────────

/**
 * Crée (ou rafraîchit) l'appartenance d'un élève à un groupe.
 * Non bloquant : renvoie false en cas d'échec, sans lever d'erreur.
 *
 * @param codeInvitation  à fournir UNIQUEMENT pour une inscription par code
 *                        faite par l'élève lui-même (la règle le compare au
 *                        code en cours du groupe et à son échéance).
 */
export async function ajouterMembre(params: {
  groupeId: string;
  eleveId: string;
  source: SourceMembre;
  codeInvitation?: string;
}): Promise<boolean> {
  const { groupeId, eleveId, source, codeInvitation } = params;
  if (!groupeId || !eleveAvecCompte(eleveId)) return false;
  try {
    await setDoc(doc(db, COL_MEMBRES, idMembre(groupeId, eleveId)), {
      groupeId,
      eleveId,
      source,
      ...(codeInvitation ? { codeInvitation } : {}),
      dateAjout: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('[membresGroupe] Appartenance non écrite (sera réparée par la migration Phase 61) :', e);
    return false;
  }
}

/**
 * Supprime l'appartenance SEULEMENT s'il ne reste aucune inscription
 * active de cet élève dans ce groupe (cas d'un doublon d'inscription :
 * retirer l'une ne doit pas couper l'accès donné par l'autre).
 * Non bloquant.
 */
export async function retirerMembreSiPlusInscrit(
  groupeId: string,
  eleveId: string
): Promise<void> {
  if (!groupeId || !eleveAvecCompte(eleveId)) return;
  try {
    const restant = await getDocs(
      query(
        collection(db, COL_INSCRIPTIONS),
        where('groupeId', '==', groupeId),
        where('eleveId', '==', eleveId),
        where('statut', '==', 'actif'),
        limit(1)
      )
    );
    if (!restant.empty) return; // une autre inscription active subsiste
    await deleteDoc(doc(db, COL_MEMBRES, idMembre(groupeId, eleveId)));
  } catch (e) {
    console.warn('[membresGroupe] Appartenance non retirée (sera réparée par la migration Phase 61) :', e);
  }
}

/**
 * Supprime toutes les appartenances d'un groupe (avant sa suppression).
 * Doit être appelée AVANT de supprimer le groupe : la règle vérifie que
 * l'auteur est propriétaire du groupe, ce qui suppose qu'il existe encore.
 * Non bloquant.
 */
export async function retirerTousMembresGroupe(groupeId: string): Promise<void> {
  if (!groupeId) return;
  try {
    const snap = await getDocs(
      query(collection(db, COL_MEMBRES), where('groupeId', '==', groupeId))
    );
    for (let i = 0; i < snap.docs.length; i += TAILLE_LOT) {
      const lot = writeBatch(db);
      snap.docs.slice(i, i + TAILLE_LOT).forEach((d) => lot.delete(d.ref));
      await lot.commit();
    }
  } catch (e) {
    console.warn('[membresGroupe] Appartenances du groupe non supprimées :', e);
  }
}

// ─────────────────────────────────────────────────────────────
// MIGRATION (bouton admin, idempotent)
// ─────────────────────────────────────────────────────────────

/** Compte rendu affiché à l'admin après la migration. */
export interface CompteRenduMigration61 {
  inscriptionsActives: number;      // inscriptions actives lues
  inscriptionsSansCompte: number;   // élèves offline / identifiants ignorés
  membresCrees: number;             // appartenances ajoutées
  membresDejaPresents: number;      // appartenances déjà correctes
  membresObsoletesSupprimes: number; // appartenances sans inscription active
  quizClassiquesLus: number;
  quizClassiquesNormalises: number; // groupeId → null et/ou status → 'published'
  quizAvancesLus: number;
  quizAvancesNormalises: number;    // groupeId → null
  quizAvancesSansStatut: number;    // laissés tels quels (déjà invisibles aux élèves)
  erreurs: string[];
  dureeMs: number;
}

/** Exécute des opérations par lots de TAILLE_LOT. */
async function executerParLots(
  operations: Array<(lot: ReturnType<typeof writeBatch>) => void>,
  erreurs: string[],
  libelle: string
): Promise<number> {
  let reussies = 0;
  for (let i = 0; i < operations.length; i += TAILLE_LOT) {
    const tranche = operations.slice(i, i + TAILLE_LOT);
    const lot = writeBatch(db);
    tranche.forEach((op) => op(lot));
    try {
      await lot.commit();
      reussies += tranche.length;
    } catch (e: any) {
      erreurs.push(`${libelle} (lot ${i / TAILLE_LOT + 1}) : ${e?.message || e}`);
    }
  }
  return reussies;
}

/** Un groupeId « vide » : absent, undefined ou chaîne vide → quiz global. */
function groupeIdAbsent(data: Record<string, unknown>): boolean {
  return !('groupeId' in data) || data.groupeId === undefined || data.groupeId === '';
}

/**
 * Migration Phase 61 — RÉSERVÉE À L'ADMIN. Idempotente : la relancer ne
 * produit aucune écriture si tout est déjà en ordre.
 *
 *   1. Appartenances : crée celles qui manquent (inscriptions actives d'élèves
 *      avec compte) et supprime celles qui n'ont plus d'inscription active.
 *   2. Quiz classiques (`quizzes`) : groupeId absent/'' → null ;
 *      status absent → 'published' (un quiz sans statut était déjà affiché
 *      comme publié : aucun changement visible).
 *   3. Quiz avancés (`quizzes_v2`) : groupeId absent/'' → null.
 *      Le statut n'est pas modifié.
 */
export async function migrerMembresEtQuiz(): Promise<CompteRenduMigration61> {
  const debut = Date.now();
  const cr: CompteRenduMigration61 = {
    inscriptionsActives: 0,
    inscriptionsSansCompte: 0,
    membresCrees: 0,
    membresDejaPresents: 0,
    membresObsoletesSupprimes: 0,
    quizClassiquesLus: 0,
    quizClassiquesNormalises: 0,
    quizAvancesLus: 0,
    quizAvancesNormalises: 0,
    quizAvancesSansStatut: 0,
    erreurs: [],
    dureeMs: 0,
  };

  // ── 1. Appartenances ────────────────────────────────────────
  try {
    const [inscSnap, membresSnap] = await Promise.all([
      getDocs(query(collection(db, COL_INSCRIPTIONS), where('statut', '==', 'actif'))),
      getDocs(collection(db, COL_MEMBRES)),
    ]);
    cr.inscriptionsActives = inscSnap.size;

    // Appartenances attendues : id → { groupeId, eleveId }
    const attendues = new Map<string, { groupeId: string; eleveId: string }>();
    inscSnap.docs.forEach((d) => {
      const { groupeId, eleveId } = d.data() as { groupeId?: string; eleveId?: string };
      if (!groupeId || !eleveAvecCompte(eleveId)) {
        cr.inscriptionsSansCompte++;
        return;
      }
      attendues.set(idMembre(groupeId, eleveId), { groupeId, eleveId });
    });

    const existantes = new Set(membresSnap.docs.map((d) => d.id));

    // Créations
    const creations: Array<(lot: ReturnType<typeof writeBatch>) => void> = [];
    attendues.forEach((m, id) => {
      if (existantes.has(id)) {
        cr.membresDejaPresents++;
        return;
      }
      creations.push((lot) =>
        lot.set(doc(db, COL_MEMBRES, id), {
          groupeId: m.groupeId,
          eleveId: m.eleveId,
          source: 'migration',
          dateAjout: serverTimestamp(),
        })
      );
    });
    cr.membresCrees = await executerParLots(creations, cr.erreurs, 'Création des appartenances');

    // Suppressions (appartenances orphelines)
    const suppressions: Array<(lot: ReturnType<typeof writeBatch>) => void> = [];
    membresSnap.docs.forEach((d) => {
      if (!attendues.has(d.id)) suppressions.push((lot) => lot.delete(d.ref));
    });
    cr.membresObsoletesSupprimes = await executerParLots(
      suppressions,
      cr.erreurs,
      'Suppression des appartenances obsolètes'
    );
  } catch (e: any) {
    cr.erreurs.push(`Lecture des inscriptions / appartenances : ${e?.message || e}`);
  }

  // ── 2. Quiz classiques ──────────────────────────────────────
  try {
    const snap = await getDocs(collection(db, COL_QUIZZES));
    cr.quizClassiquesLus = snap.size;
    const ops: Array<(lot: ReturnType<typeof writeBatch>) => void> = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      const patch: Record<string, unknown> = {};
      if (groupeIdAbsent(data)) patch.groupeId = null;
      if (!data.status) patch.status = 'published';
      if (Object.keys(patch).length > 0) ops.push((lot) => lot.update(d.ref, patch));
    });
    cr.quizClassiquesNormalises = await executerParLots(ops, cr.erreurs, 'Normalisation des quiz classiques');
  } catch (e: any) {
    cr.erreurs.push(`Lecture des quiz classiques : ${e?.message || e}`);
  }

  // ── 3. Quiz avancés ─────────────────────────────────────────
  try {
    const snap = await getDocs(collection(db, COL_QUIZZES_V2));
    cr.quizAvancesLus = snap.size;
    const ops: Array<(lot: ReturnType<typeof writeBatch>) => void> = [];
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.status) cr.quizAvancesSansStatut++;
      if (groupeIdAbsent(data)) ops.push((lot) => lot.update(d.ref, { groupeId: null }));
    });
    cr.quizAvancesNormalises = await executerParLots(ops, cr.erreurs, 'Normalisation des quiz avancés');
  } catch (e: any) {
    cr.erreurs.push(`Lecture des quiz avancés : ${e?.message || e}`);
  }

  cr.dureeMs = Date.now() - debut;
  return cr;
}
