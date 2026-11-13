import { useRef, type KeyboardEvent } from 'react';
import { CalendarDays, Feather, Swords, type LucideIcon } from 'lucide-react';
import { nextTabIndex } from './useStoredChoice';

export type ShellTab = 'timeline' | 'quests' | 'pinboard';

export const SHELL_TABS: { id: ShellTab; label: string; Icon: LucideIcon }[] = [
  { id: 'timeline', label: 'Timeline', Icon: CalendarDays },
  { id: 'quests', label: 'Quests', Icon: Swords },
  { id: 'pinboard', label: 'Pinboard', Icon: Feather },
];

/** The Pocket Storybook's velvet tab bar, fixed to the bottom edge and clear of the home indicator. */
export function TabBar({
  active,
  onSelect,
  tabId,
  panelId,
}: {
  active: ShellTab;
  onSelect: (tab: ShellTab) => void;
  tabId: (tab: ShellTab) => string;
  panelId: (tab: ShellTab) => string;
}) {
  const buttons = useRef<Partial<Record<ShellTab, HTMLButtonElement | null>>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabIndex(e.key, SHELL_TABS.findIndex((t) => t.id === active), SHELL_TABS.length);
    if (next === null) return;
    e.preventDefault();
    const tab = SHELL_TABS[next].id;
    onSelect(tab);
    buttons.current[tab]?.focus();
  }

  return (
    <nav aria-label="Panels" className="shell-tabbar fixed inset-x-0 bottom-0 z-40">
      <div role="tablist" aria-label="Panels" onKeyDown={onKeyDown} className="mx-auto grid max-w-md grid-cols-3 gap-2 px-3 pt-2">
        {SHELL_TABS.map(({ id, label, Icon }) => {
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
              className={`shell-tab relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 pb-1.5 pt-2 transition-colors ${
                selected ? 'shell-tab-active text-gold' : 'text-taupe hover:text-vanilla active:text-gold'
              }`}
            >
              {selected && <span aria-hidden className="shell-flame" />}
              <Icon aria-hidden size={22} strokeWidth={selected ? 2 : 1.6} />
              <span className={`font-serif text-[0.95rem] leading-none tracking-wide ${selected ? 'font-semibold italic' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
