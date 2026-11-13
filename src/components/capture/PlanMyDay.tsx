import { useId, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, MoonStar, Sparkles } from 'lucide-react';
import { formatRange, planDay, useVespera, type PlanSuggestion } from '../../context/VesperaContext';
import { useCelebrate } from '../ui/Sparkles';
import { useToast } from '../ui/Toast';

const plural = (n: number) => `${n} block${n === 1 ? '' : 's'}`;

/**
 * "Plan my day", a small disclosure folded away by default: unfolding it fits open quests into today's
 * free gaps, then the ones you keep are added as flexible blocks.
 */
export function PlanMyDay() {
  const { state, today, nowMinutes, addBlock } = useVespera();
  const celebrate = useCelebrate();
  const showToast = useToast();
  const id = useId();
  const addRef = useRef<HTMLButtonElement>(null);
  const [plan, setPlan] = useState<PlanSuggestion[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const open = plan !== null;

  function toggleOpen() {
    if (open) {
      setPlan(null);
      return;
    }
    const suggestions = planDay(state, today, nowMinutes);
    setPlan(suggestions);
    setKept(new Set(suggestions.map((s) => s.taskId)));
  }

  function toggle(taskId: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function add() {
    const chosen = (plan ?? []).filter((s) => kept.has(s.taskId));
    if (chosen.length === 0) return;
    for (const s of chosen) {
      addBlock(today, { title: s.title, kind: 'flexible', start: s.start, end: s.end, categoryId: s.categoryId, note: 'From Plan my day' });
    }
    celebrate('small', addRef.current);
    showToast({ message: `Added ${plural(chosen.length)} to today` });
    setPlan(null);
  }

  const count = plan?.filter((s) => kept.has(s.taskId)).length ?? 0;

  return (
    <section aria-label="Plan my day" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-plan`}
        onClick={toggleOpen}
        className="scribe-plan-toggle inline-flex min-h-11 items-center gap-2 self-start rounded-full px-4 font-serif text-base italic text-gold transition hover:text-vanilla"
      >
        <Sparkles aria-hidden size={15} />
        Plan my day
        <ChevronDown aria-hidden size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div id={`${id}-plan`} hidden={!open}>
        {plan && plan.length === 0 && (
          <p className="scribe-rise flex items-center gap-2 px-2 text-sm italic text-taupe">
            <MoonStar aria-hidden size={14} className="shrink-0 text-gold" />
            No free time left today.
          </p>
        )}

        {plan && plan.length > 0 && (
          <div role="group" aria-label="Suggested plan" className="scribe-rise ornate-border flex flex-col gap-1 rounded-xl p-2">
            <p className="subheading px-2 pb-0.5 pt-1 text-sm">Here’s a suggestion:</p>
            <ul className="flex flex-col">
              {plan.map((s) => {
                const range = formatRange(s);
                const checked = kept.has(s.taskId);
                return (
                  <li key={s.taskId}>
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gold/[0.06] ${checked ? '' : 'opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${s.title} · ${range}`}
                        checked={checked}
                        onChange={() => toggle(s.taskId)}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-gold"
                      />
                      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                        <span className={`min-w-0 break-words text-sm ${checked ? 'text-vanilla' : 'text-taupe line-through decoration-gold/50'}`}>{s.title}</span>
                        <span className="whitespace-nowrap text-xs tabular-nums text-taupe">{range}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-gold/15 px-1 pt-2">
              <button type="button" onClick={() => setPlan(null)} className="min-h-11 rounded-xl px-4 text-sm text-taupe transition hover:text-vanilla">
                Not now
              </button>
              <button
                ref={addRef}
                type="button"
                onClick={add}
                disabled={count === 0}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-burgundy px-4 text-sm font-semibold text-vanilla shadow-[0_4px_14px_color-mix(in_srgb,var(--shadow-color)_30%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CalendarPlus aria-hidden size={15} />
                Add {plural(count)}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
