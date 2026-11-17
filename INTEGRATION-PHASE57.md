# 👥 PHASE 57 — Gestion des utilisateurs (admin) : élèves invisibles, historique, inscription & suppression

**Date :** novembre 2026 · **Branche conseillée :** `phase57-admin-utilisateurs` · **Statut :** prêt à tester (non commité, non déployé)

---

## 1. L'anomalie : pourquoi les élèves de 2nde S-B n'apparaissaient pas

Deux causes cumulées :

| # | Cause | Symptôme |
|---|---|---|
| 1 | `getUsers()` triait avec `orderBy('displayName')`. Firestore **exclut silencieusement** d'une requête triée tout document qui n'a pas le champ de tri. | Écart « 187 Total comptes » / « 185 utilisateur(s) au total » : 2 comptes sans `displayName` étaient invisibles. |
| 2 | Les élèves inscrits par un prof **sans compte PedaClic** (saisie manuelle ou import en lot → inscription *offline*) n'existent que dans `inscriptions_groupe`, jamais dans `users`. La liste admin ne lisait que `users`. | « 347 Élèves en classe » mais seulement 171 comptes élèves : les élèves sans compte (ex. ceux sans email dans la liste de classe) n'apparaissaient nulle part côté admin. |

**Correctifs :** lecture complète de `users` + tri côté client ; fusion dans le tableau des élèves sans compte (badge orange **Sans compte**, avec leur classe).

---

## 2. Ce qui est ajouté

- **Colonnes** `Classe(s)` et `Inscription` (date) dans le tableau.
- **Recherche** par nom, email **ou classe** (taper « 2nde S-B »).
- **Filtres** : *Type* (avec compte / sans compte), *Classe*, *Trier par* (nom ou date d'inscription, récents d'abord).
- **Historique** dans le panneau *Détail* : date d'inscription sur PedaClic, dernière connexion, chaque classe rejointe avec sa date et son mode (via code / par le professeur).
- **Inscrire un utilisateur** : nom, email, mot de passe provisoire (généré), rôle, sexe, classe optionnelle. L'admin **reste connecté** (instance Firebase secondaire en mémoire). Les identifiants sont affichés à la fin pour être transmis.
- **Supprimer** (icône 🗑) :
  - *compte* : retrait de toutes ses classes, suppression du profil, blocage de la reconnexion (collection `comptes_supprimes`). Quiz et notes **conservés**. Impossible sur son propre compte.
  - *élève sans compte* : retrait de sa classe.

> ⚠️ Le compte **Firebase Authentication** ne peut être effacé que côté serveur. Pour libérer l'adresse email : Firebase Console › Authentication › supprimer l'utilisateur.

---

## 3. Fichiers

| Fichier | État | Rôle |
|---|---|---|
| `src/services/adminUsersService.ts` | **nouveau** | inscriptions par compte, élèves sans compte, création, suppression |
| `src/services/userService.ts` | modifié | `getUsers()` sans `orderBy` + tri client ; champs `lastLogin`, `sexe`, `sourceCreation` sur `User` |
| `src/components/admin/UserManager.tsx` | modifié | colonnes, filtres, historique, modales création / suppression / détail élève sans compte |
| `src/contexts/AuthContext.tsx` | modifié | bloque la recréation du profil d'un compte supprimé |
| `src/firebase.ts` | modifié | `firebaseConfig` exporté (seul ajout : le mot `export`) |
| `src/styles/admin.css` | modifié | bloc « PHASE 57 » ajouté en fin de fichier |
| `firestore.rules` | modifié | admin peut créer `users/{uid}` ; nouvelle collection `comptes_supprimes` |
| `firestore-rules-backup-phase56.txt` | nouveau | sauvegarde des règles avant modification |

Aucune fonctionnalité existante retirée, aucune migration de données.

---

## 4. Intégration pas à pas

```bash
cd ~/Developer/PedaClic-deploy
git checkout -b phase57-admin-utilisateurs
git add -A && git status          # vérifier la liste ci-dessus
```

1. **Déployer les règles EN PREMIER** (sinon création/suppression refusées) :
   ```bash
   firebase deploy --only firestore:rules
   ```
2. **Tester en local** :
   ```bash
   npm run dev
   ```
   Connecté en admin → `Utilisateurs › Tous les utilisateurs` :
   - le sous-titre affiche « N utilisateur(s) au total (dont X élève(s) sans compte) » ;
   - Filtres › Classe › *2nde S-B* : tous les élèves de la classe apparaissent ;
   - *Détail* d'un compte : section **Historique** ;
   - *Inscrire un utilisateur* avec un email de test + classe → l'admin reste connecté, le compte apparaît dans la classe ;
   - se connecter avec ce compte dans une fenêtre privée → OK ;
   - le supprimer (🗑) puis tenter de se reconnecter → « Ce compte a été désactivé. »
3. **Build & déploiement** :
   ```bash
   npm run build
   git commit -m "feat(admin): élèves sans compte visibles, historique, inscription/suppression (Phase 57)"
   npm run deploy
   ```

### Retour arrière
```bash
cp firestore-rules-backup-phase56.txt firestore.rules && firebase deploy --only firestore:rules
git checkout main
```

---

## 5. Points d'attention

- **App Check** : la création de compte réutilise la clé reCAPTCHA. Si l'application stricte (*enforcement*) est activée sur Authentication et qu'une création échoue en production, vérifier la console du navigateur.
- **Élève sans compte → compte** : créer le compte via *Inscrire un utilisateur* (avec la même classe), puis retirer l'ancienne ligne *Sans compte* si le prof n'a pas de notes à conserver sur celle-ci.
