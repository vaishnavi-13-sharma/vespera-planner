import { useId, useState } from 'react';
import { Stamp } from 'lucide-react';
import { normalizeInitial, SEAL_COLORS, SEAL_EMBLEMS, useVespera, type SealColor, type SealEmblem, type Signet } from '../../context/VesperaContext';
import { FIELD_CLASS } from '../ui/accents';
import { VanitySection } from '../vanity/VanitySection';
import { useRadioKeys } from './useRadioKeys';
import { WaxSeal } from './WaxSeal';

const COLOR_IDS = SEAL_COLORS.map((c) => c.id);
const EMBLEM_IDS = SEAL_EMBLEMS.map((e) => e.id);

const CHOICE_ON = 'border-gold/70 bg-gold/10 text-vanilla shadow-[0_0_14px_color-mix(in_srgb,var(--color-gold)_20%,transparent)]';
const CHOICE_OFF = 'border-rose/20 text-taupe hover:border-rose/50 hover:text-vanilla';

/** The Vanity Drawer "Signet" section: the wax color, and the emblem or initial pressed into it. */
export function SignetSection() {
  const { state, updateSettings } = useVespera();
  const id = useId();
  const { signet } = state.settings;
  const setSignet = (patch: Partial<Signet>) => updateSettings({ signet: { ...signet, ...patch } });
  const colorKeys = useRadioKeys<SealColor>(COLOR_IDS, signet.color, (color) => setSignet({ color }));
  const emblemKeys = useRadioKeys<SealEmblem>(EMBLEM_IDS, signet.emblem, (emblem) => setSignet({ emblem }));

  // A draft lets the one-letter field sit empty mid-edit; only a real letter is saved.
  const [draft, setDraft] = useState(signet.initial);
  const [synced, setSynced] = useState(signet.initial);
  if (synced !== signet.initial) {
    setSynced(signet.initial);
    setDraft(signet.initial);
  }

  function typeInitial(value: string) {
    if (value === '') return setDraft('');
    if (!/[a-z]/i.test(value.normalize('NFD'))) return;
    const initial = normalizeInitial(value);
    setDraft(initial);
    setSignet({ initial });
  }

  const colorName = SEAL_COLORS.find((c) => c.id === signet.color)?.name ?? '';
  const emblemName = signet.emblem === 'initial' ? `The initial ${signet.initial}` : SEAL_EMBLEMS.find((e) => e.id === signet.emblem)?.name;

  return (
    <VanitySection icon={Stamp} title="Wax seal" blurb="The seal that marks each finished quest." summary={`${colorName} · ${emblemName}`}>
      <div className="flex items-center gap-4">
        <div className="signet-cushion grid h-28 w-28 shrink-0 place-items-center rounded-full">
          <WaxSeal key={`${signet.color}-${signet.emblem}-${signet.initial}`} signet={signet} size={88} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-serif text-xl leading-tight text-vanilla">{colorName} wax</p>
          <p className="font-serif text-base italic text-gold">{emblemName}</p>
          <p className="mt-1 text-xs leading-snug text-taupe">Shown on every quest you finish and in your History.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-color`} className="text-xs text-taupe">
          Seal color
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-color`} className="flex flex-wrap gap-2">
          {SEAL_COLORS.map((c, i) => {
            const checked = c.id === signet.color;
            return (
              <button
                key={c.id}
                {...colorKeys(c.id, i)}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSignet({ color: c.id })}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2 text-sm transition ${checked ? CHOICE_ON : CHOICE_OFF}`}
              >
                <span
                  aria-hidden
                  className={`signet-bead h-6 w-6 shrink-0 rounded-full transition ${checked ? 'scale-110' : ''}`}
                  style={{ backgroundColor: c.wax }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`${id}-emblem`} className="text-xs text-taupe">
          Emblem
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-emblem`} className="grid grid-cols-4 gap-2 sm:grid-cols-7 min-[1100px]:grid-cols-4">
          {SEAL_EMBLEMS.map((e, i) => {
            const checked = e.id === signet.emblem;
            return (
              <button
                key={e.id}
                {...emblemKeys(e.id, i)}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSignet({ emblem: e.id })}
                className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[0.7rem] leading-tight transition ${
                  checked ? CHOICE_ON : CHOICE_OFF
                }`}
              >
                <WaxSeal signet={{ ...signet, emblem: e.id }} decorative size={34} className={checked ? '' : 'opacity-80'} />
                {e.name}
              </button>
            );
          })}
        </div>
      </div>

      {signet.emblem === 'initial' && (
        <div className="flex items-center gap-3">
          <label htmlFor={`${id}-initial`} className="text-xs text-taupe">
            Initial
          </label>
          <input
            id={`${id}-initial`}
            value={draft}
            maxLength={1}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => typeInitial(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => setDraft(signet.initial)}
            className={`${FIELD_CLASS} h-12 w-12 text-center font-serif text-2xl uppercase`}
          />
          <p className="text-xs italic leading-snug text-taupe/80">One letter, A to Z.</p>
        </div>
      )}
    </VanitySection>
  );
}
