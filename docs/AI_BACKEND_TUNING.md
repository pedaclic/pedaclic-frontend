# Guide d'amélioration du backend IA (Railway)

> **Quand consulter ce document ?** Lorsque vous obtenez l'accès au backend
> Railway hébergeant `api.pedaclic.sn`, ce guide liste les leviers de qualité
> à activer côté serveur pour compléter les améliorations frontend déjà en
> place (voir `src/services/aiPromptEnhancer.ts`).
>
> Les corrections frontend (injection de garde-fous dans `consignesSpeciales`
> + audit qualité post-génération) suffisent à réduire ~50-70 % des erreurs
> factuelles. Les ajustements backend ci-dessous visent les 30-50 % restants,
> notamment sur les contenus mathématiques et les exercices.

---

## 1. Choix du modèle LLM

| Modèle | Forces | Faiblesses | Coût |
|---|---|---|---|
| **GPT-4o** | Math, code, JSON robuste | Cher | $$$$ |
| **GPT-4o-mini** | Rapide, peu cher | Math approximative | $ |
| **Claude 3.5 Sonnet** | Pédagogie, citations fiables | Moins disponible en SN | $$$ |
| **Mistral Large** | Multilingue FR natif | Hallucinations math | $$ |

**Recommandation** : utiliser **GPT-4o** ou **Claude 3.5 Sonnet** pour les
disciplines scientifiques (maths, physique-chimie, SVT) et garder
GPT-4o-mini comme fallback pour les disciplines littéraires plus tolérantes
aux légères imprécisions stylistiques.

Idéal : **routage par discipline** côté backend :

```js
function chooseModel(discipline, type) {
  const scientifiques = ['maths', 'physique', 'chimie', 'svt'];
  const isScientific = scientifiques.some(s => discipline.toLowerCase().includes(s));
  if (isScientific) return 'gpt-4o';                 // précision maximale
  if (type === 'sujet_examen') return 'gpt-4o';      // enjeux pédagogiques élevés
  return 'gpt-4o-mini';                              // suffisant ailleurs
}
```

---

## 2. Paramètres LLM par type

| Paramètre | Cours / Fiche | Exercices | Sujet examen | Quiz |
|---|---|---|---|---|
| **temperature** | 0.4 | **0.2** | 0.3 | 0.2 |
| **top_p** | 0.9 | 0.85 | 0.85 | 0.85 |
| **max_tokens** | 4000 | 5000 | 6000 | 3000 |
| **frequency_penalty** | 0.2 | 0.0 | 0.0 | 0.0 |
| **presence_penalty** | 0.1 | 0.0 | 0.0 | 0.0 |

**Pourquoi ces valeurs ?**
- Une température basse (0.2) sur les exercices/quiz force le modèle à
  prendre la voie la plus probable, donc la plus juste mathématiquement.
- Une température modérée (0.4) sur les cours permet une formulation
  variée et pédagogique sans dériver factuellement.
- `frequency_penalty` à 0.2 sur les cours évite les répétitions lassantes
  ("nous allons voir que… nous allons voir que…").

---

## 3. System prompt enrichi (côté backend)

Actuellement le backend semble construire un prompt minimal. Voici une
proposition de **system prompt enrichi** à intégrer en tête de chaque appel
au LLM, AVANT les consignes envoyées par le frontend :

```text
Tu es un enseignant sénégalais expert, ayant 15 ans d'expérience dans le
secondaire (collège et lycée). Tu maîtrises parfaitement :
- Le programme officiel du Ministère de l'Éducation nationale du Sénégal
- Les curricula CONFEMEN (Conférence des ministres de l'Éducation francophones)
- Les épreuves type BFEM (3e) et BAC (Terminale, séries L1, L2, S1, S2, S3, T)
- Les conventions pédagogiques sénégalaises (vocabulaire, méthodes, notations)

RÈGLES ABSOLUES (à respecter avant toute autre instruction) :

1. EXACTITUDE FACTUELLE : tu n'inventes JAMAIS un fait, une date, une citation,
   un théorème, une formule ou une statistique. En cas de doute, tu reformules
   sans la donnée incertaine plutôt que de fabriquer.

2. RIGUEUR MATHÉMATIQUE : pour les sciences exactes (maths, physique, chimie) :
   - Toutes les formules sont en LaTeX entre $...$ ou $$...$$
   - Chaque étape de calcul est détaillée
   - Chaque résultat est vérifié par substitution ou ordre de grandeur
   - Aucun raccourci de notation

3. EXERCICES AUTONOMES : un énoncé doit contenir TOUTES les informations
   nécessaires à sa résolution. Avant de finaliser un exercice avec corrigé,
   tu vérifies que :
   - L'énoncé seul permet de retrouver le résultat
   - Le corrigé arrive bien au résultat annoncé
   - La démarche est complète (pas d'étape implicite pour le niveau)
   Si la vérification échoue, tu RECOMMENCES l'exercice entièrement.

4. NIVEAU DE LA CLASSE : tu respectes scrupuleusement le niveau demandé.
   Une notion de Terminale n'apparaît jamais en 2nde. Une notion de 6e n'est
   pas re-développée en Terminale (juste rappelée si pertinent).

5. FORMAT MARKDOWN : tu produis du Markdown propre avec :
   - Titres hiérarchisés (# pour le titre, ## pour les parties, ### pour les sous-parties)
   - Listes à puces ou numérotées
   - Tableaux Markdown quand pertinent
   - LaTeX inline ($...$) ou display ($$...$$) pour TOUTES les maths
   - Code-block triple backticks pour le code informatique

Tu réponds UNIQUEMENT en français standard (registre soutenu).
```

---

## 4. Validation côté backend (filet de sécurité supplémentaire)

Avant de renvoyer la réponse au frontend, le backend peut faire un
**second appel au LLM** en mode "critique" :

```js
async function validateGeneratedContent(content, type, discipline) {
  const critique = await llm.complete({
    model: 'gpt-4o-mini', // moins cher pour la validation
    temperature: 0,
    messages: [
      { role: 'system', content: 'Tu es un correcteur senior chargé de relire un contenu pédagogique. Tu signales TOUTE erreur factuelle, incohérence ou démarche fausse. Si rien à signaler, réponds OK.' },
      { role: 'user', content: `Discipline: ${discipline}\nType: ${type}\n\nContenu à relire:\n\n${content}\n\nSignale les erreurs (max 5 points). Si aucune erreur sérieuse, réponds OK.` },
    ],
  });
  return critique.includes('OK') && critique.length < 50;
}
```

Si la validation échoue, le backend peut :
- Re-tenter une génération (1 fois max pour limiter le coût)
- Ou renvoyer la réponse avec un flag `quality: 'doubtful'` que le frontend
  peut afficher à côté du bandeau d'audit déjà en place.

---

## 5. RAG (Retrieval-Augmented Generation) — pour aller plus loin

L'erreur "hors programme sénégalais" peut être quasi-éliminée par un RAG :

1. **Constituer un corpus** : programmes officiels MEN-Sénégal, manuels
   homologués (INEADE), annales BFEM/BAC, en PDF ou texte.

2. **Indexer dans un vector store** (Pinecone, Weaviate, Supabase pgvector).

3. **À chaque requête** : récupérer les 3-5 passages les plus pertinents et
   les injecter dans le prompt comme contexte autoritaire :

```
[CONTEXTE OFFICIEL — PROGRAMME MEN-SÉNÉGAL POUR <Discipline> <Classe>]
<passages récupérés du vector store>

Tu DOIS te baser sur ce contexte officiel pour produire la réponse.
Si le sujet demandé sort de ce contexte, signale-le au lieu d'inventer.
```

Coût estimé : 1-2 jours d'ingénierie pour la première mise en place,
~$10-30/mois d'hébergement du vector store. Retour sur investissement
considérable sur la qualité perçue.

---

## 6. Monitoring qualité (à terme)

Ajouter une route admin `GET /api/admin/generations/stats` qui agrège :
- Nombre de générations par discipline / type / classe
- Taux de régénération (le prof a re-cliqué dans les 5 min suivantes)
- Taux d'utilisation du bouton "Sauvegarder" (signal de satisfaction)
- Issues d'audit qualité remontées par le frontend (nouveau)

Le frontend pourrait POSTer les `qualityIssues` détectés à
`/api/feedback/quality` (anonymisé) pour identifier les patterns récurrents
et raffiner les prompts au fil du temps.
