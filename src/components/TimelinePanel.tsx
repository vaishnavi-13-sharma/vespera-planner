import { useId, useState, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  addDays,
  currentOccurrence,
  formatDateKey,
  lateOffer,
  occurrencesForDate,
  rollingWeek,
  useVespera,
  type DateKey,
} from '../context/VesperaContext';
import { BlockCard } from './timeline/BlockCard';
import { BlockEditor, type EditorTarget } from './timeline/BlockEditor';
import { LateRibbon } from './timeline/LateRibbon';
import { NowLine } from './timeline/NowLine';
import { QuickAddBlock } from './timeline/QuickAddBlock';
import { WeekNav } from './timeline/WeekNav';
import './timeline/timeline.css';

export function TimelinePanel() {
  const { state, today, nowMinutes } = useVespera();
  const panelId = useId();
  const [weekStart, setWeekStart] = useState<DateKey>(today);
  const [selected, setSelected] = useState<DateKey>(today);
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  // A new morning: if the user was looking at "today", follow the calendar forward.
  const [shownToday, setShownToday] = useState(today);
  if (shownToday !== today) {
    setShownToday(today);
    if (weekStart === shownToday) setWeekStart(today);
    if (selected === shownToday) setSelected(today);
  }

  const week = rollingWeek(weekStart);
  const busy = new Set(week.filter((d) => occurrencesForDate(state, d).length > 0));
  const blocks = occurrencesForDate(state, selected);
  const dayName = formatDateKey(selected, 'long');
  const isToday = selected === today;

  const offer = isToday ? lateOffer(state, today, nowMinutes) : null;
  const current = isToday ? currentOccurrence(blocks, nowMinutes) : null;
  const showNow = isToday && nowMinutes >= state.settings.dayStart && nowMinutes <= state.settings.dayEnd;
  // Cards are untimed first, then by start, so everything "before now" is a prefix.
  const nowIndex = blocks.filter((b) => b.start === null || b.start <= nowMinutes).length;

  function page(direction: -1 | 1) {
    const start = addDays(weekStart, direction * 7);
    setWeekStart(start);
    setSelected(start);
  }

  function goToday() {
    setWeekStart(today);
    setSelected(today);
  }

  const items: ReactNode[] = blocks.map((block) => (
    <li key={block.key}>
      <BlockCard block={block} inProgress={current?.key === block.key} onEdit={() => setEditor({ mode: 'edit', occurrence: block })} />
    </li>
  ));
  if (showNow && blocks.length > 0) items.splice(nowIndex, 0, <NowLine key="now" minutes={nowMinutes} />);

  return (
    <section aria-label="Daily Timeline" className="velvet-card flex flex-col gap-4 p-4 sm:p-5">
      <header>
        <h2 className="flex items-center gap-2 font-serif text-2xl text-gold">
          <CalendarDays aria-hidden className="h-5 w-5" />
          Daily Timeline
        </h2>
        <p className="subheading">
          {dayName}
          {isToday && <span className="not-italic text-gold"> · today</span>}
        </p>
      </header>

      <WeekNav dates={week} value={selected} today={today} busy={busy} panelId={panelId} onSelect={setSelected} onPage={page} onToday={goToday} />

      {offer && <LateRibbon key={offer.key} offer={offer} />}

      <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${selected}`}>
        <ol aria-label={`${dayName} schedule`} className="flex flex-col gap-3">
          {blocks.length === 0 ? <li className="py-4 text-center font-serif text-lg italic text-taupe">Nothing planned for this day.</li> : items}
        </ol>
      </div>

      <QuickAddBlock date={selected} onMoreOptions={setEditor} />

      {editor && (
        <BlockEditor key={editor.mode === 'edit' ? editor.occurrence.key : `new-${editor.date}`} target={editor} onClose={() => setEditor(null)} />
      )}
    </section>
  );
}
