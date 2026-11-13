// The starter tutorial's "show me" touches: a brief gold ring on whatever it points at.

/** The Start Here category's stable id (see createStarterState in context/seed.ts). */
export const START_HERE_ID = 'tut-cat-start';

/** What each clickable tutorial quest's title does, keyed by its stable `tut-` id. Other quests' titles are plain text. */
export const TUTORIAL_ACTIONS = {
  'tut-task-gentle': 'gentle-start',
  'tut-task-due': 'edit',
  'tut-task-chronicle': 'chronicle',
  'tut-task-drag': 'drag-handle',
  'tut-task-categories': 'category-menu',
} as const satisfies Record<string, string>;

export type TutorialAction = (typeof TUTORIAL_ACTIONS)[keyof typeof TUTORIAL_ACTIONS];

export function tutorialAction(taskId: string): TutorialAction | undefined {
  return (TUTORIAL_ACTIONS as Record<string, TutorialAction>)[taskId];
}

export const SPOTLIGHT_MS = 2000;
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Rings `el` in gold (`[data-spotlight]`, styled in quest.css) for `ms`, restarting if it's already lit. */
export function spotlight(el: Element | null | undefined, ms = SPOTLIGHT_MS): void {
  if (!el) return;
  clearTimeout(timers.get(el));
  el.removeAttribute('data-spotlight');
  // A reflow between removing and re-adding restarts the glow's animation when tapped twice.
  void (el as HTMLElement).offsetWidth;
  el.setAttribute('data-spotlight', '');
  timers.set(
    el,
    setTimeout(() => {
      el.removeAttribute('data-spotlight');
      timers.delete(el);
    }, ms),
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Glides `el` to the top of the view (or jumps, under reduced motion). */
export function scrollToTop(el: Element): void {
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
