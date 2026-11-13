import { useEffect, useRef } from 'react';
import type { NoteTag } from '../../context/VesperaContext';

/** 'all' or a tag id. */
export type NoteFilter = string;

/** Marks which ends of the row have chips scrolled out of sight, so only those edges fade (see pinboard.css). */
function markEdges(row: HTMLElement) {
  const before = row.scrollLeft > 1;
  const after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  row.toggleAttribute('data-more-before', before);
  row.toggleAttribute('data-more-after', after);
}

/** One row of filter chips, "All" first, that scrolls sideways instead of wrapping. */
export function TagFilter({ tags, value, onChange }: { tags: NoteTag[]; value: NoteFilter; onChange: (filter: NoteFilter) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const OPTIONS = [{ key: 'all', emoji: '🕯️', label: 'All' }, ...tags.map((t) => ({ key: t.id, emoji: t.emoji, label: t.name }))];

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    markEdges(row);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => markEdges(row));
    observer.observe(row);
    return () => observer.disconnect();
  }, [tags]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label="Filter notes"
      onScroll={(e) => markEdges(e.currentTarget)}
      className="pinboard-filter -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
    >
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={(e) => {
              onChange(o.key);
              e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-xs transition ${
              active ? 'ornate-border bg-burgundy text-vanilla' : 'border border-rose/25 text-taupe hover:text-vanilla'
            }`}
          >
            <span aria-hidden>{o.emoji}</span> {o.label}
          </button>
        );
      })}
    </div>
  );
}
