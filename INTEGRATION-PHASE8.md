# 📊 PHASE 8 — Dashboard Professeurs : Guide d'Intégration

**Date :** Février 2026  
**Version :** 1.0.0  
**Statut :** Prêt pour intégration

---

## 📋 Fichiers livrés

| Fichier | Emplacement | Description |
|---------|------------|-------------|
| `profService.ts` | `src/services/profService.ts` | Service de récupération et calcul des statistiques prof |
| `ProfDashboard.tsx` | `src/components/prof/ProfDashboard.tsx` | Composant principal avec 5 onglets |
| `prof.css` | `src/styles/prof.css` | Styles dédiés (responsive) |
| `INTEGRATION-PHASE8.md` | Racine du projet | Ce guide |

---

## 🚀 Étapes d'intégration

### Étape 1 — Copier les fichiers

```bash
# Créer le dossier prof dans components
mkdir -p src/components/prof

# Copier les fichiers aux bons emplacements
cp profService.ts    src/services/profService.ts
cp ProfDashboard.tsx src/components/prof/ProfDashboard.tsx
cp prof.css          src/styles/prof.css
```

### Étape 2 — Vérifier les imports dans profService.ts

Le service importe Firebase depuis le chemin relatif. Vérifiez que le chemin correspond à votre structure :

```typescript
// Dans src/services/profService.ts, ligne 28 :
import { db } from '../firebase';
// OU si votre firebase.ts est dans src/services/ :
// import { db } from './firebase';
```

**Ajustez le chemin si nécessaire** selon votre arborescence réelle.

### Étape 3 — Vérifier les imports dans ProfDashboard.tsx

```typescript
// Dans src/components/prof/ProfDashboard.tsx :

// Import du service (chemin relatif depuis components/prof/)
import { ... } from '../../services/profService';

// Import du hook auth
import { useAuth } from '../../hooks/useAuth';

// Import des styles
import '../../styles/prof.css';
```

**Ajustez les chemins** si votre structure diffère de celle documentée.

### Étape 4 — Ajouter la route dans App.tsx

Ouvrez `src/App.tsx` et ajoutez la route du dashboard prof :

```tsx
// 1. Import du composant
import ProfDashboard from './components/prof/ProfDashboard';

// 2. Ajouter la route (dans le bloc Routes)
{/* Prof protégé — ajouter après les routes élèves */}
<Route 
  path="/prof/dashboard" 
  element={
    <Layout>
      <ProfDashboard />
    </Layout>
  } 
/>
```

#### Option recommandée : Protéger la route avec ProfRoute

Si vous avez un composant `AdminRoute` dans `AuthContext.tsx`, créez un composant `ProfRoute` similaire :

```tsx
// Dans src/contexts/AuthContext.tsx, ajouter :

/**
 * Route protégée pour les professeurs
 * Redirige vers / si l'utilisateur n'est pas prof ou admin
 */
export const ProfRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }
  
  // Les admins ET les profs ont accès
  if (!currentUser || (currentUser.role !== 'prof' && currentUser.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};
```

Puis utilisez-le dans App.tsx :

```tsx
import { ProfRoute } from './contexts/AuthContext';

<Route 
  path="/prof/dashboard" 
  element={
    <ProfRoute>
      <Layout>
        <ProfDashboard />
      </Layout>
    </ProfRoute>
  } 
/>
```

### Étape 5 — Modifier la navigation du Header

Dans `src/components/Header.tsx`, mettez à jour la logique de redirection pour inclure le rôle `prof` :

```tsx
// AVANT (actuel) :
const dashboardLink = currentUser?.role === 'eleve' ? '/eleve/dashboard' : '/admin';

// APRÈS (avec prof) :
const getDashboardLink = () => {
  if (!currentUser) return '/connexion';
  switch (currentUser.role) {
    case 'eleve': return '/eleve/dashboard';
    case 'prof':  return '/prof/dashboard';
    case 'admin': return '/admin';
    default:      return '/';
  }
};
const dashboardLink = getDashboardLink();
```

**Appliquez cette même logique** partout où le lien "Tableau de bord" ou "Accéder à mon espace" est utilisé, y compris dans la page d'accueil (Home.tsx).

### Étape 6 — Mettre à jour les règles Firestore

Les professeurs doivent pouvoir lire la collection `quiz_results` et la collection `users` (rôle élève). Vérifiez vos règles Firestore :

```rules
// Collection quiz_results — les profs peuvent lire tous les résultats
match /quiz_results/{resultId} {
  allow read: if isSignedIn() && (isAdmin() || isProf() || isOwner(resource.data.userId));
  allow create: if isSignedIn() && isEleve() && request.auth.uid == request.resource.data.userId;
}

// Collection users — les profs peuvent lire les profils élèves
match /users/{userId} {
  allow read: if isOwner(userId) || isAdmin() || isProf();
  // ... (garder les règles write existantes)
}

// Collection matieres — les profs peuvent lire
match /matieres/{matiereId} {
  allow read: if isSignedIn();
  // ... (garder les règles write existantes)
}
```

### Étape 7 — Tester

```bash
# 1. Démarrer le serveur de développement
npm run dev

# 2. Se connecter avec un compte prof
# Email: prof@pedaclic.sn (ou votre compte prof test)

# 3. Vérifier :
#    - Le lien "Tableau de bord" redirige vers /prof/dashboard
#    - L'onglet "Vue d'ensemble" affiche les stats globales
#    - L'onglet "Par discipline" montre les cartes discipline
#    - L'onglet "Par élève" liste les élèves avec recherche/filtre
#    - Le clic sur "Détail" ouvre la fiche élève
#    - L'onglet "Par quiz" montre les analyses
#    - L'onglet "Alertes" identifie les élèves < 40%
#    - Le responsive fonctionne sur mobile
```

### Étape 8 — Déployer

```bash
# Build de production
npm run build

# Vérifier la build
npx serve dist

# Déployer sur GitHub Pages
npm run deploy
```

---

## 🏗️ Architecture technique

### Flux de données

```
Firestore                    profService.ts                ProfDashboard.tsx
┌──────────────┐            ┌──────────────────┐          ┌──────────────────┐
│ quiz_results │──getDocs──▶│ getAllQuizResults │──state──▶│                  │
│ users        │──getDocs──▶│ getAllEleves      │──state──▶│  useMemo() pour  │
│ matieres     │──getDocs──▶│ getAllDisciplines │          │  calculs cachés  │
└──────────────┘            │                  │          │                  │
                            │ calculer*()      │◀─appel──│  5 onglets       │
                            │ analyser*()      │          │  + vue détail    │
                            │ detecter*()      │──retour─▶│                  │
                            │ generer*()       │          │  recharts pour   │
                            └──────────────────┘          │  les graphiques  │
                                                          └──────────────────┘
```

### Choix techniques

1. **Pas de nouvelle collection Firestore** — Toutes les stats sont calculées côté client à partir de `quiz_results` + `users` + `matieres`. Cela évite la duplication et la synchronisation.

2. **useMemo() pour les calculs** — Les fonctions de calcul (moyennes, tendances, alertes) sont mémorisées et ne recalculent que quand les données brutes changent.

3. **Chargement parallèle** — `Promise.all()` pour récupérer `quiz_results` et `users` simultanément.

4. **Recharts pour les graphiques** — Déjà installé dans le projet, utilisé pour AreaChart (progression), BarChart (comparaisons), PieChart (répartition).

5. **CSS dédié avec variables globales** — Le fichier `prof.css` utilise les variables CSS définies dans `globals.css` pour garantir la cohérence visuelle avec le reste de PedaClic.

---

## 📐 Fonctionnalités par onglet

### Onglet 1 — Vue d'ensemble
- 6 cartes KPI : élèves inscrits, quiz passés, moyenne générale, taux réussite, élèves en difficulté, quiz aujourd'hui
- Graphique AreaChart : progression des 30 derniers jours (moyenne + nombre de quiz)
- Graphique PieChart : répartition des quiz par discipline
- Indicateur de tendance (hausse/baisse/stable) sur la moyenne

### Onglet 2 — Par discipline
- Cartes discipline avec : nombre d'élèves, quiz passés, moyenne, taux de réussite, barre de progression, min/max
- Graphique BarChart comparatif des moyennes et taux de réussite

### Onglet 3 — Par élève
- Barre de recherche par nom/email
- Filtre par discipline
- Tableau : nom, quiz passés, moyenne (colorée), réussite, tendance, date dernier quiz
- Ligne rouge pour les élèves en difficulté
- **Vue détaillée** (clic sur "Détail") :
  - Avatar + infos
  - 4 cartes stats
  - Graphique BarChart par discipline
  - Historique complet des quiz (tableau)

### Onglet 4 — Par quiz
- Cartes quiz avec : nombre de passages, moyenne, taux de réussite, temps moyen, min/max
- Graphique BarChart horizontal comparatif (top 10 quiz)

### Onglet 5 — Alertes
- Bandeau rouge avec compteur
- Carte par élève en difficulté : avatar, moyenne, quiz passés, disciplines faibles (tags rouges)
- Bouton "Voir le détail" redirige vers l'onglet Élèves

---

## 🎨 Design & Responsive

Le design suit les conventions PedaClic :
- **Palette** : bleu (#3b82f6), vert (#10b981), orange (#f59e0b), rouge (#ef4444), violet (#8b5cf6)
- **Cards blanches** avec `box-shadow` et `border-radius: 12px`
- **Breakpoints** :
  - Desktop (> 1024px) : grilles 3-4 colonnes
  - Tablette (768-1024px) : grilles 2 colonnes
  - Mobile (< 768px) : 1 colonne, onglets icônes-only, filtres empilés
  - Petit mobile (< 480px) : marges et polices réduites

---

## 🔮 Évolutions futures

1. **Export PDF/CSV** des statistiques (bouton déjà prévu dans le design)
2. **Notion de classes assignées** — Filtrer les résultats par les classes du prof
3. **Notifications push** quand un élève passe sous 40%
4. **Analyse par question** — Identifier les questions les plus échouées
5. **Comparaison inter-périodes** — Comparer deux mois entre eux
6. **Cache local** — Mettre en cache les résultats pour réduire les lectures Firestore

---

## 📝 Résumé des modifications

| Fichier | Action | Détail |
|---------|--------|--------|
| `src/services/profService.ts` | **CRÉER** | Service complet de stats prof |
| `src/components/prof/ProfDashboard.tsx` | **CRÉER** | Dashboard 5 onglets |
| `src/styles/prof.css` | **CRÉER** | Styles dédiés responsive |
| `src/App.tsx` | **MODIFIER** | Ajouter route `/prof/dashboard` |
| `src/contexts/AuthContext.tsx` | **MODIFIER** | Ajouter `ProfRoute` |
| `src/components/Header.tsx` | **MODIFIER** | Logique 3 rôles pour lien dashboard |
| `firestore.rules` | **MODIFIER** | Lecture `quiz_results` + `users` pour profs |

---

**Phase 8 complète.** ✅ Bonne intégration !
