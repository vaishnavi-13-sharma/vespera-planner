import { Check, Shuffle, X } from 'lucide-react';
import { useVespera, type FocusVeilSession } from '../../context/VesperaContext';
import { useCelebrate } from '../ui/Sparkles';
import { formatCountdown, useCountdown } from './useCountdown';

const VEIL_BUTTON = 'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition';

/** Dims the master list and holds one tiny action with a gentle 5:00 countdown. */
export function FocusVeil({ session }: { session: FocusVeilSession }) {
  const { completeFiveMinuteReset, dismissFiveMinuteReset, triggerFiveMinuteReset } = useVespera();
  const secondsLeft = useCountdown(session.endsAt);
  const celebrate = useCelebrate();

  return (
    <div
      role="dialog"
      aria-label="Gentle Start"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-espresso/85 p-8 text-center backdrop-blur-sm"
    >
      <p className="subheading text-lg">Just this one small thing</p>
      <p className="max-w-md font-serif text-3xl leading-snug text-vanilla">{session.action}</p>
      <p role="timer" aria-label="Time remaining" className="font-serif text-6xl tabular-nums text-gold">
        {formatCountdown(secondsLeft)}
      </p>
      {secondsLeft === 0 && <p className="text-sage">Time’s up. Starting is the hardest part, and you did it. Anything more is a bonus.</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={(e) => {
            celebrate('small', e.currentTarget, 'chime');
            completeFiveMinuteReset();
          }} className={`${VEIL_BUTTON} bg-sage/90 text-espresso hover:bg-sage`}>
          <Check aria-hidden size={16} />
          I did it
        </button>
        <button type="button" onClick={triggerFiveMinuteReset} className={`${VEIL_BUTTON} border border-gold/50 text-gold hover:bg-gold/10`}>
          <Shuffle aria-hidden size={16} />
          Something else
        </button>
        <button type="button" onClick={dismissFiveMinuteReset} className={`${VEIL_BUTTON} text-taupe hover:text-vanilla`}>
          <X aria-hidden size={16} />
          Not now
        </button>
      </div>
    </div>
  );
}
