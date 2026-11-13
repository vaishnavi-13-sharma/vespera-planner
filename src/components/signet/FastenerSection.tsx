import { useId } from 'react';
import { Flower2, Pin } from 'lucide-react';
import { useVespera, type Fastener as FastenerKind } from '../../context/VesperaContext';
import { Fastener } from '../pinboard/Fastener';
import { Sprig } from '../pinboard/Sprig';
import { VanitySection } from '../vanity/VanitySection';
import { useRadioKeys } from './useRadioKeys';
import './signet.css';

// Preview ids picked so each little scrap shows a pleasing angle and tape.
const KINDS: { id: FastenerKind; name: string; preview: string }[] = [
  { id: 'tacks', name: 'Brass tacks', preview: 'preview-tacks' },
  { id: 'bows', name: 'Velvet bows', preview: 'preview-bows' },
  { id: 'washi', name: 'Washi tape', preview: 'preview-washi' },
];
const KIND_IDS = KINDS.map((k) => k.id);

/** The Vanity Drawer "Pinboard" section: one fastener for the whole board, plus optional pressed sprigs. */
export function FastenerSection() {
  const { state, updateSettings } = useVespera();
  const id = useId();
  const { fastener, sprigs } = state.settings;
  const keys = useRadioKeys<FastenerKind>(KIND_IDS, fastener, (next) => updateSettings({ fastener: next }));

  return (
    <VanitySection
      icon={Pin}
      title="Pinboard"
      blurb="How your notes are pinned."
      summary={`${KINDS.find((k) => k.id === fastener)?.name ?? ''}${sprigs ? ' · flower sprigs' : ''}`}
    >
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-label`} className="text-xs text-taupe">
          Fastener
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-3 gap-2">
          {KINDS.map((k, i) => {
            const checked = k.id === fastener;
            return (
              <button
                key={k.id}
                {...keys(k.id, i)}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => updateSettings({ fastener: k.id })}
                className={`flex flex-col items-center gap-2 rounded-xl border px-2 pt-4 pb-2.5 text-center text-xs leading-tight transition ${
                  checked
                    ? 'border-gold/70 bg-gold/10 text-vanilla shadow-[0_0_14px_color-mix(in_srgb,var(--color-gold)_20%,transparent)]'
                    : 'border-rose/20 text-taupe hover:border-rose/50 hover:text-vanilla'
                }`}
              >
                <span aria-hidden className={`relative isolate block h-12 w-full max-w-20 transition ${checked ? '' : 'opacity-85'}`}>
                  {sprigs && <Sprig noteId="preview-sprig" />}
                  <span className="fastener-swatch absolute inset-0 bg-parchment" />
                  <span className="absolute inset-x-3 top-5 flex flex-col gap-1.5">
                    <span className="h-px bg-ink/25" />
                    <span className="h-px w-3/4 bg-ink/20" />
                    <span className="h-px w-1/2 bg-ink/15" />
                  </span>
                  <Fastener kind={k.id} noteId={k.preview} />
                </span>
                {k.name}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={sprigs}
        aria-labelledby={`${id}-sprigs`}
        aria-describedby={`${id}-sprigs-hint`}
        onClick={() => updateSettings({ sprigs: !sprigs })}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-rose/15 bg-mahogany/60 px-3 py-2.5 text-left transition hover:border-gold/40"
      >
        <Flower2 aria-hidden size={16} className={`shrink-0 transition ${sprigs ? 'text-gold' : 'text-taupe/60'}`} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-sprigs`} className={`text-sm transition ${sprigs ? 'text-vanilla' : 'text-taupe'}`}>
            Flower sprigs
          </span>
          <span id={`${id}-sprigs-hint`} className="text-xs italic leading-snug text-taupe/75">
            Adds a small flower behind some of your notes.
          </span>
        </span>
        <span aria-hidden className="signet-switch-track">
          <span className="signet-switch-knob" />
        </span>
      </button>
    </VanitySection>
  );
}
