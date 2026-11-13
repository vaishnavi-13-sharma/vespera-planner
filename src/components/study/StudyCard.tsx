import { useEffect, useRef } from 'react';
import { Eye, Pin } from 'lucide-react';
import type { Note, NoteTag } from '../../context/VesperaContext';

/** A parchment flashcard: the word up front, the definition on the flip side. */
export function StudyCard({
  note,
  tag,
  revealed,
  onReveal,
  autoFocus,
}: {
  note: Note;
  tag: NoteTag | undefined;
  revealed: boolean;
  onReveal: () => void;
  autoFocus: boolean;
}) {
  const showRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus && !revealed) showRef.current?.focus();
  }, [autoFocus, revealed, note.id]);

  return (
    <div className="study-stage">
      <div
        key={revealed ? 'back' : 'front'}
        className={`study-card relative flex min-h-56 flex-col items-center justify-center bg-parchment px-6 pb-8 pt-9 text-center text-ink ${revealed ? 'study-flip' : 'study-deal'}`}
      >
        <Pin aria-hidden className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 fill-gold text-gold" />
        {tag && (
          <p className="mb-2 text-[0.65rem] uppercase tracking-widest text-burgundy/80">
            <span aria-hidden>{tag.emoji}</span> {tag.name}
          </p>
        )}
        <h3 className={`font-serif italic transition-all ${revealed ? 'text-2xl text-burgundy' : 'text-4xl'}`}>{note.text}</h3>
        <span aria-hidden className="study-flourish my-3 text-gold">
          ❦
        </span>
        {revealed ? (
          <p className="max-w-[28ch] text-[0.95rem] leading-relaxed text-ink/90">{note.definition ?? 'No definition yet.'}</p>
        ) : (
          <button
            ref={showRef}
            type="button"
            onClick={onReveal}
            className="inline-flex items-center gap-1.5 rounded-full border border-burgundy/40 px-4 py-1.5 text-sm text-burgundy transition hover:bg-burgundy hover:text-parchment"
          >
            <Eye aria-hidden size={14} />
            Show definition
          </button>
        )}
      </div>
    </div>
  );
}
