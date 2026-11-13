import { useRef, type KeyboardEvent } from 'react';
import { nextTabIndex } from './useStoredChoice';

export type PageTab = 'quests' | 'pinboard';

export const PAGE_TABS: { id: PageTab; label: string; emoji: string }[] = [
  { id: 'quests', label: 'Quest Board', emoji: '⚔️' },
  { id: 'pinboard', label: 'Pinboard', emoji: '📜' },
];

/** Silk bookmark ribbons draped over the top edge of the Storybook's right-hand page. */
export function PageTabs({
  active,
  onSelect,
  tabId,
  panelId,
}: {
  active: PageTab;
  onSelect: (tab: PageTab) => void;
  tabId: (tab: PageTab) => string;
  panelId: (tab: PageTab) => string;
}) {
  const buttons = useRef<Partial<Record<PageTab, HTMLButtonElement | null>>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabIndex(e.key, PAGE_TABS.findIndex((t) => t.id === active), PAGE_TABS.length);
    if (next === null) return;
    e.preventDefault();
    const tab = PAGE_TABS[next].id;
    onSelect(tab);
    buttons.current[tab]?.focus();
  }

  return (
    <div role="tablist" aria-label="Pages" onKeyDown={onKeyDown} className="relative z-10 -mb-3 flex items-start justify-end gap-2 px-6">
      {PAGE_TABS.map(({ id, label, emoji }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            ref={(el) => {
              buttons.current[id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(id)}
            aria-selected={selected}
            aria-controls={panelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(id)}
            className={`shell-ribbon flex min-h-12 min-w-[7.5rem] items-start justify-center gap-1.5 px-4 pb-4 pt-2 font-serif text-base tracking-wide transition ${
              selected ? 'shell-ribbon-active font-semibold italic text-espresso' : 'text-vanilla/85 hover:text-vanilla'
            }`}
          >
            <span aria-hidden>{emoji}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
