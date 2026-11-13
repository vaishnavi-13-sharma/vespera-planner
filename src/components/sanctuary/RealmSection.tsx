import { useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Castle, Check, Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { REALM_PALETTES, REALMS, skyPhase, useVespera, type RealmId, type SkyPhase } from '../../context/VesperaContext';
import { VanitySection } from '../vanity/VanitySection';
import './sanctuary.css';

const PHASE_HINT: Record<SkyPhase, { icon: LucideIcon; text: string }> = {
  dawn: { icon: Sunrise, text: 'Right now: sunrise.' },
  day: { icon: Sun, text: 'Right now: daytime, with a few clouds.' },
  dusk: { icon: Sunset, text: 'Right now: sunset.' },
  night: { icon: Moon, text: 'Right now: night, with the moon and stars.' },
};

/** Each realm's signature in the corner of its little room. Colors come from the scene's own palette vars. */
function RealmMotif({ realm }: { realm: RealmId }) {
  switch (realm) {
    case 'velvet':
      // A velvet swag drawn up with gold tassels.
      return (
        <g>
          <path d="M0 0H160V10C140 22 118 22 100 10C82 22 60 22 42 10C28 20 12 20 0 12Z" fill="var(--scene-burgundy)" />
          <path d="M0 12C12 20 28 20 42 10C60 22 82 22 100 10C118 22 140 22 160 10" fill="none" stroke="var(--scene-gold)" strokeOpacity="0.7" strokeWidth="1.2" />
          {[42, 100].map((x) => (
            <g key={x}>
              <line x1={x} y1="10" x2={x} y2="19" stroke="var(--scene-gold)" strokeWidth="1" />
              <path d={`M${x - 2.5} 19h5l1 6h-7Z`} fill="var(--scene-gold)" />
            </g>
          ))}
        </g>
      );
    case 'sunlit':
      // An arched glasshouse pane with a fern frond leaning in.
      return (
        <g>
          <path d="M112 32V22a18 18 0 0 1 36 0V32" fill="var(--scene-mahogany)" stroke="var(--scene-gold)" strokeWidth="1.4" />
          <path d="M130 4V32M112 20H148" stroke="var(--scene-gold)" strokeOpacity="0.6" strokeWidth="1" />
          <path d="M6 30C14 18 24 10 38 6" fill="none" stroke="var(--scene-sage)" strokeWidth="1.4" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={10 + i * 6.5} cy={25 - i * 4.2} rx="4" ry="1.6" transform={`rotate(${-50 + i * 6} ${10 + i * 6.5} ${25 - i * 4.2})`} fill="var(--scene-sage)" />
          ))}
        </g>
      );
    case 'moonlit':
      // A candlelit crystal chandelier under a sky of silver stars.
      return (
        <g>
          {[
            [16, 10, 1],
            [34, 22, 0.7],
            [50, 7, 0.85],
            [108, 20, 0.7],
            [122, 8, 0.9],
          ].map(([x, y, s]) => (
            <path key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -2.5L0.7 -0.7L2.5 0L0.7 0.7L0 2.5L-0.7 0.7L-2.5 0L-0.7 -0.7Z" fill="var(--scene-vanilla)" opacity="0.8" />
          ))}
          {/* Centred, clear of the chosen-card check in the top-right corner. */}
          <g transform="translate(80 0) scale(1.25) translate(-128 0)">
            <circle cx="128" cy="13" r="15" fill="#ffcf6b" opacity="0.12" />
            <g fill="none" stroke="var(--scene-gold)" strokeLinecap="round">
              <line x1="128" y1="0" x2="128" y2="6" strokeWidth="0.9" />
              <path d="M128 9V20M128 15C122 15 115 14 114 10M128 15C134 15 141 14 142 10M128 18C124 18 121 17 120.5 13.5M128 18C132 18 135 17 135.5 13.5" strokeWidth="1.1" />
            </g>
            <circle cx="128" cy="7.5" r="1.6" fill="var(--scene-gold)" />
            <path d="M122 18Q128 26 134 18Z" fill="var(--scene-gold)" />
            {/* Wax tapers and their flames are real things, so their colors stay put. */}
            {[114, 120.5, 135.5, 142].map((x) => {
              const y = x === 114 || x === 142 ? 10 : 13.5;
              return (
                <g key={x}>
                  <path d={`M${x - 1.8} ${y}h3.6l-0.6 1.2h-2.4Z`} fill="var(--scene-gold)" />
                  <rect x={x - 0.8} y={y - 3.2} width="1.6" height="3.2" fill="#efe4cf" />
                  <path d={`M${x} ${y - 6}c-1 1.4 -1.1 2.2 0 2.7c1.1 -0.5 1 -1.3 0 -2.7Z`} fill="#ffb347" />
                </g>
              );
            })}
            {[
              [128, 26.5],
              [118, 17],
              [138, 17],
            ].map(([x, y]) => (
              <path key={`${x}-${y}`} d={`M${x} ${y - 2}q1.3 1.8 0 3q-1.3 -1.2 0 -3Z`} fill="var(--scene-vanilla)" opacity="0.85" />
            ))}
          </g>
        </g>
      );
    case 'vintage':
      // An oval vanity mirror, blush-lit, strung with pearls.
      return (
        <g>
          <ellipse cx="132" cy="16" rx="14" ry="12" fill="var(--scene-rose)" fillOpacity="0.28" stroke="var(--scene-gold)" strokeWidth="1.6" />
          <path d="M124 10q4 -4 9 -3" fill="none" stroke="var(--scene-vanilla)" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
          {[8, 18, 28, 38, 48, 58].map((x, i) => (
            <circle key={x} cx={x} cy={6 + Math.sin(i * 0.9) * 2 + i * 0.8} r="1.8" fill="var(--scene-vanilla)" opacity="0.75" />
          ))}
        </g>
      );
  }
}

/** A tiny room painted in one realm's own colors: page, card, gold rule and a lit candle. */
function RealmScene({ realm }: { realm: RealmId }) {
  const p = REALM_PALETTES[realm];
  const vars = {
    '--scene-espresso': p.espresso,
    '--scene-mahogany': p.mahogany,
    '--scene-vanilla': p.vanilla,
    '--scene-taupe': p.taupe,
    '--scene-gold': p.gold,
    '--scene-burgundy': p.burgundy,
    '--scene-rose': p.rose,
    '--scene-sage': p.sage,
    '--scene-shadow': p.shadow,
  } as CSSProperties;
  return (
    <svg aria-hidden viewBox="0 0 160 96" className="realm-scene block h-auto w-full" style={vars} preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="96" fill="var(--scene-espresso)" />
      <RealmMotif realm={realm} />
      {/* The card on the desk, with its gold rule and two lines of handwriting. */}
      <rect x="15" y="40" width="88" height="46" rx="6" fill="var(--scene-shadow)" opacity="0.25" transform="translate(1.5 2.5)" />
      <rect x="15" y="40" width="88" height="46" rx="6" fill="var(--scene-mahogany)" stroke="var(--scene-gold)" strokeOpacity="0.45" strokeWidth="1" />
      <line x1="25" y1="51" x2="72" y2="51" stroke="var(--scene-gold)" strokeWidth="2" strokeLinecap="round" />
      <line x1="25" y1="61" x2="90" y2="61" stroke="var(--scene-taupe)" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="69" x2="64" y2="69" stroke="var(--scene-taupe)" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="25" y="75" width="18" height="5" rx="2.5" fill="var(--scene-burgundy)" />
      <circle cx="51" cy="77.5" r="2.5" fill="var(--scene-rose)" />
      {/* A tiny candle on a brass dish. Wax and flame are real things, so their colors stay put. */}
      <g className="realm-scene-candle">
        <circle cx="132" cy="54" r="12" fill="#ffcf6b" opacity="0.16" />
        <path className="realm-scene-flame" d="M132 47c-3 4 -3.5 7 0 9c3.5 -2 3 -5 0 -9Z" fill="#ffb347" />
        <path d="M132 51c-1.2 1.8 -1.3 3 0 4c1.3 -1 1.2 -2.2 0 -4Z" fill="#fff3c4" />
        <line x1="132" y1="56" x2="132" y2="58" stroke="#3a2a1e" strokeWidth="0.8" />
        <path d="M127.5 58h9v22h-9Z" fill="#efe4cf" />
        <path d="M127.5 58h9v3c-1.5 0 -1.5 3 -3 3s-1 -2 -3 -2s-1.5 1 -3 1Z" fill="#fbf4e4" />
        <ellipse cx="132" cy="81" rx="11" ry="3" fill="var(--scene-gold)" />
        <ellipse cx="132" cy="80" rx="7" ry="1.4" fill="var(--scene-shadow)" opacity="0.25" />
      </g>
    </svg>
  );
}

/** Vanity Drawer "Realm" section: pick one of the four realms, plus the sky toggle. */
export function RealmSection() {
  const { state, nowMinutes, updateSettings } = useVespera();
  const id = useId();
  const { realm, skyAtmosphere, dayStart, dayEnd } = state.settings;
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const phase = PHASE_HINT[skyPhase(nowMinutes, dayStart, dayEnd)];
  const PhaseIcon = phase.icon;

  function choose(next: RealmId) {
    if (next !== realm) updateSettings({ realm: next });
  }

  // Arrow keys walk the realms like any radio group (the grid reads left to right, top to bottom).
  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + REALMS.length) % REALMS.length;
    choose(REALMS[next].id);
    cards.current[next]?.focus();
  }

  return (
    <VanitySection
      icon={Castle}
      title="Theme"
      blurb="Pick the colors for Vespera."
      summary={`${REALMS.find((r) => r.id === realm)?.name ?? ''} · sky ${skyAtmosphere ? 'on' : 'off'}`}
    >
      <div role="radiogroup" aria-label="Theme"className="grid grid-cols-2 gap-2.5">
        {REALMS.map((r, i) => {
          const checked = r.id === realm;
          return (
            <button
              key={r.id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-labelledby={`${id}-${r.id}-name`}
              aria-describedby={`${id}-${r.id}-tagline`}
              tabIndex={checked ? 0 : -1}
              onClick={() => choose(r.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`realm-card group flex min-h-11 flex-col overflow-hidden rounded-xl text-left transition ${
                checked ? 'is-chosen ornate-border bg-mahogany' : 'border border-rose/20 bg-mahogany/50 hover:border-gold/50'
              }`}
            >
              <span className="relative block">
                <RealmScene realm={r.id} />
                {checked && (
                  <span aria-hidden className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border border-gold/60 bg-burgundy text-gold shadow-[0_1px_4px_color-mix(in_srgb,var(--shadow-color)_45%,transparent)]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2">
                <span id={`${id}-${r.id}-name`} className={`font-serif text-base leading-tight transition ${checked ? 'text-gold' : 'text-vanilla'}`}>
                  {r.name}
                </span>
                <span id={`${id}-${r.id}-tagline`} className="text-[11px] italic leading-snug text-taupe">
                  {r.tagline}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={skyAtmosphere}
        aria-labelledby={`${id}-sky-label`}
        aria-describedby={`${id}-sky-hint`}
        onClick={() => updateSettings({ skyAtmosphere: !skyAtmosphere })}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-rose/15 bg-mahogany/60 px-3 py-2.5 text-left transition hover:border-gold/40"
      >
        <PhaseIcon aria-hidden size={16} className={`shrink-0 transition ${skyAtmosphere ? 'text-gold' : 'text-taupe/60'}`} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-sky-label`} className={`text-sm transition ${skyAtmosphere ? 'text-vanilla' : 'text-taupe'}`}>
            Sky follows the time of day
          </span>
          <span id={`${id}-sky-hint`} className="text-xs italic leading-snug text-taupe/75">
            {skyAtmosphere ? phase.text : 'The sky above the title stays plain.'}
          </span>
        </span>
        <span aria-hidden className="sanctuary-switch-track">
          <span className="sanctuary-switch-knob" />
        </span>
      </button>
    </VanitySection>
  );
}
