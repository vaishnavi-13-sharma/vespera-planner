import { useState, type ReactNode } from 'react';
import { House, Share, SquarePlus } from 'lucide-react';
import { isIosSafari, isStandalone } from './detect';
import './install.css';

// A device preference, not board data, so it lives beside the board rather than in it.
const DISMISSED_KEY = 'vespera_install_hint_dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function shouldShow(): boolean {
  return typeof navigator !== 'undefined' && isIosSafari(navigator.userAgent) && !isStandalone() && !wasDismissed();
}

function Candle() {
  return (
    <span aria-hidden className="flex size-12 shrink-0 items-end justify-center rounded-full bg-burgundy pb-2.5 shadow-[0_0_18px_color-mix(in_srgb,var(--color-gold)_35%,transparent)] ring-1 ring-gold/50">
      <span className="install-candle">
        <span className="install-candle-flame" />
        <span className="install-candle-wick" />
        <span className="install-candle-wax" />
      </span>
    </span>
  );
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-burgundy font-serif text-lg font-semibold text-vanilla ring-1 ring-gold/60">
        {n}
      </span>
      <span className="flex-1 leading-snug">{children}</span>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-burgundy/25 bg-white/50 text-burgundy">
        {icon}
      </span>
    </li>
  );
}

/** One-time "Add to Home Screen" card for iPhone Safari. Hidden elsewhere, once installed, and after "Got it". */
export function InstallHint() {
  const [visible, setVisible] = useState(shouldShow);
  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private mode: it simply comes back next visit.
    }
    setVisible(false);
  };

  return (
    <section role="region" aria-label="Add Vespera to your Home Screen" className="velvet-card mx-auto w-full max-w-3xl p-1.5">
      <div className="install-parchment rounded-[1rem] px-4 py-4 text-ink sm:px-6 sm:py-5">
        <div className="flex items-center gap-3.5">
          <Candle />
          <div>
            <h2 className="font-serif text-xl font-semibold italic leading-tight text-burgundy sm:text-2xl">Keep Vespera on your Home Screen</h2>
            <p className="mt-0.5 text-sm text-ink/75">It opens like an app, full screen, and keeps working offline.</p>
          </div>
        </div>
        <ol className="mt-4 flex flex-col gap-2.5 text-[15px]">
          <Step n={1} icon={<Share size={18} />}>
            Tap the <strong className="font-semibold">Share</strong> button
          </Step>
          <Step n={2} icon={<SquarePlus size={18} />}>
            Choose <strong className="font-semibold">“Add to Home Screen”</strong>
          </Step>
          <Step n={3} icon={<House size={18} />}>
            Open Vespera from your Home Screen
          </Step>
        </ol>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 min-w-28 rounded-full bg-burgundy px-6 font-serif text-lg font-semibold text-vanilla shadow-[0_4px_14px_color-mix(in_srgb,var(--color-burgundy)_35%,transparent)] ring-1 ring-gold/60 transition hover:bg-burgundy/90 hover:ring-gold active:scale-[0.98]"
          >
            Got it
          </button>
        </div>
      </div>
    </section>
  );
}
