import { useId, useState, type FormEvent } from 'react';
import { Hourglass, Plus, X } from 'lucide-react';
import { useVespera, type Settings } from '../../context/VesperaContext';
import { FIELD_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import { VanitySection } from './VanitySection';

const TIMER_CHOICES: Settings['focusMinutes'][] = [2, 5, 10];

export function GentleStartSettings() {
  const { state, updateSettings } = useVespera();
  const id = useId();
  const { focusMinutes, unstickActions } = state.settings;
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const duplicate = unstickActions.some((a) => a.toLowerCase() === trimmed.toLowerCase());

  function add(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || duplicate) return;
    updateSettings({ unstickActions: [...unstickActions, trimmed] });
    setDraft('');
  }

  return (
    <VanitySection icon={Hourglass} title="Gentle Start" blurb="When you’re stuck: one small step and a short timer." summary={`${focusMinutes}-minute timer`}>
      <div className="flex flex-col gap-1.5">
        <span aria-hidden className="text-xs text-taupe">
          Timer length
        </span>
        <div role="radiogroup" aria-label="Gentle Start timer" className="grid grid-cols-3 gap-2">
          {TIMER_CHOICES.map((m) => {
            const checked = m === focusMinutes;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => updateSettings({ focusMinutes: m })}
                className={`rounded-xl px-3 py-2 font-serif text-lg transition ${
                  checked
                    ? 'ornate-border bg-burgundy text-gold shadow-[0_0_12px_color-mix(in_srgb,var(--color-gold)_35%,transparent)]'
                    : 'border border-rose/25 text-taupe hover:border-gold/50 hover:text-vanilla'
                }`}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs text-taupe">Tiny actions</h4>
        {unstickActions.length === 0 ? (
          <p className="text-sm italic text-taupe/80">No tiny actions yet. Gentle Start will pick from your first quest category.</p>
        ) : (
          <ul aria-label="Tiny actions" className="flex flex-col gap-1.5">
            {unstickActions.map((action) => (
              <li key={action} className="tiny-action flex items-start gap-2 rounded-lg bg-mahogany/70 px-3 py-2 text-sm text-vanilla">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70" />
                <span className="flex-1 leading-snug">{action}</span>
                <button
                  type="button"
                  aria-label={`Remove ${action}`}
                  onClick={() => updateSettings({ unstickActions: unstickActions.filter((a) => a !== action) })}
                  className="-m-1 shrink-0 rounded-full p-1.5 text-taupe transition hover:bg-rose/10 hover:text-rose"
                >
                  <X aria-hidden size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={add} className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-new`} className="text-xs text-taupe">
          New tiny action
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-new`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Light a candle"
            className={`${FIELD_CLASS} min-w-0 flex-1`}
          />
          <button type="submit" disabled={!trimmed || duplicate} className={`${QUIET_BUTTON_CLASS} shrink-0 disabled:opacity-50`}>
            <Plus aria-hidden size={14} /> Add action
          </button>
        </div>
        {duplicate && trimmed && <p className="text-xs text-taupe">That one’s already on the list.</p>}
      </form>
    </VanitySection>
  );
}
