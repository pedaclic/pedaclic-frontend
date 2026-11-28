# PedaClic — Phase 61 : Accès aux quiz réservé aux classes, brouillons réservés à leur auteur

> **Nouvelle collection** : `membres_groupe/{groupeId}_{eleveId}` (appartenance à identifiant déterministe).
> **Migration** : bouton admin idempotent (tableau de bord admin → carte « 🛠️ Maintenance »).
> **Index** : 2 index composites ajoutés (page « Quiz gratuits »), déployés dès l'étape 1.
> **Règles** : déployées en **deux temps** — étape 1 (écriture de `membres_groupe` + collection témoin), étape 3 (lecture des quiz).
> **Trois étapes déployables séparément**, dans cet ordre : **1 → migration → 2 → 3a → 3b**.
> Aucune route ajoutée ou retirée. Code d'inscription, de connexion et de navigation non modifié ; règle `users` non modifiée.

## 0. Résumé

| Avant | Après (étape 3) |
|---|---|
| Un quiz lié à une classe était lisible par **tout utilisateur connecté** connaissant son identifiant ou lançant une requête | Lisible seulement par les **membres du groupe** (ou d'une classe du cahier de la séance), les **profs**, son **auteur** et l'**admin** |
| Un brouillon était lisible par tout prof (et, en classique, par tout utilisateur) | Lisible seulement par son **auteur** et l'**admin** |
| Un élève pouvait s'ajouter à n'importe quel groupe sans code (console du navigateur) | L'appartenance d'un élève exige le **code d'invitation en cours** (groupe actif, échéance non dépassée) |

Décisions validées : profs = option stricte (publiés + leurs propres brouillons) ; quiz de classe ouverts à **tous les membres**, Premium ou non ; vérification du code à l'appartenance (la collection `codes_invitation` est reportée à une phase dédiée, voir § 8).

## 1. Fichiers

| Fichier | Statut | Étape | Rôle |
|---|---|---|---|
| `src/services/membresGroupeService.ts` | **nouveau** | 1 | `ajouterMembre`, `retirerMembreSiPlusInscrit`, `retirerTousMembresGroupe`, `migrerMembresEtQuiz` (compte rendu) |
| `src/components/admin/MigrationPhase61Card.tsx` | **nouveau** | 1 | Carte « Maintenance » : bouton de migration + compte rendu |
| `src/styles/MigrationPhase61.css` | **nouveau** | 1 | Styles commentés, préfixe `.mig61-`, mobile ≤ 640 px, mode sombre |
| `src/components/admin/AdminDashboard.tsx` | modifié | 1 | Affiche la carte sous « Actions rapides » |
| `src/services/profGroupeService.ts` | modifié | 1 + 2 | `rejoindreGroupe` (appartenance + code), `retirerEleve`, `supprimerGroupe` ; `getQuizParMatiere` (requêtes prof) |
| `src/services/inscriptionDirecteService.ts` | modifié | 1 | `inscrireEleveDirect` (prof, lot, admin), `desinscrireEleve` (prof, admin), `toggleStatutInscription` (suspension / réactivation) |
| `src/services/quizService.ts` | modifié | 1 + 2 | Création : `groupeId: null` et `status: 'published'` par défaut ; `''` → `null` ; `getQuizzesForEleve` |
| `src/services/quizAdvancedService.ts` | modifié | 1 + 2 | Création : `groupeId: null` par défaut ; `getQuizzesAvanceForEleve` ; nouveau `getQuizzesAvanceSelonRole` |
| `src/services/aiGeneratorService.ts` | modifié | 1 | Quiz IA : `groupeId: null` explicite |
| `src/config/phase61.ts` | **nouveau** | 2 | Interrupteur `PHASE61_REQUETES_SCINDEES` (false à l'étape 1, true à l'étape 2) |
| `src/services/quizAccesService.ts` | **nouveau** | 2 | Requêtes scindées (globaux / par groupe / par cahier / prof), repli automatique, test `__testPhase61` |
| `src/services/quizUnifiedService.ts` | modifié | 2 | Tableau de bord élève ; `getQuizzesBySeance` (prof) ; nouveau `getQuizzesBySeancePourEleve` |
| `src/services/quizGratuitService.ts` | modifié | 2 | Requêtes prouvables + `Promise.allSettled` |
| `src/services/progressionService.ts` | modifié | 2 | Comptage des quiz d'une discipline |
| `src/components/eleve/QuizsDeSeance.tsx` | modifié | 2 | Prop optionnelle `cahierId`, lecture « élève » |
| `src/pages/ElveCahierPage.tsx` | modifié | 2 | Transmet `cahierId` à `QuizsDeSeance` |
| `src/pages/QuizListPage.tsx` | modifié | 2 | `/quizzes` : liste selon le rôle (prof, parent) |
| `src/components/student/QuizPlayer.tsx` | modifié | 2 | Quiz de classe Premium accessible aux membres de la classe (comme les quiz avancés) |
| `firestore.indexes.json` | modifié | 1 | + 2 index `isPremium, groupeId, status, createdAt desc` (`quizzes`, `quizzes_v2`) |
| `firestore.rules` | modifié | 1 | + fonctions `membreDe`, `membreDuCahier` ; + `membres_groupe` ; + `test_phase61` (témoin). **Lecture des quiz inchangée.** |
| `firestore-rules-phase61-etape3.txt` | **nouveau** | 3 | Règles complètes de l'étape 3 (lecture durcie de `quizzes` et `quizzes_v2`) |
| `firestore-rules-backup-phase60.txt` | **nouveau** | — | Sauvegarde des règles Phase 60 (retour arrière) |

Aucune fonction supprimée, aucune signature existante modifiée (seuls ajouts : props / paramètres optionnels et fonctions nouvelles). Vérification TypeScript des 18 fichiers concernés : 0 erreur.

## 2. Fonctionnement

### 2.1 Appartenance `membres_groupe`
- Document `membres_groupe/{groupeId}_{eleveId}` : `groupeId`, `eleveId`, `source` (`code` | `direct` | `reactivation` | `migration`), `codeInvitation` (inscription par code uniquement), `dateAjout`.
- `inscriptions_groupe` reste la **source de vérité** ; `membres_groupe` n'en est que le reflet, lu par les règles.
- Écrite / supprimée automatiquement :

| Action | Fonction | Effet |
|---|---|---|
| Élève rejoint par code | `rejoindreGroupe` | crée (code vérifié par la règle) |
| Prof inscrit un élève (unitaire ou en lot) | `inscrireEleveDirect` | crée |
| Admin crée un compte élève dans une classe | `creerCompteUtilisateur` → `inscrireEleveDirect` | crée |
| Prof retire un élève | `retirerEleve` | supprime *s'il ne reste aucune inscription active* |
| Prof / admin désinscrit (suppression) | `desinscrireEleve` | idem |
| Admin supprime un compte | `supprimerCompteUtilisateur` → `desinscrireEleve` | idem |
| Prof suspend / réactive | `toggleStatutInscription` | supprime / recrée |
| Prof supprime un groupe | `supprimerGroupe` | supprime toutes les appartenances (avant le groupe) |

- **Non bloquant** : un échec n'empêche jamais l'inscription ; il laisse dans la console `[membresGroupe] Appartenance non écrite (sera réparée par la migration Phase 61)`. Relancer la migration répare.
- Élèves sans compte (`offline:`) : ignorés (ils ne se connectent pas).
- Groupe **archivé** : les appartenances sont conservées (restauration possible) ; l'affichage élève continue de masquer les groupes archivés.

### 2.2 Migration (bouton admin, idempotent)
1. Crée l'appartenance de chaque inscription **active** d'élève avec compte ; supprime les appartenances sans inscription active.
2. `quizzes` : `groupeId` absent ou `''` → `null` ; `status` absent → `'published'` (un quiz sans statut était déjà affiché comme publié : rien ne change à l'écran).
3. `quizzes_v2` : `groupeId` absent ou `''` → `null`. Les quiz avancés **sans statut** sont laissés tels quels (déjà invisibles aux élèves) et comptés dans le rapport.
4. Compte rendu : inscriptions lues, élèves sans compte, appartenances créées / déjà présentes / supprimées, quiz lus et normalisés, erreurs éventuelles.

**Une 2ᵉ exécution doit afficher 0 création, 0 suppression, 0 quiz normalisé.**

### 2.3 Requêtes scindées (interrupteur `PHASE61_REQUETES_SCINDEES`)
Firestore refuse une requête de liste entière s'il ne peut pas prouver que chaque document est autorisé. Les listes sont donc découpées :

| Liste | Requêtes (égalités seulement, pas d'index requis) |
|---|---|
| Quiz globaux (élève) | `status == 'published'` + `groupeId == null` (+ `isPremium == false` si non Premium, quiz classiques) |
| Quiz de classe (élève) | **une requête par groupe** : `status == 'published'` + `groupeId == G` |
| Quiz de séance (élève) | `status == 'published'` + `cahierId == C` (+ `seanceId == S` dans la séance) |
| Prof (par discipline, par séance, `/quizzes`) | requête simple si autorisée ; sinon `status == 'published'` + « les miens » (`profId` / `auteurId`) |
| Parent (`/quizzes`) | quiz avancés globaux publiés |
| Quiz gratuits (visiteur, élève) | `isPremium == false` + `groupeId == null` + `status == 'published'` + `orderBy createdAt` (index ajoutés) |

Une requête **par groupe** plutôt qu'un `in` sur 30 groupes : chaque évaluation de la règle compte une vérification `exists()`, et la limite des lectures dépendantes par requête serait vite dépassée avec `in`.

**Repli automatique** (aucune action requise) : une requête refusée est rejouée sous une forme plus restreinte. C'est ce qui rend l'étape 2 compatible avec les règles **Phase 60 et Phase 61** :
- quiz de classe Premium pour un élève non Premium : refusé par les règles Phase 60 → repli `isPremium == false` (comportement historique) ; accepté par les règles Phase 61 ;
- prof : liste complète acceptée par les règles Phase 60, refusée par les règles Phase 61 → repli « publiés + les miens ».

**Correctifs obtenus au passage** (défauts existants) :
- tableau de bord élève : les **quiz avancés** n'apparaissaient pas (requête sans filtre `status`, refusée en silence) ;
- quiz avancés d'une séance invisibles pour l'élève (même cause) ;
- « Quiz gratuits » : la requête `quizzes_v2` sans `status` faisait échouer **toute** la page pour les visiteurs et les élèves ; désormais les quiz classiques s'affichent même si les avancés sont refusés ;
- `/quizzes` pour un parent : liste refusée → quiz globaux publiés ;
- progression : total des quiz à 0 pour un élève non Premium.

### 2.4 Règles de lecture (étape 3)

**`quizzes`** — lisible si :
1. le document n'existe pas (rien n'est exposé ; « introuvable » au lieu de « permission refusée ») ;
2. publié + global : `!isPremium || isPremium()` — **visiteurs compris** pour les quiz gratuits (inchangé) ;
3. connecté et : publié + membre du groupe, **ou** publié + membre d'une des 3 premières classes du cahier de la séance, **ou** publié + prof ; **ou** auteur (`profId` / `auteurId`) ; **ou** admin.

**`quizzes_v2`** — connecté (comme avant) et : publié + global ; publié + membre du groupe / d'une classe du cahier ; publié + prof ; auteur (`auteurId`) ; admin. Le contrôle Premium des quiz avancés reste fait par l'application (inchangé).

**`membres_groupe`** :
- lecture : l'élève concerné, le prof propriétaire du groupe, l'admin ;
- création / mise à jour : admin, prof propriétaire, ou **l'élève lui-même** avec `source: 'code'` et le **code en cours** (groupe actif, code identique, `codeExpireLe` non dépassé) ; identifiant = `groupeId_eleveId`, champs limités à la liste autorisée ;
- suppression : admin ou prof propriétaire (groupe lu à partir de l'identifiant).

**Parents** : aucun écran parent ne lit les quiz (les titres sont recopiés dans les résultats, `quizTitre`) ; ils conservent l'accès aux quiz **globaux** publiés.

**Séances d'un cahier partagé à plusieurs classes** : le quiz ne porte que le 1er groupe dans `groupeId` ; la règle accepte aussi les membres des classes n°2 et n°3 du cahier. Au-delà de 3 classes par cahier, les élèves des classes suivantes ne verraient plus les quiz de séance (liez alors le quiz à leur classe).

## 3. ÉTAPE 1 — Appartenance, normalisation, migration

### 3.1 Test en local
```bash
git checkout -b phase61-acces-quiz-classes   # emporte les modifications non commitées
npm run dev
```
`src/config/phase61.ts` doit contenir `PHASE61_REQUETES_SCINDEES = false`.

> Les règles `membres_groupe` ne sont actives qu'une fois déployées : en local sans déploiement, les avertissements `[membresGroupe] Appartenance non écrite` sont normaux et **n'empêchent rien**.

### 3.2 Mise en production de l'étape 1
```bash
npm run deploy:rules      # membres_groupe + test_phase61 + 2 index (lecture des quiz INCHANGÉE)
npm run deploy:prod       # ou votre script habituel (il redéploie aussi les règles : sans danger)
```
Attendez que les 2 nouveaux index soient « Activés » (console Firebase → Firestore → Index, 1 à 5 min).

### 3.3 Lancer la migration
Admin → tableau de bord → carte **🛠️ Maintenance** → **▶ Lancer la migration** → confirmer.
- [ ] Compte rendu affiché, aucune erreur.
- [ ] Relancer → 0 création, 0 suppression, 0 quiz normalisé.
- [ ] Console Firebase → `membres_groupe` : un document `groupeId_eleveId` par élève inscrit (avec compte).

### 3.4 Tests de l'étape 1
**Élève** (navigation privée)
- [ ] Rejoindre un groupe avec un code valide → inscription OK **et** document `membres_groupe/{groupe}_{uid}` créé (`source: code`).
- [ ] Code expiré (Phase 59) → refus inchangé, aucune appartenance créée.
- [ ] Console navigateur : création manuelle d'une appartenance sans code ou avec un faux code → **permission-denied**.

**Prof**
- [ ] « 👥 Inscrire un élève » (unitaire et en lot) → appartenance créée (`source: direct`).
- [ ] Élève sans compte (offline) → inscription OK, **aucune** appartenance (normal).
- [ ] Suspendre un élève → appartenance supprimée ; réactiver → recréée (`source: reactivation`).
- [ ] Retirer un élève → appartenance supprimée.
- [ ] Supprimer un groupe de test → ses appartenances disparaissent.

**Admin**
- [ ] Créer un compte élève avec une classe → appartenance créée.
- [ ] Supprimer ce compte → appartenance supprimée.

**Création de quiz**
- [ ] Prof : quiz classique et avancé sans classe → `groupeId: null` dans Firestore ; quiz classique publié → `status: 'published'`.
- [ ] Générateur IA → `groupeId: null`.
- [ ] Admin : lier puis délier un quiz (« Tous les élèves ») → `groupeId: null`.

**Non-régression** : listes élèves, tableau de bord, quiz gratuits, appel, notes, statistiques de groupe : **identiques à avant** (requêtes historiques).

### 3.5 Retour arrière de l'étape 1
Annuler le commit, puis :
```bash
cp firestore-rules-backup-phase60.txt firestore.rules && npm run deploy:rules
```
Les documents `membres_groupe` et les champs `null` / `published` ajoutés sont neutres pour l'ancien code (rien à nettoyer).

## 4. ÉTAPE 2 — Requêtes scindées

> **Prérequis : migration de l'étape 1 lancée** (sinon les anciens quiz sans `groupeId` / `status` disparaîtraient des listes).

### 4.1 Activation
Dans `src/config/phase61.ts` :
```ts
export const PHASE61_REQUETES_SCINDEES = true;
```
```bash
npm run dev     # tests ci-dessous, puis
npm run deploy:prod
```

### 4.2 Tests de l'étape 2 (règles Phase 60 encore en place)
**Élève inscrit à une classe** (non Premium, puis Premium)
- [ ] Tableau de bord : quiz globaux + quiz de sa classe ; **les quiz avancés apparaissent désormais** ; aucun quiz d'une autre classe ; aucun brouillon.
- [ ] `/quizzes` et « Quiz gratuits » (section avancés) : mêmes règles d'affichage.
- [ ] Cahier de textes partagé → séance avec quiz → « 🧩 Quiz proposés » listés, classique et avancé.
- [ ] Lecture d'un quiz `/quiz/:id` et `/quiz-avance/:id` → OK.
- [ ] Progression d'une discipline : le total des quiz n'est plus à 0.

**Élève sans classe** : quiz globaux uniquement.

**Visiteur non connecté**
- [ ] « Quiz gratuits » : la page s'affiche (quiz classiques gratuits) ; aucun message d'erreur ; un quiz gratuit se lance.

**Prof**
- [ ] Groupe → statistiques / choix d'un quiz par matière : liste complète (globaux + ceux du groupe).
- [ ] Séance → onglet « Quiz » : quiz rattachés visibles ; rattacher / détacher OK.
- [ ] « Mes quiz », création, modification, générateur IA : inchangés.

**Parent** : `/quizzes` → quiz avancés globaux publiés ; tableau de bord parent (derniers quiz, résumé) inchangé.

**Admin** : QuizManager, quiz avancés, résultats, tableau de bord : inchangés.

> Console : des avertissements `[quizAcces] … une lecture a échoué` sont possibles **avant l'étape 3** uniquement si une variante de repli échoue ; signalez-les-moi s'ils persistent.
> Si la console indique « The query requires an index » avec un lien, cliquez le lien (création de l'index en 1 clic) et prévenez-moi.

### 4.3 Retour arrière de l'étape 2
`PHASE61_REQUETES_SCINDEES = false` puis `npm run deploy:prod` (tant que l'étape 3 n'est **pas** déployée).

## 5. ÉTAPE 3 — Durcissement des lectures

### 5.1 Étape 3a — Test sur la collection témoin (sans risque)
La règle témoin `test_phase61` (= future règle de `quizzes_v2`) est **déjà déployée** depuis l'étape 1.

1. Console Firebase → Firestore → créer la collection `test_phase61` avec 4 documents :

| Id | Champs |
|---|---|
| `global` | `status: "published"`, `groupeId: null`, `cahierId: null`, `auteurId: "x"` |
| `classeA` | `status: "published"`, `groupeId: "<groupe A>"`, `cahierId: null`, `auteurId: "x"` |
| `classeB` | `status: "published"`, `groupeId: "<groupe B>"`, `cahierId: null`, `auteurId: "x"` |
| `seance` | `status: "published"`, `groupeId: "<groupe A>"`, `cahierId: "<cahier partagé au groupe A>"`, `auteurId: "x"` |

   (élève de test inscrit au groupe **A**, pas au groupe **B** ; migration déjà lancée.)
2. Se connecter avec cet élève, ouvrir le tableau de bord, puis dans la console du navigateur (F12) :
```js
await __testPhase61('<groupe A>', '<groupe B>', '<cahier>')
```
3. Résultat attendu (tableau affiché) — **toutes les lignes `ok: true`** :

| Test | Attendu |
|---|---|
| Liste : quiz globaux publiés | autorisé (1 doc.) |
| Liste : groupe dont je suis membre | autorisé (2 doc.) |
| Liste : groupe dont je ne suis PAS membre | refusé |
| Liste : toute la collection | refusé |
| Liste : séances du cahier | autorisé (1 doc.) |

**Si une ligne « autorisé » est refusée : ne passez pas à 3b** et transmettez-moi le tableau.

### 5.2 Étape 3b — Règles réelles
```bash
cp firestore.rules firestore-rules-backup-phase61-etape1.txt   # sauvegarde de l'état étape 1
cp firestore-rules-phase61-etape3.txt firestore.rules
npm run deploy:rules
```
> `npm run deploy:prod` redéploie aussi `firestore.rules` : faites cette copie **une seule fois** et gardez ensuite `firestore.rules` à jour (c'est désormais la version étape 3).

### 5.3 Tests de l'étape 3
**Sécurité (console navigateur d'un élève NON inscrit au groupe A)**
- [ ] Ouvrir `/quiz/<id quiz classique lié au groupe A>` → « Erreur lors du chargement du quiz » (lecture refusée).
- [ ] Ouvrir `/quiz-avance/<id quiz avancé lié au groupe A>` → message d'erreur.
- [ ] Ouvrir `/quiz/<id brouillon>` → refusé.

**Élève inscrit au groupe A** (non Premium)
- [ ] Les quiz du groupe A apparaissent et se lancent, **y compris un quiz classique de classe marqué Premium** (décision validée).
- [ ] Élève retiré ou suspendu → les quiz du groupe disparaissent (après rechargement).
- [ ] Quiz de séance d'un cahier partagé à 2 classes → visible par les élèves des **deux** classes.

**Visiteur** : « Quiz gratuits » et lancement d'un quiz classique gratuit → OK.

**Prof**
- [ ] Ses brouillons : visibles et modifiables ; brouillon d'un **autre** prof : invisible.
- [ ] Statistiques de groupe, quiz par matière, onglet Quiz de séance, « Mes quiz », création / édition / IA → OK.

**Parent** : tableau de bord, `/quizzes` → OK.

**Admin** : tout visible, y compris tous les brouillons ; migration relançable.

### 5.4 Retour arrière de l'étape 3 (1 minute, sans toucher au code)
```bash
cp firestore-rules-backup-phase61-etape1.txt firestore.rules && npm run deploy:rules
```
Le code de l'étape 2 fonctionne avec ces règles (repli automatique).

## 6. Non-régression générale
- [ ] Inscription élève / prof / parent (email + Google), vérification d'email, connexion, déconnexion, redirections par rôle.
- [ ] Règle `users` (Phase 60) : `updateDoc(users/uid, {role:'admin'})` depuis un élève → toujours **permission-denied**.
- [ ] Rejoindre un groupe par code, validité des codes (Phase 59), régénération 🔄.
- [ ] Appel, retards, feuilles de notes, cahier de textes, messagerie de classe, médiathèque.
- [ ] Résultats de quiz (élève, prof, parent, admin).
- [ ] Mode sombre et mobile (≤ 640 px) de la carte « Maintenance ».

### Build de production en local
```bash
npm run build && npm run preview
```

## 7. Ordre de mise en production (récapitulatif)

| # | Action | Retour arrière |
|---|---|---|
| 1 | `deploy:rules` + `deploy:prod` (interrupteur à `false`) | annuler le commit + règles `backup-phase60` |
| 1 bis | Bouton **Migration** (puis 2ᵉ passage = 0) | aucun (idempotent, neutre) |
| 2 | Interrupteur à `true` + `deploy:prod` | interrupteur à `false` |
| 3a | `__testPhase61(...)` sur `test_phase61` | — |
| 3b | `firestore-rules-phase61-etape3.txt` → `firestore.rules` + `deploy:rules` | règles `backup-phase61-etape1` |

Une fois l'étape 3 en production, **ne plus remettre l'interrupteur à `false`**.
Après validation, les documents de `test_phase61` peuvent être supprimés depuis la console (la règle témoin est inoffensive et peut rester).

## 8. Limites connues et suite proposée (Phase 62)
- **Codes d'invitation lisibles** : `groupes_prof` est lisible (y compris en liste) par tout utilisateur connecté, champ `codeInvitation` compris. Un élève techniquement averti peut donc encore lire un code et s'inscrire. Correction proposée : collection de recherche `codes_invitation/{code} → groupeId` et lecture de `groupes_prof` restreinte (touche le parcours d'inscription : phase dédiée).
- **Inscriptions** : `inscriptions_groupe` accepte toujours qu'un élève s'inscrive lui-même sans code (il apparaît alors dans la liste du prof, **sans** accès aux quiz). À durcir en Phase 62 avec le même contrôle de code.
- **Résultats** : `quiz_results` / `quiz_results_v2` restent lisibles par tout prof et tout parent (hors périmètre).
- **Cahiers partagés à plus de 3 classes** : voir § 2.4.
