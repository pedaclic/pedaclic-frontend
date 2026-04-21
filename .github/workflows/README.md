# GitHub Actions — Auto-deploy Firebase Hosting

## État actuel

Le workflow `firebase-deploy.yml` est **en place mais inactif**.
Tant que le secret `FIREBASE_SERVICE_ACCOUNT_PEDACLIC` n'est pas défini, chaque
exécution se termine proprement (job vert, warning visible) sans rien déployer.

Le déploiement manuel via CLI continue de fonctionner :

```bash
npm run build && firebase deploy --only hosting
```

---

## Activation (une seule fois, ~5 min)

### 1. Générer le secret Firebase

Dans un terminal local :

```bash
firebase init hosting:github
```

- Confirme le repo `pedaclic/pedaclic-frontend`.
- À la question « Set up the workflow to run a build script ? », réponds **No**
  (notre workflow fait déjà le build avec les bonnes variables d'env).
- Firebase va :
  - créer un service account Google Cloud dédié,
  - ajouter automatiquement le secret `FIREBASE_SERVICE_ACCOUNT_PEDACLIC`
    dans les secrets du repo GitHub,
  - écraser notre workflow par le sien → **refuse cette partie** si demandé,
    ou restaure notre `firebase-deploy.yml` après exécution (`git restore`).

> ⚠️ Si `firebase init hosting:github` écrase notre fichier, lance :
> ```bash
> git restore .github/workflows/firebase-deploy.yml
> rm -f .github/workflows/firebase-hosting-merge.yml
> rm -f .github/workflows/firebase-hosting-pull-request.yml
> ```

### 2. Ajouter les secrets de build Vite

`Settings → Secrets and variables → Actions → New repository secret` :

| Nom | Valeur (copier depuis `.env` local) |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `…` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `pedaclic.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `pedaclic` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `pedaclic.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `…` |
| `VITE_FIREBASE_APP_ID` | `…` |
| `VITE_RECAPTCHA_SITE_KEY` | `…` (si utilisé en prod) |
| `VITE_MONTHLY_PRICE` | `…` |
| `VITE_YEARLY_PRICE` | `…` |

Optionnel (si backend Railway exposé via variables d'env plutôt qu'en dur) :

| Nom | Valeur |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.pedaclic.sn` |
| `VITE_API_URL` | idem |
| `VITE_RAILWAY_API_URL` | idem |

### 3. Déclencher un premier run

Deux options :
- Pousser un commit sur `main`.
- Onglet **Actions → Deploy Firebase Hosting → Run workflow**.

---

## Désactivation temporaire

Pour mettre le workflow en pause sans le supprimer :
`Actions → Deploy Firebase Hosting → ··· → Disable workflow`.

## Remarques

- `channelId: live` envoie sur le canal de production.
  Pour ajouter des previews par PR, créer un second workflow
  avec `channelId: pr-${{ github.event.number }}` déclenché sur `pull_request`.
- Les deploys manuels (`firebase deploy`) restent toujours opérationnels.
