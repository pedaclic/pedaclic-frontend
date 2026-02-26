/**
 * ============================================================
 * PEDACLIC — Phase 16 : Service Générateur IA (v2 — fix timeout)
 * ============================================================
 * Fichier : aiGeneratorService.ts
 * Emplacement : src/services/aiGeneratorService.ts
 *
 * Corrections v2 :
 *  - Timeout 120s via AbortController (était absent → 504 Railway)
 *  - Retry automatique (1 tentative supplémentaire si échec réseau)
 *  - Keep-alive ping exporté pour garder Railway éveillé
 *  - Réduction de maxTokens par type pour accélérer la génération
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
  getDoc,
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
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.pedaclic.sn';

/**
 * Timeout global pour chaque appel IA (en millisecondes).
 * 120 000 ms = 2 minutes — suffisant pour Claude avec 2000 tokens.
 * Augmenter à 180_000 si Railway est sur un plan lent.
 */
const AI_TIMEOUT_MS = 120_000;

/**
 * Nombre maximum de tentatives en cas d'échec réseau.
 * La 2ème tentative profite du serveur déjà "chaud".
 */
const MAX_RETRIES = 1;

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
  cours_complet:
    'Un cours structuré avec introduction, développement et conclusion adapté au programme sénégalais.',
  fiche_revision:
    'Synthèse des points clés pour réviser efficacement avant un examen.',
  exercices_corriges:
    "Série d'exercices progressifs avec corrections détaillées étape par étape.",
  quiz_auto:
    '10 questions QCM avec 4 options, corrections et explications. Sauvegardé directement comme quiz jouable.',
  sujet_examen:
    'Sujet conforme au format officiel BFEM ou BAC avec barème.',
  evaluation_personnalisee:
    'Évaluation sur mesure avec barème /20 et corrigé-type.',
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

// ==================== UTILITAIRES INTERNES ====================

/**
 * Effectue un fetch avec timeout via AbortController.
 * Lève une erreur explicite si le délai est dépassé.
 *
 * @param url     - URL cible
 * @param options - Options fetch standard
 * @param timeout - Délai max en ms (défaut : AI_TIMEOUT_MS)
 */
async function fetchAvecTimeout(
  url: string,
  options: RequestInit,
  timeout: number = AI_TIMEOUT_MS
): Promise<Response> {
  // Contrôleur d'annulation — interrompra la requête si timeout atteint
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    // AbortError = timeout dépassé
    if ((err as Error).name === 'AbortError') {
      throw new Error(
        `La génération a pris trop de temps (>${timeout / 1000}s). ` +
          'Le serveur est peut-être surchargé. Veuillez réessayer dans quelques instants.'
      );
    }
    throw err;
  }
}

/**
 * Exécute un appel avec retry automatique.
 * Attend 3 secondes entre chaque tentative (laisser Railway se réveiller).
 *
 * @param fn       - Fonction async à exécuter
 * @param retries  - Nombre de ré-essais après le premier échec
 */
async function avecRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;

    console.warn(
      `[aiGeneratorService] Échec, nouvelle tentative dans 3s... (${retries} restante(s))`
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return avecRetry(fn, retries - 1);
  }
}

// ==================== KEEP-ALIVE ====================

/**
 * Ping le serveur Railway pour éviter qu'il entre en veille.
 * À appeler dans App.tsx via setInterval toutes les 10 minutes.
 *
 * Exemple d'usage dans App.tsx :
 * ─────────────────────────────────────────────────────────
 * import { pingServeurIA } from './services/aiGeneratorService';
 *
 * useEffect(() => {
 *   pingServeurIA(); // Ping immédiat au chargement de l'app
 *   const interval = setInterval(pingServeurIA, 10 * 60 * 1000);
 *   return () => clearInterval(interval);
 * }, []);
 * ─────────────────────────────────────────────────────────
 */
export async function pingServeurIA(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    console.log('[aiGeneratorService] Ping Railway OK');
  } catch {
    // Silencieux — ne pas bloquer l'app si le ping échoue
  }
}

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Appelle le backend Railway pour générer du contenu IA.
 * — Timeout 120 secondes via AbortController
 * — Retry automatique 1 fois en cas d'échec réseau
 *
 * @param request - Paramètres de génération
 * @returns Réponse du backend avec le contenu généré
 */
export async function generateContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  // Corps de la requête
  const body = JSON.stringify(request);

  // Options fetch communes
  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  // Appel avec timeout + retry
  const response = await avecRetry(() =>
    fetchAvecTimeout(`${API_BASE_URL}/api/generate`, fetchOptions)
  ).catch((err: Error) => {
    console.error('[aiGeneratorService] Erreur génération:', err);

    // Erreur réseau (pas de connexion du tout)
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
      );
    }

    throw err;
  });

  // Gestion des erreurs HTTP (4xx, 5xx)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as { error?: string }).error ||
      `Erreur serveur (${response.status})`;
    throw new Error(message);
  }

  const data: GenerationResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'La génération a échoué.');
  }

  return data;
}

/**
 * Sauvegarde un contenu généré dans Firestore (collection generated_content)
 *
 * @param userId       - ID de l'utilisateur
 * @param request      - Requête de génération originale
 * @param content      - Contenu Markdown généré
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
 *
 * @param userId       - ID de l'utilisateur créateur
 * @param request      - Requête de génération originale
 * @param questions    - Questions du quiz générées par l'IA
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
      duree: 15,        // 15 minutes par défaut
      isPremium: true,  // Quiz IA = Premium
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
 *
 * @param userId     - ID de l'utilisateur
 * @param limitCount - Nombre max de résultats (défaut: 20)
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
    throw new Error("Erreur lors du chargement de l'historique.");
  }
}

/**
 * Supprime un contenu généré de Firestore
 *
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
 *
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