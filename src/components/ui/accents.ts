import type { Accent } from '../../context/VesperaContext';

export const ACCENTS: Accent[] = ['gold', 'burgundy', 'rose', 'sage', 'taupe'];

/** Literal Tailwind classes per accent (kept literal so Tailwind can see them). */
export const ACCENT_STYLES: Record<Accent, { dot: string; text: string; border: string; soft: string; label: string }> = {
  gold: { dot: 'bg-gold', text: 'text-gold', border: 'border-gold', soft: 'bg-gold/10', label: 'Gold' },
  burgundy: { dot: 'bg-burgundy', text: 'text-rose', border: 'border-burgundy', soft: 'bg-burgundy/25', label: 'Burgundy' },
  rose: { dot: 'bg-rose', text: 'text-rose', border: 'border-rose', soft: 'bg-rose/10', label: 'Rose' },
  sage: { dot: 'bg-sage', text: 'text-sage', border: 'border-sage', soft: 'bg-sage/10', label: 'Sage' },
  taupe: { dot: 'bg-taupe', text: 'text-taupe', border: 'border-taupe', soft: 'bg-taupe/10', label: 'Taupe' },
};

/** Shared input styling for forms inside sheets and panels. */
export const FIELD_CLASS =
  'ornate-border rounded-lg bg-espresso/60 px-2.5 py-1.5 text-sm text-vanilla placeholder:text-taupe/60 focus:border-gold focus:outline-none';

export const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-burgundy px-3 py-2 text-sm text-vanilla transition hover:bg-burgundy/80 hover:text-gold';

export const QUIET_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gold/30 px-3 py-2 text-sm text-taupe transition hover:border-gold hover:text-vanilla';
