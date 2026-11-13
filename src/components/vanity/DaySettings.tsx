import { useId, useState } from 'react';
import { Sunrise } from 'lucide-react';
import { formatRange, useVespera, type Settings } from '../../context/VesperaContext';
import { FIELD_CLASS } from '../ui/accents';
import { VanitySection } from './VanitySection';

const NUDGE_OPTIONS: { value: Settings['lateOfferMinutes']; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 5, label: 'After 5 minutes' },
  { value: 10, label: 'After 10 minutes' },
  { value: 15, label: 'After 15 minutes' },
];

/** 390 → "06:30" for a time input. */
export function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "06:30" → 390, or null when the input is empty or half-typed. */
export function fromTimeValue(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 24 * 60 ? minutes : null;
}

export function DaySettings() {
  const { state, updateSettings } = useVespera();
  const id = useId();
  const { dayStart, dayEnd, lateOfferMinutes } = state.settings;
  // Drafts let a half-typed or out-of-order time sit in the field without being saved.
  const [startDraft, setStartDraft] = useState(() => toTimeValue(dayStart));
  const [endDraft, setEndDraft] = useState(() => toTimeValue(dayEnd));
  // Follow saved changes made elsewhere (an import or a reset) while the drawer is open.
  const [synced, setSynced] = useState({ dayStart, dayEnd });
  if (synced.dayStart !== dayStart || synced.dayEnd !== dayEnd) {
    setSynced({ dayStart, dayEnd });
    setStartDraft(toTimeValue(dayStart));
    setEndDraft(toTimeValue(dayEnd));
  }
  const draftStart = fromTimeValue(startDraft);
  const draftEnd = fromTimeValue(endDraft);
  const outOfOrder = draftStart !== null && draftEnd !== null && draftEnd <= draftStart;

  function change(which: 'start' | 'end', value: string) {
    (which === 'start' ? setStartDraft : setEndDraft)(value);
    const minutes = fromTimeValue(value);
    if (minutes === null) return;
    const start = which === 'start' ? minutes : draftStart;
    const end = which === 'end' ? minutes : draftEnd;
    // Save both ends together, so fixing one side also saves the other side that was waiting on it.
    if (start === null || end === null || end <= start) return;
    updateSettings({ dayStart: start, dayEnd: end });
  }

  return (
    <VanitySection
      icon={Sunrise}
      title="Your day"
      blurb="When your day starts and ends."
      summary={formatRange({ start: dayStart, end: dayEnd })}
    >
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-start`} className="flex flex-col gap-1.5 text-xs text-taupe">
          Day starts
          <input id={`${id}-start`} type="time" value={startDraft} onChange={(e) => change('start', e.target.value)} className={FIELD_CLASS} />
        </label>
        <label htmlFor={`${id}-end`} className="flex flex-col gap-1.5 text-xs text-taupe">
          Day ends
          <input id={`${id}-end`} type="time" value={endDraft} onChange={(e) => change('end', e.target.value)} className={FIELD_CLASS} />
        </label>
      </div>
      {outOfOrder && <p className="text-xs text-rose">The day has to end after it starts. Nothing is saved until it does.</p>}

      <label htmlFor={`${id}-nudge`} className="flex flex-col gap-1.5 text-xs text-taupe">
        Running-late nudge
        <select
          id={`${id}-nudge`}
          value={String(lateOfferMinutes)}
          onChange={(e) => updateSettings({ lateOfferMinutes: Number(e.target.value) as Settings['lateOfferMinutes'] })}
          className={FIELD_CLASS}
        >
          {NUDGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-mahogany">
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="-mt-1 text-xs text-taupe/80">If a block starts and you haven’t begun, Vespera offers to move the rest of your day later.</p>
    </VanitySection>
  );
}
