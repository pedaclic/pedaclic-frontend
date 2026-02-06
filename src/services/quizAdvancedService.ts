/**
 * ============================================================
 * PEDACLIC — Phase 12 : Service Firebase Quiz Avancé
 * CRUD complet pour les quiz multi-types
 * ============================================================
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  QuizAvance,
  QuizAvanceFormData,
  QuizAvanceResult,
  ReponseEleve,
  QuestionAvancee,
  DetailQuestionResult,
  QCMUniqueData,
  QCMMultipleData,
  DragDropData,
  MiseEnRelationData,
  EssaiData,
} from '../types/quiz-advanced';

// ==================== RÉFÉRENCES COLLECTIONS ====================

const QUIZZES_COLLECTION = 'quizzes_v2';       // Nouvelle collection pour quiz avancés
const RESULTS_COLLECTION = 'quiz_results_v2';   // Résultats quiz avancés

// ==================== CRUD QUIZ ====================

/**
 * Créer un nouveau quiz avancé
 */
export async function createQuizAvance(
  data: QuizAvanceFormData,
  auteurId: string
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, QUIZZES_COLLECTION), {
      ...data,
      auteurId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Quiz avancé créé :', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Erreur création quiz avancé :', error);
    throw new Error('Impossible de créer le quiz');
  }
}

/**
 * Mettre à jour un quiz avancé
 */
export async function updateQuizAvance(
  quizId: string,
  data: Partial<QuizAvanceFormData>
): Promise<void> {
  try {
    const docRef = doc(db, QUIZZES_COLLECTION, quizId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Quiz avancé mis à jour :', quizId);
  } catch (error) {
    console.error('❌ Erreur mise à jour quiz :', error);
    throw new Error('Impossible de mettre à jour le quiz');
  }
}

/**
 * Supprimer un quiz avancé
 */
export async function deleteQuizAvance(quizId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, QUIZZES_COLLECTION, quizId));
    console.log('✅ Quiz avancé supprimé :', quizId);
  } catch (error) {
    console.error('❌ Erreur suppression quiz :', error);
    throw new Error('Impossible de supprimer le quiz');
  }
}

/**
 * Récupérer un quiz par ID
 */
export async function getQuizAvance(quizId: string): Promise<QuizAvance | null> {
  try {
    const docSnap = await getDoc(doc(db, QUIZZES_COLLECTION, quizId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || undefined,
    } as QuizAvance;
  } catch (error) {
    console.error('❌ Erreur récupération quiz :', error);
    throw new Error('Impossible de récupérer le quiz');
  }
}

/**
 * Récupérer tous les quiz d'une discipline
 */
export async function getQuizzesByDiscipline(
  disciplineId: string
): Promise<QuizAvance[]> {
  try {
    const q = query(
      collection(db, QUIZZES_COLLECTION),
      where('disciplineId', '==', disciplineId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || undefined,
      } as QuizAvance;
    });
  } catch (error) {
    console.error('❌ Erreur récupération quiz par discipline :', error);
    throw new Error('Impossible de récupérer les quiz');
  }
}

/**
 * Récupérer tous les quiz (admin)
 */
export async function getAllQuizzes(): Promise<QuizAvance[]> {
  try {
    const q = query(
      collection(db, QUIZZES_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || undefined,
      } as QuizAvance;
    });
  } catch (error) {
    console.error('❌ Erreur récupération tous les quiz :', error);
    throw new Error('Impossible de récupérer les quiz');
  }
}

// ==================== SOUMISSION & CORRECTION ====================

/**
 * Corriger automatiquement les réponses d'un élève
 * Retourne le résultat détaillé
 */
export function corrigerQuiz(
  quiz: QuizAvance,
  reponses: ReponseEleve[]
): { score: number; scoreMax: number; details: DetailQuestionResult[] } {
  let score = 0;
  let scoreMax = 0;
  const details: DetailQuestionResult[] = [];

  for (const question of quiz.questions) {
    scoreMax += question.points;
    const reponse = reponses.find((r) => r.questionId === question.id);

    if (!reponse) {
      // Question non répondue
      details.push({
        questionId: question.id,
        type: question.type,
        pointsObtenus: 0,
        pointsMax: question.points,
        isCorrect: false,
      });
      continue;
    }

    let pointsObtenus = 0;
    let isCorrect = false;
    let isPartiel = false;
    let correctionManuelleRequise = false;

    switch (question.type) {
      // ---- QCM Choix Unique ----
      case 'qcm_unique': {
        const data = question.typeData as QCMUniqueData;
        const bonneOption = data.options.find((o) => o.isCorrect);
        if (bonneOption && reponse.selectedOptionId === bonneOption.id) {
          pointsObtenus = question.points;
          isCorrect = true;
        }
        break;
      }

      // ---- QCM Choix Multiple ----
      case 'qcm_multiple': {
        const data = question.typeData as QCMMultipleData;
        const bonnesIds = data.options
          .filter((o) => o.isCorrect)
          .map((o) => o.id);
        const mauvaisesIds = data.options
          .filter((o) => !o.isCorrect)
          .map((o) => o.id);
        const selected = reponse.selectedOptionIds || [];

        // Vérifier si aucune mauvaise réponse n'est cochée
        const aMauvaise = selected.some((id) => mauvaisesIds.includes(id));
        const bonnesTrouvees = selected.filter((id) =>
          bonnesIds.includes(id)
        ).length;

        if (!aMauvaise && bonnesTrouvees === bonnesIds.length) {
          // Tout correct
          pointsObtenus = question.points;
          isCorrect = true;
        } else if (data.scoringPartiel && bonnesTrouvees > 0 && !aMauvaise) {
          // Score partiel (proportionnel aux bonnes réponses trouvées)
          pointsObtenus = Math.round(
            (question.points * bonnesTrouvees) / bonnesIds.length * 100
          ) / 100;
          isPartiel = true;
        }
        break;
      }

      // ---- Drag & Drop (réordonner) ----
      case 'drag_drop': {
        const data = question.typeData as DragDropData;
        const ordrePropose = reponse.ordrePropose || [];
        const ordreCorrect = data.items
          .sort((a, b) => a.ordreCorrect - b.ordreCorrect)
          .map((item) => item.id);

        // Compter les positions correctes
        let positionsCorrectes = 0;
        for (let i = 0; i < ordreCorrect.length; i++) {
          if (ordrePropose[i] === ordreCorrect[i]) {
            positionsCorrectes++;
          }
        }

        if (positionsCorrectes === ordreCorrect.length) {
          pointsObtenus = question.points;
          isCorrect = true;
        } else if (positionsCorrectes > 0) {
          // Score partiel proportionnel
          pointsObtenus = Math.round(
            (question.points * positionsCorrectes) / ordreCorrect.length * 100
          ) / 100;
          isPartiel = true;
        }
        break;
      }

      // ---- Mise en Relation ----
      case 'mise_en_relation': {
        const data = question.typeData as MiseEnRelationData;
        const proposees = reponse.relationsProposees || {};

        // Construire la map correcte: paire.id (gauche) → paire.id (droite)
        // Les IDs droite mélangés sont les mêmes paire.id
        let pairesCorrectes = 0;
        for (const paire of data.paires) {
          if (proposees[paire.id] === paire.id) {
            pairesCorrectes++;
          }
        }

        if (pairesCorrectes === data.paires.length) {
          pointsObtenus = question.points;
          isCorrect = true;
        } else if (pairesCorrectes > 0) {
          pointsObtenus = Math.round(
            (question.points * pairesCorrectes) / data.paires.length * 100
          ) / 100;
          isPartiel = true;
        }
        break;
      }

      // ---- Essai ----
      case 'essai': {
        const data = question.typeData as EssaiData;
        const texte = reponse.texteReponse || '';

        if (data.correctionMode === 'mots_cles' && data.motsCles.length > 0) {
          // Correction par mots-clés
          const texteLower = texte.toLowerCase().replace(/<[^>]*>/g, ''); // Strip HTML
          let poidsTotal = 0;
          let poidsTrouve = 0;

          for (const mc of data.motsCles) {
            poidsTotal += mc.poids;
            if (texteLower.includes(mc.mot.toLowerCase())) {
              poidsTrouve += mc.poids;
            }
          }

          if (poidsTotal > 0) {
            pointsObtenus = Math.round(
              (question.points * poidsTrouve) / poidsTotal * 100
            ) / 100;
            isCorrect = poidsTrouve === poidsTotal;
            isPartiel = poidsTrouve > 0 && poidsTrouve < poidsTotal;
          }
        } else {
          // Correction manuelle requise
          correctionManuelleRequise = true;
        }
        break;
      }
    }

    score += pointsObtenus;
    details.push({
      questionId: question.id,
      type: question.type,
      pointsObtenus,
      pointsMax: question.points,
      isCorrect,
      isPartiel,
      correctionManuelleRequise,
    });
  }

  return { score, scoreMax, details };
}

/**
 * Soumettre un quiz et enregistrer le résultat
 */
export async function soumettreQuiz(
  quiz: QuizAvance,
  userId: string,
  reponses: ReponseEleve[],
  tempsEcoule: number
): Promise<QuizAvanceResult> {
  try {
    // Correction automatique
    const { score, scoreMax, details } = corrigerQuiz(quiz, reponses);
    const note20 = scoreMax > 0 ? Math.round((score / scoreMax) * 20 * 100) / 100 : 0;
    const correctionManuelle = details.some((d) => d.correctionManuelleRequise);

    const result: Omit<QuizAvanceResult, 'id'> = {
      quizId: quiz.id,
      userId,
      reponses,
      score,
      scoreMax,
      note20,
      tempsEcoule,
      datePassage: new Date(),
      reussi: note20 >= quiz.noteMinimale,
      correctionManuelle,
      detailsParQuestion: details,
    };

    // Enregistrer dans Firestore
    const docRef = await addDoc(collection(db, RESULTS_COLLECTION), {
      ...result,
      datePassage: serverTimestamp(),
    });

    console.log('✅ Résultat quiz enregistré :', docRef.id);
    return { id: docRef.id, ...result };
  } catch (error) {
    console.error('❌ Erreur soumission quiz :', error);
    throw new Error('Impossible d\'enregistrer le résultat');
  }
}

/**
 * Récupérer les résultats d'un élève pour un quiz
 */
export async function getResultatsEleve(
  userId: string,
  quizId?: string
): Promise<QuizAvanceResult[]> {
  try {
    let q;
    if (quizId) {
      q = query(
        collection(db, RESULTS_COLLECTION),
        where('userId', '==', userId),
        where('quizId', '==', quizId),
        orderBy('datePassage', 'desc')
      );
    } else {
      q = query(
        collection(db, RESULTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('datePassage', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      return {
        id: docSnap.id,
        ...data,
        datePassage: data.datePassage?.toDate() || new Date(),
      } as QuizAvanceResult;
    });
  } catch (error) {
    console.error('❌ Erreur récupération résultats :', error);
    throw new Error('Impossible de récupérer les résultats');
  }
}

/**
 * Correction manuelle d'un essai par le professeur
 */
export async function corrigerEssai(
  resultId: string,
  questionId: string,
  pointsAccordes: number,
  commentaire: string
): Promise<void> {
  try {
    const docRef = doc(db, RESULTS_COLLECTION, resultId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Résultat introuvable');

    const data = docSnap.data() as QuizAvanceResult;
    const details = [...data.detailsParQuestion];
    const idx = details.findIndex((d) => d.questionId === questionId);

    if (idx === -1) throw new Error('Question introuvable dans le résultat');

    // Mettre à jour le détail
    const ancienPoints = details[idx].pointsObtenus;
    details[idx] = {
      ...details[idx],
      pointsObtenus: pointsAccordes,
      isCorrect: pointsAccordes === details[idx].pointsMax,
      isPartiel: pointsAccordes > 0 && pointsAccordes < details[idx].pointsMax,
      correctionManuelleRequise: false,
      commentaireProf: commentaire,
    };

    // Recalculer le score total
    const nouveauScore = data.score - ancienPoints + pointsAccordes;
    const note20 = data.scoreMax > 0
      ? Math.round((nouveauScore / data.scoreMax) * 20 * 100) / 100
      : 0;
    const correctionManuelle = details.some((d) => d.correctionManuelleRequise);

    await updateDoc(docRef, {
      detailsParQuestion: details,
      score: nouveauScore,
      note20,
      correctionManuelle,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Essai corrigé pour le résultat :', resultId);
  } catch (error) {
    console.error('❌ Erreur correction essai :', error);
    throw new Error('Impossible de corriger l\'essai');
  }
}
