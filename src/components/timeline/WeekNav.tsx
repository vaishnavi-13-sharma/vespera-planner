import { useRef, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Sun } from 'lucide-react';
import { formatDateKey, type DateKey } from '../../context/VesperaContext';

const ARROW =
  'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/30 text-taupe transition hover:border-gold hover:text-gold';

/** ‹ seven dated tabs › plus a "Today" chip when the window has wandered off today. */
export function WeekNav({
  dates,
  value,
  today,
  busy,
  panelId,
  onSelect,
  onPage,
  onToday,
}: {
  dates: DateKey[];
  value: DateKey;
  today: DateKey;
  /** Dates that have at least one block, shown with a tiny gold dot. */
  busy: Set<DateKey>;
  panelId: string;
  onSelect: (date: DateKey) => void;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + dates.length) % dates.length;
    onSelect(dates[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <nav aria-label="Week" className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" aria-label="Previous week" onClick={() => onPage(-1)} className={ARROW}>
          <ChevronLeft aria-hidden size={18} />
        </button>

        <div role="tablist" aria-label="Day of the week" className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {dates.map((d, i) => {
            const selected = d === value;
            const isToday = d === today;
            const [weekday, day] = formatDateKey(d, 'tab').split(' ');
            return (
              <button
                key={d}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`${panelId}-tab-${d}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`relative flex flex-col items-center rounded-xl px-0.5 pb-2 pt-1.5 leading-none transition ${
                  selected ? 'ornate-border bg-burgundy shadow-[0_0_16px_color-mix(in_srgb,var(--color-burgundy)_60%,transparent)]' : 'hover:bg-vanilla/5'
                } ${isToday ? 'text-gold' : selected ? 'text-vanilla' : 'text-taupe hover:text-vanilla'}`}
              >
                <span className="text-[0.6rem] uppercase tracking-normal opacity-80">{weekday}</span>{' '}
                <span className="mt-1 font-serif text-xl">{day}</span>
                {busy.has(d) && <span aria-hidden className={`absolute bottom-1 h-1 w-1 rounded-full ${isToday ? 'bg-gold' : 'bg-rose/70'}`} />}
              </button>
            );
          })}
        </div>

        <button type="button" aria-label="Next week" onClick={() => onPage(1)} className={ARROW}>
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>

      {dates[0] !== today && (
        <button
          type="button"
          onClick={onToday}
          className="inline-flex items-center gap-1.5 self-center rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs text-gold transition hover:bg-gold/20"
        >
          <Sun aria-hidden size={12} />
          Today
        </button>
      )}
    </nav>
  );
}
