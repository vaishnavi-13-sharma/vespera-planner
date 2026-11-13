import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, X } from 'lucide-react';
import { askOracle, useOracleAvailability } from '../../ai/askOracle';
import { parseCaptures, useVespera, type CaptureIntent, type ParsedLine } from '../../context/VesperaContext';
import { PRIMARY_BUTTON_CLASS } from '../ui/accents';
import { trapTab } from '../ui/focusTrap';
import { isTopOverlay, popOverlay, pushOverlay } from '../ui/overlayStack';
import { useCelebrate } from '../ui/Sparkles';
import { useToast } from '../ui/Toast';
import { IntentPreview, type PreviewRow } from './IntentPreview';
import { PlanMyDay } from './PlanMyDay';
import './capture.css';

const PLACEHOLDER = 'Thu 3-5pm study · quest: email prof tomorrow · vocab: halcyon - calm';

/** A few things to try, shown while the page is still blank: a tap fills the page. */
const EXAMPLES = ['Add quest: Finish reading ch. 4', 'Block 2pm–3pm Deep Focus', 'Pin note: Buy oat milk', 'Fri 9am Coffee with Mum'];

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * Quick Scribe: a parchment storybook page floating in the middle of the screen. Write a line (or a pasted
 * list), watch it read live, and press Enter to keep it; the page closes the moment something is saved.
 */
export function QuickScribeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, today, nowMinutes, capture, undoCapture } = useVespera();
  const { via } = useOracleAvailability();
  const celebrate = useCelebrate();
  const showToast = useToast();
  const titleId = useId();
  const hintId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // The draft survives an accidental close; it clears once saved.
  const [text, setText] = useState('');
  /** Per line: a reading chosen by hand ("a note instead") or by the Scribe. */
  const [overrides, setOverrides] = useState<Record<string, { intents: CaptureIntent[]; fromScribe: boolean }>>({});
  const [asking, setAsking] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overlay = pushOverlay();
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!isTopOverlay(overlay)) return;
      if (e.key === 'Escape') onCloseRef.current();
      else trapTab(e, panelRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popOverlay(overlay);
      previous?.focus?.();
    };
  }, [open]);

  const parsed = useMemo(() => parseCaptures(text, state, today, nowMinutes), [text, state, today, nowMinutes]);
  const noteTag = state.noteTags.find((t) => !t.vocab);
  const lastSaved = state.captureLog[0];

  const rows: PreviewRow[] = parsed.map(({ line, intent }) => {
    const chosen = overrides[line];
    const uncertain = !chosen && (intent.kind === 'unknown' || (intent.kind === 'quest' && !!intent.guessed));
    return {
      line,
      intents: chosen?.intents ?? [intent],
      fromScribe: !!chosen?.fromScribe,
      canNote: !chosen && intent.kind === 'quest' && !!intent.guessed && !!noteTag,
      canAsk: uncertain && via !== null,
      asking: !!asking[line],
      error: errors[line],
    };
  });
  const lines: ParsedLine[] = rows.flatMap((row) => row.intents.map((intent) => ({ line: row.line, intent })));

  const reset = () => {
    setText('');
    setOverrides({});
    setAsking({});
    setErrors({});
    setNotice('');
  };

  const save = () => {
    const receipt = capture(lines);
    if (receipt.count === 0) {
      setNotice('Nothing to save yet');
      return;
    }
    celebrate('small', boxRef.current);
    const { count } = receipt;
    showToast({ message: `Captured ${count} thing${count === 1 ? '' : 's'}`, actionLabel: 'Undo', onAction: () => undoCapture(receipt) });
    reset();
    onClose();
  };

  const noteInstead = (line: string) => {
    if (!noteTag) return;
    setOverrides((all) => ({ ...all, [line]: { intents: [{ kind: 'note', text: line, tagId: noteTag.id }], fromScribe: false } }));
    boxRef.current?.focus();
  };

  const ask = async (line: string) => {
    setAsking((all) => ({ ...all, [line]: true }));
    setErrors((all) => without(all, line));
    const result = await askOracle(line, state, today);
    setAsking((all) => without(all, line));
    if (result.ok && result.intents.length > 0) {
      setOverrides((all) => ({ ...all, [line]: { intents: result.intents, fromScribe: true } }));
      boxRef.current?.focus();
    } else {
      setErrors((all) => ({ ...all, [line]: result.ok ? 'AI couldn’t find anything to save in that line.' : result.message }));
    }
  };

  const tryExample = (example: string) => {
    setText(example);
    setNotice('');
    const box = boxRef.current;
    if (!box) return;
    box.focus();
    requestAnimationFrame(() => box.setSelectionRange(example.length, example.length));
  };

  if (!open) return null;
  return createPortal(
    <div className="scribe-overlay fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
      <div data-testid="scribe-backdrop" aria-hidden className="scribe-backdrop absolute inset-0" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="scribe-page relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[34rem] flex-col outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex items-center justify-between gap-3 py-3 pl-14 pr-3">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-xl leading-none">
              🖋️
            </span>
            <h2 id={titleId} className="font-serif text-2xl font-semibold italic text-gold">
              Quick Scribe
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-taupe transition hover:text-vanilla">
            <X aria-hidden size={20} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
          <label className="sr-only" htmlFor={`${hintId}-box`}>
            Capture
          </label>
          <textarea
            id={`${hintId}-box`}
            ref={boxRef}
            value={text}
            rows={3}
            spellCheck
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder={PLACEHOLDER}
            aria-describedby={hintId}
            onChange={(e) => {
              setText(e.target.value);
              setNotice('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              }
            }}
            className="capture-parchment w-full resize-none rounded-xl px-4 py-2 font-serif text-lg text-ink placeholder:text-ink/45 focus:outline-none"
          />

          <p aria-live="polite" className={notice ? 'text-sm italic text-rose' : 'sr-only'}>
            {notice}
          </p>

          {rows.length > 0 ? (
            <IntentPreview rows={rows} state={state} onNote={noteInstead} onAsk={(line) => void ask(line)} />
          ) : (
            <div role="group" aria-label="Things to try" className="flex flex-col gap-2">
              <p aria-hidden className="subheading text-sm">
                one line per item: a time block, a quest, a note or a vocab word
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => tryExample(example)}
                    className="inline-flex min-h-11 items-center rounded-full border border-gold/30 bg-gold/[0.06] px-3.5 text-left text-sm text-vanilla transition hover:border-gold/60 hover:bg-gold/[0.12]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lastSaved && (
            <p className="flex min-w-0 items-center gap-1.5 text-xs italic text-taupe">
              <History aria-hidden size={13} className="shrink-0" />
              <span className="truncate">Last saved: {lastSaved.summary}</span>
            </p>
          )}

          <div aria-hidden className="scribe-divider" />

          <PlanMyDay />
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gold/20 px-5 py-3 sm:px-6">
          <p id={hintId} className="scribe-hint mr-auto text-xs text-taupe">
            <kbd className="font-sans">Enter</kbd> to save · <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for a new line
          </p>
          <button type="button" onClick={save} className={`${PRIMARY_BUTTON_CLASS} min-h-11 px-5`}>
            <span aria-hidden>✍️</span>
            Save
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
