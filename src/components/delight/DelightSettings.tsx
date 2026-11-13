import { useId, type ReactNode } from 'react';
import { Bell, Flower2, Leaf, ScrollText, Snowflake, Sparkles as SparklesIcon, Volume1, Volume2, type LucideIcon } from 'lucide-react';
import { seasonFor, useVespera, type Season, type Settings } from '../../context/VesperaContext';
import { QUIET_BUTTON_CLASS } from '../ui/accents';
import { useCelebrate } from '../ui/Sparkles';
import { VanitySection } from '../vanity/VanitySection';
import './delight.css';

type DelightKey = 'sparkles' | 'sounds' | 'seasonal' | 'weeklySummary';

const SEASON_HINT: Record<Season, { icon: LucideIcon; text: string }> = {
  winter: { icon: Snowflake, text: 'Falling snow and a red ribbon in the corner.' },
  autumn: { icon: Leaf, text: 'A few falling leaves.' },
  valentine: { icon: Flower2, text: 'Falling rose petals.' },
  spring: { icon: Flower2, text: 'Falling blossoms.' },
};

function DelightSwitch({ icon: Icon, label, hint, checked, onToggle }: { icon: LucideIcon; label: string; hint: ReactNode; checked: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      onClick={onToggle}
      className="group flex w-full items-center gap-3 rounded-xl border border-rose/15 bg-mahogany/60 px-3 py-2.5 text-left transition hover:border-gold/40"
    >
      <Icon aria-hidden size={16} className={`shrink-0 transition ${checked ? 'text-gold' : 'text-taupe/60'}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={`${id}-label`} className={`text-sm transition ${checked ? 'text-vanilla' : 'text-taupe'}`}>
          {label}
        </span>
        <span id={`${id}-hint`} className="text-xs italic leading-snug text-taupe/75">
          {hint}
        </span>
      </span>
      <span aria-hidden className="delight-switch-track">
        <span className="delight-switch-knob" />
      </span>
    </button>
  );
}

/** The folded header's line: "Sparkles, sounds on", "Sparkles on, sounds off" and so on. */
function delightSummary(sparkles: boolean, sounds: boolean): string {
  if (sparkles === sounds) return `Sparkles, sounds ${sparkles ? 'on' : 'off'}`;
  return `Sparkles ${sparkles ? 'on' : 'off'}, sounds ${sounds ? 'on' : 'off'}`;
}

/** The "Delights" section of the Vanity Drawer: sparkles, sounds, seasons and the weekly recap. */
export function DelightSettings() {
  const { state, today, updateSettings } = useVespera();
  const celebrate = useCelebrate();
  const id = useId();
  const { sparkles, sounds, volume, seasonal, weeklySummary } = state.settings;
  const season = seasonFor(today);
  const toggle = (key: DelightKey) => updateSettings({ [key]: !state.settings[key] } as Partial<Settings>);
  const percent = Math.round(volume * 100);

  return (
    <VanitySection icon={SparklesIcon} title="Effects & sounds" blurb="Sparkles, sounds and seasonal decorations." summary={delightSummary(sparkles, sounds)}>
      <div className="flex flex-col gap-2">
        <DelightSwitch icon={SparklesIcon} label="Sparkles" hint="A burst of gold when you finish something." checked={sparkles} onToggle={() => toggle('sparkles')} />
        <DelightSwitch icon={Bell} label="Sounds" hint="A soft click and a chime." checked={sounds} onToggle={() => toggle('sounds')} />
        <DelightSwitch
          icon={season ? SEASON_HINT[season].icon : Leaf}
          label="Seasonal touches"
          hint={season ? SEASON_HINT[season].text : 'Nothing right now. They come back in the fall.'}
          checked={seasonal}
          onToggle={() => toggle('seasonal')}
        />
        <DelightSwitch icon={ScrollText} label="Weekly summary" hint="A recap of last week, shown on Mondays." checked={weeklySummary} onToggle={() => toggle('weeklySummary')} />
      </div>

      <div className={`flex flex-col gap-2 rounded-xl border border-rose/15 bg-espresso/40 px-3 py-3 transition ${sounds ? '' : 'opacity-55'}`}>
        <div className="flex items-center justify-between">
          <label htmlFor={`${id}-volume`} className="text-xs text-taupe">
            Volume
          </label>
          <span aria-hidden className="font-serif text-sm tabular-nums text-gold">
            {percent}%
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <Volume1 aria-hidden size={15} className="shrink-0 text-taupe/70" />
          <input
            id={`${id}-volume`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={percent}
            aria-label="Volume"
            disabled={!sounds}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
            className="delight-volume h-1.5 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed"
          />
          <Volume2 aria-hidden size={15} className="shrink-0 text-taupe/70" />
        </div>
        <button
          type="button"
          disabled={!sounds}
          onClick={(e) => celebrate('small', e.currentTarget, 'chime')}
          className={`${QUIET_BUTTON_CLASS} self-start disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Bell aria-hidden size={14} /> Test sound
        </button>
      </div>
    </VanitySection>
  );
}
