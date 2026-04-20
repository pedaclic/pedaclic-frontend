import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// ── Création du contexte ───────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── ThemeProvider : enveloppe l'application et fournit le thème ────────────
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialisation depuis localStorage (persistance du choix utilisateur)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('pedaclic-theme') as Theme;
    return saved || 'light';
  });

  // Applique l'attribut data-theme sur <html> et sauvegarde dans localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pedaclic-theme', theme);
  }, [theme]);

  // Bascule entre light et dark
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ── Hook personnalisé useTheme ─────────────────────────────────────────────
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé à l\'intérieur d\'un ThemeProvider');
  }
  return context;
};

export default ThemeContext;
