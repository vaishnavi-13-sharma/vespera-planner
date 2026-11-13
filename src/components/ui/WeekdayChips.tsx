import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../../context/VesperaContext';

/** Toggle chips for weekdays (0 = Sunday … 6 = Saturday), shown Monday-first. */
export function WeekdayChips({ value, onChange, label = 'Repeat on' }: { value: number[]; onChange: (days: number[]) => void; label?: string }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_LONG[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              on ? 'ornate-border bg-burgundy text-vanilla' : 'border border-rose/25 text-taupe hover:text-vanilla'
            }`}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}
