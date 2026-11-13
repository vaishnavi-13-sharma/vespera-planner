import { useEffect, useId, useMemo, type HTMLAttributes, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { FoldSlotContext, type FoldSlot } from './foldSlot';
import { NowPill } from './NowPill';
import { PageTabs, PAGE_TABS, type PageTab } from './PageTabs';
import { onRevealPanel } from './revealPanel';
import { SHELL_TABS, TabBar, type ShellTab } from './TabBar';
import { useMediaQuery } from './useMediaQuery';
import { useStoredChoice } from './useStoredChoice';
import './shell.css';

export const BOOK_QUERY = '(min-width: 768px)';
export const TRIPTYCH_QUERY = '(min-width: 1100px)';
export const TAB_STORAGE_KEY = 'vespera_mobile_tab';
export const PAGE_STORAGE_KEY = 'vespera_page_tab';
export const FOLD_STORAGE_KEY = 'vespera_pinboard_folded';

const SHELL_TAB_IDS = SHELL_TABS.map((t) => t.id);
const PAGE_TAB_IDS = PAGE_TABS.map((t) => t.id);
const FOLD_VALUES = ['true', 'false'] as const;

type Tier = 'pocket' | 'book' | 'triptych';
type Attrs = HTMLAttributes<HTMLDivElement> & { hidden?: boolean };

const MAIN_CLASS: Record<Tier, string> = {
  pocket: 'pb-[calc(6rem+env(safe-area-inset-bottom))]',
  book: 'shell-book grid grid-cols-[minmax(0,42fr)_1.75rem_minmax(0,58fr)] items-start',
  triptych: 'grid items-start gap-6 transition-[grid-template-columns] duration-300 ease-out',
};
const TRIPTYCH_COLUMNS = 'grid-cols-[minmax(280px,1fr)_minmax(360px,1.4fr)_minmax(280px,1fr)]';
const TRIPTYCH_FOLDED_COLUMNS = 'grid-cols-[minmax(280px,1fr)_minmax(360px,1.8fr)_3.5rem]';

/**
 * Lays out the three panels in one of three tiers:
 * - under 768px, "The Pocket Storybook": one panel at a time, a bottom tab bar and a Happening Now pill;
 * - 768–1099px, "The Two-Page Open Storybook": Timeline on the left page, Quests or Pinboard behind bookmarks on the right;
 * - 1100px and up, "The Full Vanity Triptych": three columns, with a Pinboard that folds into a slim strip.
 * Every panel stays mounted in every tier (inactive ones get `hidden`), and the element tree is the same throughout,
 * so rotating or resizing never loses a panel's state.
 */
export function MobileShell({ timeline, quests, pinboard }: { timeline: ReactNode; quests: ReactNode; pinboard: ReactNode }) {
  const book = useMediaQuery(BOOK_QUERY);
  const wide = useMediaQuery(TRIPTYCH_QUERY);
  const tier: Tier = wide ? 'triptych' : book ? 'book' : 'pocket';

  const [tab, setTab] = useStoredChoice<ShellTab>(TAB_STORAGE_KEY, SHELL_TAB_IDS, 'quests');
  const [page, setPage] = useStoredChoice<PageTab>(PAGE_STORAGE_KEY, PAGE_TAB_IDS, 'quests');
  const [foldedValue, setFolded] = useStoredChoice(FOLD_STORAGE_KEY, FOLD_VALUES, 'false');
  const folded = foldedValue === 'true';

  const baseId = useId();
  const tabId = (id: string) => `${baseId}-${tier}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const pinboardBodyId = `${panelId('pinboard')}-body`;
  const foldSlot = useMemo<FoldSlot | null>(
    () => (tier === 'triptych' && !folded ? { controls: pinboardBodyId, onFold: () => setFolded('true') } : null),
    [tier, folded, pinboardBodyId, setFolded],
  );

  // Someone elsewhere (the Start Here ribbon) asked for a panel: turn to it now, so they can scroll to it next.
  useEffect(
    () =>
      onRevealPanel((panel) =>
        flushSync(() => {
          if (tier === 'pocket') setTab(panel);
          if (tier === 'book' && panel !== 'timeline') setPage(panel);
        }),
      ),
    [tier, setTab, setPage],
  );

  function selectTab(next: ShellTab) {
    setTab(next);
    const scroller = document.scrollingElement;
    if (scroller) scroller.scrollTop = 0;
  }

  /** Attributes for a panel's wrapper: a tabpanel under the given tablist, or a plain column. */
  function panelAttrs(id: ShellTab): Attrs {
    if (tier === 'pocket') {
      return { id: panelId(id), role: 'tabpanel', 'aria-labelledby': tabId(id), hidden: id !== tab, className: 'shell-panel-enter min-w-0' };
    }
    if (tier === 'book' && id !== 'timeline') {
      return { id: panelId(id), role: 'tabpanel', 'aria-labelledby': tabId(id), hidden: id !== page, className: 'shell-panel-enter min-w-0' };
    }
    if (tier === 'triptych' && id === 'pinboard') return { id: panelId(id), className: 'min-w-0' };
    return { className: 'min-w-0' };
  }

  const mainClass = tier === 'triptych' ? `${MAIN_CLASS.triptych} ${folded ? TRIPTYCH_FOLDED_COLUMNS : TRIPTYCH_COLUMNS}` : MAIN_CLASS[tier];

  return (
    <>
      <main className={mainClass}>
        {tier === 'pocket' && tab !== 'timeline' && <NowPill onOpenTimeline={() => selectTab('timeline')} />}
        <div key="timeline" {...panelAttrs('timeline')}>
          {timeline}
        </div>
        {tier === 'book' && <div aria-hidden className="shell-spine self-stretch" />}
        <div key="pages" className={tier === 'book' ? 'flex min-w-0 flex-col' : 'contents'}>
          {tier === 'book' && <PageTabs active={page} onSelect={setPage} tabId={tabId} panelId={panelId} />}
          <div key="quests" {...panelAttrs('quests')}>
            {quests}
          </div>
          <div key="pinboard" {...panelAttrs('pinboard')}>
            {tier === 'triptych' && folded && (
              <button
                type="button"
                aria-label="Unfold Pinboard"
                aria-expanded={false}
                aria-controls={pinboardBodyId}
                onClick={() => setFolded('false')}
                className="shell-strip velvet-card flex min-h-64 w-14 items-center justify-center py-6 font-serif text-lg tracking-wider text-gold transition hover:text-vanilla"
              >
                <span className="shell-strip-label">📜 Pinboard</span>
              </button>
            )}
            <div key="body" id={pinboardBodyId} hidden={tier === 'triptych' && folded}>
              {/* The fold seal lives in the Pinboard's own header row (see PinboardFoldSeal). */}
              <FoldSlotContext.Provider value={foldSlot}>{pinboard}</FoldSlotContext.Provider>
            </div>
          </div>
        </div>
      </main>
      {tier === 'pocket' && <TabBar active={tab} onSelect={selectTab} tabId={tabId} panelId={panelId} />}
    </>
  );
}
