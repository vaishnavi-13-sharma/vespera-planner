import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Cat } from 'lucide-react';
import { useVespera, type TrinketKind } from '../../context/VesperaContext';
import { VanitySection } from '../vanity/VanitySection';
import { CatArt, JarArt, ShelfArt, VialArt } from './art';
import './trinket.css';

const OPTIONS: { id: TrinketKind; name: string; preview: ReactNode }[] = [
  { id: 'cat', name: 'Castle kitten', preview: <CatArt mood="awake" /> },
  { id: 'vial', name: 'Rosewater vial', preview: <VialArt ratio={0.6} /> },
  { id: 'jar', name: 'Firefly jar', preview: <JarArt count={5} still /> },
  { id: 'none', name: 'None', preview: <ShelfArt className="opacity-50" /> },
];

/** Vanity Drawer "Desk trinket" section: choose the small companion that lives on the header shelf. */
export function TrinketSection() {
  const { state, updateSettings } = useVespera();
  const chosen = state.settings.trinket;
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move the choice around the group, as in any radio group.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (OPTIONS.findIndex((o) => o.id === chosen) + step + OPTIONS.length) % OPTIONS.length;
    updateSettings({ trinket: OPTIONS[next].id });
    radios.current[next]?.focus();
  }

  return (
    <VanitySection
      icon={Cat}
      title="Desk trinket"
      blurb="A little decoration at the top of the page."
      summary={OPTIONS.find((o) => o.id === chosen)?.name ?? ''}
    >
      <div role="radiogroup" aria-label="Desk trinket" onKeyDown={onKeyDown} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o, i) => {
          const checked = o.id === chosen;
          return (
            <button
              key={o.id}
              ref={(el) => {
                radios.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => updateSettings({ trinket: o.id })}
              className={`flex min-h-14 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left font-serif text-base leading-tight text-vanilla transition ${
                checked
                  ? 'border-gold/70 bg-burgundy/25 shadow-[0_0_12px_color-mix(in_srgb,var(--color-gold)_25%,transparent)]'
                  : 'border-gold/15 bg-mahogany/40 hover:border-gold/40'
              }`}
            >
              <span aria-hidden className="tk-preview tk-still grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-espresso/50">
                {o.preview}
              </span>
              {o.name}
            </button>
          );
        })}
      </div>
    </VanitySection>
  );
}
