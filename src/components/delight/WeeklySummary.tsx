import { Flame } from 'lucide-react';
import { addDays, formatDateKey, useVespera, weekCandles, weeklySummary } from '../../context/VesperaContext';
import './delight.css';

/** "3h 20m", "45m" or "2h". */
function formatFocus(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 && `${h}h`, (m > 0 || h === 0) && `${m}m`].filter(Boolean).join(' ');
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Last week's parchment recap, shown once per new week. */
export function WeeklySummary() {
  const { state, today, dismissWeeklySummary } = useVespera();
  const recap = weeklySummary(state, today);
  if (!recap) return null;

  const parts = [
    `${count(recap.candles, 'candle')} lit`,
    recap.quests > 0 && count(recap.quests, 'quest'),
    recap.focusMinutes > 0 && `${formatFocus(recap.focusMinutes)} of focus`,
    recap.cards > 0 && count(recap.cards, 'card'),
  ].filter(Boolean);
  const days = weekCandles(state, addDays(recap.weekStart, 6));

  return (
    <aside role="note" aria-label="Last week" className="parchment-note mx-auto w-full max-w-2xl rounded-2xl px-4 py-4 text-ink sm:px-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <span aria-hidden className="wax-seal mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gold">
          <Flame size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="font-serif text-2xl font-semibold italic leading-tight text-burgundy">Your week in review</h2>
          <p className="text-sm leading-relaxed text-ink/85">{parts.join(' · ')}</p>
          <div aria-hidden className="mt-1 flex items-end gap-2.5">
            {days.map((d) => (
              <span key={d.date} className="flex flex-col items-center gap-1">
                <span className={`recap-flame ${d.lit ? '' : 'recap-flame-out'}`} />
                <span className="font-serif text-[0.65rem] leading-none text-ink/60">{formatDateKey(d.date, 'short')[0]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={dismissWeeklySummary}
          className="rounded-lg border border-burgundy/40 px-3 py-1.5 font-serif text-base italic text-burgundy transition hover:border-burgundy hover:bg-burgundy hover:text-parchment"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
