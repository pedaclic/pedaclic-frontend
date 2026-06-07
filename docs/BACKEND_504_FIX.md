# Correctif backend — 504 sur `/api/generate` (Exercices corrigés)

> **À appliquer dès que vous avez accès au repo backend Railway** (`api.pedaclic.sn`).
> Ce document complète la mitigation **frontend** déjà livrée (dégradation
> gracieuse anti‑504 dans `src/services/aiGeneratorService.ts` +
> `src/services/aiPromptEnhancer.ts`). La mitigation frontend permet aux
> *exercices corrigés* d'aboutir malgré un serveur lent ; le présent correctif
> supprime la cause racine côté serveur.

---

## 1. Diagnostic

La console montre, pour le type **Exercices corrigés** :

```
Failed to load resource: the server responded with a status of 504 ()  api.pedaclic.sn/api/generate
[aiGeneratorService] HTTP 504 sur /api/generate — tentative 2/3 dans 10s…
[aiGeneratorService] HTTP 504 sur /api/generate — tentative 3/3 dans 15s…
```

Un **504 Gateway Timeout** est émis par le **proxy d'hébergement** (et/ou le
serveur HTTP du backend), pas par le navigateur. Il survient parce que la
génération des *exercices corrigés* est la plus longue :

- C'est le type avec le `max_tokens` le plus élevé des contenus texte
  (5000, cf. `docs/AI_BACKEND_TUNING.md` §2).
- Le prompt impose une auto‑vérification coûteuse
  (« *Si la vérification échoue, RECOMMENCE l'exercice ENTIÈREMENT* »), sans
  borne sur le nombre d'exercices → le modèle génère très longtemps.

La somme dépasse le délai d'inactivité/réponse du proxy → 504.

---

## 2. Correctif (3 leviers, du plus simple au plus complet)

### Levier A — Augmenter le timeout serveur (rapide, indispensable)

La génération IA est légitimement longue : le serveur doit autoriser des
réponses lentes. Dans un backend **Express/Node** :

```js
// server.js / index.js
const http = require('http');
const express = require('express');

const app = express();
// ... vos routes ...

const server = http.createServer(app);

// Génération IA = requêtes longues. On relève les timeouts au-dessus de la
// durée max plausible d'une génération (le frontend, lui, plafonne à 240 s).
server.requestTimeout = 0;            // 0 = pas de coupure côté Node (sinon 300_000)
server.headersTimeout  = 305_000;     // > requestTimeout
server.keepAliveTimeout = 305_000;

server.listen(process.env.PORT || 3000);
```

> **Important — proxy en amont.** Si `api.pedaclic.sn` passe par un reverse
> proxy (Nginx, Caddy) ou un CDN (Cloudflare) **avant** Railway, c'est *lui*
> qui coupe à ~30/60/100 s. Relevez aussi son timeout :
>
> - **Nginx** : `proxy_read_timeout 300s; proxy_send_timeout 300s;`
> - **Caddy** : `reverse_proxy ... { transport http { read_timeout 300s } }`
> - **Cloudflare** (plan gratuit, limite à 100 s, renvoie souvent 524/504) :
>   il faut **streamer** la réponse (voir Levier C) ou sortir l'appel du proxy.

### Levier B — Réduire / borner la charge par type (recommandé)

Réduire `max_tokens` pour les exercices et **borner le nombre d'exercices**
demandés divise le temps de génération sans nuire à la qualité pédagogique
(4 exercices bien corrigés suffisent). Là où vous appelez le LLM :

```js
// Paramètres LLM par type — aligné sur docs/AI_BACKEND_TUNING.md, valeurs
// resserrées pour éviter les générations interminables.
const LLM_PARAMS = {
  cours_complet:            { max_tokens: 4000, temperature: 0.4 },
  fiche_revision:           { max_tokens: 2500, temperature: 0.4 },
  exercices_corriges:       { max_tokens: 3500, temperature: 0.2 }, // ↓ depuis 5000
  quiz_auto:                { max_tokens: 3000, temperature: 0.2 },
  sujet_examen:             { max_tokens: 4500, temperature: 0.3 }, // ↓ depuis 6000
  evaluation_personnalisee: { max_tokens: 3500, temperature: 0.3 },
};

function paramsFor(type) {
  return LLM_PARAMS[type] || { max_tokens: 3500, temperature: 0.3 };
}

// Exemple d'appel (OpenAI-like) :
const { max_tokens, temperature } = paramsFor(req.body.type);
const completion = await llm.chat.completions.create({
  model,
  temperature,
  max_tokens,
  messages,
});
```

> Le frontend envoie déjà, lors d'un retry après 504, une consigne « MODE
> RAPIDE » qui borne le nombre d'exercices. Le Levier B fait de même côté
> serveur dès la 1ʳᵉ tentative, ce qui élimine l'aller-retour en échec.

### Levier C — Streaming (solution de fond, neutralise tout timeout proxy)

Streamer la réponse token par token empêche tout proxy de considérer la
requête comme « bloquée » : des octets arrivent en continu. C'est la solution
définitive si un CDN/Cloudflare à 100 s est en amont.

```js
app.post('/api/generate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stream = await llm.chat.completions.create({
    model, ...paramsFor(req.body.type), messages, stream: true,
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) { full += delta; res.write(`data: ${JSON.stringify({ delta })}\n\n`); }
  }
  res.write(`data: ${JSON.stringify({ done: true, content: full })}\n\n`);
  res.end();
});
```

> ⚠️ Le streaming change le **contrat d'API** : le frontend actuel attend un
> JSON unique (`{ success, type, data: { content } }`). N'activez le Levier C
> que si vous adaptez aussi `generateContent()` pour lire un flux SSE. Pour un
> correctif immédiat **sans changement de contrat**, appliquez **A + B**.

---

## 3. Plan d'application recommandé

1. **A + B** d'abord (effet immédiat, aucun changement de contrat API, aucun
   redéploiement frontend nécessaire). Cela suffit dans la grande majorité des
   cas à supprimer le 504.
2. Vérifier s'il existe un proxy/CDN en amont (`curl -I https://api.pedaclic.sn`
   → en-têtes `Server:`/`cf-ray:`). Si Cloudflare/Nginx, relever leur timeout.
3. **C** seulement si un timeout proxy ≤ 100 s reste incontournable, et en
   adaptant le frontend au SSE.

## 4. Vérification après déploiement

```bash
# Doit répondre 200 (et non 504) en restant < ~3-4 min
curl -s -o /dev/null -w "%{http_code}  %{time_total}s\n" \
  -X POST https://api.pedaclic.sn/api/generate \
  -H "Content-Type: application/json" \
  -d '{"type":"exercices_corriges","discipline":"Français","classe":"1ère","chapitre":"Exercices sur les figures de style","options":{"difficulte":"moyen","duree":60}}'
```

Côté app : générer des *Exercices corrigés* (Français, 1ère) — la console ne
doit plus afficher de `HTTP 504 sur /api/generate`.
