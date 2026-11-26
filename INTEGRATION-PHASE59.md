# PedaClic — Phase 59 : Validité des codes d'invitation & Correctif lecture Médiathèque

> Aucune nouvelle collection Firestore, aucune migration, aucun index.
> **`firestore.rules` est modifié** (2 règles) → à déployer avec `npm run deploy:rules`
> (le correctif Médiathèque dépend en partie de ce déploiement, voir § 3).
> Retour arrière : annuler le commit de la phase.

## 1. Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/types/prof.ts` | modifié | + type `ValiditeCode` ; + champs optionnels `codeValidite`, `codeExpireLe` sur `GroupeProf` |
| `src/services/profGroupeService.ts` | modifié | + `OPTIONS_VALIDITE_CODE`, `calculerExpirationCode`, `estCodeExpire`, `estValiditeRelative`, `definirValiditeCode` ; `creerGroupe` (paramètre optionnel), `regenererCode` (même signature), `rejoindreGroupe` (contrôle d'échéance), lecture des groupes (conversion de `codeExpireLe`) |
| `src/components/prof/GroupeManager.tsx` | modifié | Champ « Validité » à la création, bouton ⏱️ + panneau sur chaque carte, état « Valide jusqu'au… / Expiré le… » |
| `src/styles/prof.css` | modifié (ajout en fin de fichier) | Classes `groupe-validite-*`, modificateurs `--expire`, mode sombre |
| `src/pages/MediaDetailPage.tsx` | modifié | Chargement tolérant aux erreurs secondaires ; lecteurs `<video>` / `<audio>` avec `src` direct |
| `firestore.rules` | modifié | `groupes_prof` : champs du code protégés côté élève ; `mediatheque_vues` : lecture d'un document de progression pas encore créé |

Lignes existantes retirées : 29 (toutes remplacées par leur version étendue). Aucune fonction supprimée, aucune signature cassée.

## 2. Tâche 1 — Validité du code d'invitation

### Fonctionnement
- **Options** : Sans limite (défaut, comportement historique) · 24 h · 48 h · 7 j · 15 j · 30 j · Jusqu'à une date précise (fin de journée, 23:59).
- **Où** : à la création d'un groupe (nouveau champ) et à tout moment via le bouton **⏱️** à côté de 📋 et 🔄 sur la carte d'un groupe actif.
- **Révocation automatique** : l'échéance est stockée dans `groupes_prof/{id}.codeExpireLe`. Quand un élève saisit un code expiré, `rejoindreGroupe` refuse l'inscription avec le message *« Ce code d'invitation a expiré. Demande un nouveau code à ton professeur. »* Aucune tâche planifiée n'est nécessaire.
- **Affichage prof** : sous le code, « ⏱️ Valide jusqu'au JJ/MM/AAAA à HH:MM » ; une fois expiré, encadré rouge, code barré, « ⛔ Code expiré le… ».
- **Régénération 🔄 (inchangée pour l'utilisateur)** : même bouton, même fonction `regenererCode(groupeId)`.
  - validité **relative** (24 h, 7 j…) → le nouveau code repart pour la même durée ;
  - validité **date fixe** ou **sans limite** → l'échéance est conservée.
- **Groupes existants** : aucun champ → illimités, exactement comme avant. Les élèves déjà inscrits ne sont jamais affectés par l'expiration (seules les **nouvelles** inscriptions par code le sont).
- **Inscription directe par le prof** (« 👥 Inscrire un élève ») : non concernée, n'utilise pas le code.

### Sécurité (`firestore.rules`)
La règle `update` de `groupes_prof` laissait un élève modifier tout champ sauf `profId`, `createdAt`, `createdBy` (nécessaire pour incrémenter `nombreInscrits`). `codeInvitation`, `codeValidite` et `codeExpireLe` y sont ajoutés : un élève ne peut plus prolonger un code. L'inscription élève reste inchangée (elle n'écrit que `nombreInscrits` et `dateMiseAJour`).

## 3. Tâche 2 — Lecture de la Médiathèque par le professeur

### Cause identifiée
À l'ouverture d'un média, `MediaDetailPage` lit la progression `mediatheque_vues/{uid}_{mediaId}`. Avant le **premier** visionnage, ce document n'existe pas : dans la règle Firestore, `resource` vaut alors `null`, `resource.data.userId` lève une erreur, et seul `isAdmin()` pouvait rendre la règle vraie. Pour un **prof** (et un élève), la lecture était donc refusée (`permission-denied`). Comme cet appel était groupé dans un `Promise.all` avec le chargement principal, toute la page tombait dans le `catch` et affichait « Contenu introuvable » à la place du lecteur. L'admin, lui, n'était pas touché, ce qui explique que le défaut soit passé inaperçu.

### Correctifs (double sécurité)
1. **Règle** `mediatheque_vues` : lecture autorisée d'un document **inexistant** dont l'identifiant commence par l'uid du lecteur. Aucune donnée d'autrui n'est exposée.
2. **Page** : progression, contenus similaires et compteur de vues passent par `Promise.allSettled` / `.catch` : un échec n'affecte plus que la donnée concernée, jamais le lecteur. La sauvegarde périodique de progression (toutes les 30 s) est aussi protégée.
3. **Lecteurs** : l'URL est posée sur `<video src>` / `<audio src>` au lieu d'un `<source type=…>`. Un fichier dont le type MIME était jugé non lisible (ex. `video/quicktime` d'iPhone, audio `.m4a` étiqueté `audio/mpeg`) était ignoré **sans message** (lecteur noir) ; désormais le navigateur détecte le vrai format, et en cas d'échec le message « Vidéo indisponible » + « 🔄 Réessayer » s'affiche bien.

> Le point 2 suffit à rétablir la lecture **en local sans déployer les règles**. Le point 1 rétablit en plus la reprise de lecture (« ▶ Reprendre à… ») dès le premier visionnage.

## 4. Test en local

```bash
git checkout -b phase59-validite-codes-mediatheque   # emporte les modifications non commitées
npm run dev
```

Prof dans une fenêtre normale, élève en navigation privée.

### Validité des codes
- [ ] Création d'un groupe sans toucher au champ Validité → aucune ligne d'échéance (sans limite).
- [ ] Création avec « 7 jours » → « ⏱️ Valide jusqu'au … » = maintenant + 7 j.
- [ ] Création avec « Date précise » : bouton « Créer » désactivé tant qu'aucune date n'est choisie ; dates passées non sélectionnables.
- [ ] ⏱️ sur un groupe existant : panneau pré-rempli (« Sans limite » pour les anciens groupes) ; « Appliquer » → message vert + ligne d'échéance ; « Annuler » ferme ; 2ᵉ clic sur ⏱️ ferme.
- [ ] Test d'expiration rapide : régler une date précise = aujourd'hui, puis dans la console Firebase mettre `codeExpireLe` à une heure passée **ou** patienter → encadré rouge, code barré, « ⛔ Code expiré le… ».
- [ ] Élève : saisie du code expiré → message « Ce code d'invitation a expiré… » ; aucune inscription créée, compteur inchangé.
- [ ] Prof : 🔄 sur un code « 24 heures » expiré → nouveau code + nouvelle échéance à +24 h ; l'élève peut rejoindre.
- [ ] Prof : 🔄 sur un code « date précise » → nouveau code, même date.
- [ ] Repasser à « Sans limite » → la ligne d'échéance disparaît, l'élève peut rejoindre.
- [ ] Mode sombre et affichage mobile (≤ 640 px) lisibles.

### Médiathèque (compte **prof** non admin)
- [ ] Ouvrir « Ma Chèvre » et « Introduction aux fonctions affines » → le lecteur s'affiche et la vidéo se lit.
- [ ] Console : au plus des `console.warn` « Progression indisponible » tant que les règles ne sont pas déployées, plus aucune erreur bloquante.
- [ ] Après 30 s de lecture, revenir sur le média → « ▶ Reprendre à… » (nécessite les règles déployées ou l'émulateur).
- [ ] Contenu Premium : toujours accessible en entier au prof.
- [ ] URL vidéo invalide (média de test) → message « Vidéo indisponible » + « Réessayer ».
- [ ] Vidéo YouTube → lecteur intégré inchangé.

### Non-régression
- [ ] Copier 📋, Modifier, Archiver / Restaurer, Supprimer, Voir détails des groupes.
- [ ] Élève : rejoindre un groupe **ancien** (sans validité) avec son code → OK.
- [ ] Élève : aperçu Premium de 30 s toujours appliqué sur un média Premium.
- [ ] Admin : médiathèque (actions de carte, statut, Premium, suppression) inchangée.

### Build de production en local
```bash
npm run build && npm run preview
```

## 5. Mise en production

```bash
npm run deploy:rules   # règles Firestore (+ index/storage inchangés)
npm run deploy:prod    # ou votre script habituel
```
