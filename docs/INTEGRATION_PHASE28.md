# PHASE 28 — GUIDE D'INTÉGRATION COMPLET
# YouTube Live Simplifié — PedaClic
# www.pedaclic.sn

---

## APERÇU DE LA PHASE

### Ce qui est livré
Système de sessions en direct YouTube, intégré nativement dans PedaClic.
Aucune dépendance tierce payante — YouTube Live est gratuit.

### Flux utilisateur
```
PROF
  1. Crée sa session YouTube en direct dans YouTube Studio
  2. Copie le lien YouTube Live
  3. Crée la session sur /prof/live (formulaire)
  4. Notifie ses élèves automatiquement (Phase 26 ✅)
  5. Passe le statut "En direct" au moment du démarrage
  6. Passe en "Terminé" à la fin → replay disponible immédiatement

ÉLÈVE
  1. Reçoit une notification in-app + email avec le lien
  2. Ouvre /live → voit la session en carte
  3. Clique → lit le live embedé dans pedaclic.sn
  4. Peut regarder le replay après la fin (même URL)
```

### Fichiers livrés

| Fichier              | Rôle                                              |
|----------------------|---------------------------------------------------|
| `live_types.ts`      | Types TypeScript, constantes, valeurs initiales   |
| `liveService.ts`     | CRUD Firestore + notifications (Phase 26)         |
| `LivePage.tsx`       | Page catalogue + lecteur élève (/live)            |
| `ProfLivePage.tsx`   | Dashboard prof — créer et gérer les sessions      |
| `Live.css`           | Tous les styles (catalogue, cartes, formulaire)   |

---

## ÉTAPE 1 — COPIER LES FICHIERS

Structure à plat dans `src/` (convention PedaClic) :

```bash
cp live_types.ts      src/
cp liveService.ts     src/
cp LivePage.tsx       src/
cp ProfLivePage.tsx   src/
cp Live.css           src/
```

---

## ÉTAPE 2 — IMPORTER LE CSS

Dans `main.tsx` ou `globals.css` :

```tsx
// main.tsx
import './Live.css';
```

---

## ÉTAPE 3 — AJOUTER LES ROUTES (App.tsx)

```tsx
// ── Imports à ajouter ────────────────────────────────────────
import LivePage     from './LivePage';
import ProfLivePage from './ProfLivePage';

// ── Routes à ajouter dans <Routes> ───────────────────────────

// Page catalogue + lecteur (catalogue sur /live, lecteur sur /live/:sessionId)
<Route
  path="/live"
  element={<PrivateRoute><Layout><LivePage /></Layout></PrivateRoute>}
/>
<Route
  path="/live/:sessionId"
  element={<PrivateRoute><Layout><LivePage /></Layout></PrivateRoute>}
/>

// Dashboard professeur
<Route
  path="/prof/live"
  element={<ProfRoute><Layout><ProfLivePage /></Layout></ProfRoute>}
/>
```

> `PrivateRoute`, `ProfRoute` et `Layout` = vos composants existants.

---

## ÉTAPE 4 — LIENS DE NAVIGATION

### Header / Navbar (visible par tous les élèves connectés)
```tsx
{ path: '/live', label: 'Sessions Live', icon: '🔴' }
```

### Dashboard Professeur
```tsx
// Dans le tableau de liens/boutons premium du prof :
{
  path:           '/prof/live',
  label:          'Sessions Live',
  icon:           '📺',
  requirePremium: true,
  requireRole:    ['prof'],
}

// Ou bouton direct :
<button onClick={() => navigate('/prof/live')}>
  📺 Mes sessions live
</button>
```

### Notification dans le Header (bonus)
Si une session est en direct, afficher un badge rouge :
```tsx
// Dans Header.tsx, vous pouvez faire une requête Firestore légère
// pour détecter les sessions en_direct et afficher un badge :
import { collection, query, where, getDocs } from 'firebase/firestore';

const [enDirect, setEnDirect] = useState(false);
useEffect(() => {
  const q = query(
    collection(db, 'live_sessions'),
    where('statut', '==', 'en_direct')
  );
  getDocs(q).then(s => setEnDirect(!s.empty));
}, []);

// Dans le JSX :
<Link to="/live">
  🔴 Live {enDirect && <span className="badge-danger">EN DIRECT</span>}
</Link>
```

---

## ÉTAPE 5 — RÈGLES FIRESTORE

Ajouter dans `firestore.rules` (avant le `deny all`) :

```
// ==================== PHASE 28 — SESSIONS LIVE ====================

match /live_sessions/{sessionId} {
  // Lecture publique — toute personne connectée peut voir les sessions
  allow read: if isSignedIn();

  // Création — prof Premium uniquement
  allow create: if isSignedIn()
    && request.resource.data.profId == request.auth.uid
    && isProf();

  // Modification / suppression — prof propriétaire ou admin
  allow update, delete: if isSignedIn() && (
    resource.data.profId == request.auth.uid || isAdmin()
  );
}
```

Déployer les règles :
```bash
firebase deploy --only firestore:rules
```

---

## ÉTAPE 6 — INDEX FIRESTORE

Créer ces deux index composites dans la console Firebase
→ Firestore → Index → Add composite index :

### Collection `live_sessions`

| Champ 1   | Ordre      | Champ 2     | Ordre       |
|-----------|------------|-------------|-------------|
| `statut`  | Ascending  | `dateDebut` | Descending  |
| `profId`  | Ascending  | `dateDebut` | Descending  |

> 💡 Astuce : si vous ne créez pas les index manuellement,
> Firebase génère un lien cliquable dans la console du navigateur
> lors de la première erreur. Cliquez ce lien pour créer
> l'index automatiquement.

---

## ÉTAPE 7 — VÉRIFIER L'INTÉGRATION AVEC LA PHASE 26

Le service `liveService.ts` appelle `envoyerNotificationGroupe()`
et `envoyerNotification()` depuis `notificationService.ts` (Phase 26).

Vérifiez que les fonctions suivantes sont bien exportées
dans votre `notificationService.ts` :

```typescript
export async function envoyerNotificationGroupe(groupeId, payload): Promise<void>
export async function envoyerNotification(payload): Promise<void>
```

Si vos fonctions ont des noms différents, adapter les imports
dans `liveService.ts` lignes 18-19.

---

## ÉTAPE 8 — GUIDE D'UTILISATION PROF

### Créer une session live (étape par étape)

**1. Créer le live sur YouTube Studio**
```
https://studio.youtube.com
→ Créer → Diffuser en direct
→ Choisir "Diffusion planifiée" ou "Immédiate"
→ Copier l'URL de la vidéo (exemple : https://youtu.be/XXXX)
```

**2. Créer la session sur PedaClic**
```
/prof/live → Nouvelle session
→ Remplir le formulaire
→ Coller l'URL YouTube copiée à l'étape 1
→ Cocher "Notifier les élèves" si désiré
→ Cliquer "Créer la session"
```

**3. Au moment de démarrer le live**
```
/prof/live → Carte de la session → bouton "Démarrer"
→ Passe le statut à "En direct"
→ Les élèves voient le badge rouge clignotant
```

**4. Après la session**
```
/prof/live → Carte → bouton "Terminer"
→ Le replay devient immédiatement accessible
→ L'URL YouTube reste la même (YouTube archive automatiquement)
```

### Formats d'URL YouTube acceptés

```
✅ https://www.youtube.com/watch?v=dQw4w9WgXcQ
✅ https://youtu.be/dQw4w9WgXcQ
✅ https://www.youtube.com/live/dQw4w9WgXcQ
✅ https://www.youtube.com/embed/dQw4w9WgXcQ
```

---

## ÉTAPE 9 — ROADMAP VERS MUX (Phase future)

Quand PedaClic aura une base d'abonnés suffisante,
la migration vers Mux se fera en remplaçant :

```typescript
// Aujourd'hui (Phase 28) :
urlYoutube: string;
youtubeId:  string;  // embed YouTube gratuit

// Futur (Phase Mux) :
muxStreamKey:    string;  // Clé RTMP pour OBS
muxPlaybackId:   string;  // ID de lecture Mux
muxSignedUrl?:   string;  // URL signée pour contenu Premium
```

La structure de `LiveSession`, les pages et le service
sont déjà conçus pour faciliter cette migration :
seul le player (iframe YouTube → video.js + hls.js) changera.

---

## RÉCAPITULATIF COMPLET

```
src/
├── live_types.ts         ← Types TypeScript (LiveSession, StatutLive, etc.)
├── liveService.ts        ← CRUD Firestore + helpers + notifications
├── LivePage.tsx          ← Catalogue /live + Lecteur /live/:sessionId
├── ProfLivePage.tsx      ← Dashboard /prof/live
└── Live.css              ← Tous les styles

App.tsx                   ← +2 routes publiques +1 route prof
firestore.rules           ← +règles live_sessions
firebase indexes          ← +2 index composites
```

### Coût total de cette phase : **0 FCFA**
YouTube Live est gratuit. Aucune API externe.
Tout fonctionne avec Firebase + Railway déjà en place.
