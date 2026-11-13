import type { Accent } from '../../context/VesperaContext';
import { ACCENT_STYLES, ACCENTS } from './accents';

export function AccentSwatches({ label, value, onChange }: { label: string; value: Accent; onChange: (accent: Accent) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {ACCENTS.map((a) => {
        const checked = a === value;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={ACCENT_STYLES[a].label}
            onClick={() => onChange(a)}
            className={`h-7 w-7 rounded-full border-2 transition ${ACCENT_STYLES[a].dot} ${
              checked ? 'border-vanilla shadow-[0_0_10px_color-mix(in_srgb,var(--color-gold)_60%,transparent)]' : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          />
        );
      })}
    </div>
  );
}
