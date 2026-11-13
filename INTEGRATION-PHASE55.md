# 🗓️ PHASE 55 — Emploi du temps évolutif (créneaux datés) : Guide d'intégration

**Date :** novembre 2026 · **Branche conseillée :** `phase55-creneaux-dates` · **Statut :** prêt à tester (non commité, non déployé)

---

## 1. Ce qui change

### 1.1 Le principe
Chaque créneau peut désormais porter une **période de validité** : `valideDu` et `valideJusquAu` (format `YYYY-MM-DD`, bornes incluses, toutes deux optionnelles).

| Action du professeur | Effet sur l'emploi du temps | Effet sur les séances saisies |
|---|---|---|
| ✏️ Modifier **à partir du** 16 nov. | l'ancien créneau est clos le 15 nov., un nouveau démarre le 16 | aucune : elles restent rattachées à l'ancien horaire |
| ✏️ Modifier **sans date** | simple correction du créneau, sur toute sa période | aucune |
| ⏹ Arrêter à une date | le créneau est clos la veille | aucune |
| ＋ Ajouter avec « Valable à partir du » | le cours n'apparaît pas dans les semaines antérieures | aucune |
| 🗑 Supprimer (avec confirmation) | suppression définitive et rétroactive | aucune (elles restent dans le cahier) |

Les créneaux existants n'ont pas de dates : ils restent valables toute l'année. **Aucune migration de données.**

### 1.2 Tiroir « Mon emploi du temps »
- Onglet **Par classe** : bouton ✏️ sur chaque créneau ; le formulaire du bas passe en mode « Modifier le créneau » (fond bleu) avec le champ **Applicable à partir du**, et les boutons *Annuler*, *⏹ Arrêter à cette date*, *Enregistrer la modification*.
- Badges sur les cartes : **⏳ dès le 16 nov.** (changement programmé), **jusqu'au 15 nov.** (arrêt programmé).
- Les anciens créneaux sont masqués ; la case **Afficher les anciens créneaux (n)** les montre, grisés.
- Onglets **Ma semaine** / **Mon jour** : créneaux en vigueur et à venir uniquement ; le total d'heures ne compte que ceux valables aujourd'hui.
- Les alertes de chevauchement ignorent deux créneaux dont les périodes ne se croisent pas (ancien et nouvel horaire).

### 1.3 Bandeau « Mes cours de la semaine » (`/prof/cahiers`)
Chaque jour n'affiche que les créneaux valables **à cette date**. En remontant les semaines, on retrouve l'ancien emploi du temps avec ses séances « ✓ », sans fausse alerte rouge « ＋ Séance à saisir ».

---

## 2. Fichiers

| Fichier | État | Rôle |
|---|---|---|
| `src/types/emploiDuTemps.types.ts` | modifié | champs `valideDu`, `valideJusquAu` sur `Creneau` |
| `src/utils/emploiDuTempsUtils.ts` | modifié | logique pure : `creneauValideLe`, `situationCreneau`, `periodesSeCroisent`, `modifierCreneauAPartirDu`, `arreterCreneauAPartirDu` ; chevauchements par période |
| `src/components/prof/EmploiDuTempsDrawer.tsx` | modifié | ✏️ modification datée, arrêt, anciens créneaux, confirmation de suppression |
| `src/components/prof/EdtAujourdhui.tsx` | modifié | filtrage des créneaux par date affichée |
| `src/styles/EmploiDuTemps.css` | modifié | bloc « PHASE 55 » en fin de fichier (commenté, responsive, thème sombre) |

**Inchangés :** `firestore.rules`, `firestore.indexes.json`, `emploiDuTempsService.ts`, toutes les collections du cahier de textes. Les créneaux restent dans le tableau `creneaux` du même document `emplois_du_temps_prof/{id}`.

---

## 3. Intégration pas à pas

Les 5 fichiers sont déjà modifiés dans `PedaClic-deploy`, sur `main`, sans commit.

1. **Créer la branche** (les modifications suivent) :
   ```bash
   cd ~/Developer/PedaClic-deploy
   git checkout -b phase55-creneaux-dates
   git status   # 5 fichiers modifiés + ce guide
   ```
2. **Lancer en local** : `npm run dev`, puis ouvrir `/prof/cahiers`.
3. **Dérouler la recette** du § 4.
4. **Commiter** :
   ```bash
   git add -A
   git commit -m "feat(edt): créneaux datés, modification à partir d'une date (Phase 55)"
   ```
5. **Fusionner et déployer** (aucune règle ni index à publier) :
   ```bash
   git checkout main && git merge phase55-creneaux-dates
   git push
   npm run deploy:gh
   ```

**Retour arrière :** avant commit, `git checkout -- src/` ; après, `git revert`. Les champs `valideDu` / `valideJusquAu` déjà écrits sont simplement ignorés par l'ancienne version.

---

## 4. Recette (à faire sur une classe de test)

| # | Manipulation | Résultat attendu |
|---|---|---|
| 1 | Ouvrir le tiroir, onglet *Par classe* | les créneaux existants s'affichent comme avant, avec ✏️ et 🗑 |
| 2 | ✏️ sur un créneau qui a des séances saisies ; changer jour ou heure ; laisser la date du jour ; *Enregistrer* | le nouveau créneau apparaît ; l'ancien quitte la grille et rejoint les anciens créneaux |
| 3 | Bandeau : *‹ Semaine préc.* | l'ancien horaire est affiché avec ses séances « ✓ » ; aucun rouge sur le nouveau jour |
| 4 | Bandeau : *Semaine suiv. ›* | seul le nouvel horaire apparaît, en bleu « ＋ Séance à saisir » |
| 5 | ✏️ avec une date future (lundi prochain) | carte en pointillés « ⏳ dès le … » ; l'ancien porte « jusqu'au … » ; pas d'alerte de chevauchement entre les deux |
| 6 | ✏️ puis vider la date, corriger la salle | correction sur place, pas de nouveau créneau |
| 7 | ✏️ puis *⏹ Arrêter à cette date* | le créneau porte « jusqu'au … », puis rejoint les anciens |
| 8 | Cocher *Afficher les anciens créneaux* | cartes grisées « du … jusqu'au … », sans ✏️ |
| 9 | Ouvrir le cahier de la classe | toutes les séances antérieures sont intactes (dates, heures, contenus) |
| 10 | Thème sombre et mobile (≤ 640 px) | badges lisibles, boutons du formulaire en pleine largeur |

---

## 5. Vérifications déjà faites, et limites

- **Types** : `tsc` sans erreur sur les fichiers modifiés et leurs dépendances.
- **Logique** : tests automatiques de la logique pure (clôture la veille, enchaînement de plusieurs changements, correction sans date, arrêt, chevauchements par période, aucun `undefined` envoyé à Firestore).
- **Non fait** : `npm run build` et le contrôle visuel dans le navigateur (à faire aux étapes 2 et 3 du § 3).
- **Limite connue** : un changement d'horaire fait *avant* cette phase par suppression/recréation n'a pas d'historique ; on peut le reconstituer en ajoutant l'ancien créneau puis en l'arrêtant à la bonne date.
