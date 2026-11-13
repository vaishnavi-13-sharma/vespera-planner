import { useId, useState, type CSSProperties } from 'react';
import type { CatMood } from '../../context/VesperaContext';

// Hand-drawn inline-SVG art for the desk trinkets. Each piece is drawn in a 40×40 box whose bottom edge is the shelf.
// Physical things keep their own colors (fur, amber eyes, brass, silk, glass glints, firefly light); everything that
// means a theme role is tinted with realm tokens in trinket.css, so the art follows the realm.

/** A gradient id that is safe inside url(#…), unique per drawing. */
function useSvgId(): string {
  return `tk${useId().replace(/[^\w-]/g, '')}`;
}

// ── The castle kitten ─────────────────────────────────────────────────────────────────────────────────────────────

/** A tuxedo cat: black velvet fur, cream bib and socks, amber eyes. Rim-lit so it reads on dark realms too. */
export function CatArt({ mood, curled = mood === 'nap', viewBox = '0 0 40 40', className = '' }: { mood: CatMood; curled?: boolean; viewBox?: string; className?: string }) {
  const id = useSvgId();
  const fur = `url(#${id}-fur)`;
  return (
    <svg aria-hidden viewBox={viewBox} className={`tk-cat ${className}`} data-mood={mood} data-curled={curled || undefined}>
      <defs>
        <linearGradient id={`${id}-fur`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#3a3035" />
          <stop offset="0.55" stopColor="#1d181b" />
          <stop offset="1" stopColor="#0f0c0e" />
        </linearGradient>
      </defs>
      {curled ? <CurledCat fur={fur} mood={mood} /> : <SittingCat fur={fur} mood={mood} />}
    </svg>
  );
}

const CREAM = '#efe5d8';
const INNER_EAR = '#5c3c46';
const NOSE = '#b47a86';

function SittingCat({ fur, mood }: { fur: string; mood: CatMood }) {
  const silhouette = (
    <>
      <path d="M13.2 39 C10.6 39 10.8 31.5 12.6 27.4 C14.1 23.9 16 21.4 20 21.4 C24 21.4 25.9 23.9 27.4 27.4 C29.2 31.5 29.4 39 26.8 39 Z" />
      <path d="M13.3 12.4 L12.6 4.6 L18.4 9.3 Z" />
      <path d="M26.7 12.4 L27.4 4.6 L21.6 9.3 Z" />
      <ellipse cx="20" cy="14.6" rx="7.6" ry="6.6" />
    </>
  );
  return (
    <g className="tk-cat-body">
      <g className="tk-cat-tail">
        <path className="tk-rim-stroke" d="M26.4 37.6 C32.6 38.4 35.4 34.6 34.6 29.6 C34.1 26.6 32 25.2 30.6 26.4" fill="none" strokeWidth="3.8" strokeLinecap="round" />
        <path d="M26.4 37.6 C32.6 38.4 35.4 34.6 34.6 29.6 C34.1 26.6 32 25.2 30.6 26.4" fill="none" stroke={fur} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g className="tk-rim">{silhouette}</g>
      <g fill={fur}>{silhouette}</g>
      <path d="M16.4 22.4 Q20 31 23.6 22.4 Q20 24.6 16.4 22.4 Z" fill={CREAM} opacity="0.92" />
      <ellipse cx="16.6" cy="38.3" rx="2.3" ry="1.25" fill={CREAM} />
      <ellipse cx="23.4" cy="38.3" rx="2.3" ry="1.25" fill={CREAM} />
      <path d="M14.3 10.9 L13.9 6.7 L16.9 9.2 Z" fill={INNER_EAR} />
      <path d="M25.7 10.9 L26.1 6.7 L23.1 9.2 Z" fill={INNER_EAR} />
      <g className="tk-eyes">
        <Eye cx={17} cy={14.4} />
        <Eye cx={23} cy={14.4} />
      </g>
      <path d="M19.2 17.3 L20.8 17.3 L20 18.25 Z" fill={NOSE} />
      <path d="M20 18.25 Q19.4 19.2 18.5 18.8 M20 18.25 Q20.6 19.2 21.5 18.8" fill="none" stroke={CREAM} strokeWidth="0.4" strokeLinecap="round" opacity="0.55" />
      <path d="M15.4 17.6 L10.6 16.8 M15.4 18.5 L10.9 19.1 M24.6 17.6 L29.4 16.8 M24.6 18.5 L29.1 19.1" stroke={CREAM} strokeWidth="0.35" strokeLinecap="round" opacity="0.5" />
      {mood === 'focus' && <Spectacles left={17} right={23} y={14.4} r={2.45} />}
    </g>
  );
}

function CurledCat({ fur, mood }: { fur: string; mood: CatMood }) {
  const asleep = mood === 'nap';
  const silhouette = (
    <>
      <path d="M5.2 39 C4.4 31.4 10.6 25.2 19.6 25.2 C28.4 25.2 34.8 30.4 35.2 39 Z" />
      <path d="M7.5 29.6 L6.2 23.4 L11.2 26.7 Z" />
      <path d="M13.5 26.3 L16.9 21.6 L17.7 27.5 Z" />
      <ellipse cx="12.4" cy="31.6" rx="6.4" ry="5.6" />
    </>
  );
  return (
    <>
      {asleep && (
        <g className="tk-zzz" fill="none" strokeWidth="0.65" strokeLinecap="round" strokeLinejoin="round">
          <path className="tk-z tk-z-a" d="M21.5 19.5 H23.9 L21.5 22.1 H23.9" />
          <path className="tk-z tk-z-b" d="M26.2 13.4 H29.4 L26.2 16.8 H29.4" />
        </g>
      )}
      <g className="tk-cat-body">
        <g className="tk-rim">{silhouette}</g>
        <g fill={fur}>{silhouette}</g>
        <path d="M24.2 38.6 C24.8 33.8 28.4 30.8 32 31.7" fill="none" stroke="#4a3f45" strokeWidth="0.6" strokeLinecap="round" opacity="0.8" />
        <path className="tk-rim-stroke" d="M34 38 C30.6 39.8 19.2 39.9 15.2 38.5" fill="none" strokeWidth="4" strokeLinecap="round" />
        <path d="M34 38 C30.6 39.8 19.2 39.9 15.2 38.5" fill="none" stroke={fur} strokeWidth="2.7" strokeLinecap="round" />
        <ellipse cx="17.2" cy="38.4" rx="2.4" ry="1.2" fill={CREAM} />
        <path d="M9.4 35.3 Q12.4 38 15.5 35.1 Q12.5 36.3 9.4 35.3 Z" fill={CREAM} opacity="0.92" />
        <path d="M8.2 28 L7.5 24.9 L10.1 26.7 Z" fill={INNER_EAR} />
        <path d="M14.5 26.3 L16.4 23.5 L16.9 26.9 Z" fill={INNER_EAR} />
        {asleep ? (
          <path d="M8.6 31.5 Q9.8 32.7 11 31.5 M13.8 31.5 Q15 32.7 16.2 31.5" fill="none" stroke={CREAM} strokeWidth="0.55" strokeLinecap="round" opacity="0.8" />
        ) : (
          <g className="tk-eyes">
            <Eye cx={9.9} cy={31.6} small />
            <Eye cx={14.9} cy={31.6} small />
          </g>
        )}
        <path d="M11.7 33.6 L13.1 33.6 L12.4 34.4 Z" fill={NOSE} />
        <path d="M8 34 L3.8 33.4 M8.2 34.8 L4.2 35.6 M16.8 34 L20.6 33.2" stroke={CREAM} strokeWidth="0.32" strokeLinecap="round" opacity="0.45" />
        {mood === 'focus' && <Spectacles left={9.9} right={14.9} y={31.6} r={2.15} />}
      </g>
    </>
  );
}

function Eye({ cx, cy, small = false }: { cx: number; cy: number; small?: boolean }) {
  const s = small ? 0.82 : 1;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={1.55 * s} ry={1.25 * s} fill="#e8c25e" />
      <ellipse cx={cx} cy={cy} rx={0.48 * s} ry={1.05 * s} fill="#140e0c" />
      <circle cx={cx + 0.45 * s} cy={cy - 0.45 * s} r={0.3 * s} fill="#fff8e6" />
    </g>
  );
}

/** Tiny round brass reading spectacles. */
function Spectacles({ left, right, y, r }: { left: number; right: number; y: number; r: number }) {
  const mid = (left + right) / 2;
  return (
    <g className="tk-spectacles" fill="none" strokeLinecap="round">
      <circle cx={left} cy={y} r={r} fill="rgba(255, 248, 230, 0.12)" />
      <circle cx={right} cy={y} r={r} fill="rgba(255, 248, 230, 0.12)" />
      <path d={`M${left + r - 0.1} ${y - 0.2} Q${mid} ${y - 1.1} ${right - r + 0.1} ${y - 0.2}`} />
      <path d={`M${left - r} ${y - 0.3} L${left - r - 1.8} ${y - 1.2} M${right + r} ${y - 0.3} L${right + r + 1.8} ${y - 1.2}`} />
      <path className="tk-lens-glint" d={`M${left - r * 0.55} ${y - r * 0.35} Q${left - r * 0.35} ${y - r * 0.7} ${left} ${y - r * 0.72} M${right - r * 0.55} ${y - r * 0.35} Q${right - r * 0.35} ${y - r * 0.7} ${right} ${y - r * 0.72}`} />
    </g>
  );
}

// ── The rosewater vial ────────────────────────────────────────────────────────────────────────────────────────────

/** A cushioned perfume bottle: a short neck, rounded shoulders and a flat base on the shelf. */
const BOTTLE = 'M17.8 12.8 H22.2 V15.4 C28.8 15.8 32.4 19.4 32.4 25.4 V33.6 Q32.4 38.6 27.4 38.6 H12.6 Q7.6 38.6 7.6 33.6 V25.4 C7.6 19.4 11.2 15.8 17.8 15.4 Z';
/** A faceted crystal stopper. */
const STOPPER = 'M20 1.6 L23.8 6.2 L20 11.2 L16.2 6.2 Z';
const BUBBLES = [
  { x: 13.4, r: 0.9, delay: 0 },
  { x: 21.6, r: 0.7, delay: 0.18 },
  { x: 26.4, r: 0.85, delay: 0.36 },
  { x: 17.8, r: 0.6, delay: 0.52 },
  { x: 23.8, r: 0.55, delay: 0.7 },
];
/** A four-pointed glint, for a bottle filled to the stopper. */
const STAR = 'M0 -2 L0.5 -0.5 L2 0 L0.5 0.5 L0 2 L-0.5 0.5 L-2 0 L-0.5 -0.5 Z';
const STARS: [number, number, number][] = [[5.4, 18.6, 0.95], [35, 30, 0.7], [5.8, 33.6, 0.6]];

/** A perfume bottle of rosewater with a ribbon at its neck, filled to `ratio`. Bubbles rise whenever `done` goes up; it glows once `full`. */
export function VialArt({ ratio, done = 0, full = false, className = '' }: { ratio: number; done?: number; full?: boolean; className?: string }) {
  const id = useSvgId();
  const level = Math.min(1, Math.max(0, ratio));
  // A fresh burst of bubbles (a new key) every time another quest is sealed.
  const [seen, setSeen] = useState(done);
  const [burst, setBurst] = useState(0);
  if (done !== seen) {
    setSeen(done);
    if (done > seen) setBurst((b) => b + 1);
  }
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={`tk-vial ${className}`} data-full={full || undefined}>
      <defs>
        <clipPath id={`${id}-inside`}>
          <path d={BOTTLE} />
        </clipPath>
        <linearGradient id={`${id}-rosewater`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="tk-rosewater-top" />
          <stop offset="1" className="tk-rosewater-deep" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" className="tk-halo-core" />
          <stop offset="1" className="tk-halo-edge" />
        </radialGradient>
      </defs>
      <circle className="tk-vial-halo" cx="20" cy="27" r="15" fill={`url(#${id}-halo)`} />
      <path className="tk-glass" d={BOTTLE} />
      <g clipPath={`url(#${id}-inside)`}>
        <g className="tk-liquid" style={{ transform: `translateY(${(1 - level) * 24}px)` }}>
          <rect x="6" y="15" width="28" height="26" fill={`url(#${id}-rosewater)`} />
          <path className="tk-surface" d="M-6 15 q3 -1.1 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 V16.4 H-6 Z" />
        </g>
        {burst > 0 && (
          <g key={burst} className="tk-bubbles">
            {BUBBLES.map((b) => (
              <circle key={b.x} cx={b.x} cy="35" r={b.r} style={{ animationDelay: `${b.delay}s` }} />
            ))}
          </g>
        )}
      </g>
      <path className="tk-glass-edge" d={BOTTLE} />
      <path d="M10.8 31.4 Q10.4 24.6 14.2 20.8" fill="none" stroke="rgba(255, 252, 240, 0.6)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M29 27.4 V32.6" fill="none" stroke="rgba(255, 252, 240, 0.35)" strokeWidth="0.7" strokeLinecap="round" />
      {/* A brass collar and a faceted crystal stopper. */}
      <rect className="tk-collar" x="16.8" y="10.6" width="6.4" height="2.4" rx="0.9" />
      <path className="tk-stopper" d={STOPPER} />
      <path className="tk-stopper-facet" d="M16.2 6.2 H23.8 M20 1.6 V11.2" fill="none" strokeWidth="0.4" />
      <path d="M18.2 4.6 L19.4 3.2" fill="none" stroke="rgba(255, 252, 240, 0.75)" strokeWidth="0.5" strokeLinecap="round" />
      {/* A silk ribbon tied in a bow at the neck, its tails trailing over the glass. */}
      <g className="tk-ribbon">
        <path d="M17.4 13.9 H22.6 V15.5 H17.4 Z" />
        <path d="M19.6 15.2 L17.2 21 L18.7 20.3 L19.3 21.8 L20.6 15.3 Z" />
        <path d="M20.4 15.2 L22.9 20.6 L21.5 20.2 L21.1 21.6 L19.6 15.3 Z" />
        <path d="M20 14.7 C17.4 12.2 13.8 12.4 14.2 14.6 C14.6 16.6 17.6 16 20 14.7 Z" />
        <path d="M20 14.7 C22.6 12.2 26.2 12.4 25.8 14.6 C25.4 16.6 22.4 16 20 14.7 Z" />
      </g>
      <path className="tk-ribbon-fold" d="M15.6 14.2 Q17.4 14.2 19 14.7 M24.4 14.2 Q22.6 14.2 21 14.7" fill="none" strokeWidth="0.4" strokeLinecap="round" />
      <circle className="tk-ribbon-knot" cx="20" cy="14.7" r="1.15" />
      {full && (
        <g>
          {STARS.map(([x, y, s], i) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
              <path className="tk-star" d={STAR} style={{ animationDelay: `${-i * 0.8}s` }} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ── The firefly jar ───────────────────────────────────────────────────────────────────────────────────────────────

const JAR = 'M12.2 10 H27.8 Q29.6 10 29.6 11.8 V12.6 Q33 14.6 33 19.4 V35 Q33 38.8 29.2 38.8 H10.8 Q7 38.8 7 35 V19.4 Q7 14.6 10.4 12.6 V11.8 Q10.4 10 12.2 10 Z';

/** Twelve hand-placed perches, so a handful of fireflies already looks scattered rather than stacked. */
const PERCHES: [number, number][] = [
  [15, 29], [24.5, 23.5], [19.5, 19.5], [27, 32], [12, 22.5], [21, 34.5],
  [26.5, 17.5], [16.5, 24.5], [29, 26.5], [12.5, 34.5], [23, 29], [18, 15.8],
];

/** A mason jar holding `count` fireflies (at most twelve), each drifting on its own slow path. */
export function JarArt({ count, still = false, className = '' }: { count: number; still?: boolean; className?: string }) {
  const id = useSvgId();
  const n = Math.max(0, Math.min(12, Math.floor(count)));
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={`tk-jar ${className}`}>
      <defs>
        <clipPath id={`${id}-inside`}>
          <path d={JAR} />
        </clipPath>
        <radialGradient id={`${id}-light`}>
          <stop offset="0" stopColor="#fff6cf" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffd25e" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffb84a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="tk-brass-hi" />
          <stop offset="1" className="tk-brass-lo" />
        </linearGradient>
      </defs>
      <path className="tk-jar-glass" d={JAR} />
      <g clipPath={`url(#${id}-inside)`}>
        <g className="tk-swarm">
          {PERCHES.slice(0, n).map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`} data-firefly={still ? undefined : ''}>
              <g
                className={`tk-drift tk-drift-${'abc'[i % 3]}`}
                style={{ '--tk-dur': `${6.5 + ((i * 7) % 5) * 0.9}s`, '--tk-delay': `${-((i * 1.7) % 6)}s` } as CSSProperties}
              >
                <circle className="tk-glow" r="3.2" fill={`url(#${id}-light)`} style={{ animationDelay: `${-((i * 0.9) % 3)}s` }} />
                <circle className="tk-firefly-core" r="0.8" />
              </g>
            </g>
          ))}
        </g>
      </g>
      <path className="tk-glass-edge" d={JAR} />
      <path d="M10 21 Q10 16.4 12.6 14.6" fill="none" stroke="rgba(255, 252, 240, 0.5)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M10 25 V32" fill="none" stroke="rgba(255, 252, 240, 0.3)" strokeWidth="0.8" strokeLinecap="round" />
      {/* Brass lid with its threads, punched with air holes. */}
      <rect x="10.6" y="4.4" width="18.8" height="6" rx="1.3" fill={`url(#${id}-brass)`} />
      <path className="tk-lid-thread" d="M11.4 6.6 H28.6 M11.4 8.4 H28.6" strokeWidth="0.4" />
      <rect className="tk-lid-top" x="11.4" y="3.4" width="17.2" height="1.6" rx="0.8" />
      {/* Twine tied in a bow at the neck. */}
      <path d="M10.5 12.3 Q20 13.6 29.5 12.3" fill="none" stroke="#b48d5c" strokeWidth="0.9" />
      <path d="M24.2 13 q-1.8 -2 -0.2 -2.4 q1 -0.2 0.2 2.4 q2.2 -1.4 2.4 0 q0.1 1.2 -2.4 0 M24.2 13 l-0.8 3 M24.2 13 l1.2 2.8" fill="none" stroke="#b48d5c" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── The shelf ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A little wall shelf: a gold-tinted wooden plank on two wrought scroll brackets. */
export function ShelfArt({ className = '' }: { className?: string }) {
  const id = useSvgId();
  return (
    <svg aria-hidden viewBox="0 0 56 12" className={`tk-plank ${className}`}>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="tk-wood-hi" />
          <stop offset="1" className="tk-wood-lo" />
        </linearGradient>
      </defs>
      <path className="tk-bracket" d="M10 4 V9.2 C10 11 12.2 11.3 12.6 10 M46 4 V9.2 C46 11 43.8 11.3 43.4 10" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="1" y="0.4" width="54" height="4.4" rx="1.3" fill={`url(#${id}-wood)`} />
      <path className="tk-plank-edge" d="M2.2 0.9 H53.8" strokeWidth="0.6" strokeLinecap="round" />
      <path d="M6 2.4 Q16 1.7 26 2.5 T48 2.2 M14 3.5 Q22 3.1 31 3.6" fill="none" stroke="#2a180e" strokeWidth="0.3" opacity="0.35" />
      <circle className="tk-bracket-pin" cx="10" cy="6.4" r="0.55" />
      <circle className="tk-bracket-pin" cx="46" cy="6.4" r="0.55" />
    </svg>
  );
}
