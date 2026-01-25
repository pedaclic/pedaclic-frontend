# Conventions de Code PedaClic

## Nommage
- Composants : PascalCase (`DisciplineCard.tsx`)
- Hooks : camelCase avec préfixe `use` (`useFirestore.ts`)
- Constantes : UPPER_SNAKE_CASE (`API_BASE_URL`)
- Fichiers utils : camelCase (`formatDate.ts`)

## Structure Composant Type
```typescript
import React, { useState, useEffect } from 'react';
import './ComponentName.css';

interface ComponentProps {
  prop1: string;
  prop2: number;
}

export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // States
  const [data, setData] = useState<Type | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effects
  useEffect(() => {
    // Logic
  }, []);

  // Handlers
  const handleAction = async () => {
    try {
      setLoading(true);
      // Logic
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render states
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur : {error}</div>;

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
};
```