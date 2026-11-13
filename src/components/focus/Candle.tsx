import type { CSSProperties } from 'react';

export type CandleMood = 'focus' | 'rest' | 'paused';

/**
 * A burgundy taper on a brass dish. The wax burns down with `remaining` (0–1);
 * the flame flickers while focusing, dims for rest and gutters low when paused.
 */
export function Candle({ remaining, mood }: { remaining: number; mood: CandleMood }) {
  const wax = Math.min(1, Math.max(0, remaining));
  return (
    <div aria-hidden className="fc-candle" data-mood={mood} style={{ '--wax': wax } as CSSProperties}>
      <div className="fc-stack">
        <div className="fc-light">
          <span className="fc-halo" />
          <span className="fc-flame">
            <span className="fc-flame-core" />
          </span>
        </div>
        <span className="fc-wick" />
        <div className="fc-wax">
          <span className="fc-pool" />
          <span className="fc-drip fc-drip-a" />
          <span className="fc-drip fc-drip-b" />
          <span className="fc-drip fc-drip-c" />
        </div>
      </div>
      <span className="fc-dish" />
    </div>
  );
}

/** A tiny line-art candle for buttons, matching lucide's stroke style. */
export function CandleGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5c1.6 1.9 2.2 3.1 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1 .6-2.2 2.2-4.1z" />
      <path d="M12 8.8v1.7" />
      <rect x="8.5" y="10.5" width="7" height="9" rx="1" />
      <path d="M5 21.5h14" />
    </svg>
  );
}
