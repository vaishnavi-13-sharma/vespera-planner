import { BookA, CalendarClock, CircleQuestionMark, Hourglass, LoaderCircle, NotebookPen, ScrollText, Sparkles, StickyNote, type LucideIcon } from 'lucide-react';
import { describeIntent, type CaptureIntent, type VesperaState } from '../../context/VesperaContext';

/** One typed line and how it reads now: the parser's guess, or the Scribe's reading. */
export interface PreviewRow {
  line: string;
  intents: CaptureIntent[];
  /** The AI Scribe (not the free parser) read this line. */
  fromScribe: boolean;
  /** The parser guessed a quest; offer a note instead. */
  canNote: boolean;
  /** Guessed or unknown, and an AI route is reachable. */
  canAsk: boolean;
  asking: boolean;
  error?: string;
}

const ICONS: Record<CaptureIntent['kind'], LucideIcon> = {
  block: CalendarClock,
  quest: ScrollText,
  note: StickyNote,
  vocab: BookA,
  slide: Hourglass,
  unknown: CircleQuestionMark,
};

/** The words under the reading: what will actually be written down. */
function detailOf(intent: CaptureIntent, line: string): string {
  switch (intent.kind) {
    case 'block':
    case 'quest':
      return intent.title;
    case 'note':
      return intent.text;
    case 'vocab':
      return intent.definition;
    case 'slide':
      return 'Everything after it moves later too';
    case 'unknown':
      return `“${line}” will be left out`;
  }
}

const CHIP =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition disabled:cursor-wait disabled:opacity-70';

export function IntentPreview({
  rows,
  state,
  onNote,
  onAsk,
}: {
  rows: PreviewRow[];
  state: VesperaState;
  onNote: (line: string) => void;
  onAsk: (line: string) => void;
}) {
  return (
    <ul aria-label="Preview" className="flex flex-col gap-2">
      {rows.map((row, r) =>
        row.intents.map((intent, i) => {
          const Icon = ICONS[intent.kind];
          const unknown = intent.kind === 'unknown';
          const guessed = intent.kind === 'quest' && intent.guessed;
          const last = i === row.intents.length - 1;
          return (
            <li
              key={`${r}:${i}`}
              className={`capture-row flex gap-3 rounded-xl border px-3 py-2.5 ${
                unknown ? 'border-dashed border-rose/40 bg-rose/5' : 'border-gold/20 bg-espresso/40'
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
                  unknown ? 'border-rose/40 text-rose' : 'border-gold/40 bg-gold/10 text-gold'
                }`}
              >
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-serif text-lg leading-snug ${unknown ? 'text-rose' : 'text-vanilla'}`}>{describeIntent(intent, state)}</span>
                  {guessed && <span className="text-xs italic text-taupe">a guess</span>}
                  {row.fromScribe && (
                    <span className="inline-flex items-center gap-1 text-xs italic text-gold">
                      <Sparkles aria-hidden size={12} />
                      AI suggestion
                    </span>
                  )}
                </div>
                <p className="break-words text-sm text-taupe">{detailOf(intent, row.line)}</p>
                {last && (row.canNote || row.canAsk) && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {row.canNote && (
                      <button type="button" onClick={() => onNote(row.line)} className={`${CHIP} border-gold/30 text-taupe hover:border-gold hover:text-vanilla`}>
                        <NotebookPen aria-hidden size={15} />
                        Save as a note instead
                      </button>
                    )}
                    {row.canAsk && (
                      <button
                        type="button"
                        aria-label="Ask AI"
                        aria-busy={row.asking}
                        disabled={row.asking}
                        onClick={() => onAsk(row.line)}
                        className={`${CHIP} border-gold/40 bg-gold/10 text-gold hover:border-gold hover:bg-gold/15`}
                      >
                        {row.asking ? <LoaderCircle aria-hidden size={15} className="capture-spin" /> : <Sparkles aria-hidden size={15} />}
                        {row.asking ? 'Asking AI…' : 'Ask AI'}
                      </button>
                    )}
                  </div>
                )}
                {last && row.error && (
                  <p role="alert" className="mt-1 text-sm italic text-rose">
                    {row.error}
                  </p>
                )}
              </div>
            </li>
          );
        }),
      )}
    </ul>
  );
}
