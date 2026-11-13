import { X } from 'lucide-react';
import { useVespera, type Note, type NoteTag } from '../../context/VesperaContext';
import { PinnedPaper } from './PinnedPaper';

export function NoteScrap({ note, tag, index }: { note: Note; tag: NoteTag; index: number }) {
  const { deleteNote } = useVespera();

  return (
    <PinnedPaper noteId={note.id} index={index}>
      <article aria-label={`${tag.name} note`} className="parchment-scrap relative bg-parchment px-3 pb-7 pt-7 text-ink sm:px-4">
        <p className="mb-1 text-[0.65rem] uppercase tracking-widest text-burgundy/80">
          <span aria-hidden>{tag.emoji}</span> {tag.name}
        </p>
        <p className="whitespace-pre-line font-serif text-lg leading-snug">{note.text}</p>
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
