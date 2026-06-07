// ============================================================
// PedaClic — aiPromptEnhancer
// ------------------------------------------------------------
// Enrichissement automatique du champ `consignesSpeciales` envoyé
// au backend IA (Railway). Le backend fusionne ce texte dans le
// prompt système du LLM, ce qui nous permet d'injecter des
// garde-fous QUALITÉ sans modifier le backend.
//
// Stratégie en 3 couches :
//
//   1. Garde-fou GLOBAL (toutes générations)
//      - Programme sénégalais
//      - Niveau correspondant à la classe
//      - Pas d'invention de citations / dates / auteurs
//
//   2. Garde-fou DISCIPLINE (math, physique, français, histoire…)
//      - Conventions de notation (LaTeX pour les maths)
//      - Domaines à éviter (anachronismes, méthodes hors-programme)
//      - Format des références
//
//   3. Garde-fou TYPE (exercice, fiche, cours, sujet…)
//      - Auto-vérification pour les exercices (le corrigé doit
//        être recalculable à partir de l'énoncé seul)
//      - Concision/structure pour les fiches
//      - Barème explicite pour les sujets
//
// Pourquoi côté frontend ?
//   - Itération immédiate sans redéploiement Railway
//   - Versionnage avec le reste du code
//   - Possibilité d'A/B testing facile
//   - L'admin n'a pas besoin d'accès backend pour améliorer
//     la qualité pédagogique des sorties
// ============================================================

import type { GenerationType } from './aiGeneratorService';

// ────────────────────────────────────────────────────────────
// COUCHE 1 — Consignes GLOBALES (toujours injectées)
// ────────────────────────────────────────────────────────────

const CONSIGNE_GLOBALE = `
[CONSIGNES QUALITÉ — À RESPECTER STRICTEMENT]

1. PROGRAMME OFFICIEL : aligne-toi sur le programme scolaire sénégalais en vigueur (curriculum CONFEMEN / programme MEN Sénégal). N'introduis aucune notion hors-programme pour la classe demandée.

2. NIVEAU : adapte rigoureusement le vocabulaire, les notations et la complexité au niveau exact de la classe. Une notion abordée en Terminale ne doit pas apparaître en 2nde. Inversement, ne sous-estime pas une classe terminale avec des explications de 6e.

3. PAS D'INVENTION : ne fabrique JAMAIS de citations, dates, statistiques, lois, théorèmes, auteurs ou ouvrages dont tu n'es pas certain. En cas de doute, reformule sans la donnée incertaine plutôt que de l'inventer.

4. LANGUE : français standard scolaire, registre soutenu, sans anglicismes. Utilise les conventions typographiques françaises (guillemets « », espaces insécables avant : ; ? !).

5. AUTO-VÉRIFICATION : avant de finaliser ta réponse, relis-toi mentalement et vérifie qu'aucune information ne contredit le programme officiel ni ne contient d'erreur factuelle évidente.
`.trim();

// ────────────────────────────────────────────────────────────
// COUCHE 2 — Consignes par DISCIPLINE
// ────────────────────────────────────────────────────────────

/**
 * Normalise un nom de discipline pour la table de correspondance.
 * Robuste aux variantes : "Mathématiques", "mathematiques", "Maths",
 * "Mathématique"… toutes mappées vers la clé canonique 'maths'.
 */
function normalizeDiscipline(name: string): string {
  const n = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  if (/(math|algebr|geomet|arithmet)/.test(n))                  return 'maths';
  if (/(physi|chim)/.test(n))                                    return 'physique_chimie';
  if (/(svt|biolog|geolog|science.*vie|science.*terre)/.test(n)) return 'svt';
  if (/(francais|litterat|lettre)/.test(n))                      return 'francais';
  if (/(histoire|geographi|histgeo|hist[- ]geo)/.test(n))        return 'hg';
  if (/(philos)/.test(n))                                        return 'philo';
  if (/(anglais|english)/.test(n))                               return 'anglais';
  if (/(arabe)/.test(n))                                         return 'arabe';
  if (/(espagnol|spanish)/.test(n))                              return 'espagnol';
  if (/(allemand|german)/.test(n))                               return 'allemand';
  if (/(econom|gestion|comptab)/.test(n))                        return 'economie';
  if (/(educ.*civi|civis)/.test(n))                              return 'ec';
  if (/(informat|numeriq|tice)/.test(n))                         return 'informatique';
  return 'generique';
}

const CONSIGNES_DISCIPLINE: Record<string, string> = {
  // ── Mathématiques : la cause principale des hallucinations ───────
  maths: `
[DISCIPLINE : MATHÉMATIQUES — RIGUEUR ABSOLUE]

• Notation : utilise systématiquement LaTeX entre $...$ (inline) ou $$...$$ (display) pour TOUTES les formules, fractions, exposants, indices, racines, intégrales, limites, ensembles, vecteurs. JAMAIS de formules en texte plat (ex : "x^2 + 3x" est INTERDIT — écrire $x^2 + 3x$).

• Calculs : pour chaque calcul, présente d'abord la formule générale, puis l'application numérique étape par étape. Ne SAUTE jamais d'étape pour un exercice de cours/évaluation.

• Vérification : à la fin de chaque exercice, fais une vérification rapide (substitution, ordre de grandeur, dimension) pour t'assurer que le résultat est cohérent. Si la vérification échoue, RECOMMENCE.

• Théorèmes : nomme explicitement les théorèmes utilisés (ex : « D'après le théorème des accroissements finis… »). N'invente JAMAIS de théorème.

• Définitions : reprends les définitions exactes du programme sénégalais. Pour la dérivabilité/continuité en Terminale, utilise les définitions classiques (limite du taux d'accroissement, limites à gauche/à droite).

• Domaine de définition : commence systématiquement chaque exercice de fonction par la détermination du domaine de définition.
`.trim(),

  physique_chimie: `
[DISCIPLINE : PHYSIQUE-CHIMIE]

• Unités SI obligatoires (kg, m, s, A, K, mol, cd). Toujours préciser l'unité du résultat final.
• Formules en LaTeX ($...$ ou $$...$$). Donnée + formule littérale + application numérique + résultat avec unité.
• Constantes : utilise les valeurs officielles (g = 9,81 m/s² au Sénégal, c = 3,00·10⁸ m/s, etc.). Pas d'arrondis fantaisistes.
• Schémas : remplace par une description textuelle claire des dispositifs (l'IA ne peut pas dessiner).
• Sécurité : pour la chimie, mentionne les pictogrammes de danger pertinents (CMR, corrosif…) si l'expérience le justifie.
`.trim(),

  svt: `
[DISCIPLINE : SVT]

• Vocabulaire scientifique précis (mitose ≠ méiose, ATP ≠ ADP, etc.). Pas d'analogies grossières qui faussent le sens.
• Schémas remplacés par des descriptions textuelles structurées.
• Pour la génétique : utilise les conventions classiques (lettres majuscules pour allèles dominants, minuscules pour récessifs).
• Cite uniquement des espèces et exemples présents dans le programme officiel sénégalais.
`.trim(),

  francais: `
[DISCIPLINE : FRANÇAIS / LITTÉRATURE]

• Citations : utilise UNIQUEMENT des citations dont tu es absolument certain (texte exact + auteur + œuvre + année). En cas de doute, paraphrase sans guillemets plutôt qu'inventer.
• Auteurs sénégalais et africains : intègre Senghor, Césaire, Birago Diop, Cheikh Hamidou Kane, Mariama Bâ, Ousmane Sembène, etc. quand le programme s'y prête.
• Figures de style : nomme-les précisément et illustre par un exemple bref.
• Méthode : pour le commentaire composé, structure introduction (3 axes) → développement (chaque axe = 2-3 sous-parties) → conclusion (bilan + ouverture).
• Orthographe et accords : impeccables. Relis avant de finaliser.
`.trim(),

  hg: `
[DISCIPLINE : HISTOIRE-GÉOGRAPHIE]

• Dates : utilise UNIQUEMENT des dates dont tu es certain. En cas d'incertitude, écris « au milieu du XIXᵉ siècle » plutôt qu'une date précise inventée.
• Histoire du Sénégal et de l'Afrique : centre les exemples sur le programme sénégalais (royaumes du Sahel, traite négrière, colonisation, indépendances, panafricanisme).
• Géographie : utilise des données chiffrées officielles ANSD pour le Sénégal quand pertinent ; cite la source approximative (« selon les données récentes de l'ANSD »).
• Cartes : remplace par des descriptions structurées (organisation spatiale, axes, pôles).
`.trim(),

  philo: `
[DISCIPLINE : PHILOSOPHIE]

• Auteurs et thèses : ne cite que des philosophes dont tu connais avec certitude les positions clés (Platon, Aristote, Descartes, Kant, Nietzsche, Sartre, Bergson, etc.).
• Pas de pseudo-citations : si tu ne te souviens pas du libellé exact, paraphrase l'idée sans guillemets.
• Méthode dissertation : problématique claire, plan en 3 parties dialectiques (thèse / antithèse / synthèse) avec exemples concrets.
`.trim(),

  anglais: `
[DISCIPLINE : ANGLAIS]

• Niveau CECRL adapté à la classe (A2 collège, B1 lycée).
• Grammaire : explications en français pour les classes inférieures, en anglais pour les terminales.
• Exemples : varie les contextes (vie quotidienne, environnement, sciences, culture africaine anglophone).
`.trim(),

  arabe: `
[DISCIPLINE : ARABE]

• Vocalisation (tashkīl) : indique les voyelles brèves pour les classes débutantes uniquement.
• Vocabulaire et exemples : adapte au contexte sénégalais quand pertinent (familles, mosquée, école, marché).
`.trim(),

  economie: `
[DISCIPLINE : ÉCONOMIE / GESTION / COMPTABILITÉ]

• Formules comptables exactes (SYSCOA / OHADA pour le contexte sénégalais).
• Plan comptable : utilise le PCG OHADA, pas le PCG français.
• Cas pratiques : montants en FCFA, contexte économique sénégalais ou ouest-africain.
`.trim(),

  generique: `
[DISCIPLINE : approche générique]
Reste fidèle au programme officiel sénégalais et à la classe demandée. En cas de doute factuel, préfère omettre plutôt qu'inventer.
`.trim(),
};

// ────────────────────────────────────────────────────────────
// COUCHE 3 — Consignes par TYPE de génération
// ────────────────────────────────────────────────────────────

const CONSIGNES_TYPE: Record<GenerationType, string> = {
  cours_complet: `
[TYPE : COURS COMPLET]
Structure obligatoire :
  • Objectifs pédagogiques (3-5 puces)
  • Prérequis (rappel bref)
  • Introduction motivante (contexte ou exemple concret)
  • Développement structuré en parties numérotées avec définitions, propriétés, exemples
  • Synthèse / points clés à retenir
  • Mini-exercice d'application (si demandé)
Longueur : équilibrée pour la durée du cours indiquée.
`.trim(),

  fiche_revision: `
[TYPE : FICHE DE RÉVISION]
Objectif : permettre à l'élève de réviser efficacement en 15-30 minutes.
Format : ultra-synthétique, en puces et tableaux quand pertinent. Pas de paragraphes longs.
Contenu obligatoire :
  • Définitions clés (3-7)
  • Formules / résultats à connaître par cœur
  • Méthodes / démarches types (étape par étape)
  • Erreurs fréquentes à éviter
  • Tableau récapitulatif final
Pas de digression, pas d'introduction longue. Aller à l'essentiel.
`.trim(),

  exercices_corriges: `
[TYPE : EXERCICES CORRIGÉS — RIGUEUR INDISPENSABLE]

Pour CHAQUE exercice :
  1. ÉNONCÉ AUTONOME : toutes les données nécessaires à la résolution doivent figurer dans l'énoncé. Vérifie que la résolution est POSSIBLE avec ces seules informations.
  2. NIVEAU PROGRESSIF : commence par un exercice d'application directe du cours, puis monte en complexité.
  3. CORRIGÉ COMPLET ET COHÉRENT :
     • Reformule la question ou rappelle ce qu'on cherche
     • Donne la méthode / le théorème mobilisé
     • Détaille les étapes de calcul (aucun saut)
     • Conclus avec phrase de réponse claire
  4. AUTO-VÉRIFICATION (CAPITAL) : à la fin de chaque corrigé, vérifie que le résultat est compatible avec les données de l'énoncé. Si la vérification échoue, RECOMMENCE l'exercice ENTIÈREMENT.
  5. NUMÉROTATION explicite : Exercice 1, Exercice 2… et dans le corrigé : Question 1.a, Question 1.b…

INTERDIT : présenter un corrigé dont la démarche ne mène pas effectivement au résultat annoncé. INTERDIT : présenter un énoncé pour lequel des données manquent.
`.trim(),

  quiz_auto: `
[TYPE : QUIZ QCM AUTO-GÉNÉRÉ]

Pour chaque question :
  • Question claire, sans ambiguïté
  • 4 options exactement
  • UNE SEULE bonne réponse
  • 3 distracteurs plausibles (pas absurdes, mais clairement faux pour qui maîtrise le cours)
  • Explication brève (1-2 phrases) justifiant la bonne réponse
  • Difficulté étiquetée (facile/moyen/difficile)

Vérifie pour chaque question que la bonne réponse est effectivement correcte et que les distracteurs sont effectivement faux.
`.trim(),

  sujet_examen: `
[TYPE : SUJET D'EXAMEN]

Respecte le FORMAT OFFICIEL :
  • BFEM : format conforme aux annales du Sénégal (3e)
  • BAC : format conforme aux annales sénégalaises (Terminale)

Structure :
  • En-tête : matière, durée, coefficient, classe, type d'épreuve
  • Consignes générales (calculatrice autorisée ou non, etc.)
  • Exercices numérotés avec barème explicite (sur 20)
  • Total des points = 20

Pour la durée indiquée, calibre la longueur (un BAC de 4h n'a pas la même charge qu'un devoir de 2h).
`.trim(),

  evaluation_personnalisee: `
[TYPE : ÉVALUATION PERSONNALISÉE]
Barème /20 avec répartition explicite par exercice.
Énoncé clair, corrigé-type structuré, critères d'évaluation pour le prof.
Inclus systématiquement un exercice d'application directe + un exercice d'approfondissement.
`.trim(),

  correction_sujet: `
[TYPE : CORRECTION DE SUJET]
Reprends CHAQUE question du document fourni dans l'ordre.
Pour chaque question :
  • Rappel bref de l'énoncé
  • Démarche détaillée (étapes intermédiaires visibles)
  • Réponse finale claire
  • Vérification de cohérence
N'invente pas de questions absentes du document. Si une question est ambiguë, indique-le et propose ta meilleure interprétation.
`.trim(),

  sujet_avec_corrige: `
[TYPE : SUJET + CORRIGÉ INTÉGRÉ]
PARTIE 1 — ÉNONCÉ : sujet complet, autonome, sans aucune référence au corrigé.
PARTIE 2 — CORRIGÉ : reprend chaque question dans l'ordre avec démarche, résultat, vérification, barème indicatif.

Cohérence ÉNONCÉ ↔ CORRIGÉ : avant de finaliser, relis-toi et vérifie que chaque question de la partie 1 trouve sa réponse cohérente dans la partie 2.
`.trim(),
};

// ────────────────────────────────────────────────────────────
// API publique
// ────────────────────────────────────────────────────────────

export interface BuildEnhancedConsignesArgs {
  type: GenerationType;
  discipline: string;
  classe: string;
  /** Consignes spéciales déjà saisies par le prof (priorité maximale) */
  existing?: string;
  /**
   * Niveau d'allègement de la charge de génération (anti-504).
   *   0 = qualité pleine (comportement historique, AUCUN changement).
   *   1 = mode rapide : borne le volume produit (nombre d'exercices/questions),
   *       corrigés concis, vérification ciblée (pas de reprise intégrale).
   *   2 = mode minimal : volume encore réduit, l'essentiel uniquement.
   *
   * Utilisé UNIQUEMENT par le service lors des nouvelles tentatives après un
   * 504/502/503 du serveur d'hébergement : la 1ʳᵉ tentative reste en qualité
   * pleine, les suivantes réduisent le scope pour tenir dans le délai du proxy.
   * Voir generateContent() dans aiGeneratorService.ts.
   */
  liteLevel?: 0 | 1 | 2;
}

/**
 * Directive « mode rapide » injectée lors d'un retry après timeout serveur.
 * Elle ne s'applique qu'aux types de génération les plus lourds (ceux qui
 * produisent de longs corrigés et déclenchent le 504). L'objectif est de
 * réduire le nombre de tokens générés côté backend pour passer sous le délai
 * du proxy, SANS sacrifier la justesse pédagogique (les corrigés restent
 * complets, seul le volume global est borné).
 */
function buildFastModeDirective(
  type: GenerationType,
  liteLevel: 1 | 2
): string {
  // Types « lourds » concernés par la dégradation gracieuse.
  const heavyTypes: GenerationType[] = [
    'exercices_corriges',
    'sujet_examen',
    'evaluation_personnalisee',
    'correction_sujet',
    'sujet_avec_corrige',
  ];
  if (!heavyTypes.includes(type)) {
    // Pour les types légers (fiche, quiz…), on ne touche à rien :
    // ils ne provoquent pas le timeout.
    return '';
  }

  // Bornes de volume selon le niveau d'allègement.
  const maxExos = liteLevel === 1 ? 4 : 2;

  return [
    '[MODE RAPIDE — LE SERVEUR A DÉPASSÉ LE DÉLAI À LA TENTATIVE PRÉCÉDENTE]',
    `Génère AU PLUS ${maxExos} exercice${maxExos > 1 ? 's' : ''} (les plus représentatifs du chapitre), du plus simple au plus complexe.`,
    'Corrigés COMPLETS mais CONCIS : va droit aux étapes essentielles, sans digression ni reformulation superflue.',
    "Vérification CIBLÉE : si une étape est douteuse, corrige uniquement cette étape — ne reprends PAS l'exercice entier (cela alourdit inutilement la réponse).",
    'Priorité : produire une réponse complète et correcte rapidement, dans le délai imparti.',
  ].join('\n');
}

/**
 * Construit la chaîne `consignesSpeciales` enrichie envoyée au backend IA.
 *
 * Ordre des couches (du plus prioritaire au moins prioritaire) :
 *   1. Consignes du PROF (s'il en a saisi) — toujours en premier pour que
 *      le LLM les voie comme contrainte principale
 *   2. Consigne TYPE (structure attendue)
 *   3. Consigne DISCIPLINE (rigueur scientifique / typographie)
 *   4. Consigne GLOBALE (programme, niveau, pas d'invention)
 *
 * Cette injection augmente le prompt système de ~1500 caractères. Le
 * plafond MAX_CONSIGNES_TOTAL_CHARS du service principal (40 000 chars)
 * laisse largement de la place pour un texte source en plus.
 */
export function buildEnhancedConsignes(args: BuildEnhancedConsignesArgs): string {
  const disciplineKey = normalizeDiscipline(args.discipline);
  const consigneDiscipline = CONSIGNES_DISCIPLINE[disciplineKey] || CONSIGNES_DISCIPLINE.generique;
  const consigneType = CONSIGNES_TYPE[args.type] || '';

  const blocs: string[] = [];

  // 0. Mode rapide (anti-504) — uniquement lors d'un retry après timeout serveur.
  //    Placé tout en haut pour que le LLM le traite comme contrainte dominante
  //    et borne réellement le volume produit. Vide en fonctionnement normal
  //    (liteLevel 0 ou absent) → aucun impact sur le happy path.
  const liteLevel = args.liteLevel ?? 0;
  if (liteLevel > 0) {
    const fastDirective = buildFastModeDirective(args.type, liteLevel as 1 | 2);
    if (fastDirective) blocs.push(fastDirective);
  }

  // 1. Prof en premier — sa voix prime sur les automatismes
  if (args.existing?.trim()) {
    blocs.push(`[CONSIGNES PROF — PRIORITAIRES]\n${args.existing.trim()}`);
  }

  // 2. Type
  if (consigneType) blocs.push(consigneType);

  // 3. Discipline
  if (consigneDiscipline) blocs.push(consigneDiscipline);

  // 4. Globale
  blocs.push(CONSIGNE_GLOBALE);

  // 5. Rappel final court : recentrer le LLM sur la cible
  blocs.push(
    `[RAPPEL FINAL] Tu produis pour la classe « ${args.classe} » en « ${args.discipline} ». Reste rigoureusement dans ce cadre.`
  );

  return blocs.join('\n\n');
}

// ────────────────────────────────────────────────────────────
// VALIDATION POST-GÉNÉRATION
// ────────────────────────────────────────────────────────────

export interface GenerationQualityIssue {
  severity: 'warning' | 'error';
  code: string;
  message: string;
}

/**
 * Audit léger du contenu généré pour détecter des problèmes évidents
 * avant que le prof ne sauvegarde. Ne remplace pas une relecture
 * humaine — c'est juste un filet de sécurité automatique.
 *
 * Volontairement conservateur : on n'émet une alerte que sur des
 * patterns à très haute probabilité d'erreur, pour ne pas
 * noyer l'utilisateur sous des faux positifs.
 */
export function auditGeneratedContent(
  content: string,
  type: GenerationType,
  discipline: string
): GenerationQualityIssue[] {
  const issues: GenerationQualityIssue[] = [];
  if (!content || content.trim().length === 0) {
    issues.push({
      severity: 'error',
      code: 'EMPTY',
      message: 'Le contenu généré est vide. Réessayez la génération.',
    });
    return issues;
  }

  // -- Tronquature suspecte (réponse coupée en milieu de phrase) --
  // Détection : se termine par un mot incomplet, "..." de troncature,
  // ou un caractère manifestement non-final.
  const tail = content.trimEnd().slice(-80);
  if (/(\.\.\.|…)$/.test(tail) && !/(\bet\s|cqfd|fin)\s*\.{3}\s*$/i.test(tail)) {
    issues.push({
      severity: 'warning',
      code: 'TRUNCATED',
      message: "La réponse semble tronquée (se termine par '...'). Le serveur a peut-être dépassé son délai. Régénérez si nécessaire.",
    });
  }

  // -- Trop court (probable échec partiel) --
  if (content.length < 300 && type !== 'quiz_auto') {
    issues.push({
      severity: 'warning',
      code: 'TOO_SHORT',
      message: `Le contenu généré est très court (${content.length} caractères). Une fiche/cours attendu devrait dépasser 800 caractères. Vérifiez le résultat avant de sauvegarder.`,
    });
  }

  // -- Maths sans LaTeX : si la discipline est maths/physique et qu'on
  //    voit des opérateurs en texte plat sans aucun $...$, c'est suspect.
  const disciplineKey = normalizeDiscipline(discipline);
  if (disciplineKey === 'maths' || disciplineKey === 'physique_chimie') {
    const hasMathOps = /[=≤≥<>]|\^|\bx\^?\d|\bf\(x\)/.test(content);
    const hasLatex = /\$[^$]+\$|\\\(|\\\[/.test(content);
    if (hasMathOps && !hasLatex) {
      issues.push({
        severity: 'warning',
        code: 'NO_LATEX',
        message: 'Le contenu mathématique contient des formules en texte plat (sans LaTeX). Le rendu ne sera pas optimal — pensez à régénérer ou à corriger manuellement.',
      });
    }
  }

  // -- Exercices : énoncé sans corrigé ou inverse --
  if (type === 'exercices_corriges' || type === 'sujet_avec_corrige') {
    const hasExo = /(exercice|énoncé|sujet|question)\s*\d*/i.test(content);
    const hasCorr = /(corrig[éeè]|solution|réponse|d[ée]marche)/i.test(content);
    if (hasExo && !hasCorr) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_SOLUTION',
        message: "Des exercices sont présents mais aucun corrigé n'a été détecté. Régénérez ou complétez manuellement.",
      });
    }
  }

  // -- Citations littéraires : signaler les guillemets isolés (potentielles
  //    citations inventées sans source claire) --
  if (disciplineKey === 'francais' || disciplineKey === 'philo') {
    const quotes = (content.match(/«[^»]{20,}»|"[^"]{20,}"/g) || []).length;
    if (quotes > 5) {
      issues.push({
        severity: 'warning',
        code: 'MANY_QUOTES',
        message: `${quotes} citations détectées — vérifiez leur authenticité (auteur, œuvre, exactitude du texte). Les LLM peuvent inventer des citations plausibles mais fausses.`,
      });
    }
  }

  return issues;
}
