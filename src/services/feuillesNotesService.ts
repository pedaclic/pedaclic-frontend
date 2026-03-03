/**
 * Service feuilles de notes — PedaClic
 * Gestion des notes par groupe, avec moyennes périodiques
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getElevesGroupe } from './profGroupeService';
import type {
  FeuilleDeNotes,
  EvaluationNote,
  NotesEleve,
  LigneNotes,
  PeriodeType,
} from '../types/feuillesNotes.types';

const COL = 'feuilles_notes';

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Timestamp((val as { seconds: number }).seconds, (val as { nanoseconds?: number }).nanoseconds ?? 0).toDate();
  }
  return new Date(String(val));
}

/** Crée une feuille de notes pour un groupe */
export async function creerFeuilleDeNotes(
  groupeId: string,
  groupeNom: string,
  matiereId: string,
  matiereNom: string,
  profId: string,
  profNom: string,
  anneeScolaire: string,
  periodeType: PeriodeType,
  periodeLabel: string,
  dateDebut: Date,
  dateFin: Date,
  evaluations: EvaluationNote[] = []
): Promise<FeuilleDeNotes> {
  const now = Timestamp.now();
  const inscriptions = await getElevesGroupe(groupeId);
  const notes: Record<string, NotesEleve> = {};
  const eleveIds: string[] = [];
  inscriptions.forEach((i) => {
    notes[i.eleveId] = {};
    eleveIds.push(i.eleveId);
  });

  const ref = await addDoc(collection(db, COL), {
    eleveIds,
    groupeId,
    groupeNom,
    matiereId,
    matiereNom,
    profId,
    profNom,
    anneeScolaire,
    periodeType,
    periodeLabel,
    dateDebut: Timestamp.fromDate(dateDebut),
    dateFin: Timestamp.fromDate(dateFin),
    evaluations: evaluations.length ? evaluations : [{ id: 'e1', libelle: 'Évaluation 1', coefficient: 1 }],
    notes,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await getDoc(ref);
  const data = snap.data()!;
  return {
    id: ref.id,
    ...data,
    dateDebut: toDate(data.dateDebut),
    dateFin: toDate(data.dateFin),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as FeuilleDeNotes;
}

/** Récupère les feuilles d'un groupe */
export async function getFeuillesByGroupe(groupeId: string): Promise<FeuilleDeNotes[]> {
  const q = query(
    collection(db, COL),
    where('groupeId', '==', groupeId),
    orderBy('dateDebut', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      dateDebut: toDate(data.dateDebut),
      dateFin: toDate(data.dateFin),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as FeuilleDeNotes;
  });
}

/** Récupère une feuille par ID */
export async function getFeuilleById(feuilleId: string): Promise<FeuilleDeNotes | null> {
  const snap = await getDoc(doc(db, COL, feuilleId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    dateDebut: toDate(data.dateDebut),
    dateFin: toDate(data.dateFin),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as FeuilleDeNotes;
}

/** Met à jour les notes d'une feuille */
export async function updateNotesFeuille(
  feuilleId: string,
  eleveId: string,
  evaluationId: string,
  note: number | null
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const notes = { ...(data.notes || {}) };
  notes[eleveId] = { ...(notes[eleveId] || {}) };
  if (note === null || note === undefined || Number.isNaN(note)) {
    delete notes[eleveId][evaluationId];
  } else {
    notes[eleveId][evaluationId] = Math.max(0, Math.min(20, Number(note)));
  }
  await updateDoc(ref, { notes, updatedAt: Timestamp.now() });
}

/** Met à jour une note en une seule opération (optimisation) */
export async function updateNoteBulk(
  feuilleId: string,
  updates: { eleveId: string; evaluationId: string; note: number | null }[]
): Promise<void> {
  const ref = doc(db, COL, feuilleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Feuille introuvable');
  const data = snap.data();
  const notes = JSON.parse(JSON.stringify(data.notes || {}));
  for (const u of updates) {
    if (!notes[u.eleveId]) notes[u.eleveId] = {};
    if (u.note === null || u.note === undefined || Number.isNaN(u.note)) {
      delete notes[u.eleveId][u.evaluationId];
    } else {
      notes[u.eleveId][u.evaluationId] = Math.max(0, Math.min(20, Number(u.note)));
    }
  }
  await updateDoc(ref, { notes, updatedAt: Timestamp.now() });
}

/** Met à jour les évaluations d'une feuille */
export async function updateEvaluationsFeuille(
  feuilleId: string,
  evaluations: EvaluationNote[]
): Promise<void> {
  await updateDoc(doc(db, COL, feuilleId), {
    evaluations,
    updatedAt: Timestamp.now(),
  });
}

/** Supprime une feuille */
export async function supprimerFeuille(feuilleId: string): Promise<void> {
  await deleteDoc(doc(db, COL, feuilleId));
}

/** Construit les lignes de notes (élèves + moyennes) */
export function buildLignesNotes(feuille: FeuilleDeNotes, inscriptions: { eleveId: string; eleveNom: string; eleveEmail: string }[]): LigneNotes[] {
  const lignes: LigneNotes[] = [];
  const notes = feuille.notes || {};
  const evals = feuille.evaluations || [];

  for (const i of inscriptions) {
    const notesEleve = notes[i.eleveId] || {};
    let totalCoef = 0;
    let totalPoints = 0;
    for (const e of evals) {
      const n = notesEleve[e.id];
      if (n !== undefined && n !== null && !Number.isNaN(n)) {
        const coef = e.coefficient ?? 1;
        totalPoints += n * coef;
        totalCoef += coef;
      }
    }
    const moyenne = totalCoef > 0 ? Math.round((totalPoints / totalCoef) * 100) / 100 : 0;

    lignes.push({
      eleveId: i.eleveId,
      eleveNom: i.eleveNom,
      eleveEmail: i.eleveEmail,
      notes: notesEleve,
      moyenne,
    });
  }

  return lignes;
}

/** Feuilles pour un élève (tous ses groupes) */
export async function getFeuillesForEleve(eleveId: string): Promise<FeuilleDeNotes[]> {
  const { getGroupesEleve } = await import('./profGroupeService');
  const groupes = await getGroupesEleve(eleveId);
  const all: FeuilleDeNotes[] = [];
  for (const g of groupes) {
    const feuilles = await getFeuillesByGroupe(g.id);
    all.push(...feuilles);
  }
  all.sort((a, b) => {
    const da = toDate(a.dateDebut);
    const db = toDate(b.dateDebut);
    return db.getTime() - da.getTime();
  });
  return all;
}

/** Feuilles pour un parent (groupes de ses enfants) */
export async function getFeuillesForParent(enfantIds: string[]): Promise<FeuilleDeNotes[]> {
  const all: FeuilleDeNotes[] = [];
  const seen = new Set<string>();
  for (const eleveId of enfantIds) {
    const feuilles = await getFeuillesForEleve(eleveId);
    for (const f of feuilles) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        all.push(f);
      }
    }
  }
  all.sort((a, b) => {
    const da = toDate(a.dateDebut);
    const db = toDate(b.dateDebut);
    return db.getTime() - da.getTime();
  });
  return all;
}
