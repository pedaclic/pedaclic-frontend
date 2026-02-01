# PedaClic - Phase 5 : Pages et Services Complets

## 📋 Fichiers Créés

### Services (src/services/)
| Fichier | Description |
|---------|-------------|
| `DisciplineService.ts` | Requêtes Firestore pour les disciplines |
| `ResourceService.ts` | Requêtes Firestore pour les ressources |

### Contextes (src/contexts/)
| Fichier | Description |
|---------|-------------|
| `AuthContext.tsx` | Contexte d'authentification Firebase |

### Composants (src/components/)
| Fichier | Description |
|---------|-------------|
| `layout/Navbar.tsx` | Barre de navigation responsive |
| `layout/Navbar.css` | Styles de la navbar |
| `layout/Footer.tsx` | Pied de page avec newsletter |
| `layout/Footer.css` | Styles du footer |
| `auth/PrivateRoute.tsx` | Protection des routes |

### Pages (src/pages/)
| Fichier | Description |
|---------|-------------|
| `HomePage.tsx` | Page d'accueil |
| `styles/HomePage.css` | Styles page d'accueil |
| `disciplines/DisciplinesPage.tsx` | Liste des disciplines |
| `disciplines/DisciplinesPage.css` | Styles liste disciplines |
| `disciplines/DisciplineDetailPage.tsx` | Détail d'une discipline |
| `disciplines/DisciplineDetailPage.css` | Styles détail discipline |
| `premium/PremiumPage.tsx` | Page Premium + PayTech |
| `premium/PremiumPage.css` | Styles page Premium |
| `premium/PaymentSuccessPage.tsx` | Confirmation paiement |
| `premium/PaymentCancelPage.tsx` | Annulation paiement |
| `premium/PaymentResult.css` | Styles résultats paiement |

### Configuration
| Fichier | Description |
|---------|-------------|
| `App.tsx` | Routes et layout principal |

---

## 🚀 Instructions d'Intégration

### 1. Copier les fichiers
Copiez tous les fichiers dans votre projet existant :
```bash
# Depuis le dossier téléchargé
cp -r src/* /chemin/vers/votre/projet/src/
```

### 2. Structure des dossiers requise
```
src/
├── App.tsx
├── main.tsx
├── firebase.ts              # Votre config Firebase
├── index.ts                 # Interfaces TypeScript
├── globals.css              # Variables CSS globales
├── components/
│   ├── auth/
│   │   └── PrivateRoute.tsx
│   └── layout/
│       ├── Navbar.tsx
│       ├── Navbar.css
│       ├── Footer.tsx
│       └── Footer.css
├── contexts/
│   └── AuthContext.tsx
├── pages/
│   ├── HomePage.tsx
│   ├── styles/
│   │   └── HomePage.css
│   ├── disciplines/
│   │   ├── DisciplinesPage.tsx
│   │   ├── DisciplinesPage.css
│   │   ├── DisciplineDetailPage.tsx
│   │   └── DisciplineDetailPage.css
│   └── premium/
│       ├── PremiumPage.tsx
│       ├── PremiumPage.css
│       ├── PaymentSuccessPage.tsx
│       ├── PaymentCancelPage.tsx
│       └── PaymentResult.css
└── services/
    ├── DisciplineService.ts
    └── ResourceService.ts
```

### 3. Installer les dépendances
```bash
npm install react-router-dom
```

### 4. Variables d'environnement (.env)
```env
# Firebase
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre_project_id
VITE_FIREBASE_STORAGE_BUCKET=votre_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# PayTech
VITE_PAYTECH_API_KEY=votre_api_key_paytech
VITE_PAYTECH_API_SECRET=votre_api_secret_paytech
VITE_PAYTECH_ENV=test

# API (si backend séparé)
VITE_API_URL=https://votre-api.com
```

### 5. Modifier le basename du Router
Dans `App.tsx`, ajustez le `basename` selon votre déploiement :
```tsx
// Pour GitHub Pages avec repo "pedaclic"
<Router basename="/pedaclic">

// Pour un domaine racine
<Router>
```

### 6. Activer les pages d'authentification
Décommentez les imports et routes dans `App.tsx` pour vos pages auth existantes.

---

## 🎨 Design System

### Palette de couleurs
```css
/* Bleu primaire */
--color-primary: #2563eb;
--color-primary-dark: #1e40af;

/* Vert secondaire */
--color-secondary: #059669;
--color-secondary-dark: #047857;

/* Or Premium */
--color-premium: #fbbf24;

/* Texte */
--color-text: #1f2937;
--color-text-light: #6b7280;

/* Fond */
--color-bg: #ffffff;
--color-bg-secondary: #f3f4f6;
```

### Espacements
```css
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;
--spacing-xl: 2rem;
--spacing-2xl: 3rem;
```

### Bordures
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

---

## 📱 Fonctionnalités Implémentées

### Page d'accueil
- ✅ Hero section avec CTA
- ✅ Statistiques animées
- ✅ Grille des niveaux (6ème-Terminale)
- ✅ Section Premium avec avantages
- ✅ Témoignages d'élèves

### Page Disciplines
- ✅ Chargement dynamique depuis Firestore
- ✅ Filtres par niveau et classe
- ✅ Compteur de ressources par discipline
- ✅ Design responsive

### Page Détail Discipline
- ✅ Affichage en accordéon par chapitre
- ✅ Filtre par type de ressource
- ✅ Distinction gratuit/Premium (cadenas)
- ✅ CTA Premium pour non-abonnés

### Page Premium
- ✅ Plans mensuel (2000 FCFA) et annuel (20000 FCFA)
- ✅ Intégration PayTech
- ✅ Comparaison Gratuit vs Premium
- ✅ FAQ interactive
- ✅ Pages de confirmation/annulation

---

## 🔒 Sécurité

### Règles Firestore recommandées
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Disciplines : lecture publique
    match /disciplines/{docId} {
      allow read: if true;
      allow write: if request.auth != null 
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Ressources : lecture conditionnelle
    match /resources/{docId} {
      allow read: if !resource.data.isPremium 
        || (request.auth != null 
          && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isPremium == true);
      allow write: if request.auth != null 
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'prof'];
    }
  }
}
```

---

## 🧪 Test

### Compte test recommandé
- Email: `test@pedaclic.sn`
- Password: `Test1234!`
- Role: `eleve`

### Compte admin
- Email: `admin@pedaclic.sn`
- Password: `Admin1234!`
- Role: `admin`

---

## 📝 Prochaines étapes

1. **ResourceDetailPage** - Page de visualisation d'une ressource
2. **Pages d'authentification** - LoginPage, RegisterPage (si non existantes)
3. **DashboardPage** - Tableau de bord élève avec progression
4. **AdminPage** - Gestion des contenus
5. **Mode hors-ligne** - Persistance Firestore

---

Développé pour **PedaClic** 🇸🇳
"L'école en un clic"
