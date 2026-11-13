import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Default 6 seconds. */
  durationMs?: number;
}

type ShowToast = (toast: ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** `const showToast = useToast(); showToast({ message: 'Skipped', actionLabel: 'Undo', onAction })` */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastOptions & { id: number })[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (toast) => {
      const id = nextId.current++;
      setToasts((all) => [...all, { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.durationMs ?? 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id} className="velvet-card pointer-events-auto flex items-center gap-4 px-4 py-2.5 text-sm text-vanilla">
              <span>{t.message}</span>
              {t.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                  className="font-semibold text-gold transition hover:text-vanilla"
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
