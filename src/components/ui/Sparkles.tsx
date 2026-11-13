import { createContext, useCallback, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useVespera } from '../../context/VesperaContext';
import { playChime, playSeal } from '../../lib/sound';

export type CelebrationSize = 'small' | 'big';
export type CelebrationSound = 'seal' | 'chime' | 'none';
type Origin = Element | { x: number; y: number } | null | undefined;

/** `celebrate(size, origin?, sound?)`: gold sparkles at an element or point (respecting settings) plus a sound. */
export type Celebrate = (size: CelebrationSize, origin?: Origin, sound?: CelebrationSound) => void;

const CelebrateContext = createContext<Celebrate>(() => {});

export function useCelebrate(): Celebrate {
  return useContext(CelebrateContext);
}

interface Burst {
  id: number;
  x: number;
  y: number;
  size: CelebrationSize;
}

const PARTICLES: Record<CelebrationSize, number> = { small: 10, big: 28 };

function centerOf(origin: Origin): { x: number; y: number } {
  if (origin && 'getBoundingClientRect' in origin) {
    const r = origin.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (origin) return origin;
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

/** Mount once inside VesperaProvider. Renders bursts in a fixed, click-through layer. */
export function SparkleProvider({ children }: { children: ReactNode }) {
  const { state } = useVespera();
  const settings = useRef(state.settings);
  settings.current = state.settings;
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  const celebrate = useCallback<Celebrate>((size, origin, sound = size === 'big' ? 'chime' : 'seal') => {
    const s = settings.current;
    if (s.sounds && sound === 'seal') playSeal(s.volume);
    if (s.sounds && sound === 'chime') playChime(s.volume);
    if (!s.sparkles) return;
    const id = nextId.current++;
    setBursts((all) => [...all, { id, size, ...centerOf(origin) }]);
    setTimeout(() => setBursts((all) => all.filter((b) => b.id !== id)), size === 'big' ? 1600 : 1000);
  }, []);

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {createPortal(
        <div aria-hidden data-testid="sparkle-layer" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
          {bursts.map((b) =>
            Array.from({ length: PARTICLES[b.size] }, (_, i) => {
              const angle = (i / PARTICLES[b.size]) * Math.PI * 2 + Math.random() * 0.5;
              const distance = (b.size === 'big' ? 70 : 34) + Math.random() * (b.size === 'big' ? 90 : 28);
              const style = {
                left: b.x,
                top: b.y,
                '--dx': `${Math.cos(angle) * distance}px`,
                '--dy': `${Math.sin(angle) * distance}px`,
                animationDelay: `${Math.random() * 120}ms`,
              } as CSSProperties;
              return <span key={`${b.id}-${i}`} data-sparkle className={`sparkle-particle ${i % 3 === 0 ? 'sparkle-star' : ''}`} style={style} />;
            }),
          )}
        </div>,
        document.body,
      )}
    </CelebrateContext.Provider>
  );
}
