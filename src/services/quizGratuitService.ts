// ============================================================
// SERVICE : quizGratuitService
// Charge les quiz gratuits depuis quizzes + quizzes_v2
// PedaClic — www.pedaclic.sn
// ============================================================

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
// ★ Phase 61 — requêtes compatibles règles Phase 60 et Phase 61
import { PHASE61_REQUETES_SCINDEES } from '../config/phase61';

// ─── Interfaces ──────────────────────────────────────────────

/**
 * Quiz gratuit unifié (compatible quizzes ET quizzes_v2)
 */
export interface QuizGratuit {
  id: string;
  titre: string;
  description?: string;
  matiere: string;
  niveau?: string;
  classe?: string;
  nombreQuestions: number;
  duree?: number;           // en minutes
  difficulte?: 'facile' | 'moyen' | 'difficile';
  source: 'quizzes' | 'quizzes_v2';
  isPremium: false;
  createdAt?: Timestamp;
}

// ─── Constantes ──────────────────────────────────────────────
const COL_QUIZZES    = 'quizzes';
const COL_QUIZZES_V2 = 'quizzes_v2';
const MAX_PAR_COL    = 50;

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Normalise un document quizzes (ancienne collection)
 */
function normaliserQuizAncien(d: QueryDocumentSnapshot): QuizGratuit {
  const data = d.data();
  return {
    id:              d.id,
    titre:           data.titre       || 'Quiz sans titre',
    description:     data.description || '',
    matiere:         data.matiere     || data.disciplineId || '',
    niveau:          data.niveau      || '',
    classe:          data.classe      || '',
    nombreQuestions: Array.isArray(data.questions) ? data.questions.length : 0,
    duree:           data.duree       || undefined,
    difficulte:      data.difficulte  || 'moyen',
    source:          'quizzes',
    isPremium:       false,
    createdAt:       data.createdAt   || undefined,
  };
}

/**
 * Normalise un document quizzes_v2 (collection avancée)
 */
function normaliserQuizV2(d: QueryDocumentSnapshot): QuizGratuit {
  const data = d.data();
  return {
    id:              d.id,
    titre:           data.titre       || 'Quiz sans titre',
    description:     data.description || '',
    matiere:         data.matiere     || '',
    niveau:          data.niveau      || '',
    classe:          data.classe      || '',
    nombreQuestions: Array.isArray(data.questions) ? data.questions.length : 0,
    duree:           data.dureeEstimee || undefined,
    difficulte:      data.difficulte   || 'moyen',
    source:          'quizzes_v2',
    isPremium:       false,
    createdAt:       data.createdAt    || undefined,
  };
}

// ─── Fonctions exportées ──────────────────────────────────────

/**
 * Récupère tous les quiz gratuits des deux collections.
 * Retourne les quiz triés par date de création décroissante.
 */
export async function getQuizGratuits(): Promise<QuizGratuit[]> {
  // ★ Phase 61 — étape 2 : version compatible avec les règles durcies.
  if (PHASE61_REQUETES_SCINDEES) return getQuizGratuitsPhase61();

  const [snapOld, snapV2] = await Promise.all([
    // Collection quizzes (ancienne)
    getDocs(
      query(
        collection(db, COL_QUIZZES),
        where('isPremium', '==', false),
        orderBy('createdAt', 'desc'),
        limit(MAX_PAR_COL)
      )
    ),
    // Collection quizzes_v2 (avancée)
    getDocs(
      query(
        collection(db, COL_QUIZZES_V2),
        where('isPremium', '==', false),
        orderBy('createdAt', 'desc'),
        limit(MAX_PAR_COL)
      )
    ),
  ]);

  // ★ Phase 60 — La page publique « Quiz gratuits » ne doit lister que les
  // quiz réellement publics : on écarte les BROUILLONS et les quiz LIÉS À
  // UNE CLASSE / UN GROUPE (`groupeId` renseigné), réservés à leurs élèves.
  // Filtre côté client : aucune requête ni aucun index modifié.
  const estPublic = (d: QueryDocumentSnapshot): boolean => {
    const data = d.data();
    return data.status !== 'draft' && !data.groupeId;
  };
  const quizzesOld = snapOld.docs.filter(estPublic).map(normaliserQuizAncien);
  const quizzesV2  = snapV2.docs.filter(estPublic).map(normaliserQuizV2);

  // Fusion + tri global par date décroissante
  return [...quizzesOld, ...quizzesV2].sort((a, b) => {
    const dateA = a.createdAt?.toMillis() ?? 0;
    const dateB = b.createdAt?.toMillis() ?? 0;
    return dateB - dateA;
  });
}

/**
 * ★ Phase 61 — Quiz gratuits, globaux et publiés, PROUVABLES par les règles :
 *   where isPremium == false && groupeId == null && status == 'published'
 *   (+ orderBy createdAt desc, limit) → index composites ajoutés dans
 *   firestore.indexes.json (déployés dès l'étape 1).
 * Promise.allSettled : si les quiz avancés sont refusés (visiteur non
 * connecté : règle inchangée), les quiz classiques restent affichés —
 * auparavant, l'échec d'une seule requête faisait échouer toute la page.
 */
async function getQuizGratuitsPhase61(): Promise<QuizGratuit[]> {
  const filtres = [
    where('isPremium', '==', false),
    where('groupeId', '==', null),
    where('status', '==', 'published'),
    orderBy('createdAt', 'desc'),
    limit(MAX_PAR_COL),
  ];
  const [resOld, resV2] = await Promise.allSettled([
    getDocs(query(collection(db, COL_QUIZZES), ...filtres)),
    getDocs(query(collection(db, COL_QUIZZES_V2), ...filtres)),
  ]);
  if (resOld.status === 'rejected' && resV2.status === 'rejected') {
    throw resOld.reason; // les deux ont échoué : la page affiche son message d'erreur
  }
  if (resOld.status === 'rejected') console.warn('[quizGratuits] quiz classiques indisponibles :', resOld.reason);
  if (resV2.status === 'rejected') console.warn('[quizGratuits] quiz avancés indisponibles :', resV2.reason);

  const quizzesOld = resOld.status === 'fulfilled' ? resOld.value.docs.map(normaliserQuizAncien) : [];
  const quizzesV2  = resV2.status === 'fulfilled' ? resV2.value.docs.map(normaliserQuizV2) : [];
  return [...quizzesOld, ...quizzesV2].sort((a, b) => {
    const dateA = a.createdAt?.toMillis() ?? 0;
    const dateB = b.createdAt?.toMillis() ?? 0;
    return dateB - dateA;
  });
}

/**
 * Récupère les quiz gratuits filtrés par matière
 */
export async function getQuizGratuitsByMatiere(matiere: string): Promise<QuizGratuit[]> {
  const tous = await getQuizGratuits();
  return tous.filter(q =>
    q.matiere.toLowerCase().includes(matiere.toLowerCase())
  );
}

/**
 * Aperçu limité pour les visiteurs non connectés (3 quiz max)
 */
export async function getQuizGratuitsApercu(): Promise<QuizGratuit[]> {
  const tous = await getQuizGratuits();
  return tous.slice(0, 3);
}
