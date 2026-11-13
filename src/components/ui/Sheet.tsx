import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { trapTab } from './focusTrap';
import { isTopOverlay, popOverlay, pushOverlay } from './overlayStack';

/** A mahogany drawer: slides in from the right on wide screens (≥1100px), up from the bottom on phones and tablets. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overlay = pushOverlay();
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!isTopOverlay(overlay)) return;
      if (e.key === 'Escape') onCloseRef.current();
      else trapTab(e, panelRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popOverlay(overlay);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center min-[1100px]:items-stretch min-[1100px]:justify-end">
      <div aria-hidden className="absolute inset-0 bg-espresso/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="velvet-card relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-b-none pb-[env(safe-area-inset-bottom)] outline-none min-[1100px]:max-h-none min-[1100px]:w-[420px] min-[1100px]:max-w-none min-[1100px]:rounded-r-none min-[1100px]:rounded-bl-[1.25rem] min-[1100px]:pb-0"
      >
        <div aria-hidden className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gold/30 min-[1100px]:hidden" />
        <header className="flex items-center justify-between gap-3 border-b border-gold/20 px-5 py-3">
          <h2 id={titleId} className="font-serif text-2xl text-gold">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-taupe transition hover:text-vanilla">
            <X aria-hidden size={20} />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-gold/20 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
