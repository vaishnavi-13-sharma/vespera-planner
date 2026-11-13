import { FastForward, Feather, Lock, PenLine, Repeat, SkipForward, Sparkles } from 'lucide-react';
import {
  canShift,
  describeRepeat,
  formatDateKey,
  formatRange,
  occurrencesForDate,
  openCountByCategory,
  useVespera,
  type Accent,
  type BlockKind,
  type Occurrence,
} from '../../context/VesperaContext';
import { FocusButton } from '../focus/FocusButton';
import { ACCENT_STYLES } from '../ui/accents';
import { useToast } from '../ui/Toast';

const KIND_STYLE: Record<BlockKind, string> = {
  anchor: 'border border-gold/60 bg-gold/5 shadow-[inset_0_0_14px_color-mix(in_srgb,var(--color-gold)_12%,transparent)]',
  focus: 'border border-rose/25 border-l-4 border-l-burgundy bg-burgundy/25',
  flexible: 'border border-rose/25 border-l-4 border-l-rose bg-rose/5',
};

/** Softer borders for the category chip (literal so Tailwind can see them). */
const CHIP_BORDER: Record<Accent, string> = {
  gold: 'border-gold/50',
  burgundy: 'border-burgundy',
  rose: 'border-rose/50',
  sage: 'border-sage/50',
  taupe: 'border-taupe/50',
};

const KIND_LABEL: Record<BlockKind, string> = { anchor: 'Anchor', focus: 'Focus', flexible: 'Flexible' };

const ACTION_BUTTON =
  'inline-flex items-center gap-1 rounded-full border border-rose/30 px-2.5 py-1 text-rose transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rose/30 disabled:hover:text-rose';

export function BlockCard({ block, inProgress, onEdit }: { block: Occurrence; inProgress: boolean; onEdit: () => void }) {
  const { state, today, pushOccurrence, beginOccurrence, skipOccurrence, unskipOccurrence } = useVespera();
  const showToast = useToast();
  const locked = block.kind === 'anchor';
  const timed = block.start !== null && block.end !== null;
  const isToday = block.date === today;

  const seriesStart = block.source.type === 'series' ? state.series.find((s) => s.id === block.source.id)?.startDate : undefined;
  const category = state.categories.find((c) => c.id === block.categoryId && !c.archived);
  const openCount = category ? (openCountByCategory(state.tasks)[category.id] ?? 0) : 0;
  const accent = block.accent ? ACCENT_STYLES[block.accent] : null;
  const canBegin = isToday && timed && !locked && !block.begun;
  const canPush = timed && !locked && canShift(occurrencesForDate(state, block.date), block.key, 30);

  function skip() {
    if (block.source.type !== 'series') return;
    const { id, date } = block.source;
    skipOccurrence(id, date);
    showToast({ message: `Skipped “${block.title}”`, actionLabel: 'Undo', onAction: () => unskipOccurrence(id, date) });
  }

  function jumpToCategory() {
    if (!category) return;
    document.getElementById(`quest-category-${category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <article
      aria-label={block.title}
      aria-current={inProgress ? 'time' : undefined}
      className={`relative rounded-xl p-3 pr-4 transition-all duration-500 sm:p-4 ${KIND_STYLE[block.kind]} ${
        inProgress ? 'animate-glow ring-1 ring-gold/70' : ''
      }`}
    >
      {accent && <span aria-hidden className={`tl-bookmark absolute right-10 top-0 h-6 w-3 ${accent.dot}`} />}

      <div className="flex items-center justify-between gap-2">
        <p className={`min-w-0 text-xs uppercase tracking-widest ${inProgress ? 'text-gold' : 'text-taupe'}`}>{formatRange(block)}</p>
        <div className="flex shrink-0 items-center gap-1">
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 px-2 py-0.5 text-xs text-gold">
              <Lock aria-hidden size={12} />
              Locked
            </span>
          ) : (
            <span className={`text-xs italic ${accent ? accent.text : 'text-rose'}`}>{KIND_LABEL[block.kind]}</span>
          )}
          <button
            type="button"
            aria-label={`Edit ${block.title}`}
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-full text-taupe transition hover:bg-vanilla/5 hover:text-gold"
          >
            <PenLine aria-hidden size={15} />
          </button>
        </div>
      </div>
      <h3 className="font-serif text-lg leading-snug text-vanilla [overflow-wrap:anywhere]">{block.title}</h3>

      {(block.repeat || block.begun || category) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          {block.repeat && (
            <span className="inline-flex items-center gap-1 italic text-taupe">
              <Repeat aria-hidden size={12} />
              {describeRepeat(block.repeat, seriesStart ?? block.date)}
            </span>
          )}
          {block.begun && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-2 py-0.5 text-sage">
              <Sparkles aria-hidden size={12} />
              Started
            </span>
          )}
          {category && (
            <button
              type="button"
              aria-label={`${category.emoji} ${category.name} · ${openCount} open`}
              onClick={jumpToCategory}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition hover:bg-vanilla/5 ${CHIP_BORDER[category.accent]} ${ACCENT_STYLES[category.accent].text}`}
            >
              <span aria-hidden>{category.emoji}</span>
              <span className="truncate">{category.name}</span>
              <span className="shrink-0 text-taupe">· {openCount} open</span>
            </button>
          )}
        </div>
      )}

      {block.note && <p className="mt-1.5 whitespace-pre-line font-serif text-sm italic text-taupe">{block.note}</p>}

      {(!locked || block.source.type === 'series') && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          {canBegin && (
            <button type="button" onClick={() => beginOccurrence(block.source)} className={ACTION_BUTTON}>
              <Feather aria-hidden size={12} />
              I'm on it
            </button>
          )}
          {!locked && (
            <button
              type="button"
              disabled={!canPush}
              title={timed && !canPush ? 'No room left before midnight' : undefined}
              onClick={() => pushOccurrence(block.date, block.key, 30)}
              className={ACTION_BUTTON}
            >
              <FastForward aria-hidden size={12} />
              Push 30m
            </button>
          )}
          {!locked && <FocusButton occurrence={block} />}
          {block.source.type === 'series' && (
            <button type="button" onClick={skip} className={ACTION_BUTTON}>
              <SkipForward aria-hidden size={12} />
              {isToday ? 'Skip today' : `Skip ${formatDateKey(block.date, 'short')}`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
