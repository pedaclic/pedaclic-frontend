# PedaClic — Phase 60 : Quiz liés à une classe, quiz du professeur Premium, édition étendue

> Aucune nouvelle collection Firestore, aucune migration de données, aucun nouvel index.
> **`firestore.rules` est modifié** (blocs `quizzes` et `quizzes_v2`) → à déployer avec `npm run deploy:rules`.
> Les quiz existants restent valides tels quels : tous les champs exploités (`status`, `groupeId`, `afficherCorpus`, `corpusText`) existaient déjà, en option, dans le type `Quiz`.
> Retour arrière : `git checkout -- .` (avant commit) ou annuler le commit de la phase, puis redéployer les règles (sauvegarde : version précédente de `firestore.rules` dans Git).

## 1. Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/services/quizCibleService.ts` | **nouveau** | `getCiblesQuiz()` (groupes actifs — tous pour l'admin, les siens pour le prof ; groupes archivés déjà liés conservés), `libelleCible()` |
| `src/components/quiz/EditeurQuestionsClassiques.tsx` | **nouveau** | Éditeur de questions QCM partagé admin / prof ; `validerQuestionsClassiques()` |
| `src/styles/EditeurQuestionsClassiques.css` | **nouveau** | Styles commentés, préfixe `.eqc-`, mobile ≤ 640 px, mode sombre |
| `src/components/admin/QuizManager.tsx` | modifié | Statut, classe / groupe ciblé, texte support, éditeur partagé, badges + filtre « Classe / groupe », confirmation avant d'abandonner des modifications |
| `src/styles/admin.css` | modifié (ajout en fin de fichier) | `.quiz-card-cible`, `.quiz-badge-brouillon`, `.quiz-badge-cible`, `.quiz-form-aide`, `.quiz-form-check` |
| `src/pages/QuizEditorPage.tsx` | modifié | Quiz avancés (admin) : groupes libellés « Nom (niveau) · Prof », groupe archivé déjà lié conservé |
| `src/components/quiz/QuizEditor.tsx` | modifié | Props optionnelles `libelleSansGroupe`, `classeObligatoire`, `groupeIdParDefaut` (défauts = comportement inchangé) |
| `src/pages/ProfQuizAvanceCreatePage.tsx` / `ProfQuizAvanceEditPage.tsx` | modifiés | Classe obligatoire pour publier (§ 5 bis B) |
| `src/pages/QuizAdvancedList.tsx` | modifié | Badge 👥 de la classe liée |
| `src/pages/ProfQuizClassicCreatePage.tsx` | modifié | Éditeur partagé, validation complète à la publication, aide sur la classe |
| `src/pages/ProfQuizClassicEditPage.tsx` | modifié | Idem + classe archivée déjà liée conservée |
| `src/pages/ProfQuizPage.tsx` | modifié | Badge « 👥 Classe » ou « 🌍 Tous les élèves » sur chaque quiz |
| `src/services/quizService.ts` | modifié | Retrait des valeurs `undefined` avant écriture (correctif) |
| `src/services/quizGratuitService.ts` | modifié | Page publique « Quiz gratuits » : brouillons et quiz de classe exclus |
| `firestore.rules` | modifié | Écritures professeur sur `quizzes` / `quizzes_v2` durcies (§ 5) ; profils `users` protégés contre l'auto-promotion (§ 5 bis) |

Aucune route ajoutée ou retirée, aucune signature de fonction existante modifiée, aucun lecteur de quiz (`QuizPlayer`) touché.

## 2. Fonctionnalité 1 — Lier un quiz à une classe ou à un groupe

- **Admin, quiz classiques** (`/admin/quiz` → Modifier / Nouveau Quiz) : nouveau champ **« Classe / groupe ciblé »**. *Tous les élèves (quiz global)* (défaut, comportement historique) ou n'importe quel groupe actif de la plateforme, libellé « Nom (niveau) · Professeur ».
- **Admin, quiz avancés** (`/admin/quiz-avance`) : le sélecteur existait déjà ; ses libellés indiquent désormais le niveau et le professeur, et l'option vide s'intitule « Tous les élèves (quiz global) ».
- **Professeur** : sélecteur « Classe » inchangé, limité à ses propres groupes, avec une phrase d'aide. Sans aucune classe, un encadré prévient que le quiz publié sera visible par **tous** les élèves.
- **Effet côté élève** : aucun code élève modifié. Le filtrage par `groupeId` existait déjà (`getQuizzesForEleve`, `getQuizzesAvanceForEleve`, `quizUnifiedService`). Un quiz lié n'apparaît qu'aux élèves inscrits à ce groupe.
- **Page publique « Quiz gratuits »** : elle listait jusqu'ici aussi les brouillons et les quiz réservés à une classe ; ils en sont désormais exclus.
- **Listes** : badge 👥 sur les cartes admin (classiques et avancés) et sur « Mes quiz » du prof ; filtre « Classe / groupe » dans les filtres admin.
- **Groupe archivé** : un quiz déjà lié à un groupe archivé garde son lien (le groupe reste affiché dans le sélecteur au lieu d'être délié sans que personne ne le voie).

## 3. Fonctionnalité 2 — Quiz du professeur Premium

L'existant est conservé (`/prof/quiz`, boutons « Quiz classique » / « Quiz avancé », accès Premium contrôlé dans l'interface). Cette phase :
- **corrige un bug bloquant** : un professeur Premium **sans classe** ne pouvait enregistrer aucun quiz classique (`groupeId: undefined`, rejeté par Firestore) ;
- lui donne le **même éditeur de questions que l'admin** (§ 4) ;
- impose **côté serveur** que seul un professeur Premium actif crée des quiz, et seulement à son nom (§ 5).

## 4. Fonctionnalité 3 — Édition étendue (quiz classiques)

Composant `EditeurQuestionsClassiques`, utilisé par l'admin et par le professeur :

| Action | Comment |
|---|---|
| Réordonner les questions | Boutons ↑ ↓ (toujours visibles) ou glisser-déposer par la poignée ⠿ (souris) |
| Insérer une question à un endroit précis | « Insérer une question après » |
| Dupliquer / supprimer | Confirmation avant suppression d'une question non vide ; au moins 1 question conservée |
| Options de réponse | De **2 à 6** options, ajout, retrait, ↑ ↓ ; la bonne réponse suit son texte |
| Explication, difficulté, points (1–20) | Par question (le prof n'avait que l'énoncé et les options) |
| Actions groupées | Appliquer une difficulté ou un barème à toutes les questions |
| Lisibilité | Tout déplier / tout replier ; question incomplète signalée (⚠ + liseré ambre) ; total des points |

**En plus, côté admin** (formulaire de quiz) :
- **Statut** *Publié / Brouillon* : un brouillon est masqué aux élèves et peut être enregistré incomplet ; un quiz publié est validé entièrement (énoncés, options non vides, bonne réponse définie).
- **Texte support** : affichage d'un corpus pendant le quiz (champs Phase 35 jusqu'ici réservés au générateur IA).
- **Annuler** demande confirmation s'il y a des modifications non enregistrées.
- La propriété d'un quiz de professeur (`profId`) n'est jamais modifiée par l'admin.

Compatibilité : les lecteurs affichent `question.options.map(...)` et corrigent par index, donc un nombre d'options différent de 4 fonctionne sans modification.

## 5. Sécurité

### Règles Firestore (`quizzes`, `quizzes_v2`)
| Opération | Avant | Après |
|---|---|---|
| Lecture | — | **inchangée** |
| Création | tout professeur, sans contrôle du propriétaire | admin, **ou** professeur **Premium actif** (`isProfPremiumActif()`, déjà utilisée en Phase 43) créant à **son nom** (`profId` / `auteurId` = son uid) |
| Mise à jour | prof propriétaire, pouvait réécrire `profId` / `auteurId` | prof propriétaire, **propriété non modifiable** ; abonnement expiré → peut toujours modifier ses quiz |
| Lien à un groupe (prof) | aucun contrôle | uniquement vers un groupe **dont il est propriétaire** (contrôle fait seulement si `groupeId` change ; un groupe supprimé ne bloque pas) |
| Suppression | — | **inchangée** |

Les chemins existants ont été vérifiés : création classique / avancée prof, générateur IA (`profId` renseigné), rattachement à une séance de cahier (groupe du cahier du prof), écritures admin.

### Inscription, connexion, navigation
**Code non modifié** : `AuthContext`, `LoginPage`, pages d'inscription, `ProtectedRoute` / `ProfRoute` / `AdminRoute`, `App.tsx`. Seule la règle Firestore `users` est durcie (§ 5 bis), sans changer le parcours d'inscription ni de connexion.

## 5 bis. Correctifs de sécurité complémentaires (failles antérieures)

### A. Auto-promotion via le profil utilisateur — **corrigée** (`firestore.rules`, bloc `users`)
Avant : tout utilisateur pouvait créer ou modifier son propre profil avec `role: 'admin'`, `isPremium: true`, un `subscriptionEnd` lointain… (simple appel Firestore depuis la console du navigateur).
Après :
- **création autonome** (inscription email / Google) : rôle limité à `eleve`, `prof`, `parent` ; `isPremium` obligatoirement `false` ; champs `subscriptionEnd`, `subscriptionPlan`, `isActive` interdits ;
- **mise à jour par l'utilisateur** : tout reste modifiable (nom, photo, sexe, `lastLogin`, streak, compteurs d'usage, cours choisis, code parent…) **sauf** `role`, `isPremium`, `subscriptionEnd`, `subscriptionPlan`, `isActive`, `emailVerificationRequired`, `createdAt` ;
- **admin** : droits inchangés (création de comptes Phase 57, octroi / retrait Premium, rôles, activation).

Chemins vérifiés dans le code : `AuthContext.createOrUpdateUserDoc` (inscription, Google, `lastLogin`), `adminUsersService.creerCompte`, `userService` (fonctions admin), `progressionService` (streak), `premiumProService` (usage), `premiumCoursService` (cours choisis), `parentService` (code parent).
Effet de bord voulu : un utilisateur ne peut plus effacer lui-même `emailVerificationRequired` pour contourner la vérification d'email.

### B. Option « Toutes mes classes » des quiz avancés prof — **corrigée**
Elle enregistrait `groupeId = null`, ce qui rendait le quiz visible par **tous** les élèves de PedaClic. Désormais, côté professeur (`classeObligatoire`), la classe est **obligatoire pour publier** (comme pour les quiz classiques) ; un brouillon reste enregistrable sans classe ; un prof sans classe est averti que son quiz sera public. Depuis une séance de cahier, la classe de la séance est présélectionnée. Admin : inchangé.

Fichiers : `src/components/quiz/QuizEditor.tsx` (props optionnelles `classeObligatoire`, `groupeIdParDefaut`), `src/pages/ProfQuizAvanceCreatePage.tsx`, `src/pages/ProfQuizAvanceEditPage.tsx` (classe archivée déjà liée conservée).

### C. Lecture d'un quiz lié à une classe par un non-membre — **non corrigée dans cette phase**
Voir le compte rendu : nécessite une restructuration (collection d'appartenance aux groupes + requêtes élèves scindées + migration).

### Tests complémentaires
- [ ] Inscription élève, prof et parent (email + Google) → compte créé, email de vérification reçu, connexion après vérification.
- [ ] Connexion d'un compte existant (élève, prof, parent, admin) → OK (`lastLogin` mis à jour).
- [ ] Console navigateur d'un élève connecté : `updateDoc(doc(db,'users',uid),{role:'admin'})` → **permission-denied** ; idem `isPremium: true`.
- [ ] Admin : créer un compte, octroyer / retirer Premium, changer un rôle, désactiver → OK.
- [ ] Élève : streak, quota de ressources, choix de cours à la carte, code parent → OK.
- [ ] Prof : quiz avancé sans classe → « Publier » refusé avec message ; brouillon accepté ; avec classe → publié et visible de cette classe uniquement.

## 6. Test en local

```bash
git checkout -b phase60-quiz-classes-edition   # emporte les modifications non commitées
npm run dev
```
Admin dans une fenêtre normale, prof Premium dans une autre, élève en navigation privée.

### Lien classe / groupe
- [ ] Admin : modifier « Quiz IA — Travail et puissance » → lier à un groupe → Enregistrer → badge 👥 sur la carte ; filtre « Classe / groupe » OK.
- [ ] Élève **inscrit** au groupe : le quiz apparaît. Élève **non inscrit** : il n'apparaît plus.
- [ ] Repasser à « Tous les élèves » → de nouveau visible par tous (selon Gratuit / Premium).
- [ ] Page « Quiz gratuits » : un quiz lié à un groupe ou en brouillon n'y figure plus.
- [ ] Quiz avancé admin : libellés « Nom (niveau) · Prof », option « Tous les élèves (quiz global) ».

### Professeur Premium
- [ ] Prof **sans classe** : création d'un quiz classique → enregistrement OK (bug corrigé), encadré d'avertissement visible.
- [ ] Prof avec classes : création + publication → visible par sa classe uniquement ; badge 👥 dans « Mes quiz ».
- [ ] Prof **non Premium** : `/prof/quiz` affiche toujours l'écran « Fonctionnalité Premium ».
- [ ] Générateur IA (prof Premium) : génération et sauvegarde d'un quiz OK.
- [ ] Cahier de textes : « Créer un quiz » depuis une séance → quiz créé **et** rattaché.

### Édition étendue
- [ ] ↑ ↓ et glisser-déposer → ordre conservé après enregistrement et dans le lecteur élève.
- [ ] 2, 3, 5 ou 6 options → l'élève voit le bon nombre d'options ; correction juste.
- [ ] Retirer l'option correcte → la 1re devient correcte ; retirer une option avant → la bonne réponse reste la même.
- [ ] Actions groupées (difficulté, points) ; total des points mis à jour.
- [ ] Admin : brouillon incomplet enregistrable ; publication bloquée avec message « Question n : … ».
- [ ] Admin : modifier puis « Annuler » → demande de confirmation ; sans modification → fermeture directe.
- [ ] Admin : texte support coché → visible pendant le quiz élève.
- [ ] Mobile (≤ 640 px) et mode sombre lisibles.

### Non-régression
- [ ] Inscription, connexion, déconnexion, redirections par rôle inchangées.
- [ ] Aperçu et suppression des quiz admin ; quiz avancés (création, médias, types de questions) inchangés.
- [ ] Anciens quiz (sans `status` ni `groupeId`) : affichage et lecture inchangés.

### Build de production en local
```bash
npm run build && npm run preview
```

## 7. Mise en production

```bash
npm run deploy:rules   # règles Firestore : la CLI compile les règles avant publication
npm run deploy:prod    # ou votre script habituel
```
> Déployez les règles **avec** le code : un professeur qui utiliserait une ancienne version en cache n'est pas gêné (ses écritures étaient déjà à son nom).
