import { useId } from 'react';
import { FIELD_CLASS } from './accents';

const SUGGESTIONS = ['✨', '🔬', '🎓', '🪑', '📚', '💼', '🧪', '🌙', '☕', '🏋️', '💭', '🧺', '🔔', '📜', '💡', '🎨'];

/** Type any emoji, or tap a suggestion. */
export function EmojiField({ label, value, onChange }: { label: string; value: string; onChange: (emoji: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-taupe">
        {label}
      </label>
      <input id={id} value={value} maxLength={8} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLASS} w-20 text-center text-lg`} />
      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Use ${e}`}
            onClick={() => onChange(e)}
            className={`rounded-md px-1.5 py-0.5 text-lg transition hover:bg-vanilla/10 ${value === e ? 'bg-gold/20' : ''}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
