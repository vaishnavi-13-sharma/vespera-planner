import { Feather, Hourglass } from 'lucide-react';
import { canShift, formatTime, occurrencesForDate, useVespera, type Occurrence } from '../../context/VesperaContext';

/** A gentle nudge when a movable block started a while ago and hasn't been begun. */
export function LateRibbon({ offer }: { offer: Occurrence }) {
  const { state, today, nowMinutes, pushOccurrence, beginOccurrence } = useVespera();
  const start = offer.start ?? nowMinutes;
  const canSlide = canShift(occurrencesForDate(state, today), offer.key, nowMinutes - start);

  return (
    <div
      role="group"
      aria-label="Running behind"
      className="tl-unfurl relative overflow-hidden rounded-xl border border-rose/40 bg-linear-to-br from-burgundy/50 to-mahogany p-4 shadow-[inset_0_0_18px_color-mix(in_srgb,var(--color-rose)_12%,transparent)]"
    >
      <p className="tl-swallowtail -mx-4 -mt-4 mb-3 flex items-center gap-2 bg-rose/15 px-6 py-1.5 font-serif text-lg italic text-rose">
        <Hourglass aria-hidden size={16} className="shrink-0" />
        Running late?
      </p>
      <p className="text-sm text-vanilla/90">
        <span className="font-serif text-base text-vanilla">{offer.title}</span> was set for {formatTime(start)}. That’s okay.{' '}
        {canSlide
          ? 'Move the rest of today so it starts now?'
          : 'There isn’t room to move everything before midnight, so just start when you can.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canSlide && (
          <button
            type="button"
            onClick={() => pushOccurrence(today, offer.key, nowMinutes - start)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-sm font-semibold text-ink shadow-[0_0_14px_color-mix(in_srgb,var(--color-gold)_45%,transparent)] transition hover:bg-vanilla"
          >
            Move the rest of today to now
          </button>
        )}
        <button
          type="button"
          onClick={() => beginOccurrence(offer.source)}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose/50 px-3.5 py-1.5 text-sm text-rose transition hover:border-gold hover:text-gold"
        >
          <Feather aria-hidden size={14} />
          I'm on it
        </button>
      </div>
    </div>
  );
}
