import type { CSSProperties } from 'react';
import { formatDateKey, useVespera, weekCandles, type Candle } from '../../context/VesperaContext';
import './delight.css';

function candleLabel(candle: Candle): string {
  const day = formatDateKey(candle.date, 'tab');
  if (candle.lit) return `${day}: lit`;
  return candle.isFuture ? `${day}: not yet` : `${day}: unlit`;
}

/** This week's 7 candles under the header title: any small win lights the day. */
export function CandleRow() {
  const { state, today } = useVespera();
  const candles = weekCandles(state, today);
  const lit = candles.filter((c) => c.lit).length;

  return (
    <div className="mt-2 flex flex-col items-center gap-1.5">
      <div role="group" aria-label="This week's candles" className="flex items-end gap-3 sm:gap-3.5">
        {candles.map((candle, i) => {
          const mood = candle.lit ? 'candle-lit' : candle.isFuture ? 'candle-future' : 'candle-unlit';
          return (
            <div key={candle.date} className="flex flex-col items-center gap-1">
              <div
                role="img"
                aria-label={candleLabel(candle)}
                className={`candle ${mood} ${candle.isToday ? 'candle-today' : ''}`}
                style={{ '--ignite-delay': `${i * 90}ms` } as CSSProperties}
              >
                {candle.lit && <span className="candle-flame" />}
                <span className="candle-wick" />
                <span className="candle-wax" />
              </div>
              <span
                aria-hidden
                className={`font-serif text-[0.7rem] leading-none ${candle.isToday ? 'font-semibold text-gold' : candle.isFuture ? 'text-taupe/40' : 'text-taupe/80'}`}
              >
                {formatDateKey(candle.date, 'short')[0]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-serif text-sm italic text-taupe">
        {lit === 0 ? 'Check off a task to light today’s candle' : `${lit} candle${lit === 1 ? '' : 's'} lit this week`}
      </p>
    </div>
  );
}
