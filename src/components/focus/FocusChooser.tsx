import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CloudRain, Flame, Hourglass, Sunrise, VolumeX } from 'lucide-react';
import {
  focusSessionMinutes,
  formatRange,
  useVespera,
  type AmbientSound,
  type FocusRhythm,
  type Occurrence,
} from '../../context/VesperaContext';
import { Sheet } from '../ui/Sheet';
import { CandleGlyph } from './Candle';
import { formatDuration } from './format';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon: ReactNode;
}

/** A radiogroup of buttons with roving focus: arrow keys move and select. */
function RadioCards<T extends string>({
  label,
  value,
  options,
  onChange,
  layout,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  layout: 'stack' | 'row';
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 id={`${id}-label`} className="subheading text-base">
        {label}
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className={layout === 'stack' ? 'flex flex-col gap-2' : 'grid grid-cols-3 gap-2'}>
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-labelledby={`${id}-${i}`}
              aria-describedby={o.hint ? `${id}-${i}-hint` : undefined}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`group flex items-center gap-3 rounded-xl border px-3.5 text-left transition ${
                layout === 'stack' ? 'py-3' : 'flex-col justify-center gap-1.5 py-3 text-center'
              } ${
                checked
                  ? 'border-gold/70 bg-gold/10 text-vanilla shadow-[0_0_16px_color-mix(in_srgb,var(--color-gold)_22%,transparent)]'
                  : 'border-rose/20 text-taupe hover:border-rose/50 hover:text-vanilla'
              }`}
            >
              <span aria-hidden className={`shrink-0 transition ${checked ? 'text-gold' : 'text-rose/70 group-hover:text-rose'}`}>
                {o.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span id={`${id}-${i}`} className={layout === 'stack' ? 'font-serif text-lg leading-tight' : 'text-sm'}>
                  {o.label}
                </span>
                {o.hint && (
                  <span id={`${id}-${i}-hint`} className="text-xs italic text-taupe">
                    {o.hint}
                  </span>
                )}
              </span>
              {layout === 'stack' && (
                <span
                  aria-hidden
                  className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full border transition ${
                    checked ? 'border-gold bg-gold shadow-[0_0_8px_color-mix(in_srgb,var(--color-gold)_90%,transparent)]' : 'border-taupe/50'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The "Focus session" sheet: pick a rhythm and an ambient sound, then light the candle. */
export function FocusChooser({ occurrence, onClose }: { occurrence: Occurrence; onClose: () => void }) {
  const { state, startFocus, finishFocus } = useVespera();
  const [rhythm, setRhythm] = useState<FocusRhythm>(state.settings.focusRhythm);
  const [sound, setSound] = useState<AmbientSound>(state.settings.focusSound);
  const running = state.focusSession;

  const rhythms: Option<FocusRhythm>[] = [
    { value: 'whole', label: `Whole block · ${formatDuration(focusSessionMinutes(occurrence))}`, hint: 'One long session, no breaks', icon: <Flame size={18} /> },
    { value: 'pomodoro25', label: '25 min focus + 5 min rest', hint: 'Short sessions with short breaks', icon: <Hourglass size={18} /> },
    { value: 'pomodoro50', label: '50 min focus + 10 min rest', hint: 'Longer sessions for deep work', icon: <Sunrise size={18} /> },
  ];
  const sounds: Option<AmbientSound>[] = [
    { value: 'rain', label: 'Rain', icon: <CloudRain size={18} /> },
    { value: 'fire', label: 'Fire', icon: <Flame size={18} /> },
    { value: 'off', label: 'Off', icon: <VolumeX size={18} /> },
  ];

  function light() {
    if (running) finishFocus();
    startFocus(occurrence, rhythm, sound);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Focus session"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-taupe transition hover:text-vanilla">
            Not now
          </button>
          <button
            type="button"
            onClick={light}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-espresso shadow-[0_0_18px_color-mix(in_srgb,var(--color-gold)_35%,transparent)] transition hover:bg-vanilla"
          >
            <CandleGlyph size={15} />
            Start the timer
          </button>
        </>
      }
    >
      <div>
        <p className="subheading text-xl leading-snug text-vanilla [overflow-wrap:anywhere]">{occurrence.title}</p>
        <p className="mt-0.5 text-xs uppercase tracking-widest text-taupe">{formatRange(occurrence)}</p>
      </div>

      <RadioCards label="Rhythm" value={rhythm} options={rhythms} onChange={setRhythm} layout="stack" />
      <RadioCards label="Sound" value={sound} options={sounds} onChange={setSound} layout="row" />

      {!state.settings.sounds && sound !== 'off' && (
        <p className="text-xs italic text-taupe">Sounds are turned off in Settings, so the timer will be silent.</p>
      )}
      {running && (
        <p className="rounded-xl border border-rose/25 bg-burgundy/20 px-3.5 py-2.5 text-sm text-rose">
          A Focus Timer is already running for “{running.title}”. Starting this one ends it and keeps its focus minutes.
        </p>
      )}
    </Sheet>
  );
}
