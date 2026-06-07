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
// Enrichisseur de prompt — injecte automatiquement des garde-fous
// qualité par discipline et par type de génération dans le champ
// consignesSpeciales envoyé au backend Railway. Voir aiPromptEnhancer.ts
// pour la stratégie en 3 couches (globale / discipline / type).
import { buildEnhancedConsignes } from './aiPromptEnhancer';

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
  /**
   * Phase 35 — Afficher le texte support (corpus) à l'élève pendant le quiz IA.
   * Utile quand les questions portent sur un texte source (compréhension écrite,
   * analyse littéraire, documents historiques, etc.). Par défaut à false pour
   * ne pas changer le comportement des quiz existants.
   */
  afficherCorpus?: boolean;
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
  /**
   * Pour les entrées historiques correspondant à un quiz IA :
   * ID du document associé dans la collection `quizzes`
   * (permet de relier l'entrée d'historique au quiz jouable / éditable).
   * Optionnel — absent pour les contenus textuels.
   */
  quizId?: string;
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
 *
 * @param req       - Requête de génération
 * @param liteLevel - Niveau d'allègement anti-504 (0 = qualité pleine par défaut).
 *                    Augmenté par generateContent() lors des retries après un
 *                    504/502/503 pour réduire le volume généré et tenir dans le
 *                    délai du proxy d'hébergement.
 */
function finalizeGenerationRequest(
  req: GenerationRequest,
  liteLevel: 0 | 1 | 2 = 0
): GenerationRequest {
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

  const o = req.options || {};

  // ──────────────────────────────────────────────────────────
  // ENRICHISSEMENT AUTOMATIQUE QUALITÉ (Phase qualité IA)
  // ──────────────────────────────────────────────────────────
  // On reconstruit `consignesSpeciales` en injectant :
  //   1. Les consignes du prof (priorité maximale)
  //   2. Une couche TYPE (structure attendue selon exercice/fiche/etc.)
  //   3. Une couche DISCIPLINE (rigueur scientifique, LaTeX pour maths…)
  //   4. Une couche GLOBALE (programme sénégalais, anti-invention)
  //
  // Le backend Railway fusionne ce bloc dans le prompt système du LLM,
  // ce qui agit comme un garde-fou anti-hallucination sans modification
  // backend nécessaire.
  // ──────────────────────────────────────────────────────────
  const consignesEnrichies = buildEnhancedConsignes({
    type: req.type,
    discipline: req.discipline,
    classe: req.classe,
    existing: o.consignesSpeciales,
    liteLevel,
  });

  const parts: string[] = [];
  if (consignesEnrichies.trim()) {
    parts.push(consignesEnrichies.trim());
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
 * — Timeout 240 s ; boucle unique de retry (3 tentatives) avec ping de réveil.
 * — Pas de retry imbriqué pour éviter de surcharger un serveur déjà lent.
 */
export async function generateContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  const url = `${API_BASE_URL}/api/generate`;
  const MAX_TENTATIVES = 3;

  // ── Dégradation gracieuse anti-504 ─────────────────────────────────────────
  // Le corps est (re)construit à CHAQUE tentative avec un niveau d'allègement
  // croissant : tentative 1 = qualité pleine (liteLevel 0), tentatives suivantes
  // = scope réduit (liteLevel 1 puis 2) pour les types lourds (exercices_corrigés,
  // sujets…). Objectif : si le serveur a dépassé le délai en pleine qualité, la
  // tentative suivante génère moins de tokens et passe sous le timeout du proxy.
  // Le happy path (réponse rapide à la 1ʳᵉ tentative) reste strictement inchangé.
  const buildBodyForAttempt = (attempt: number): string => {
    const liteLevel = Math.min(attempt, 2) as 0 | 1 | 2;
    return JSON.stringify(finalizeGenerationRequest(request, liteLevel));
  };

  // Ping de réveil — s'assurer que Railway est chaud avant la requête lourde
  try {
    await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
  } catch {
    // Silencieux — le ping est un bonus, pas un pré-requis
  }

  let lastError: Error = new Error('La génération a échoué.');

  for (let t = 0; t < MAX_TENTATIVES; t++) {
    try {
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBodyForAttempt(t),
      };
      if (t > 0) {
        console.warn(
          `[aiGeneratorService] Tentative ${t + 1}/${MAX_TENTATIVES} en mode rapide (allègement niveau ${Math.min(t, 2)}) pour tenir dans le délai serveur.`
        );
      }
      const response = await fetchAvecTimeout(url, fetchOptions);
      const status = response.status;

      // ── Gateway timeout : le serveur est trop lent ──
      if (status === 504 || status === 502 || status === 503) {
        if (t < MAX_TENTATIVES - 1) {
          const delai = 10_000 + t * 5_000; // 10s, 15s — backoff progressif
          console.warn(
            `[aiGeneratorService] HTTP ${status} sur /api/generate — tentative ${t + 2}/${MAX_TENTATIVES} dans ${delai / 1000}s…`
          );
          // Re-ping pour garder Railway éveillé entre les tentatives
          try { await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' }); } catch {}
          await new Promise((r) => setTimeout(r, delai));
          continue;
        }
        throw new Error(
          'Le serveur a mis trop de temps à répondre (délai dépassé côté hébergement). ' +
            'Réessayez dans une minute. Si le texte source est très long, essayez de le raccourcir ' +
            'ou de ne garder que les parties essentielles du document.'
        );
      }

      // ── Autre erreur HTTP ──
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          (errorData as { error?: string }).error ||
          `Erreur serveur (${response.status})`;
        throw new Error(message);
      }

      // ── Succès ──
      const data: GenerationResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'La génération a échoué.');
      }

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[aiGeneratorService] Erreur génération (tentative ${t + 1}/${MAX_TENTATIVES}):`, lastError.message);

      // Erreur réseau (pas de connexion) — laisser la boucle réessayer
      if (err instanceof TypeError && err.message.includes('fetch')) {
        if (t < MAX_TENTATIVES - 1) {
          const delai = 5_000 + t * 3_000; // 5s, 8s
          console.warn(`[aiGeneratorService] Erreur réseau — nouvelle tentative dans ${delai / 1000}s…`);
          await new Promise((r) => setTimeout(r, delai));
          continue;
        }
        lastError = new Error(
          'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
        );
      }

      // Erreur non-retriable (400, 401, erreur de parsing…) — sortie immédiate
      throw lastError;
    }
  }

  throw lastError;
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

    // ────────────────────────────────────────────────────────────
    // Résolution de la durée du quiz
    //   - On privilégie la durée choisie dans le wizard (options.duree,
    //     valeurs 30/45/60/90/120 min — c'est la durée de la séance).
    //   - Fallback à 15 min si absente, pour préserver le comportement
    //     historique sur d'anciens clients qui n'enverraient pas ce champ.
    // ────────────────────────────────────────────────────────────
    const dureeChoisie = request.options?.duree;
    const duree =
      typeof dureeChoisie === 'number' && dureeChoisie > 0 ? dureeChoisie : 15;

    // ────────────────────────────────────────────────────────────
    // Convention Firestore `quizzes` (alignée sur ProfQuizClassicCreatePage) :
    //   - `profId`   : propriétaire → requis par getQuizzesByProf()
    //   - `isPremium`: false pour un quiz créé par un prof pour sa classe
    //                  (sinon filtré par `freeOnly` pour les élèves non-premium)
    //   - `status`   : 'published' → visible immédiatement côté élève
    //   - `auteurId` : conservé pour rétro-compatibilité (historique IA)
    // ────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────
    // Phase 35 — Corpus (texte support) à afficher pendant le quiz.
    //   Le prof décide au moment de la génération s'il veut que l'élève
    //   voie le texte source pendant qu'il répond. On persiste les deux
    //   champs uniquement si le toggle est activé ET qu'un texte existe.
    // ────────────────────────────────────────────────────────────
    const afficherCorpus = request.options?.afficherCorpus === true;
    const corpusText = request.options?.sourceText?.trim() ?? '';
    const corpusFields =
      afficherCorpus && corpusText.length > 0
        ? { afficherCorpus: true, corpusText }
        : {};

    const quizDoc = {
      disciplineId,
      titre: `Quiz IA — ${request.chapitre}`,
      description: `Quiz auto-généré pour ${request.discipline} (${request.classe}) — Chapitre : ${request.chapitre}`,
      questions: formattedQuestions,
      duree,
      isPremium: false,
      noteMinimale: 10,
      profId: userId,
      auteurId: userId,
      status: 'published' as const,
      source: 'ia_generator',
      ...corpusFields,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'quizzes'), quizDoc);

    console.log('[aiGeneratorService] Quiz sauvegardé:', docRef.id);

    // ────────────────────────────────────────────────────────────
    // Miroir dans `generated_content` pour qu'un quiz IA apparaisse
    // dans l'onglet « Historique » (qui ne lit que cette collection).
    // Cette écriture secondaire est non-bloquante : si elle échoue,
    // le quiz reste sauvegardé dans `quizzes` et jouable normalement
    // — on n'annule rien et on ne lève pas d'exception côté appelant.
    // ────────────────────────────────────────────────────────────
    try {
      await addDoc(collection(db, 'generated_content'), {
        userId,
        type: request.type, // 'quiz_auto'
        discipline: request.discipline,
        disciplineId,
        classe: request.classe,
        chapitre: request.chapitre,
        // Rendu Markdown des questions pour aperçu dans le modal « Lire »
        content: formatQuizQuestionsAsMarkdown(questions),
        options: request.options
          ? JSON.parse(JSON.stringify(request.options))
          : null,
        quizId: docRef.id, // lien vers le quiz jouable
        createdAt: Timestamp.now(),
      });
    } catch (histError) {
      // Volontairement silencieux : l'historique est un bonus d'UX,
      // pas une garantie contractuelle de la sauvegarde du quiz.
      console.warn(
        '[aiGeneratorService] Entrée historique quiz non créée (non bloquant):',
        histError
      );
    }

    return docRef.id;
  } catch (error) {
    console.error('[aiGeneratorService] Erreur sauvegarde quiz:', error);
    throw new Error('Erreur lors de la sauvegarde du quiz généré.');
  }
}

/**
 * Convertit une liste de questions QCM en aperçu Markdown lisible.
 * Utilisé pour peupler `content` dans l'entrée `generated_content`
 * d'un quiz IA — permet à l'utilisateur de relire les questions
 * depuis le modal « Lire » de l'historique.
 */
function formatQuizQuestionsAsMarkdown(questions: QuizQuestion[]): string {
  if (!questions || questions.length === 0) return '';
  const lignes: string[] = [
    `# Quiz auto-généré`,
    '',
    `**${questions.length} question${questions.length > 1 ? 's' : ''}**`,
    '',
  ];
  questions.forEach((q, i) => {
    lignes.push(`## Question ${i + 1}`);
    lignes.push('');
    lignes.push(q.question);
    lignes.push('');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    q.options.forEach((opt, idx) => {
      const marque = idx === q.reponseCorrecte ? '**' : '';
      lignes.push(`- ${marque}${letters[idx] ?? idx + 1}. ${opt}${marque}`);
    });
    if (q.explication) {
      lignes.push('');
      lignes.push(`> **Explication :** ${q.explication}`);
    }
    lignes.push('');
  });
  return lignes.join('\n');
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