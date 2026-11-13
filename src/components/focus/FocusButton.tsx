import { useState } from 'react';
import { useVespera, type Occurrence } from '../../context/VesperaContext';
import { CandleGlyph } from './Candle';
import { FocusChooser } from './FocusChooser';

/** Matches the other actions on a Timeline block card; glows gold while this block's candle burns. */
const ACTION_BUTTON = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition hover:border-gold hover:text-gold';
const IDLE = 'border-rose/30 text-rose';
const BURNING = 'border-gold/70 text-gold shadow-[0_0_10px_color-mix(in_srgb,var(--color-gold)_35%,transparent)]';

/** The "Focus" button on a Timeline block; opens the chooser for a focus session. */
export function FocusButton({ occurrence }: { occurrence: Occurrence }) {
  const { state } = useVespera();
  const [open, setOpen] = useState(false);
  const burning = state.focusSession?.occurrenceKey === occurrence.key && state.focusSession.date === occurrence.date;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ACTION_BUTTON} ${burning ? BURNING : IDLE}`}
      >
        <CandleGlyph />
        Focus
      </button>
      {open && <FocusChooser occurrence={occurrence} onClose={() => setOpen(false)} />}
    </>
  );
}
