import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
/**
 * Variante visuelle du bouton de confirmation. Permet d'adapter la couleur
 * et l'icône de la modale au type d'action :
 *   - 'danger'  : suppression, désinscription (rouge)
 *   - 'warning' : action potentiellement risquée (orange)
 *   - 'info'    : action neutre (bleu)
 *   - 'success' : validation (vert)
 */
export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Phase 34 — variante du bouton de confirmation (rouge / orange / bleu / vert) */
  variant?: ConfirmVariant;
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

// ── Contexte ───────────────────────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmFunction | undefined>(undefined);

// ── ConfirmProvider : affiche une modale de confirmation ───────────────────
export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Ouvre la modale et retourne une Promise résolue au clic
  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise(resolve => setDialog({ options: opts, resolve }));
  }, []);

  const handleClose = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* Modale de confirmation — overlay sombre + boîte de dialogue */}
      {dialog && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem',
            maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
          }}>
            {/* Titre optionnel */}
            {dialog.options.title && (
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                {dialog.options.title}
              </h3>
            )}
            {/* Message principal */}
            <p style={{ margin: '0 0 1.5rem', color: '#6b7280', lineHeight: 1.6 }}>
              {dialog.options.message}
            </p>
            {/* Boutons Annuler / Confirmer */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleClose(false)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
                  border: '1px solid #d1d5db', backgroundColor: 'white',
                  cursor: 'pointer', color: '#374151', fontWeight: 500
                }}
              >
                {dialog.options.cancelLabel || 'Annuler'}
              </button>
              <button
                onClick={() => handleClose(true)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
                  border: 'none',
                  // Phase 34 — couleur adaptée à la variante
                  backgroundColor:
                    dialog.options.variant === 'danger'  ? '#dc2626' :
                    dialog.options.variant === 'warning' ? '#d97706' :
                    dialog.options.variant === 'success' ? '#16a34a' :
                                                           '#3b82f6',
                  color: 'white', cursor: 'pointer', fontWeight: 500
                }}
              >
                {dialog.options.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

// ── Hook useConfirm ────────────────────────────────────────────────────────
export const useConfirm = (): ConfirmFunction => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm doit être utilisé à l'intérieur d'un ConfirmProvider");
  return context;
};

export default ConfirmContext;
