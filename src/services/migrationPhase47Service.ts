// ============================================================
// PedaClic — Phase 47 : Migration des séances existantes (ADMIN)
// ------------------------------------------------------------
// Pour CHAQUE séance (entrees_cahier) :
//   1. visibleEleves ← isPartage du cahier parent (false si orphelin)
//   2. notesPrivees non vide → copié dans entrees_cahier_privees/{id}
//      puis le champ est SUPPRIMÉ du document de séance.
//
// • Idempotente : peut être relancée sans risque (rien n'est écrit
//   si la séance est déjà conforme).
// • Paginée (200 séances / lot → ≤ 400 écritures par batch).
// • Réservée aux administrateurs (règles Firestore : isAdmin()).
// ============================================================

import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  documentId,
  writeBatch,
  deleteField,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COL_NOTES_PRIVEES } from './notesPriveesService';

const TAILLE_PAGE = 200;

export interface RapportMigration47 {
  seancesAnalysees: number;
  visibiliteCorrigee: number;
  notesDeplacees: number;
  champsVidesRetires: number;
  terminee: boolean;
}

export async function migrerSeancesPhase47(
  onProgression?: (r: RapportMigration47) => void
): Promise<RapportMigration47> {
  const rapport: RapportMigration47 = {
    seancesAnalysees: 0,
    visibiliteCorrigee: 0,
    notesDeplacees: 0,
    champsVidesRetires: 0,
    terminee: false,
  };

  // 1. Partage de chaque cahier (Map cahierId → isPartage)
  const cahiersSnap = await getDocs(collection(db, 'cahiers_textes'));
  const partageParCahier = new Map<string, boolean>(
    cahiersSnap.docs.map(d => [d.id, d.data().isPartage === true])
  );

  // 2. Parcours paginé de toutes les séances (ordre stable par ID)
  let dernier: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const q = dernier
      ? query(collection(db, 'entrees_cahier'), orderBy(documentId()), startAfter(dernier), limit(TAILLE_PAGE))
      : query(collection(db, 'entrees_cahier'), orderBy(documentId()), limit(TAILLE_PAGE));
    const page = await getDocs(q);
    if (page.empty) break;

    const batch = writeBatch(db);
    let ecritures = 0;

    for (const d of page.docs) {
      const data = d.data();
      const correctif: Record<string, unknown> = {};

      // a) Visibilité élèves alignée sur le cahier parent
      const visible = partageParCahier.get(String(data.cahierId)) ?? false;
      if (data.visibleEleves !== visible) {
        correctif.visibleEleves = visible;
        rapport.visibiliteCorrigee++;
      }

      // b) Notes privées sorties du document public
      if ('notesPrivees' in data) {
        const notes = typeof data.notesPrivees === 'string' ? data.notesPrivees : '';
        if (notes.trim()) {
          batch.set(
            doc(db, COL_NOTES_PRIVEES, d.id),
            {
              profId: String(data.profId ?? ''),
              cahierId: String(data.cahierId ?? ''),
              notesPrivees: notes,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
          ecritures++;
          rapport.notesDeplacees++;
        } else {
          rapport.champsVidesRetires++;
        }
        correctif.notesPrivees = deleteField();
      }

      // updatedAt volontairement inchangé : la migration est invisible
      if (Object.keys(correctif).length) {
        batch.update(d.ref, correctif);
        ecritures++;
      }
    }

    if (ecritures > 0) await batch.commit();
    rapport.seancesAnalysees += page.size;
    onProgression?.({ ...rapport });

    if (page.size < TAILLE_PAGE) break;
    dernier = page.docs[page.docs.length - 1];
  }

  rapport.terminee = true;
  onProgression?.({ ...rapport });
  return rapport;
}
