import { currentOccurrence, formatTime, occurrencesForDate, useVespera } from '../../context/VesperaContext';
import { FocusButton } from '../focus/FocusButton';

/** A slim gold "Happening Now" pill that stays pinned under the header; tapping it opens the Timeline. */
export function NowPill({ onOpenTimeline }: { onOpenTimeline: () => void }) {
  const { state, today, nowMinutes } = useVespera();
  const now = currentOccurrence(occurrencesForDate(state, today), nowMinutes);
  if (!now || now.end === null) return null;
  const until = formatTime(now.end);

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 mb-4 flex justify-center">
      <div className="shell-now-pill flex max-w-full items-center gap-1 rounded-full p-0.5">
        <button
          type="button"
          onClick={onOpenTimeline}
          aria-label={`Happening now: ${now.title}, until ${until}. Open the Timeline`}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full pl-3 pr-3 text-sm text-vanilla transition hover:text-gold"
        >
          <span aria-hidden className="shell-now-dot" />
          <span className="block min-w-0 truncate">
            <span className="font-serif text-base italic text-gold">Now:</span> {now.title}{' '}
            <span className="text-taupe">· until {until}</span>
          </span>
        </button>
        {now.kind !== 'anchor' && (
          <span className="shell-now-focus shrink-0 text-sm">
            <FocusButton occurrence={now} />
          </span>
        )}
      </div>
    </div>
  );
}
