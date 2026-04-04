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
  | 'evaluation_personnalisee'
  /**
   * Nouveaux types — Phase 17 : génération à partir d'un document source.
   * Ces deux types exigent un texte source (collé ou importé depuis PDF/DOCX/TXT).
   */
  | 'correction_sujet'      // Correction détaillée d'un sujet ou exercice fourni
  | 'sujet_avec_corrige';   // Sujet d'évaluation complet + corrigé intégré

/** Options supplémentaires pour la génération */
export interface GenerationOptions {
  difficulte?: 'facile' | 'moyen' | 'difficile';
  duree?: number;
  nombreQuestions?: number;
  typeExamen?: 'BFEM' | 'BAC';
  objectifs?: string;
  consignesSpeciales?: string;
  /**
   * Texte collé ou extrait d'un fichier — fusionné dans les consignes envoyées au serveur
   * (tronqué pour respecter les limites du modèle).
   */
  sourceText?: string;
  /** Inclure des exercices / problèmes dans le contenu généré (sauf type dédié aux exercices). */
  includeExercices?: boolean;
  /** Ajouter une section quiz (QCM) en fin de document (ignoré si type = quiz_auto). */
  includeQuiz?: boolean;
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
 * 240 s : marge large pour les gros documents (sujets d'examen, cours longs) ;
 * le proxy (Railway / CDN) peut tout de même répondre 504 avant la fin — d'où les retries.
 */
const AI_TIMEOUT_MS = 240_000;

/**
 * Nombre maximum de tentatives en cas d'échec réseau.
 * La 2ème tentative profite du serveur déjà "chaud".
 */
const MAX_RETRIES = 2;

/**
 * Taille max du texte source injecté dans le prompt (caractères).
 * 25 000 ≈ 10-15 pages de texte — suffisant pour la plupart des sujets d'examen
 * (BAC, BFEM) et des cours longs. Au-delà le texte est tronqué intelligemment.
 */
const MAX_SOURCE_IN_PROMPT = 25_000;

/**
 * Plafond total des consignes fusionnées (source + instructions + options).
 * 40 000 caractères laisse de la place pour un gros document source + consignes détaillées.
 */
const MAX_CONSIGNES_TOTAL_CHARS = 40_000;

/**
 * Fusionne le texte source et les options de structure dans `consignesSpeciales`
 * pour compatibilité avec l'API existante, et retire `sourceText` du corps envoyé.
 */
function finalizeGenerationRequest(req: GenerationRequest): GenerationRequest {
  // ── Mapping des types frontend non supportés par le backend Railway ────────
  // 'correction_sujet' et 'sujet_avec_corrige' sont des types frontend uniquement.
  // On les convertit vers les types backend acceptés et on enrichit les consignes.
  if (req.type === 'correction_sujet' || req.type === 'sujet_avec_corrige') {
    const existingConsignes = req.options?.consignesSpeciales?.trim() || '';
    const [backendType, instruction] =
      req.type === 'correction_sujet'
        ? [
            'exercices_corriges' as const,
            'TÂCHE PRINCIPALE : Produire une CORRECTION DÉTAILLÉE du sujet ou exercice fourni.\n' +
              'Reprendre chaque question/exercice, donner la démarche complète et la réponse attendue avec justification.',
          ]
        : [
            'sujet_examen' as const,
            "TÂCHE PRINCIPALE : Générer un SUJET D'ÉVALUATION COMPLET suivi de son CORRIGÉ INTÉGRAL.\n" +
              'Structure obligatoire : Partie 1) Énoncé complet du sujet avec toutes les questions numérotées. ' +
              'Partie 2) Corrigé détaillé question par question avec barème indicatif.',
          ];

    req = {
      ...req,
      type: backendType,
      options: {
        ...req.options,
        consignesSpeciales: [instruction, existingConsignes]
          .filter(Boolean)
          .join('\n\n'),
      },
    };
  }

  const o = req.options;
  if (!o) return req;

  const parts: string[] = [];
  if (o.consignesSpeciales?.trim()) {
    parts.push(o.consignesSpeciales.trim());
  }

  const st = o.sourceText?.trim();
  if (st) {
    let cap: string;
    let truncated = false;

    if (st.length <= MAX_SOURCE_IN_PROMPT) {
      cap = st;
    } else {
      truncated = true;
      // Troncature intelligente : garder début (consignes) + fin (barème / corrigé)
      const keepEnd = Math.min(3_000, Math.floor(MAX_SOURCE_IN_PROMPT * 0.15));
      const keepStart = MAX_SOURCE_IN_PROMPT - keepEnd - 120; // 120 chars pour le marqueur
      cap =
        st.slice(0, keepStart) +
        `\n\n[… ${st.length - keepStart - keepEnd} caractères omis au milieu …]\n\n` +
        st.slice(st.length - keepEnd);
    }

    parts.push(
      `[CONTENU SOURCE FOURNI PAR L'ENSEIGNANT — À RÉORGANISER, ENRICHIR ET ADAPTER AU PROGRAMME SÉNÉGALAIS]\n${cap}` +
        (truncated
          ? `\n\n[Texte source : ${st.length} caractères au total, tronqué intelligemment — début et fin conservés.]`
          : '')
    );
  }

  if (o.includeExercices === false) {
    parts.push(
      "Ne pas inclure d'exercices, de problèmes à résoudre ni de corrigés détaillés dans le document généré."
    );
  }

  if (o.includeQuiz === true && req.type !== 'quiz_auto') {
    parts.push(
      'Inclure une section finale de quiz (QCM) avec questions, propositions de réponses et corrigé court.'
    );
  }

  const { sourceText: _drop, consignesSpeciales: _old, ...restOpts } = o;
  let merged = parts.filter(Boolean).join('\n\n');
  if (merged.length > MAX_CONSIGNES_TOTAL_CHARS) {
    merged =
      merged.slice(0, MAX_CONSIGNES_TOTAL_CHARS) +
      "\n\n[… Contenu tronqué automatiquement pour limiter la charge sur le serveur. Réduisez les objectifs ou le texte source.]";
  }

  return {
    ...req,
    options: {
      ...restOpts,
      consignesSpeciales: merged || undefined,
    },
  };
}

/** Labels français pour chaque type de contenu */
export const GENERATION_TYPE_LABELS: Record<GenerationType, string> = {
  cours_complet: 'Cours complet',
  fiche_revision: 'Fiche de révision',
  exercices_corriges: 'Exercices corrigés',
  quiz_auto: 'Quiz auto-généré',
  sujet_examen: 'Sujet type examen',
  evaluation_personnalisee: 'Évaluation personnalisée',
  // --- Types nécessitant un document source ---
  correction_sujet: 'Correction de sujets / exercices',
  sujet_avec_corrige: 'Sujet avec corrigé',
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
  // --- Types nécessitant un document source ---
  correction_sujet:
    "Génère une correction détaillée et méthodique d'un sujet ou d'exercices fournis (PDF, Word ou texte collé).",
  sujet_avec_corrige:
    "Crée un sujet d'évaluation complet accompagné de son corrigé intégré, à partir des indications ou du document fourni.",
};

/** Icônes pour chaque type (emoji) */
export const GENERATION_TYPE_ICONS: Record<GenerationType, string> = {
  cours_complet: '📖',
  fiche_revision: '📝',
  exercices_corriges: '✏️',
  quiz_auto: '🎯',
  sujet_examen: '📋',
  evaluation_personnalisee: '📊',
  // --- Types nécessitant un document source ---
  correction_sujet: '🔍',
  sujet_avec_corrige: '📄',
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
    const response = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
    if (response.ok) {
      console.log('[aiGeneratorService] Ping Railway OK');
    }
  } catch {
    // Silencieux — ne pas bloquer l'app si le ping échoue
  }
}

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Appelle le backend Railway pour générer du contenu IA.
 * — Timeout 180 s ; retry réseau via `avecRetry` ; 2ᵉ essai sur 502/503/504 (gateway)
 */
export async function generateContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  const payload = finalizeGenerationRequest(request);
  const body = JSON.stringify(payload);

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  const url = `${API_BASE_URL}/api/generate`;
  const MAX_TENTATIVES_GATEWAY = 3;

  for (let t = 0; t < MAX_TENTATIVES_GATEWAY; t++) {
    try {
      const response = await avecRetry(() => fetchAvecTimeout(url, fetchOptions));

      const status = response.status;

      if (status === 504 || status === 502 || status === 503) {
        if (t < MAX_TENTATIVES_GATEWAY - 1) {
          const delai = 8_000 + t * 4_000; // 8s, 12s — backoff progressif
          console.warn(
            `[aiGeneratorService] HTTP ${status} sur /api/generate — tentative ${t + 2}/${MAX_TENTATIVES_GATEWAY} dans ${delai / 1000}s…`
          );
          await new Promise((r) => setTimeout(r, delai));
          continue;
        }
        throw new Error(
          'Le serveur a mis trop de temps à répondre (délai dépassé côté hébergement). ' +
            'Réessayez dans une minute. Si le texte source est très long, essayez de le raccourcir ' +
            'ou de ne garder que les parties essentielles du document.'
        );
      }

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
    } catch (err) {
      console.error('[aiGeneratorService] Erreur génération:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error(
          'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
        );
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error('La génération a échoué.');
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
      options: request.options
        ? JSON.parse(JSON.stringify(request.options))
        : null,
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