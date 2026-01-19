# 📚 Tableau de Bord de Planification de Contenus Pédagogiques

## 🎯 Description

Application React professionnelle pour gérer les programmes scolaires de la 6ème à la Terminale avec visualisations graphiques et exports Excel/Google Sheets.

---

## ✨ Fonctionnalités principales

### 📊 Gestion complète
- **7 niveaux** : 6ème, 5ème, 4ème, 3ème, Seconde, Première, Terminale
- **3 trimestres** par année scolaire
- **9 disciplines** : Français, Mathématiques, Histoire-Géo, SVT, Physique-Chimie, Anglais, EPS, Arts, Technologie

### 📝 Planification détaillée
Pour chaque combinaison Niveau × Trimestre × Discipline :
- Thèmes et chapitres
- Objectifs d'apprentissage
- Compétences visées
- Évaluations prévues
- Ressources pédagogiques
- Statut (Non commencé / En cours / Terminé)
- Pourcentage de progression

### 📈 Visualisations graphiques
- **Graphique en barres** : Progression par niveau
- **Graphique circulaire** : Contenus terminés par discipline
- **Graphique en ligne** : Taux de complétion par trimestre
- **Cartes de statistiques** : Vue d'ensemble rapide

### 💾 Export de données
- **Export Excel** : Fichier CSV avec tous les contenus
- **Export Google Sheets** : Compatible pour import direct
- Format structuré avec en-têtes
- Encodage UTF-8 avec BOM pour les accents

---

## 🚀 Installation rapide

### 1. Installer les dépendances

```bash
npm install lucide-react recharts
```

### 2. Copier le fichier

Placez `PlanificationContenus.jsx` dans votre dossier `src/components/admin/`

### 3. Créer la route

```javascript
// App.js
import PlanificationContenus from './components/admin/PlanificationContenus';

<Route path="/admin/planification" element={<PlanificationContenus />} />
```

### 4. Lancer l'application

```bash
npm start
```

Accédez à : `http://localhost:3000/admin/planification`

---

## 📦 Dépendances

| Package | Version | Usage |
|---------|---------|-------|
| `react` | ^18.0.0 | Framework UI |
| `lucide-react` | ^0.263.1 | Icônes modernes |
| `recharts` | ^2.5.0 | Graphiques interactifs |
| `react-router-dom` | ^6.0.0 | Navigation (optionnel) |
| `firebase` | ^10.0.0 | Sauvegarde cloud (optionnel) |

---

## 🎨 Caractéristiques du design

### Interface moderne
- **Palette de couleurs** : Dégradés bleu/vert professionnels
- **Typographie** : Police Archivo (Google Fonts)
- **Glassmorphism** : Effets de transparence et flou
- **Animations** : Transitions fluides et élégantes

### Responsive
- Adapté mobile, tablette et desktop
- Grilles flexibles avec CSS Grid
- Graphiques redimensionnables automatiquement

### Interactions
- Effets de survol sur les cartes
- Animations d'apparition des éléments
- Feedback visuel sur les actions

---

## 📂 Structure du code

```
PlanificationContenus.jsx
├── Composant principal (PlanificationContenus)
│   ├── État et logique métier
│   ├── Calcul des statistiques
│   ├── Préparation des données graphiques
│   └── Export Excel/CSV
│
├── Composants d'interface
│   ├── StatCard (Cartes de statistiques)
│   ├── NavButton (Boutons de navigation)
│   └── ChampTexte (Champs de formulaire)
│
└── Vues
    ├── VuePlanification (Formulaire de saisie)
    └── VueTableauDeBord (Graphiques)
```

---

## 🔧 Configuration

### Personnaliser les disciplines

```javascript
const DISCIPLINES = [
  'Français',
  'Mathématiques',
  'Histoire-Géo',
  'SVT',
  'Physique-Chimie',
  'Anglais',
  'EPS',
  'Arts',
  'Technologie',
  'Philosophie',     // Ajouter ici
  'Économie'         // Ajouter ici
];
```

### Changer les couleurs

```javascript
const COULEURS = [
  '#2E5077',  // Bleu foncé
  '#4A7BA7',  // Bleu moyen
  '#6FA8DC',  // Bleu clair
  // Ajoutez vos couleurs
];
```

### Intégration Firebase (optionnelle)

Voir le guide d'intégration complet dans `GUIDE_INTEGRATION.md` section "Intégration Firebase".

---

## 📊 Données gérées

**Total de combinaisons** : 7 niveaux × 3 trimestres × 9 disciplines = **189 entrées**

**Structure d'une entrée** :
```javascript
{
  themes: "Les figures de style, La poésie romantique",
  objectifs: "Identifier et analyser les principales figures de style",
  competences: "Analyse littéraire, Rédaction argumentée",
  evaluations: "Contrôle continu (coef 1), Dissertation finale (coef 2)",
  ressources: "Manuel Hatier p.45-78, Exercices PedaClic",
  statut: "en-cours",
  progression: 65
}
```

---

## 🎓 Utilisation

### 1. Planification

1. Sélectionnez le **niveau** (ex: 6ème)
2. Choisissez le **trimestre** (ex: Trimestre 1)
3. Sélectionnez la **discipline** (ex: Français)
4. Remplissez les champs du formulaire
5. Définissez le **statut** et la **progression**

### 2. Visualisation

Cliquez sur **"Tableau de bord"** pour voir :
- La progression globale par niveau
- Les contenus terminés par discipline
- Le taux de complétion par trimestre

### 3. Export

- **Excel** : Télécharge un fichier CSV
- **Google Sheets** : Télécharge un CSV + instructions d'import

---

## 🔐 Sécurité

### Protection des routes

```javascript
<ProtectedRoute requiredRole="admin">
  <PlanificationContenus />
</ProtectedRoute>
```

### Règles Firestore

```javascript
// firestore.rules
match /planifications/{document=**} {
  allow read, write: if request.auth != null 
                      && request.auth.token.role == 'admin';
}
```

---

## 🐛 Dépannage

### Problème : Erreur d'import

```bash
# Vérifier les dépendances
npm list lucide-react recharts

# Réinstaller si nécessaire
npm install lucide-react recharts --force
```

### Problème : Export CSV vide

Vérifiez que les données sont bien remplies dans l'état `contenus`.

```javascript
console.log('Contenus:', contenus);
```

### Problème : Graphiques ne s'affichent pas

Vérifiez l'import :
```javascript
import { BarChart, Bar, XAxis, YAxis, ... } from 'recharts';
```

---

## 🚀 Évolutions possibles

### Fonctionnalités
- [ ] Import depuis Excel/CSV
- [ ] Sauvegarde automatique dans Firebase
- [ ] Historique des modifications
- [ ] Notifications et rappels
- [ ] Export PDF stylisé
- [ ] Collaboration multi-utilisateurs
- [ ] Version mobile native (React Native)

### Améliorations techniques
- [ ] Tests unitaires (Jest)
- [ ] Tests d'intégration (Cypress)
- [ ] Optimisation des performances (React.memo)
- [ ] PWA (Progressive Web App)
- [ ] Mode hors ligne
- [ ] Accessibilité WCAG 2.1

---

## 📄 Fichiers fournis

| Fichier | Description |
|---------|-------------|
| `planification-contenus.jsx` | Application React complète |
| `GUIDE_INTEGRATION.md` | Guide d'intégration détaillé (20+ pages) |
| `README.md` | Ce fichier |

---

## 📞 Support

Pour toute question ou problème :
1. Consultez le `GUIDE_INTEGRATION.md` (section Dépannage)
2. Vérifiez la console navigateur pour les erreurs
3. Testez les dépendances : `npm list`

---

## 📜 Licence

Propriété de **PedaClic** - Tous droits réservés

---

## 🎉 Version

**Version** : 1.0  
**Date** : Janvier 2026  
**Compatibilité** : React 18+, Node 16+

---

**Créé avec ❤️ pour PedaClic** | L'école en un clic
