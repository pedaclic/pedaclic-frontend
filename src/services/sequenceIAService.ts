// ============================================================
// PedaClic — Phase 23 : Service IA — Génération de Séquences
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Communique avec le backend Railway (Express.js + Claude API)
// pour générer des séquences pédagogiques structurées.
// ============================================================

import type {
  SequenceIAResponse,
  TypeActivite,
  TypeEvaluation,
  NiveauScolaire,
} from '../types/sequencePedagogique.types';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// Même URL que aiGeneratorService — backend Railway / api.pedaclic.sn
// ─────────────────────────────────────────────────────────────

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.pedaclic.sn';

/** Timeout global en ms (180 s — identique à aiGeneratorService) */
const AI_TIMEOUT_MS = 180_000;

/** Nombre de ré-essais en cas d'échec réseau */
const MAX_RETRIES = 1;

// ─────────────────────────────────────────────────────────────
// TYPES DU CONTEXTE DE GÉNÉRATION
// ─────────────────────────────────────────────────────────────

export interface ContexteGenerationSequence {
  /** Matière (ex: "Mathématiques") */
  matiere: string;

  /** Niveau scolaire (ex: "3eme", "terminale") */
  niveau: NiveauScolaire | string;

  /** Thème ou chapitre du programme (ex: "Les fonctions affines") */
  theme: string;

  /** Nombre de séances souhaité */
  nombreSeances: number;

  /** Durée standard d'une séance en minutes */
  dureeSeanceMinutes: number;

  /**
   * Instructions supplémentaires optionnelles du professeur.
   * Ex: "Insister sur la résolution graphique",
   *     "Inclure une séance de TP avec GeoGebra"
   */
  instructionsSupplementaires?: string;

  /** Trimestre (pour contextualiser dans le calendrier sénégalais) */
  trimestre?: 1 | 2 | 3;
}

// ─────────────────────────────────────────────────────────────
// VALIDATEUR — Vérifie et nettoie la réponse de l'IA
// Protège contre les hallucinations ou le JSON malformé
// ─────────────────────────────────────────────────────────────

const TYPES_ACTIVITE_VALIDES: TypeActivite[] = [
  'cours', 'td', 'tp', 'evaluation', 'revision', 'projet', 'correction',
];

const TYPES_EVALUATION_VALIDES: TypeEvaluation[] = [
  'formative', 'sommative', 'diagnostique', 'devoir', 'composition', 'interrogation',
];

function validerTypeActivite(val: string): TypeActivite {
  return TYPES_ACTIVITE_VALIDES.includes(val as TypeActivite)
    ? (val as TypeActivite)
    : 'cours';
}

function validerTypeEvaluation(val: string | undefined): TypeEvaluation | undefined {
  if (!val) return undefined;
  return TYPES_EVALUATION_VALIDES.includes(val as TypeEvaluation)
    ? (val as TypeEvaluation)
    : 'formative';
}

/**
 * Valide et normalise la réponse brute de l'IA.
 * Retourne un SequenceIAResponse propre et typé.
 * Lance une erreur si la structure est trop éloignée du format attendu.
 */
function validerReponseIA(raw: Record<string, unknown>): SequenceIAResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Réponse IA invalide : non-objet');
  }

  if (!Array.isArray(raw.seances) || raw.seances.length === 0) {
    throw new Error('Réponse IA invalide : tableau seances absent ou vide');
  }

  const seancesValidees = (raw.seances as Record<string, unknown>[]).map((s, i) => ({
    numero:              Number(s.numero)              || (i + 1),
    titre:               String(s.titre               ?? `Séance ${i + 1}`),
    dureeMinutes:        Number(s.dureeMinutes)        || 55,
    objectifSpecifique:  String(s.objectifSpecifique   ?? ''),
    contenu:             String(s.contenu              ?? ''),
    ressources:          Array.isArray(s.ressources) ? s.ressources.map(String) : [],
    typeActivite:        validerTypeActivite(String(s.typeActivite ?? 'cours')),
    estEvaluation:       Boolean(s.estEvaluation),
    typeEvaluation:      validerTypeEvaluation(s.typeEvaluation as string | undefined),
    noteMax:             typeof s.noteMax === 'number'  ? s.noteMax  : undefined,
    coefficient:         typeof s.coefficient === 'number' ? s.coefficient : undefined,
  }));

  return {
    titre:           String(raw.titre           ?? ''),
    description:     String(raw.description     ?? ''),
    objectifGeneral: String(raw.objectifGeneral ?? ''),
    prerequis:       String(raw.prerequis       ?? ''),
    competences:     Array.isArray(raw.competences) ? raw.competences.map(String) : [],
    seances:         seancesValidees,
  };
}

// ─────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT SYSTÈME
// Spécifique au programme sénégalais
// ─────────────────────────────────────────────────────────────

function construirePromptSysteme(): string {
  return `Tu es un expert en ingénierie pédagogique pour le système éducatif sénégalais 
(programme du Ministère de l'Éducation Nationale du Sénégal).

Tu génères des séquences pédagogiques structurées pour des professeurs du secondaire 
(collèges et lycées sénégalais, niveaux 6ème à Terminale).

RÉPONDRE UNIQUEMENT EN JSON valide. Aucun texte avant ou après le JSON.
Aucune balise markdown, aucun \`\`\`json.

Structure JSON attendue :
{
  "titre": "string",
  "description": "string (2-3 phrases contextuelles)",
  "objectifGeneral": "string (formulation en termes de compétences, verbes d'action)",
  "prerequis": "string (connaissances nécessaires avant cette séquence)",
  "competences": ["string", "string", ...],
  "seances": [
    {
      "numero": 1,
      "titre": "string",
      "dureeMinutes": 55,
      "objectifSpecifique": "string (verbe d'action + contenu)",
      "contenu": "string (déroulement détaillé de la séance)",
      "ressources": ["string", ...],
      "typeActivite": "cours|td|tp|evaluation|revision|projet|correction",
      "estEvaluation": false,
      "typeEvaluation": null,
      "noteMax": null,
      "coefficient": null
    }
  ]
}

Règles :
- Respecte les programmes officiels sénégalais
- Les trimestres au Sénégal : 1er (Oct-Déc), 2ème (Jan-Mars), 3ème (Avr-Juin)
- Inclure des séances de révision avant les évaluations
- Pour les évaluations (estEvaluation=true), préciser typeEvaluation
- Les contenus doivent être adaptés aux réalités sénégalaises (exemples locaux)
- Note maximale habituelle : 20 (système français)
- Niveaux à fort enjeu : 3ème (BFEM), Terminale (BAC)
- Langue : français`;
}

// ─────────────────────────────────────────────────────────────
// APPEL BACKEND — Timeout + Retry + Parsing robuste
// Aligné sur aiGeneratorService pour fiabilité identique
// Le backend attend : { type, discipline, classe, chapitre, options }
// ─────────────────────────────────────────────────────────────

interface AppelBackendOptions {
  discipline: string;
  classe:     string;
  chapitre:   string;
  consignes:  string;
}

/**
 * Appelle le backend IA avec timeout (AbortController) et retry automatique.
 * Envoie le format attendu par le backend : { type, discipline, classe, chapitre, options }.
 * Les consignes spéciales contiennent les instructions de formatage JSON pour la séquence.
 */
async function appelBackendIA(options: AppelBackendOptions): Promise<string> {
  const url = `${API_BASE_URL}/api/generate`;

  const body = JSON.stringify({
    type:       'cours_complet',
    discipline: options.discipline,
    classe:     options.classe,
    chapitre:   options.chapitre,
    options: {
      consignesSpeciales: options.consignes,
    },
  });

  const fetchOptions: RequestInit = {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  // Fonction interne : un seul appel avec AbortController
  async function faireAppel(): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new Error(
          `La génération a pris trop de temps (>${AI_TIMEOUT_MS / 1000}s). ` +
          'Le serveur est peut-être surchargé. Réessayez dans quelques instants.'
        );
      }
      throw err;
    }
  }

  // Retry wrapper
  let lastError: Error | null = null;
  for (let tentative = 0; tentative <= MAX_RETRIES; tentative++) {
    try {
      if (tentative > 0) {
        console.warn(`[sequenceIAService] Nouvelle tentative (${tentative}/${MAX_RETRIES})…`);
        await new Promise(r => setTimeout(r, 3000));
      }

      const response = await faireAppel();

      // Gestion des erreurs gateway (502/503/504)
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (tentative < MAX_RETRIES) {
          console.warn(`[sequenceIAService] HTTP ${response.status} — retry dans 6s…`);
          await new Promise(r => setTimeout(r, 6000));
          continue;
        }
        throw new Error(
          'Le serveur a mis trop de temps à répondre (délai dépassé côté hébergement). ' +
          'Réessayez dans une minute ou simplifiez la requête.'
        );
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => 'Erreur inconnue');
        throw new Error(`Erreur serveur IA (${response.status}) : ${detail}`);
      }

      const responseData = await response.json();

      // Format GenerationResponse : { success, data: { content } }
      // Format brut             : { content | result | text }
      const rawText: string =
        (responseData.data?.content) ??
        responseData.content ??
        responseData.result  ??
        responseData.text    ??
        '';

      if (!rawText) {
        throw new Error('Réponse IA vide — le serveur a renvoyé un contenu vide.');
      }

      return rawText;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Erreur réseau pure (fetch a échoué) → retry si possible
      if (err instanceof TypeError && (err as TypeError).message.includes('fetch')) {
        if (tentative < MAX_RETRIES) continue;
        throw new Error(
          'Impossible de contacter le serveur IA. Vérifiez votre connexion Internet ' +
          'ou réessayez dans quelques instants.'
        );
      }

      // Autres erreurs → propager immédiatement
      if (tentative >= MAX_RETRIES) throw lastError;
    }
  }

  throw lastError ?? new Error('La génération a échoué.');
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION PRINCIPALE
// ─────────────────────────────────────────────────────────────

/**
 * Génère une séquence pédagogique complète via l'IA (Railway + Claude).
 *
 * @param contexte - Paramètres de la génération
 * @returns Séquence validée et prête à être injectée dans le formulaire
 * @throws Error si le backend est inaccessible ou la réponse invalide
 */
export async function genererSequenceAvecIA(
  contexte: ContexteGenerationSequence
): Promise<SequenceIAResponse> {
  // Construction des consignes spéciales pour la génération de séquence
  const consignes = [
    construirePromptSysteme(),
    '',
    `Nombre de séances : ${contexte.nombreSeances}`,
    `Durée par séance : ${contexte.dureeSeanceMinutes} minutes`,
    contexte.trimestre ? `Trimestre : ${contexte.trimestre}ème trimestre` : '',
    contexte.instructionsSupplementaires
      ? `Instructions supplémentaires du professeur : ${contexte.instructionsSupplementaires}`
      : '',
    '',
    'Distribue intelligemment les séances : cours → TD/TP → révision → évaluation.',
    'Assure-toi que les objectifs spécifiques sont progressifs et mesurables.',
  ].filter(Boolean).join('\n');

  // Appel au backend avec timeout + retry
  const rawText = await appelBackendIA({
    discipline: contexte.matiere,
    classe:     String(contexte.niveau),
    chapitre:   contexte.theme,
    consignes,
  });

  // Nettoyage des backticks markdown éventuels
  const jsonTexte = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/,       '')
    .replace(/```\s*$/,        '')
    .trim();

  // Parsing JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonTexte);
  } catch {
    throw new Error(
      `Réponse IA non parsable : ${jsonTexte.substring(0, 200)}...`
    );
  }

  // Validation et normalisation
  return validerReponseIA(parsed);
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION D'UNE SEULE SÉANCE
// Utile pour enrichir/compléter une séance existante
// ─────────────────────────────────────────────────────────────

export interface ContexteGenerationSeance {
  matiere:            string;
  niveau:             string;
  titreSeance:        string;
  dureeMinutes:       number;
  typeActivite:       TypeActivite;
  contexteSequence:   string; // Description courte de la séquence parente
}

/**
 * Génère le contenu détaillé d'une séance individuelle.
 * Retourne un objet avec { objectifSpecifique, contenu, ressources }.
 */
export async function genererSeanceAvecIA(
  contexte: ContexteGenerationSeance
): Promise<{ objectifSpecifique: string; contenu: string; ressources: string[] }> {
  const consignes = [
    `Génère le contenu détaillé d'une séance pédagogique.`,
    `Titre de la séance : ${contexte.titreSeance}`,
    `Type d'activité : ${contexte.typeActivite}`,
    `Durée : ${contexte.dureeMinutes} min`,
    `Contexte de la séquence : ${contexte.contexteSequence}`,
    '',
    'RÉPONDRE UNIQUEMENT EN JSON valide, sans backticks :',
    '{ "objectifSpecifique": "string", "contenu": "string (déroulement détaillé)", "ressources": ["string", ...] }',
  ].join('\n');

  const rawText = await appelBackendIA({
    discipline: contexte.matiere,
    classe:     contexte.niveau,
    chapitre:   contexte.titreSeance,
    consignes,
  });

  const jsonTexte = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonTexte);
    return {
      objectifSpecifique: String(parsed.objectifSpecifique ?? ''),
      contenu:            String(parsed.contenu            ?? ''),
      ressources:         Array.isArray(parsed.ressources)
        ? parsed.ressources.map(String)
        : [],
    };
  } catch {
    throw new Error('Réponse IA de séance non parsable.');
  }
}
