import { useId, type CSSProperties } from 'react';
import { noteVariant, type Fastener as FastenerKind } from '../../context/VesperaContext';
import './pinboard.css';

/** Each strip of washi takes one of the realm's soft tones, chosen from the note so it never changes. */
const TAPE_TONES = ['var(--color-rose)', 'var(--color-sage)', 'var(--color-gold)'];

/** A domed brass pin, catching the candlelight on its shoulder. */
function BrassTack({ nudge }: { nudge: number }) {
  const id = useId().replace(/[^\w-]/g, '');
  return (
    <svg aria-hidden data-fastener="tacks" viewBox="0 0 24 24" className="fastener-tack" style={{ '--nudge': `${nudge}px` } as CSSProperties}>
      <defs>
        <radialGradient id={`${id}-brass`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#fbefc4" />
          <stop offset="35%" stopColor="#d9b363" />
          <stop offset="75%" stopColor="#9a7432" />
          <stop offset="100%" stopColor="#5f4519" />
        </radialGradient>
      </defs>
      <ellipse cx="13.6" cy="15" rx="7" ry="5" className="fastener-shadow" />
      <circle cx="12" cy="11" r="7.5" fill={`url(#${id}-brass)`} />
      <circle cx="12" cy="11" r="7.1" fill="none" stroke="#5f4519" strokeOpacity="0.45" strokeWidth="0.8" />
      <ellipse cx="9.4" cy="8.2" rx="2.6" ry="1.5" transform="rotate(-32 9.4 8.2)" fill="#fff" fillOpacity="0.8" />
    </svg>
  );
}

/** A little velvet bow, tied in the realm's burgundy with a rose sheen. */
function VelvetBow({ tilt }: { tilt: number }) {
  return (
    <svg aria-hidden data-fastener="bows" viewBox="0 0 48 30" className="fastener-bow" style={{ '--tilt': `${tilt * 1.5}deg` } as CSSProperties}>
      <ellipse cx="25" cy="17" rx="15" ry="4" className="fastener-shadow" />
      <path d="M22 15.5 15 28l3.6-1.6L20.4 29.5 25 16Z" className="bow-tail" />
      <path d="M26 15.5 33.5 28l-3.7-1.4-1.6 3L23 16Z" className="bow-tail" />
      <path d="M24 13.5C17 3.5 5.5 2.5 4.5 9.5 3.5 16.5 14 18.5 24 14.8Z" className="bow-loop" />
      <path d="M24 13.5C31 3.5 42.5 2.5 43.5 9.5 44.5 16.5 34 18.5 24 14.8Z" className="bow-loop" />
      <path d="M21 13.6C16 9 10 8.6 9 11.5c3 1.2 8 2.3 12 2.1ZM27 13.6C32 9 38 8.6 39 11.5c-3 1.2-8 2.3-12 2.1Z" className="bow-fold" />
      <path d="M7 7.5C10 4.5 16 5.5 20 9.5M41 7.5C38 4.5 32 5.5 28 9.5" className="bow-sheen" />
      <ellipse cx="24" cy="14.2" rx="3.6" ry="3.4" className="bow-knot" />
    </svg>
  );
}

/** A translucent strip of washi across the top edge, at the note's own angle and pattern. */
function WashiTape({ tilt, tape }: { tilt: number; tape: string }) {
  const tone = TAPE_TONES[Math.abs(Math.round(tilt * 10)) % TAPE_TONES.length];
  return (
    <span
      aria-hidden
      data-fastener="washi"
      className="fastener-washi"
      style={{ '--tilt': `${tilt}deg`, '--tape': tone } as CSSProperties}
    >
      <span className={`washi-strip washi-${tape}`} />
    </span>
  );
}

/** What pins a note to the board: brass tacks, velvet bows or washi tape (see pinboard.css). */
export function Fastener({ kind, noteId }: { kind: FastenerKind; noteId: string }) {
  const { tilt, tape } = noteVariant(noteId);
  if (kind === 'washi') return <WashiTape tilt={tilt} tape={tape} />;
  if (kind === 'bows') return <VelvetBow tilt={tilt} />;
  return <BrassTack nudge={tilt * 1.5} />;
}
