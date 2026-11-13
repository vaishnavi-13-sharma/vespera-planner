import { ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { formatDateKey, formatMonthKey, useVespera, type Category, type ChronicleEntry, type ChronicleMonth, type DateKey } from '../../context/VesperaContext';
import { WaxSeal } from '../signet/WaxSeal';
import { Sheet } from '../ui/Sheet';

/**
 * Finished quests, grouped by the day they were completed (newest first), each restorable.
 * Below them, the months older quests were folded into (see compact.ts): a quiet line per month
 * that opens to its counts per category and its titles. Archived quests can't be restored.
 */
export function ChronicleSheet({ onClose }: { onClose: () => void }) {
  const { state, restoreTask } = useVespera();

  const byDay = new Map<DateKey, ChronicleEntry[]>();
  for (const entry of state.chronicle) byDay.set(entry.completedOn, [...(byDay.get(entry.completedOn) ?? []), entry]);
  const days = [...byDay.keys()].sort().reverse();
  const months = [...state.chronicleArchive].reverse();

  return (
    <Sheet open onClose={onClose} title="History">
      {days.length === 0 && months.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span aria-hidden className="text-4xl">
            📖
          </span>
          <p className="subheading max-w-64 text-base">Nothing here yet. Tasks you finish show up here the next morning.</p>
        </div>
      ) : (
        <>
          <p className="subheading text-sm">Every task you’ve finished. Tap Restore to put one back on the board.</p>
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-3 font-serif text-lg text-gold">
                {formatDateKey(day, 'long')}
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
              </h3>
              <ul className="flex flex-col gap-1">
                {byDay.get(day)!.map((entry) => {
                  const category = state.categories.find((c) => c.id === entry.categoryId);
                  return (
                    <li key={entry.id} className="flex items-start gap-2.5 rounded-xl bg-espresso/40 px-3 py-2">
                      <WaxSeal signet={state.settings.signet} decorative size={22} className="-ml-0.5 -rotate-6" />
                      <span aria-hidden className="mt-0.5 -ml-1 text-base">
                        {category?.emoji ?? '✨'}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-snug break-words text-vanilla/90">{entry.title}</span>
                      <button
                        type="button"
                        aria-label={`Restore ${entry.title}`}
                        onClick={() => restoreTask(entry.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/30 px-2.5 py-1 text-xs text-taupe transition hover:border-gold hover:text-gold"
                      >
                        <RotateCcw aria-hidden size={12} />
                        Restore
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {months.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-3 font-serif text-lg text-gold">
                Earlier months
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
              </h3>
              {months.map((month) => (
                <ArchivedMonth key={month.month} month={month} categories={state.categories} />
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function ArchivedMonth({ month, categories }: { month: ChronicleMonth; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const name = formatMonthKey(month.month);
  const counts = Object.entries(month.byCategory)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);
  const unlisted = month.total - month.titles.length;

  return (
    <div className="rounded-xl bg-espresso/30">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-taupe transition hover:text-vanilla"
      >
        <ChevronRight aria-hidden size={14} className={`shrink-0 text-gold/70 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span>
          {name} · {month.total} {month.total === 1 ? 'quest' : 'quests'}
        </span>
      </button>
      {open && (
        <section aria-label={name} className="flex flex-col gap-2 px-3 pb-3 pl-8">
          {counts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {counts.map(([id, n]) => {
                const category = categories.find((c) => c.id === id);
                return (
                  <li key={id} className="rounded-full border border-gold/20 px-2.5 py-0.5 text-xs text-vanilla/80">
                    {`${category?.emoji ?? '✨'} ${category?.name ?? 'A deleted category'} · ${n}`}
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="flex flex-col gap-0.5">
            {month.titles.map((title, i) => (
              <li key={i} className="text-sm leading-snug break-words text-vanilla/75">
                {title}
              </li>
            ))}
          </ul>
          {unlisted > 0 && <p className="subheading text-xs">…and {unlisted} more</p>}
        </section>
      )}
    </div>
  );
}
