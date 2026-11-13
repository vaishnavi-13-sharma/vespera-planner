import { useId } from 'react';
import { SEAL_COLORS, type SealEmblem, type Signet } from '../../context/VesperaContext';
import './signet.css';

const EMBLEM_PHRASE: Record<Exclude<SealEmblem, 'initial'>, string> = {
  moon: 'a crescent moon',
  rose: 'a rose',
  crown: 'a crown',
  sword: 'a sword',
  star: 'a star',
  cat: 'a cat',
};

/** "Gold wax seal with a crown", or "Sage wax seal with the initial Q". */
export function sealLabel(signet: Signet): string {
  const color = SEAL_COLORS.find((c) => c.id === signet.color) ?? SEAL_COLORS[0];
  const what = signet.emblem === 'initial' ? `the initial ${signet.initial}` : EMBLEM_PHRASE[signet.emblem];
  return `${color.name} wax seal with ${what}`;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** A closed, smooth (Catmull-Rom) path through points at the given radii around (50, 50). */
function blob(radii: number[], turn = 0): string {
  const pts = radii.map((r, i) => {
    const a = (i / radii.length) * Math.PI * 2 + turn;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
  const at = (i: number) => pts[(i + pts.length) % pts.length];
  let d = `M${round(pts[0][0])} ${round(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d}Z`;
}

// Poured wax never lands perfectly round: a lumpy puddle, with a darker spill peeking out beneath.
const PUDDLE = blob([47.5, 46, 48.5, 47, 45.5, 47.8, 46.6, 48.8, 46.2, 47.2, 48.4, 45.8, 47.4, 48, 46.4, 48.6]);
const SPILL = blob([48.5, 49.2, 47, 48.8, 49.4, 47.6, 48.2, 49.6, 47.4, 48.9, 49.1, 47.8], 0.3);

const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 ? 9.5 : 23;
  return `${round(50 + r * Math.cos(a))},${round(51 + r * Math.sin(a))}`;
}).join(' ');

/** The emblem as it is carved into the brass stamp. `detail` paints the raised bits inside it (petal curls, cat eyes). */
function Emblem({ emblem, initial, ink, detail }: { emblem: SealEmblem; initial: string; ink: string; detail: string }) {
  switch (emblem) {
    case 'moon':
      return (
        <g fill={ink}>
          <path d="M57 29.5A22 22 0 1 0 57 70.5A24 24 0 0 1 57 29.5Z" />
          <path d="M68 37l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6Z" />
        </g>
      );
    case 'rose':
      return (
        <g fill={ink}>
          <path d="M50 25c11 0 18 8 17 17-1 9-8 14-17 14s-16-5-17-14c-1-9 6-17 17-17Z" />
          <path d="M50 56v20" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M50 69c-5-6-11-5-14-3 3 5 9 6 14 3ZM50 64c5-6 11-5 14-3-3 5-9 6-14 3Z" />
          <path
            d="M50 33c6 0 9 5 7 9s-8 5-10 1 1-6 4-5M40 40c-1 7 4 11 10 11s11-4 10-11"
            fill="none"
            stroke={detail}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      );
    case 'crown':
      return (
        <g fill={ink}>
          <path d="M28 58 24.5 36.5 38 47 50 30.5 62 47 75.5 36.5 72 58Z" />
          <rect x="27" y="60.5" width="46" height="7" rx="1.5" />
          <circle cx="24.5" cy="34" r="3.2" />
          <circle cx="50" cy="28" r="3.4" />
          <circle cx="75.5" cy="34" r="3.2" />
          <g fill={detail}>
            <circle cx="39" cy="64" r="1.6" />
            <circle cx="50" cy="64" r="1.8" />
            <circle cx="61" cy="64" r="1.6" />
          </g>
        </g>
      );
    case 'sword':
      return (
        <g fill={ink}>
          <path d="M50 20.5 54.5 29v33h-9V29Z" />
          <rect x="36" y="61.5" width="28" height="5" rx="2.5" />
          <rect x="47.5" y="66" width="5" height="10" rx="1" />
          <circle cx="50" cy="79" r="3.6" />
          <path d="M50 30v29" stroke={detail} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case 'star':
      return <polygon points={STAR} fill={ink} strokeLinejoin="round" stroke={ink} strokeWidth="2" />;
    case 'cat':
      return (
        <g fill={ink}>
          <path d="M29.5 41 31 21.5 44 31.5c4-1.4 8-1.4 12 0L69 21.5 70.5 41C74 57 63 67 50 67S26 57 29.5 41Z" />
          <g fill={detail}>
            <path d="M37 45c2-3.5 7-3.5 9 0-2 3.5-7 3.5-9 0ZM54 45c2-3.5 7-3.5 9 0-2 3.5-7 3.5-9 0Z" />
            <path d="M47.5 53h5L50 56Z" />
          </g>
          <g fill={ink}>
            <ellipse cx="41.5" cy="45" rx="0.9" ry="2.2" />
            <ellipse cx="58.5" cy="45" rx="0.9" ry="2.2" />
          </g>
        </g>
      );
    case 'initial':
      return (
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="44"
          fill={ink}
          className="font-serif"
          style={{ fontVariant: 'small-caps', fontWeight: 600 }}
        >
          {initial}
        </text>
      );
  }
}

/**
 * A round wax seal with the signet pressed into it. Seal colors are real wax, so they never change with the realm.
 * Decorative seals are hidden from assistive tech; otherwise the seal is a labelled image.
 */
export function WaxSeal({ signet, size = 28, decorative = false, className = '' }: { signet: Signet; size?: number; decorative?: boolean; className?: string }) {
  const id = useId().replace(/[^\w-]/g, '');
  const color = SEAL_COLORS.find((c) => c.id === signet.color) ?? SEAL_COLORS[0];
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': sealLabel(signet) };
  const emblem = (ink: string, detail: string) => <Emblem emblem={signet.emblem} initial={signet.initial} ink={ink} detail={detail} />;

  return (
    <svg
      {...a11y}
      data-emblem={signet.emblem}
      data-seal-color={signet.color}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`wax-signet shrink-0 ${className}`}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}-well`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`${id}-gloss`}>
          <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The puddle: a darker spill underneath, then the wax with a candlelit sheen. */}
      <path d={SPILL} fill={color.impression} opacity="0.75" />
      <path d={PUDDLE} fill={color.wax} />
      <path d={PUDDLE} fill={`url(#${id}-body)`} />

      {/* The raised lip pushed up around the stamp, and the pressed well inside it. */}
      <circle cx="50" cy="50" r="37" fill="none" stroke={`url(#${id}-lip)`} strokeWidth="4" />
      <circle cx="50" cy="50" r="34" fill={color.impression} fillOpacity="0.16" />
      <circle cx="50" cy="50" r="34" fill="none" stroke={`url(#${id}-well)`} strokeWidth="1.6" />

      {/* The emblem, debossed: a lit lower edge, a shadowed upper edge, then the cut itself. */}
      <g transform="translate(0.9 1.1)" opacity="0.35">
        {emblem('#fff', '#fff')}
      </g>
      <g transform="translate(-0.6 -0.7)" opacity="0.25">
        {emblem('#000', '#000')}
      </g>
      {emblem(color.impression, color.wax)}

      <ellipse cx="33" cy="25" rx="15" ry="6.5" transform="rotate(-32 33 25)" fill={`url(#${id}-gloss)`} />
    </svg>
  );
}
