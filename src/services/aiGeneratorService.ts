/**
 * ============================================================
 * PEDACLIC — Phase 16 : Service Générateur IA
 * ============================================================
 * Fichier : aiGeneratorService.ts
 * Emplacement : src/services/aiGeneratorService.ts
 * 
 * Gère les appels au backend Railway pour la génération IA
 * et la sauvegarde dans Firestore (generated_content + quizzes)
 * 
 * Import Firebase depuis '../firebase' (convention PedaClic)
 * ============================================================
 */

import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  doc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== INTERFACES ====================

/** Types de contenu générables par l'IA */
export type GenerationType = 
  | 'cours_complet' 
  | 'fiche_revision' 
  | 'exercices_corriges' 
  | 'quiz_auto' 
  | 'sujet_examen' 
  | 'evaluation_personnalisee';

/** Options supplémentaires pour la génération */
export interface GenerationOptions {
  difficulte?: 'facile' | 'moyen' | 'difficile';
  duree?: number;
  nombreQuestions?: number;
  typeExamen?: 'BFEM' | 'BAC';
  objectifs?: string;
  consignesSpeciales?: string;
}

/** Requête de génération envoyée au backend */
export interface GenerationRequest {
  type: GenerationType;
  discipline: string;
  classe: string;
  chapitre: string;
  options?: GenerationOptions;
}

/** Réponse du backend après génération */
export interface GenerationResponse {
  success: boolean;
  type: 'text' | 'quiz';
  data: {
    content?: string;
    questions?: QuizQuestion[];
  };
  meta: {
    discipline: string;
    classe: string;
    chapitre: string;
    contentType?: string;
    generatedAt: string;
    tokensUsed?: number;
    note?: string;
  };
  error?: string;
}

/** Question de quiz générée par l'IA */
export interface QuizQuestion {
  question: string;
  options: string[];
  reponseCorrecte: number;
  explication: string;
  difficulte: 'facile' | 'moyen' | 'difficile';
  points: number;
}

/** Document sauvegardé dans Firestore (generated_content) */
export interface GeneratedContent {
  id?: string;
  userId: string;
  type: GenerationType;
  discipline: string;
  disciplineId: string;
  classe: string;
  chapitre: string;
  content: string;
  options?: GenerationOptions;
  createdAt: Timestamp;
}

// ==================== CONFIGURATION ====================

/** URL du backend Railway */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.pedaclic.sn';

/** Labels français pour chaque type de contenu */
export const GENERATION_TYPE_LABELS: Record<GenerationType, string> = {
  cours_complet: 'Cours complet',
  fiche_revision: 'Fiche de révision',
  exercices_corriges: 'Exercices corrigés',
  quiz_auto: 'Quiz auto-généré',
  sujet_examen: 'Sujet type examen',
  evaluation_personnalisee: 'Évaluation personnalisée',
};

/** Descriptions pour chaque type de contenu */
export const GENERATION_TYPE_DESCRIPTIONS: Record<GenerationType, string> = {
  cours_complet: 'Un cours structuré avec introduction, développement et conclusion adapté au programme sénégalais.',
  fiche_revision: 'Synthèse des points clés pour réviser efficacement avant un examen.',
  exercices_corriges: 'Série d\'exercices progressifs avec corrections détaillées étape par étape.',
  quiz_auto: '10 questions QCM avec 4 options, corrections et explications. Sauvegardé directement comme quiz jouable.',
  sujet_examen: 'Sujet conforme au format officiel BFEM ou BAC avec barème.',
  evaluation_personnalisee: 'Évaluation sur mesure avec barème /20 et corrigé-type.',
};

/** Icônes pour chaque type (emoji) */
export const GENERATION_TYPE_ICONS: Record<GenerationType, string> = {
  cours_complet: '📖',
  fiche_revision: '📝',
  exercices_corriges: '✏️',
  quiz_auto: '🎯',
  sujet_examen: '📋',
  evaluation_personnalisee: '📊',
};

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Appelle le backend pour générer du contenu IA
 * @param request - Paramètres de génération
 * @returns Réponse du backend avec le contenu généré
 */
export async function generateContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    // Gestion des erreurs HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Erreur serveur (${response.status})`
      );
    }

    const data: GenerationResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'La génération a échoué.');
    }

    return data;

  } catch (error) {
    console.error('[aiGeneratorService] Erreur génération:', error);
    
    // Erreur réseau
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
      );
    }
    
    throw error;
  }
}

/**
 * Sauvegarde un contenu généré dans Firestore (collection generated_content)
 * @param userId - ID de l'utilisateur
 * @param request - Requête de génération originale
 * @param content - Contenu Markdown généré
 * @param disciplineId - ID Firestore de la discipline
 * @returns ID du document créé
 */
export async function saveGeneratedContent(
  userId: string,
  request: GenerationRequest,
  content: string,
  disciplineId: string
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'generated_content'), {
      userId,
      type: request.type,
      discipline: request.discipline,
      disciplineId,
      classe: request.classe,
      chapitre: request.chapitre,
      content,
      options: request.options || null,
      createdAt: Timestamp.now(),
    });

    console.log('[aiGeneratorService] Contenu sauvegardé:', docRef.id);
    return docRef.id;

  } catch (error) {
    console.error('[aiGeneratorService] Erreur sauvegarde contenu:', error);
    throw new Error('Erreur lors de la sauvegarde du contenu généré.');
  }
}

/**
 * Sauvegarde un quiz généré dans Firestore (collection quizzes)
 * @param userId - ID de l'utilisateur créateur
 * @param request - Requête de génération originale
 * @param questions - Questions du quiz générées par l'IA
 * @param disciplineId - ID Firestore de la discipline
 * @returns ID du quiz créé
 */
export async function saveGeneratedQuiz(
  userId: string,
  request: GenerationRequest,
  questions: QuizQuestion[],
  disciplineId: string
): Promise<string> {
  try {
    // Formatage des questions pour la collection quizzes PedaClic
    const formattedQuestions = questions.map((q, index) => ({
      id: `q_${Date.now()}_${index}`,
      question: q.question,
      options: q.options,
      reponseCorrecte: q.reponseCorrecte,
      explication: q.explication || '',
      difficulte: q.difficulte || 'moyen',
      points: q.points || 2,
    }));

    const quizDoc = {
      disciplineId,
      titre: `Quiz IA — ${request.chapitre}`,
      description: `Quiz auto-généré pour ${request.discipline} (${request.classe}) — Chapitre : ${request.chapitre}`,
      questions: formattedQuestions,
      duree: 15, // 15 minutes par défaut
      isPremium: true, // Quiz IA = Premium
      noteMinimale: 10, // 10/20 pour réussir
      auteurId: userId,
      source: 'ia_generator',
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'quizzes'), quizDoc);

    console.log('[aiGeneratorService] Quiz sauvegardé:', docRef.id);
    return docRef.id;

  } catch (error) {
    console.error('[aiGeneratorService] Erreur sauvegarde quiz:', error);
    throw new Error('Erreur lors de la sauvegarde du quiz généré.');
  }
}

/**
 * Récupère l'historique des contenus générés par un utilisateur
 * @param userId - ID de l'utilisateur
 * @param limit - Nombre max de résultats (défaut: 20)
 * @returns Liste des contenus générés
 */
export async function getGeneratedHistory(
  userId: string,
  limitCount: number = 20
): Promise<GeneratedContent[]> {
  try {
    const q = query(
      collection(db, 'generated_content'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    
    const results: GeneratedContent[] = [];
    snapshot.forEach((docSnap) => {
      if (results.length < limitCount) {
        results.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as GeneratedContent);
      }
    });

    return results;

  } catch (error) {
    console.error('[aiGeneratorService] Erreur chargement historique:', error);
    throw new Error('Erreur lors du chargement de l\'historique.');
  }
}

/**
 * Supprime un contenu généré de Firestore
 * @param contentId - ID du document à supprimer
 */
export async function deleteGeneratedContent(contentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'generated_content', contentId));
    console.log('[aiGeneratorService] Contenu supprimé:', contentId);
  } catch (error) {
    console.error('[aiGeneratorService] Erreur suppression:', error);
    throw new Error('Erreur lors de la suppression du contenu.');
  }
}

/**
 * Récupère un contenu généré par son ID
 * @param contentId - ID du document
 * @returns Le contenu ou null
 */
export async function getGeneratedContentById(
  contentId: string
): Promise<GeneratedContent | null> {
  try {
    const docSnap = await getDoc(doc(db, 'generated_content', contentId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as GeneratedContent;
  } catch (error) {
    console.error('[aiGeneratorService] Erreur lecture:', error);
    return null;
  }
}
