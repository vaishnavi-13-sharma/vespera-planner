import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'danger';
}

/** A small ⋯ menu. The trigger's accessible name is `label`. */
export function Menu({ label, items, trigger }: { label: string; items: MenuItem[]; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1 text-taupe transition hover:bg-vanilla/5 hover:text-vanilla"
      >
        {trigger ?? <MoreHorizontal aria-hidden size={16} />}
      </button>
      {open && (
        <ul role="menu" aria-label={label} className="velvet-card absolute right-0 z-30 mt-1 min-w-44 overflow-hidden p-1 text-sm">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`w-full rounded-lg px-3 py-1.5 text-left transition hover:bg-vanilla/5 ${
                  item.tone === 'danger' ? 'text-rose' : 'text-vanilla'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
