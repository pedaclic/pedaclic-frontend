# Architecture PedaClic

## Structure des Dossiers
```
src/
├── components/        # Composants réutilisables
├── pages/            # Pages principales
├── hooks/            # Custom hooks
├── services/         # Services Firebase
├── utils/            # Fonctions utilitaires
├── types/            # Interfaces TypeScript
└── styles/           # Styles globaux
```

## Routes Principales
- `/` - Page d'accueil
- `/dashboard` - Tableau de bord (role-based)
- `/disciplines` - Gestion disciplines (admin)
- `/resources/:id` - Ressources pédagogiques
- `/premium` - Page abonnement

## Rôles Utilisateurs
1. **admin** - Gestion complète
2. **prof** - Création contenu, consultation stats
3. **eleve** - Consultation contenu (Premium requis pour quiz)