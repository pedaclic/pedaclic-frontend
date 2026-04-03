import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastMessage extends ToastOptions {
  id: string;
}

interface ToastContextType {
  toast: (options: ToastOptions | string) => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

// ── Contexte ───────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ── ToastProvider : affiche les notifications en bas à droite ──────────────
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Ajoute un toast et le supprime automatiquement après la durée définie
  const toast = useCallback((options: ToastOptions | string) => {
    const opts = typeof options === 'string'
      ? { message: options, type: 'info' as ToastType }
      : options;
    const id = Date.now().toString();
    const duration = opts.duration ?? 3000;

    setToasts(prev => [...prev, { ...opts, id, type: opts.type ?? 'info' }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Couleurs selon le type de notification
  const bgColor: Record<ToastType, string> = {
    success: '#22c55e',
    error:   '#ef4444',
    warning: '#f59e0b',
    info:    '#3b82f6',
  };

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      {/* Conteneur des toasts — position fixe en bas à droite */}
      <div style={{
        position: 'fixed', bottom: '1rem', right: '1rem',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem'
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              padding: '0.75rem 1.25rem', borderRadius: '0.5rem', color: 'white',
              backgroundColor: bgColor[t.type ?? 'info'],
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ── Hook useToast ──────────────────────────────────────────────────────────
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider");
  return context;
};

export default ToastContext;
