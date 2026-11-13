import type { CSSProperties } from 'react';
import { seasonFor, useVespera, type Season } from '../../context/VesperaContext';
import './delight.css';

/** Where each falling thing starts, how it drifts, and where it rests when motion is reduced. Hugs the edges. */
const DRIFTERS = [
  { x: '3%', size: 14, dur: 26, delay: -2, drift: '24px', rest: '18vh', spin: 10, alpha: 0.4 },
  { x: '11%', size: 9, dur: 31, delay: -17, drift: '-18px', rest: '64vh', spin: 140, alpha: 0.3 },
  { x: '19%', size: 12, dur: 28, delay: -9, drift: '30px', rest: '88vh', spin: 260, alpha: 0.32 },
  { x: '27%', size: 8, dur: 34, delay: -25, drift: '-22px', rest: '4vh', spin: 70, alpha: 0.25 },
  { x: '71%', size: 10, dur: 30, delay: -6, drift: '20px', rest: '6vh', spin: 200, alpha: 0.28 },
  { x: '80%', size: 13, dur: 27, delay: -21, drift: '-26px', rest: '82vh', spin: 320, alpha: 0.36 },
  { x: '88%', size: 9, dur: 33, delay: -13, drift: '18px', rest: '42vh', spin: 40, alpha: 0.3 },
  { x: '95%', size: 15, dur: 25, delay: -4, drift: '-20px', rest: '70vh', spin: 180, alpha: 0.4 },
  { x: '50%', size: 8, dur: 36, delay: -30, drift: '28px', rest: '96vh', spin: 100, alpha: 0.22 },
  { x: '62%', size: 11, dur: 29, delay: -15, drift: '-24px', rest: '92vh', spin: 290, alpha: 0.26 },
];

const KIND: Record<Season, { className: string; count: number }> = {
  winter: { className: 'decor-snow', count: 10 },
  autumn: { className: 'decor-leaf', count: 9 },
  valentine: { className: 'decor-petal', count: 9 },
  spring: { className: 'decor-blossom', count: 9 },
};

/** Seasonal dressing: a few slow, faint things drifting behind the page (CSS only, never over panel content). */
export function SeasonalDecor() {
  const { state, today } = useVespera();
  const season = seasonFor(today);
  if (!state.settings.seasonal || !season) return null;
  const { className, count } = KIND[season];

  return (
    // -z-10 rather than z-0: unpositioned panels would otherwise paint beneath a positioned z-0 layer.
    <div aria-hidden data-season={season} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {season === 'winter' && <span className="decor-ribbon" />}
      {DRIFTERS.slice(0, count).map((d, i) => (
        <span
          key={i}
          className={`decor-fall ${className} ${i % 3 === 2 ? 'decor-alt' : ''}`}
          style={
            {
              '--x': d.x,
              '--size': `${season === 'winter' && i % 3 !== 2 ? Math.round(d.size * 0.6) : d.size}px`,
              '--dur': `${d.dur}s`,
              '--delay': `${d.delay}s`,
              '--drift': d.drift,
              '--rest-y': d.rest,
              '--spin-from': `${d.spin}deg`,
              '--alpha': d.alpha,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
