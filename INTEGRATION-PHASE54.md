# 💬 PHASE 54 — Bannière colorée & Espace classe : Guide d'intégration

**Date :** novembre 2026 · **Branche :** `phase54-communication` · **Statut :** prêt à tester

---

## 1. Ce qui change

### 1.1 Bannière « Aujourd'hui » du Cahier de textes
| Situation du cours | Libellé | Couleur |
|---|---|---|
| Non saisi, en cours ou à venir | ＋ Séance à saisir | **bleu** `#2563eb` |
| Non saisi, horaire **passé** | ＋ Séance à saisir | **rouge** `#dc2626` |
| Saisi à l'avance (statut *Planifié*) | 🕒 titre de la séance | **orange** `#d97706` |
| Saisi (réalisé, annulé, reporté) | ✓ titre de la séance | vert (inchangé) |

Pour les jours passés, tout cours non saisi passe en rouge ; pour aujourd'hui, le rouge apparaît dès la fin du créneau.

### 1.2 Espace classe (nouvelle collection `messages_classe`)
| Rubrique | Professeur | Élève |
|---|---|---|
| 📢 Annonces (date/heure d'événement, « important », épinglage) | rédige, épingle, supprime | lit |
| 💬 Forum de classe (public) | écrit, modère (supprime) | lit **et écrit**, supprime ses messages |
| ✉️ Messages privés | écrit à **un** élève | lit (aucune réponse privée possible) |

### 1.3 Notifications élèves (cloche existante, canal in-app)
- nouvelle annonce → tous les élèves du groupe ;
- message privé → l'élève visé ;
- message du prof dans le forum → tout le groupe ;
- message d'un élève dans le forum → **uniquement le professeur** (les camarades voient la pastille rouge « non lus ») ;
- séance **saisie**, **planifiée** ou **mise à jour** (éditeur ou changement rapide de statut) → les groupes du cahier, **seulement si le cahier est partagé**. Anti-rafale : 1 notification max par séance toutes les 15 min.

Les notifications ne bloquent jamais l'enregistrement : en cas d'erreur, la séance ou le message est quand même sauvegardé.

---

## 2. Fichiers

| Fichier | État | Rôle |
|---|---|---|
| `src/components/prof/EdtAujourdhui.tsx` | modifié | code couleur des statuts |
| `src/styles/EmploiDuTemps.css` | modifié | classes `--en-retard`, `--planifiee` (+ thème sombre) |
| `src/types/communication.types.ts` | **nouveau** | modèle `MessageClasse` |
| `src/services/communicationService.ts` | **nouveau** | publication, écoute temps réel, notifications |
| `src/hooks/useNonLus.ts` | **nouveau** | pastilles « non lus » (mémorisées dans le navigateur) |
| `src/components/communication/FilMessages.tsx` | **nouveau** | affichage annonces / forum / privés |
| `src/components/communication/ComposerMessage.tsx` | **nouveau** | formulaire de rédaction |
| `src/pages/ProfCommunicationPage.tsx` | **nouveau** | `/prof/communication` |
| `src/pages/EleveCommunicationPage.tsx` | **nouveau** | `/eleve/communication` |
| `src/styles/Communication.css` | **nouveau** | styles commentés, responsive, thème sombre |
| `src/types/notification_types.ts` | modifié | types `seance_cahier`, `message_forum` |
| `src/pages/EntreeEditorPage.tsx`, `CahierDetailPage.tsx` | modifiés | appel non bloquant `notifierElevesSeance()` |
| `src/App.tsx` | modifié | 2 routes |
| `src/pages/CahierTextesPage.tsx` | modifié | bouton « 💬 Espace classe » |
| `src/pages/ElveCahiersListePage.tsx`, `src/components/Header.tsx` | modifiés | accès élève |
| `firestore.rules` | modifié | bloc `messages_classe` + création de notification « forum » par un élève |
| `firestore.indexes.json` | modifié | 3 index `messages_classe` |

---

## 3. Étapes d'intégration

### Étape 1 — Relire et tester en local
```bash
cd ~/Developer/PedaClic-deploy
git status                      # branche phase54-communication
git diff                        # relecture des fichiers modifiés
npm run dev                     # http://localhost:5173
```

### Étape 2 — Déployer d'abord les règles et index Firestore
```bash
npm run deploy:rules
```
⏳ Les 3 index peuvent prendre 1 à 5 min à se construire : tant qu'ils ne sont pas prêts, l'Espace classe affiche « Lecture des messages impossible ».

### Étape 3 — Scénario de test
1. **Prof** → `/prof/cahiers` : vérifier les couleurs bleu / rouge / orange (naviguer sur « Semaine préc. » pour voir du rouge).
2. **Prof** → bouton **💬 Espace classe** → choisir un groupe → publier une annonce avec date d'événement.
3. **Élève** (autre navigateur) → cloche 🔔 : notification « 📢 … » → clic → arrive sur l'onglet Annonces.
4. **Élève** → onglet Forum → écrire → le prof reçoit une notification « 💬 Forum … ».
5. **Prof** → Messages privés → choisir l'élève → envoyer → l'élève le voit dans « Messages du prof », sans pouvoir répondre en privé.
6. **Prof** → saisir une séance dans un cahier **partagé** → l'élève reçoit « 📒 Nouvelle séance … ».

### Étape 4 — Mise en production
```bash
git add -A
git commit -m "feat(cahiers): bannière colorée + espace classe & notifications élèves (Phase 54)"
git checkout main && git merge phase54-communication
npm run deploy:prod
```

---

## 4. Notes techniques
- **Confidentialité** : un message privé n'est lisible que par le prof auteur et l'élève visé (règle Firestore). Les annonces et le forum sont lisibles par un utilisateur connecté qui interroge l'identifiant du groupe — même niveau que `groupes_prof`.
- **Appartenance** : un élève ne peut écrire dans un forum qu'en fournissant son `inscriptionId` actif, vérifié côté règles.
- **Aucun e-mail automatique** : toutes les notifications Phase 54 sont `in_app` (pas de charge Resend).
- Le compositeur de notifications existant (`/prof/notifications/nouvelle`) reste inchangé ; il propose simplement deux types de plus dans sa liste.
