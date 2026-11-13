import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useVespera, type Note, type NoteTag } from '../../context/VesperaContext';
import { ReviewHint } from '../study/ReviewHint';
import { PinnedPaper } from './PinnedPaper';

export function VocabCard({ note, tag, index }: { note: Note; tag: NoteTag; index: number }) {
  const { deleteNote } = useVespera();
  const [revealed, setRevealed] = useState(false);

  return (
    <PinnedPaper noteId={note.id} index={index}>
      <article aria-label={`Vocab card: ${note.text}`} className="parchment-scrap relative bg-parchment px-3 pb-7 pt-7 text-ink sm:px-4">
        <p className="mb-1 text-[0.65rem] uppercase tracking-widest text-burgundy/80">
          <span aria-hidden>{tag.emoji}</span> {tag.name}
        </p>
        <p className="font-serif text-2xl italic">{note.text}</p>
        <ReviewHint note={note} />
        {revealed && <p className="vocab-reveal mt-2 text-sm leading-relaxed">{note.definition ?? 'No definition yet.'}</p>}
        <button
          type="button"
          aria-pressed={revealed}
          onClick={() => setRevealed((r) => !r)}
          className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-full border border-burgundy/40 px-3 text-xs text-burgundy transition hover:bg-burgundy hover:text-parchment"
        >
          {revealed ? <EyeOff aria-hidden size={12} /> : <Eye aria-hidden size={12} />}
          {revealed ? 'Hide definition' : 'Reveal definition'}
        </button>
        <button
          type="button"
          aria-label={`Unpin note: ${note.text}`}
          onClick={() => deleteNote(note.id)}
          className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-ink/50 transition hover:text-burgundy"
        >
          <X aria-hidden size={14} />
        </button>
      </article>
    </PinnedPaper>
  );
}
