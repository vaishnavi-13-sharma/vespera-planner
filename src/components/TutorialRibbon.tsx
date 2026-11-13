import { useState } from 'react';
import { Eraser, Sparkles } from 'lucide-react';
import { hasTutorial, useVespera } from '../context/VesperaContext';
import { scrollToTop, spotlight, START_HERE_ID } from './quest/spotlight';
import { revealPanel } from './shell/revealPanel';
import { ChoiceDialog } from './ui/ChoiceDialog';
import { useToast } from './ui/Toast';

/** "Clear starter tutorial & start fresh", with a confirm. Renders nothing once the tutorial is gone. */
export function ClearTutorialButton({ className }: { className?: string }) {
  const { state, clearTutorial } = useVespera();
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  if (!hasTutorial(state)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          className ??
          'inline-flex w-full items-center justify-start gap-1.5 rounded-lg border border-gold/30 px-3 py-2 text-sm text-gold transition hover:border-gold hover:bg-gold/10'
        }
      >
        <Eraser aria-hidden size={15} /> Clear starter tutorial & start fresh
      </button>
      <ChoiceDialog
        open={confirming}
        title="Clear the starter tutorial?"
        message="Every tutorial quest, block and note goes away. Your four categories stay, empty and ready to use. Anything you added yourself is kept."
        choices={[{ value: 'clear', label: 'Clear it & start fresh', tone: 'primary' }]}
        onChoose={() => {
          setConfirming(false);
          clearTutorial();
          showToast({ message: 'Tutorial cleared. Your board is ready.' });
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** Turn to the Quests (on phones and tablets), glide to the Start Here category and ring it in gold. */
function goToStartHere() {
  revealPanel('quests');
  const category = document.getElementById(`quest-category-${START_HERE_ID}`);
  if (!category) return;
  scrollToTop(category);
  spotlight(category);
}

/** A slim gold ribbon above the panels while the starter tutorial is still on the board. */
export function TutorialRibbon() {
  const { state } = useVespera();
  if (!hasTutorial(state)) return null;
  const startHereShown = state.categories.some((c) => c.id === START_HERE_ID && !c.archived);
  return (
    <div role="region" aria-label="Starter tutorial" className="ornate-border mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-gold/10 px-4 py-1.5 text-sm text-vanilla">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5">
        <Sparkles aria-hidden size={15} className="text-gold" />
        New here? Try the
        {startHereShown ? (
          <button
            type="button"
            onClick={goToStartHere}
            className="-mx-1 inline-flex min-h-11 items-center rounded-full px-1 font-serif text-base font-semibold text-gold underline decoration-gold/50 decoration-dotted underline-offset-4 transition hover:decoration-gold"
          >
            Start Here
          </button>
        ) : (
          <strong className="font-serif text-base text-gold">Start Here</strong>
        )}
        quests, then set things up your way.
      </span>
      <ClearTutorialButton className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-xs text-gold transition hover:bg-gold/15" />
    </div>
  );
}
