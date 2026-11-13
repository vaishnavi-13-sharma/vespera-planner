import { Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { skyPhase, useVespera, type SkyPhase } from '../../context/VesperaContext';
import './sanctuary.css';

const PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night'];

/** Hand-placed so the stars frame the title instead of sitting on it: [left %, top %, size px, twinkle delay s]. */
const STARS: [number, number, number, number][] = [
  [6, 18, 2, 0],
  [14, 46, 1.5, 1.8],
  [22, 12, 2.5, 3.1],
  [30, 34, 1.5, 0.7],
  [64, 10, 2, 2.4],
  [70, 40, 1.5, 4.2],
  [86, 52, 2, 1.1],
  [93, 22, 1.5, 3.6],
  [42, 6, 1.5, 5],
  [55, 58, 1.5, 2.9],
  [9, 64, 1.5, 4.6],
];


/** The header sky that follows the time of day (behind the title). */
export function HeaderSky() {
  const { state, nowMinutes } = useVespera();
  const { skyAtmosphere, dayStart, dayEnd } = state.settings;
  if (!skyAtmosphere) return null;
  const phase = skyPhase(nowMinutes, dayStart, dayEnd);

  // Bleeds to the edge of the page by exactly the page padding (px-3 / sm:px-4 / lg:px-8 in App), never past the screen.
  return (
    <div aria-hidden data-sky-phase={phase} className="header-sky pointer-events-none absolute -inset-x-3 -top-6 bottom-0 -z-10 sm:-inset-x-4 lg:-inset-x-8">
      {PHASES.map((p) => (
        <div key={p} className={`sky-layer sky-${p} ${p === phase ? 'is-active' : ''}`}>
          {p === 'dawn' && <span className="sky-sun" />}
          {p === 'night' &&
            STARS.map(([left, top, size, delay]) => (
              <span key={`${left}-${top}`} className="sky-star" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }} />
            ))}
        </div>
      ))}
    </div>
  );
}

const GLYPHS: Record<SkyPhase, { Icon: LucideIcon; title: string }> = {
  dawn: { Icon: Sunrise, title: 'Sunrise' },
  day: { Icon: Sun, title: 'Daytime' },
  dusk: { Icon: Sunset, title: 'Sunset' },
  night: { Icon: Moon, title: 'Night' },
};

/** A small decorative time-of-day glyph for the header cluster (the moon and sun live here, not in the sky). */
export function SkyGlyph() {
  const { state, nowMinutes } = useVespera();
  const phase = skyPhase(nowMinutes, state.settings.dayStart, state.settings.dayEnd);
  const { Icon, title } = GLYPHS[phase];
  return (
    <span aria-hidden data-sky-glyph={phase} title={title} className="sky-glyph grid h-11 w-7 shrink-0 place-items-center text-gold">
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}
