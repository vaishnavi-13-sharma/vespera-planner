import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EditScope } from '../../context/VesperaContext';
import { trapTab } from './focusTrap';
import { isTopOverlay, popOverlay, pushOverlay } from './overlayStack';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  tone?: 'primary' | 'danger';
}

/** The question asked when editing or deleting one occurrence of a repeating block. */
export const EDIT_SCOPE_CHOICES: Choice<EditScope>[] = [
  { value: 'this', label: 'Just this one', description: 'Only this date changes.', tone: 'primary' },
  { value: 'future', label: 'This and all future', description: 'This date and every one after it. Past ones stay as they were.' },
];

/** A small centered question with a few answers plus Cancel. */
export function ChoiceDialog<T extends string>({
  open,
  title,
  message,
  choices,
  onChoose,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  choices: Choice<T>[];
  onChoose: (value: T) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const overlay = pushOverlay();
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!isTopOverlay(overlay)) return;
      if (e.key === 'Escape') onCancelRef.current();
      else trapTab(e, panelRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popOverlay(overlay);
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-espresso/75 backdrop-blur-sm" onClick={onCancel} />
      <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="velvet-card relative flex w-full max-w-sm flex-col gap-3 p-5">
        <h2 id={titleId} className="font-serif text-2xl text-gold">
          {title}
        </h2>
        {message && <p className="subheading">{message}</p>}
        <div className="flex flex-col gap-2">
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChoose(c.value)}
              className={`flex flex-col items-start rounded-xl border px-4 py-2.5 text-left transition ${
                c.tone === 'danger'
                  ? 'border-rose/40 text-rose hover:bg-rose/10'
                  : c.tone === 'primary'
                    ? 'border-gold/60 bg-gold/10 text-gold hover:bg-gold/20'
                    : 'border-gold/25 text-vanilla hover:border-gold/60'
              }`}
            >
              <span className="font-serif text-lg">{c.label}</span>
              {c.description && <span className="text-xs text-taupe">{c.description}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="min-h-11 self-end px-3 text-sm text-taupe transition hover:text-vanilla">
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
