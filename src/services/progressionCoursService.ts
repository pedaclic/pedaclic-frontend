// ============================================================
// PedaClic — Phase 24 : Service — Progression Élève (Cours)
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ProgressionCours, ReponseQuiz } from '../cours_types';
import { incrementerInscrits } from './coursService';

// ─────────────────────────────────────────────────────────────
// CONSTANTE COLLECTION
// ─────────────────────────────────────────────────────────────
const COL_PROGRESSION = 'progression_cours';

// ─────────────────────────────────────────────────────────────
// LECTURE
// ─────────────────────────────────────────────────────────────

/**
 * Récupère la progression d'un élève pour un cours donné.
 * Retourne null si l'élève n'a pas encore commencé ce cours.
 */
export async function getProgression(
  userId: string,
  coursId: string
): Promise<ProgressionCours | null> {
  const q = query(
    collection(db, COL_PROGRESSION),
    where('userId', '==', userId),
    where('coursId', '==', coursId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ProgressionCours;
}

/**
 * Récupère toutes les progressions d'un élève (tableau de bord).
 */
export async function getProgressionsEleve(
  userId: string
): Promise<ProgressionCours[]> {
  const q = query(
    collection(db, COL_PROGRESSION),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProgressionCours));
}

/**
 * Récupère toutes les progressions d'un cours (vue analytique prof).
 */
export async function getProgressionsCours(
  coursId: string
): Promise<ProgressionCours[]> {
  const q = query(
    collection(db, COL_PROGRESSION),
    where('coursId', '==', coursId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProgressionCours));
}

// ─────────────────────────────────────────────────────────────
// ÉCRITURE
// ─────────────────────────────────────────────────────────────

/**
 * Initialise la progression d'un élève pour un cours.
 * Appelé lors du premier accès d'un élève à un cours.
 * Incrémente aussi le compteur d'inscrits du cours.
 */
export async function initProgression(
  userId: string,
  coursId: string
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, COL_PROGRESSION), {
    userId,
    coursId,
    sectionsLues: [],
    reponsesQuiz: [],
    pourcentageProgression: 0,
    scoreQuiz: 0,
    tentativesQuiz: 0,
    debutLe: now,
    dernierAcces: now,
    estTermine: false,
  } satisfies Omit<ProgressionCours, 'id'>);

  // Incrémenter le compteur d'inscrits du cours parent
  await incrementerInscrits(coursId);

  return ref.id;
}

/**
 * Marque une section comme lue et recalcule la progression.
 *
 * @param progressionId  ID du document progression_cours
 * @param sectionId      ID de la section lue
 * @param nombreSections Nombre total de sections du cours (pour le calcul %)
 */
export async function marquerSectionLue(
  progressionId: string,
  sectionId: string,
  nombreSections: number
): Promise<void> {
  // Lire la progression actuelle pour recalcul
  const snap = await getDoc(doc(db, COL_PROGRESSION, progressionId));
  if (!snap.exists()) return;

  const prog = snap.data() as Omit<ProgressionCours, 'id'>;

  // Éviter les doublons dans sectionsLues
  if (prog.sectionsLues.includes(sectionId)) return;

  const nouvellesSectionsLues = [...prog.sectionsLues, sectionId];
  const pourcentage = Math.round(
    (nouvellesSectionsLues.length / nombreSections) * 100
  );
  const estTermine = nouvellesSectionsLues.length >= nombreSections;

  await updateDoc(doc(db, COL_PROGRESSION, progressionId), {
    sectionsLues: arrayUnion(sectionId),
    pourcentageProgression: pourcentage,
    estTermine,
    dernierAcces: Timestamp.now(),
  });
}

/**
 * Enregistre la réponse d'un élève à un quiz et met à jour le score.
 *
 * @param progressionId  ID du document progression_cours
 * @param reponse        Objet ReponseQuiz avec le choix de l'élève
 */
export async function enregistrerReponseQuiz(
  progressionId: string,
  reponse: ReponseQuiz
): Promise<void> {
  // Lire la progression actuelle pour calculer le nouveau score
  const snap = await getDoc(doc(db, COL_PROGRESSION, progressionId));
  if (!snap.exists()) return;

  const prog = snap.data() as Omit<ProgressionCours, 'id'>;
  const reponsesExistantes = prog.reponsesQuiz ?? [];

  // Ignorer si l'élève a déjà répondu à ce quiz
  const dejaRepondu = reponsesExistantes.some(r => r.blocId === reponse.blocId);
  if (dejaRepondu) return;

  const nouvellesReponses = [...reponsesExistantes, reponse];
  const nbCorrectes = nouvellesReponses.filter(r => r.estCorrecte).length;
  const scoreQuiz = nouvellesReponses.length > 0
    ? Math.round((nbCorrectes / nouvellesReponses.length) * 100)
    : 0;

  await updateDoc(doc(db, COL_PROGRESSION, progressionId), {
    reponsesQuiz: arrayUnion(reponse),
    scoreQuiz,
    tentativesQuiz: prog.tentativesQuiz + 1,
    dernierAcces: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES ANALYTIQUES (vue professeur)
// ─────────────────────────────────────────────────────────────

/**
 * Calcule les statistiques agrégées des progressions d'un cours.
 * Utilisé dans le tableau de bord analytique du professeur.
 */
export function calculerStatsProgression(progressions: ProgressionCours[]) {
  if (progressions.length === 0) {
    return {
      nombreInscrits: 0,
      nombreTermines: 0,
      tauxCompletion: 0,
      progressionMoyenne: 0,
      scoreMoyen: 0,
    };
  }

  const nombreTermines = progressions.filter(p => p.estTermine).length;
  const progressionMoyenne = Math.round(
    progressions.reduce((acc, p) => acc + p.pourcentageProgression, 0) / progressions.length
  );
  const scoreMoyen = Math.round(
    progressions.reduce((acc, p) => acc + p.scoreQuiz, 0) / progressions.length
  );

  return {
    nombreInscrits: progressions.length,
    nombreTermines,
    tauxCompletion: Math.round((nombreTermines / progressions.length) * 100),
    progressionMoyenne,
    scoreMoyen,
  };
}
