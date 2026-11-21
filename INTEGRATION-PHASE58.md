# PedaClic — Phase 58 : Lien de séance & Médias partagés

> Aucune nouvelle collection Firestore, aucune migration, aucune modification
> de `firestore.rules`, `storage.rules` ni `firestore.indexes.json`.
> Retour arrière : annuler le commit de la phase.

## 1. Fichiers

| Fichier | Statut | Rôle |
|---|---|---|
| `src/utils/lienSeance.ts` | nouveau | Construction / copie du lien, défilement + halo |
| `src/utils/mediasCahier.ts` | nouveau | Index des ressources (pièces jointes, liens, ebooks) à partir des séances chargées |
| `src/components/prof/BoutonLienSeance.tsx` | nouveau | Bouton 🔗 (carte) et « Copier le lien » (éditeur) |
| `src/components/cahier/OngletMediasCahier.tsx` | nouveau | Onglet Médias, `mode="prof"` ou `mode="eleve"` (lecture seule) |
| `src/pages/SeanceLienPage.tsx` | nouveau | Route `/seance/:entreeId` → redirige vers la vue prof ou élève |
| `src/styles/Phase58.css` | nouveau | Styles préfixés (`lien-seance-`, `medias-`, `seance-cible-`) + mode sombre |
| `src/App.tsx` | modifié | + 1 import, + 1 route |
| `src/pages/CahierDetailPage.tsx` | modifié | Bouton 🔗, onglet Médias, lecture de `?seance=` |
| `src/pages/EntreeEditorPage.tsx` | modifié | Bouton « Copier le lien » (séance déjà enregistrée) |
| `src/pages/ElveCahierPage.tsx` | modifié | Ancre `data-entree-id`, `?seance=`, bascule Séances / Médias |

Lignes existantes modifiées : 6 (imports, type `VueActive`, garde + dépendances
de l'effet Phase 40, attribut de la carte élève). Aucune ligne de logique retirée.

## 2. Fonctionnement

- **Lien** : `https://pedaclic.sn/seance/<idSéance>` (un seul format pour tous).
  - prof propriétaire / admin → `/prof/cahiers/<cahier>?seance=<id>` ;
  - élève → `/eleve/cahiers/<cahier>?seance=<id>` ;
  - non connecté → `/connexion`, puis retour automatique (Phase 56) ;
  - séance non lisible (planifiée, cahier non partagé, autre classe) → message.
- **`?seance=`** : vue Liste, filtres remis à « tous », jour déplié, défilement et
  halo (classe `entree-focus` de la Phase 40), puis le paramètre est retiré de l'URL.
  Il est prioritaire sur la « dernière activité » de la Phase 40.
- **Médias** : l'index est recalculé à partir des séances déjà chargées (aucune lecture
  supplémentaire). Côté élève, ce sont les séances réalisées et partagées uniquement.
  Les élèves voient seulement « Ouvrir » ; pas de bouton de copie ni d'action d'édition.

> Limite : une URL de fichier Firebase Storage reste utilisable par quiconque la
> possède. L'interface n'offre aucun partage à l'élève, mais il peut copier
> l'adresse d'un fichier ouvert dans son navigateur.

## 3. Test en local

```bash
git checkout -b phase58-lien-medias   # emporte les modifications non commitées
npm run dev
```

Ouvrir le prof dans une fenêtre normale, un élève du groupe en navigation privée.

### Lien de séance
- [ ] Carte de séance : 🔗 ouvre la fenêtre ; « Copier » → toast + « Copié ✓ » ; Échap et clic extérieur ferment.
- [ ] Clic sur 🔗 ne déclenche aucune autre action de la carte.
- [ ] « Envoyer par WhatsApp » ouvre WhatsApp avec le titre + le lien.
- [ ] Éditeur « Modifier la séance » : bouton « Copier le lien » présent ; absent sur « Nouvelle séance ».
- [ ] Prof : coller le lien avec un filtre actif (ex. « Annulé », mois différent) → filtres remis, défilement + halo.
- [ ] Prof : lien d'une séance dans un jour replié → le jour se déplie.
- [ ] Élève connecté : la séance s'ouvre, défile, bandeau bleu.
- [ ] Élève déconnecté : connexion puis arrivée sur la séance.
- [ ] Élève + séance **planifiée** : bandeau orange « pas encore disponible ».
- [ ] Élève d'une autre classe / prof d'un autre cahier : page « Séance indisponible ».
- [ ] Lien d'une séance supprimée (prof) : toast « Séance introuvable ».

### Médias
- [ ] Onglet « 📎 Médias (n) » : compteur cohérent ; une ressource utilisée dans 2 séances apparaît une fois avec 2 pastilles.
- [ ] Filtres par type, recherche (nom de ressource ou titre de séance), tri.
- [ ] Clic sur une pastille de séance → retour à la Liste sur la bonne séance.
- [ ] « Ouvrir » (PDF, image, audio, lien externe, ebook) ; « Copier le lien » (prof).
- [ ] Élève : bascule « Séances / Médias » ; aucun bouton de copie ; seules les séances réalisées alimentent la liste.
- [ ] Mode sombre lisible ; affichage mobile (≤ 640 px) correct.

### Non-régression
- [ ] Ouverture d'un cahier **sans** `?seance=` : défilement Phase 40 vers la dernière activité.
- [ ] Filtres, tri, Navigation par mois, statuts rapides, Dupliquer, Supprimer.
- [ ] Onglets Calendrier, Travaux, Signets, Statistiques ; export PDF.
- [ ] Titres de rubrique cliquables (Phase 52), bandeau EDT du jour.
- [ ] Élève : filtres, signets d'évaluation, quiz de séance, lecteurs médias.

### Build de production en local
```bash
npm run build && npm run preview
# puis ouvrir http://localhost:4173/seance/<idSéance>
```

## 4. Mise en production

```bash
git add -A && git commit -m "feat(cahiers): lien de séance + médias partagés (Phase 58)"
git checkout main && git merge phase58-lien-medias
npm run deploy:prod
```
Aucune règle ni aucun index n'est modifié ; `deploy:prod` les redéploie à l'identique.
