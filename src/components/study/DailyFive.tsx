import { useEffect, useRef, useState } from 'react';
import { MoonStar, RotateCcw, Sparkles } from 'lucide-react';
import { dailyFive, useVespera, type Note } from '../../context/VesperaContext';
import { PRIMARY_BUTTON_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import { useCelebrate } from '../ui/Sparkles';
import { StudyCard } from './StudyCard';

interface Graded {
  id: string;
  knew: boolean;
}

/** The Daily 5 sheet body: one snapshotted round of flashcards, graded one by one. */
export function DailyFive({ onDone }: { onDone: () => void }) {
  const { state, today, reviewCard } = useVespera();
  const celebrate = useCelebrate();
  // Snapshot the round so grading (which reschedules cards) doesn't reshuffle it.
  const [round, setRound] = useState<Note[]>(() => dailyFive(state, today));
  const [results, setResults] = useState<Graded[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [touched, setTouched] = useState(false);
  const knewRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);

  const index = results.length;
  const card = round[index];
  const complete = round.length > 0 && !card;

  useEffect(() => {
    if (revealed) knewRef.current?.focus();
  }, [revealed]);
  useEffect(() => {
    if (complete) againRef.current?.focus();
  }, [complete]);

  function grade(knew: boolean) {
    reviewCard(card.id, knew);
    setResults((r) => [...r, { id: card.id, knew }]);
    setReviewed((r) => [...r, card.id]);
    setRevealed(false);
    setTouched(true);
    if (index === round.length - 1) celebrate('big', null, 'chime');
  }

  function oneMoreRound() {
    setRound(dailyFive(state, today, 5, reviewed));
    setResults([]);
    setRevealed(false);
  }

  if (round.length === 0) {
    return (
      <div className="study-rise flex flex-col items-center gap-3 py-10 text-center">
        <MoonStar aria-hidden className="study-float h-10 w-10 text-gold" strokeWidth={1.25} />
        <p className="max-w-[24ch] font-serif text-xl italic text-vanilla">All caught up. No cards are due right now.</p>
        <button type="button" onClick={onDone} className={`${QUIET_BUTTON_CLASS} mt-2`}>
          Done
        </button>
      </div>
    );
  }

  if (complete) {
    const knew = results.filter((r) => r.knew).length;
    return (
      <div className="study-rise flex flex-col items-center gap-3 py-6 text-center">
        <div aria-hidden className="study-seal flex h-20 w-20 items-center justify-center rounded-full bg-burgundy text-gold">
          <Sparkles className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <h3 className="font-serif text-3xl text-gold">Round complete</h3>
        <p className="subheading text-lg">{`${knew} knew it · ${results.length - knew} not yet`}</p>
        <Pips results={results} total={round.length} />
        <p className="max-w-[30ch] text-sm text-taupe">Each review helps the words stick. Stop here, or do another round.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button ref={againRef} type="button" onClick={oneMoreRound} className={PRIMARY_BUTTON_CLASS}>
            <RotateCcw aria-hidden size={14} />
            One more round
          </button>
          <button type="button" onClick={onDone} className={QUIET_BUTTON_CLASS}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="subheading text-base">{`Card ${index + 1} of ${round.length}`}</p>
        <Pips results={results} total={round.length} />
      </div>

      <StudyCard
        key={card.id}
        note={card}
        tag={state.noteTags.find((t) => t.id === card.tagId)}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        autoFocus={touched}
      />

      {revealed ? (
        <div className="study-rise grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => grade(false)} className={`${QUIET_BUTTON_CLASS} py-2.5`}>
            Not yet
          </button>
          <button ref={knewRef} type="button" onClick={() => grade(true)} className={`${PRIMARY_BUTTON_CLASS} py-2.5`}>
            Knew it <span aria-hidden>✨</span>
          </button>
        </div>
      ) : (
        <p className="text-center text-xs italic text-taupe/80">Guess the meaning, then flip the card.</p>
      )}
    </div>
  );
}

/** Wax-seal progress: gold for knew it, rose for not yet, hollow for still to come. */
function Pips({ results, total }: { results: Graded[]; total: number }) {
  return (
    <ol aria-hidden className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const tone = !r ? 'border border-gold/40' : r.knew ? 'bg-gold shadow-[0_0_8px_color-mix(in_srgb,var(--color-gold)_70%,transparent)]' : 'bg-rose/70';
        return <li key={i} className={`h-2.5 w-2.5 rounded-full transition-colors duration-500 ${tone} ${i === results.length ? 'study-pip-now' : ''}`} />;
      })}
    </ol>
  );
}
