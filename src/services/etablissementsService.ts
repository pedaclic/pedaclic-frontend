// ============================================================
// PedaClic — Phase 46 : Service « Établissements du professeur »
// ------------------------------------------------------------
// Collection : etablissements_prof
// Requête    : where('profId','==',uid) SEULEMENT (tri côté client)
//              → aucun index composite nécessaire.
// Classement : écritures groupées (writeBatch, ≤ 450 par lot).
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  EtablissementProf,
  EtablissementFormData,
} from '../types/etablissement.types';

const COL_ETABS   = 'etablissements_prof';
const COL_CAHIERS = 'cahiers_textes';
/** Marge sous la limite Firestore de 500 opérations par batch */
const TAILLE_LOT  = 450;

// ─────────────────────────────────────────────────────────────
// Normalisation d'un document (valeurs par défaut rétrocompatibles)
// ─────────────────────────────────────────────────────────────
function versEtablissement(id: string, data: Record<string, unknown>): EtablissementProf {
  return {
    sigle: '',
    ville: '',
    ief: '',
    couleur: '#1F3864',
    ordre: 0,
    isArchived: false,
    ...(data as Partial<EtablissementProf>),
    id,
  } as EtablissementProf;
}

/** Tri : actifs d'abord, puis ordre, puis nom (locale fr) */
function trierEtablissements(liste: EtablissementProf[]): EtablissementProf[] {
  return [...liste].sort((a, b) =>
    Number(a.isArchived) - Number(b.isArchived) ||
    a.ordre - b.ordre ||
    a.nom.localeCompare(b.nom, 'fr')
  );
}

// ─────────────────────────────────────────────────────────────
// LECTURE — temps réel
// ─────────────────────────────────────────────────────────────
export function subscribeEtablissements(
  profId: string,
  onData: (etabs: EtablissementProf[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, COL_ETABS), where('profId', '==', profId));
  return onSnapshot(
    q,
    (snap) => onData(trierEtablissements(snap.docs.map(d => versEtablissement(d.id, d.data())))),
    onError
  );
}

// ─────────────────────────────────────────────────────────────
// CRÉATION / MODIFICATION
// ─────────────────────────────────────────────────────────────
export async function creerEtablissement(
  profId: string,
  form: EtablissementFormData,
  ordre: number
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, COL_ETABS), {
    profId,
    nom:     form.nom.trim(),
    sigle:   form.sigle.trim(),
    ville:   form.ville.trim(),
    ief:     form.ief.trim(),
    couleur: form.couleur,
    ordre,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/**
 * Modifie un établissement. Si le NOM change, le nom dénormalisé
 * (`etablissementNom`) est propagé à tous les cahiers rattachés.
 */
export async function modifierEtablissement(
  profId: string,
  etab: EtablissementProf,
  form: EtablissementFormData
): Promise<void> {
  const nouveauNom = form.nom.trim();
  await updateDoc(doc(db, COL_ETABS, etab.id), {
    nom:     nouveauNom,
    sigle:   form.sigle.trim(),
    ville:   form.ville.trim(),
    ief:     form.ief.trim(),
    couleur: form.couleur,
    updatedAt: Timestamp.now(),
  });
  if (nouveauNom !== etab.nom) {
    await majCahiersDeLEtablissement(profId, etab.id, { etablissementNom: nouveauNom });
  }
}

export async function archiverEtablissement(etabId: string, isArchived: boolean): Promise<void> {
  await updateDoc(doc(db, COL_ETABS, etabId), { isArchived, updatedAt: Timestamp.now() });
}

/** Réordonne : `idsOrdonnes[i]` reçoit `ordre = i` */
export async function reordonnerEtablissements(idsOrdonnes: string[]): Promise<void> {
  const batch = writeBatch(db);
  idsOrdonnes.forEach((id, i) => batch.update(doc(db, COL_ETABS, id), { ordre: i }));
  await batch.commit();
}

/**
 * Supprime un établissement. Les cahiers rattachés (toutes années)
 * ne sont PAS supprimés : ils redeviennent « Non classés ».
 */
export async function supprimerEtablissement(profId: string, etabId: string): Promise<void> {
  await majCahiersDeLEtablissement(profId, etabId, { etablissementId: null, etablissementNom: '' });
  await deleteDoc(doc(db, COL_ETABS, etabId));
}

// ─────────────────────────────────────────────────────────────
// CLASSEMENT DES CAHIERS
// ─────────────────────────────────────────────────────────────

/**
 * Rattache plusieurs cahiers à un établissement (ou les déclasse si
 * `etab` = null). `updatedAt` n'est volontairement PAS modifié :
 * le classement ne doit pas bouleverser l'ordre « récents d'abord ».
 */
export async function classerCahiersEnLot(
  cahierIds: string[],
  etab: Pick<EtablissementProf, 'id' | 'nom'> | null
): Promise<void> {
  for (let i = 0; i < cahierIds.length; i += TAILLE_LOT) {
    const batch = writeBatch(db);
    cahierIds.slice(i, i + TAILLE_LOT).forEach(id =>
      batch.update(doc(db, COL_CAHIERS, id), {
        etablissementId:  etab?.id  ?? null,
        etablissementNom: etab?.nom ?? '',
      })
    );
    await batch.commit();
  }
}

/** Épingle / désépingle un cahier (sans toucher à updatedAt) */
export async function basculerEpingleCahier(cahierId: string, epingle: boolean): Promise<void> {
  await updateDoc(doc(db, COL_CAHIERS, cahierId), { epingle });
}

/**
 * Met à jour tous les cahiers du prof rattachés à un établissement.
 * Requête à 2 égalités → servie par les index simples (pas de composite).
 */
async function majCahiersDeLEtablissement(
  profId: string,
  etabId: string,
  champs: Record<string, unknown>
): Promise<void> {
  const snap = await getDocs(query(
    collection(db, COL_CAHIERS),
    where('profId', '==', profId),
    where('etablissementId', '==', etabId)
  ));
  for (let i = 0; i < snap.docs.length; i += TAILLE_LOT) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + TAILLE_LOT).forEach(d => batch.update(d.ref, champs));
    await batch.commit();
  }
}
