import { noteVariant } from '../../context/VesperaContext';

/** Dried flowers keep their own faded colors: lavender, rose hips, or baby's breath. */
const BLOOMS = {
  stripes: { bud: '#a68bb8', light: '#c7b0d6' },
  dots: { bud: '#c0787c', light: '#dca3a0' },
  plain: { bud: '#eadfc6', light: '#f7f0de' },
} as const;

/** A small pressed sprig tucked behind a note, peeking out from one corner. */
export function Sprig({ noteId }: { noteId: string }) {
  const { tilt, tape } = noteVariant(noteId);
  const bloom = BLOOMS[tape];
  return (
    <svg aria-hidden data-sprig viewBox="0 0 40 64" className={`pressed-sprig ${tilt >= 0 ? 'sprig-low' : 'sprig-high'}`}>
      <path d="M20 63C19 49 21.5 35 18.5 21 17.3 15 19 9 21.5 3.5" fill="none" stroke="#76784a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M19.6 46c-3.5-5-8-5.5-10-4.5 2 4 6 5.5 10 4.5ZM20.4 39c3-5 7.5-6 9.5-5-1.5 4-5.5 5.6-9.5 5ZM19 30c-3-4.6-7-5.4-9-4.6 1.8 3.8 5.4 5.2 9 4.6ZM19.6 23c2.6-4 6.4-5 8.4-4.2-1.4 3.4-4.8 4.8-8.4 4.2Z" fill="#8a9561" fillOpacity="0.9" />
      <path d="M19.6 46 12.5 42.6M20.4 39l6.5-4M19 30l-6.5-3.6M19.6 23l5.8-3.4" stroke="#6a6c40" strokeOpacity="0.5" strokeWidth="0.5" />
      <g fill={bloom.bud}>
        <circle cx="21.5" cy="4" r="2.1" />
        <circle cx="18.6" cy="7.8" r="2.3" />
        <circle cx="23.4" cy="9" r="2.2" />
        <circle cx="19" cy="12.8" r="2.4" />
        <circle cx="22.6" cy="15" r="2.1" />
        <circle cx="17.6" cy="17.4" r="1.9" />
      </g>
      <g fill={bloom.light}>
        <circle cx="21" cy="3.4" r="0.8" />
        <circle cx="18.1" cy="7.2" r="0.9" />
        <circle cx="18.5" cy="12.1" r="0.9" />
        <circle cx="22.1" cy="14.4" r="0.8" />
      </g>
    </svg>
  );
}
