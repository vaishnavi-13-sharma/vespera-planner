import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pause, Play, Wind } from 'lucide-react';
import { focusPhase, useVespera, type FocusSession } from '../../context/VesperaContext';
import { startAmbient } from '../../lib/sound';
import { FocusKitten } from '../trinket/FocusKitten';
import { useCelebrate } from '../ui/Sparkles';
import { useToast } from '../ui/Toast';
import { Candle, type CandleMood } from './Candle';
import { formatClock, formatDuration, minutesPhrase } from './format';
import './focus.css';

const MIN = 60_000;
const TICK_MS = 500;
const MAX_QUESTS = 3;

const WORD: Record<CandleMood, string> = { focus: 'Focus', rest: 'Rest', paused: 'Paused' };
const MOOD_LINE: Record<CandleMood, string> = {
  focus: 'One thing at a time.',
  rest: 'Take a short break and rest your eyes.',
  paused: 'Paused. Resume when you’re ready.',
};
const RHYTHM_CYCLE = { pomodoro25: 30, pomodoro50: 60 } as const;

const CHAMBER_BUTTON = 'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition';

/** Full-screen focus session overlay, shown while state.focusSession is set. */
export function FocusChamber() {
  const { state } = useVespera();
  const session = state.focusSession;
  if (!session) return null;
  // Keyed per session so phase tracking starts fresh each time a candle is lit.
  return <Chamber key={`${session.occurrenceKey}@${session.startedAt}`} session={session} />;
}

function Chamber({ session }: { session: FocusSession }) {
  const { state, pauseFocus, resumeFocus, finishFocus, toggleTask } = useVespera();
  const celebrate = useCelebrate();
  const showToast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const p = focusPhase(session, now);
  const mood: CandleMood = p.paused ? 'paused' : p.phase === 'rest' ? 'rest' : 'focus';
  const clock = formatClock(p.remainingMs);

  // Focus ↔ Rest: a soft chime and a little shimmer.
  const lastPhase = useRef(p.phase);
  useEffect(() => {
    const was = lastPhase.current;
    lastPhase.current = p.phase;
    if (was !== p.phase && was !== 'done' && p.phase !== 'done') celebrate('small', null, 'chime');
  }, [p.phase, celebrate]);

  // The candle burns down: celebrate, log the minutes and close.
  const finished = useRef(false);
  useEffect(() => {
    if (p.phase !== 'done' || finished.current) return;
    finished.current = true;
    celebrate('big', null, 'chime');
    finishFocus();
    showToast({ message: `Session complete · ${minutesPhrase(Math.floor(p.focusMs / MIN))} of focus` });
  }, [p.phase, p.focusMs, celebrate, finishFocus, showToast]);

  // Ambient rain or fire, only while actually focusing.
  const { sounds, volume } = state.settings;
  const ambient = p.phase === 'focus' && !p.paused && session.sound !== 'off' && sounds ? session.sound : null;
  useEffect(() => {
    if (!ambient) return;
    return startAmbient(ambient, volume);
  }, [ambient, volume]);

  // Take the stage: focus the chamber, hold the page still, and restore both after.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // The countdown in the browser tab, for a glance from elsewhere.
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);
  useEffect(() => {
    document.title = `${clock} · ${WORD[mood]} · Vespera`;
  }, [clock, mood]);

  function togglePause() {
    if (p.paused) resumeFocus();
    else pauseFocus();
    setNow(Date.now());
  }

  function end() {
    const minutes = Math.floor(focusPhase(session, Date.now()).focusMs / MIN);
    finished.current = true;
    finishFocus();
    showToast({ message: `${minutesPhrase(minutes)} of focus logged` });
  }

  /** Keep Tab inside the chamber; Escape deliberately does nothing. */
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const category = session.categoryId ? state.categories.find((c) => c.id === session.categoryId && !c.archived) : undefined;
  const open = category ? state.tasks.filter((t) => t.categoryId === category.id && !t.done) : [];
  const cycleMinutes = session.rhythm === 'whole' ? null : RHYTHM_CYCLE[session.rhythm];
  const detail = cycleMinutes
    ? `Cycle ${p.cycle} of ${Math.ceil(session.totalMinutes / cycleMinutes)} · ${formatDuration(Math.ceil(p.totalRemainingMs / MIN))} left in all`
    : `Whole block · ${formatDuration(session.totalMinutes)}`;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Focus Timer"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-mood={mood}
      className="fc-chamber fixed inset-0 z-[55] overflow-y-auto text-vanilla outline-none"
    >
      <div aria-hidden className="fc-embers">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="fc-ember" />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-5 px-4 py-10 text-center sm:gap-6 sm:py-14">
        <header className="flex flex-col items-center gap-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.4em] text-gold/70">✦ Focus Timer ✦</p>
          <h2 className="font-serif text-3xl leading-tight text-vanilla [overflow-wrap:anywhere] sm:text-4xl">{session.title}</h2>
        </header>

        <Candle remaining={p.totalRemainingMs / (session.totalMinutes * MIN)} mood={mood} />
        <FocusKitten />

        <div className="flex flex-col items-center gap-1">
          <p key={mood} aria-live="polite" className="fc-fade-in text-sm uppercase tracking-[0.35em] text-gold">
            {WORD[mood]}
          </p>
          <p
            role="timer"
            aria-label="Time remaining"
            className={`font-serif text-6xl tabular-nums leading-none transition-colors duration-1000 sm:text-7xl ${
              mood === 'focus' ? 'text-vanilla' : 'text-taupe'
            }`}
          >
            {clock}
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest text-taupe">{detail}</p>
          <p className="subheading mt-1 text-base">{MOOD_LINE[mood]}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={togglePause}
            className={`${CHAMBER_BUTTON} border border-gold/60 text-gold hover:bg-gold/10`}
          >
            {p.paused ? <Play aria-hidden size={16} /> : <Pause aria-hidden size={16} />}
            {p.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={end} className={`${CHAMBER_BUTTON} text-taupe hover:text-rose`}>
            <Wind aria-hidden size={16} />
            End session
          </button>
        </div>

        {category && (
          <section className="velvet-card w-full max-w-md px-4 py-3.5 text-left">
            <h3 className="subheading flex items-center gap-2 text-base">
              <span aria-hidden>{category.emoji}</span>
              <span className="truncate">{category.name}</span>
            </h3>
            {open.length > 0 ? (
              <ul aria-label="Quests for this block" className="mt-2 flex flex-col gap-1.5">
                {open.slice(0, MAX_QUESTS).map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5">
                    <button
                      type="button"
                      aria-label={`Mark “${t.title}” done`}
                      onClick={(e) => {
                        celebrate('small', e.currentTarget);
                        toggleTask(t.id);
                      }}
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-gold/50 text-transparent transition hover:border-gold hover:bg-gold/15 hover:text-gold"
                    >
                      <Check aria-hidden size={12} />
                    </button>
                    <span className="text-sm leading-snug text-vanilla/90 [overflow-wrap:anywhere]">{t.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm italic text-taupe">Every quest in this category is done.</p>
            )}
            {open.length > MAX_QUESTS && <p className="mt-2 text-xs text-taupe">and {open.length - MAX_QUESTS} more on the Quest Board</p>}
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
