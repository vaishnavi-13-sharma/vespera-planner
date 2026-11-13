import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { dailyFive, useVespera } from '../../context/VesperaContext';
import { Sheet } from '../ui/Sheet';
import { DailyFive } from './DailyFive';
import './study.css';

/** The "Study" pill in the Pinboard header: shows how many cards are due and opens Daily 5. */
export function StudyButton() {
  const { state, today } = useVespera();
  const [open, setOpen] = useState(false);
  const due = dailyFive(state, today, Infinity).length;

  return (
    <>
      <button
        type="button"
        aria-label={`Study · ${due} due`}
        onClick={() => setOpen(true)}
        title="Study"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-gold/30 px-3 text-xs text-gold transition hover:border-gold hover:bg-gold/10"
      >
        <BookOpen aria-hidden size={14} />
        {/* In a narrow Pinboard column (an @container), the pill keeps just its book and count. */}
        <span className="@max-[26rem]:hidden">Study</span>
        {due > 0 && (
          <span aria-hidden className="study-badge -mr-1 rounded-full bg-burgundy px-1.5 text-[0.65rem] leading-4 text-vanilla">
            {due}
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Daily 5">
        <DailyFive onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
