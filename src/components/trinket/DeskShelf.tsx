import { useEffect, useRef, useState } from 'react';
import { catMood, todayProgress, useVespera, winsThisWeek, type CatMood } from '../../context/VesperaContext';
import { CatArt, JarArt, ShelfArt, VialArt } from './art';
import { playPurr } from './purr';
import './trinket.css';

const MOOD_WORD: Record<CatMood, string> = { nap: 'napping', awake: 'awake', focus: 'wearing glasses' };

/** How long each trinket's tap reaction plays, in ms. */
const REACTION_MS = { cat: 1200, vial: 1200, jar: 1500 } as const;

/** The little shelf in the header holding your desk trinket: tap it to pet the kitten, swirl the rosewater or stir the fireflies. */
export function DeskShelf() {
  const { state, today, nowMinutes } = useVespera();
  const { trinket, sounds, volume } = state.settings;
  const [taps, setTaps] = useState(0);
  const [reacting, setReacting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (trinket === 'none') return null;

  let label: string;
  let art;
  if (trinket === 'cat') {
    const mood = catMood(state, today, nowMinutes);
    label = `Castle kitten, ${MOOD_WORD[mood]}`;
    art = <CatArt mood={mood} />;
  } else if (trinket === 'vial') {
    const { done, total, ratio } = todayProgress(state.tasks, today);
    label = `Rosewater vial, ${done} of ${total} quests`;
    art = <VialArt ratio={ratio} done={done} full={total > 0 && done === total} />;
  } else {
    const wins = winsThisWeek(state, today);
    label = `Firefly jar, ${wins} small ${wins === 1 ? 'win' : 'wins'} this week`;
    art = <JarArt count={wins} />;
  }

  function react() {
    if (trinket === 'none') return;
    setTaps((n) => n + 1);
    setReacting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setReacting(false), REACTION_MS[trinket]);
    if (trinket === 'cat' && sounds) playPurr(volume);
  }

  return (
    <button type="button" aria-label={label} onClick={react} data-trinket={trinket} data-reacting={reacting || undefined} className="tk-shelf">
      <span className="tk-stage">
        {art}
        {trinket === 'cat' && reacting && (
          <svg key={taps} aria-hidden data-heart viewBox="0 0 12 11" className="tk-heart">
            <path d="M6 10.4 C2.6 7.9 0.6 6 0.6 3.6 C0.6 1.9 1.9 0.6 3.5 0.6 C4.6 0.6 5.5 1.2 6 2.1 C6.5 1.2 7.4 0.6 8.5 0.6 C10.1 0.6 11.4 1.9 11.4 3.6 C11.4 6 9.4 7.9 6 10.4 Z" />
          </svg>
        )}
      </span>
      <ShelfArt />
    </button>
  );
}
