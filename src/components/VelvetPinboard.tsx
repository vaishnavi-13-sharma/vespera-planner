import { useState } from 'react';
import { Feather, Tags } from 'lucide-react';
import { useVespera } from '../context/VesperaContext';
import { PinboardFoldSeal } from './shell/PinboardFoldSeal';
import { NoteScrap } from './pinboard/NoteScrap';
import { QuickNoteForm } from './pinboard/QuickNoteForm';
import { TagEditor } from './pinboard/TagEditor';
import { StudyButton } from './study/StudyButton';
import { TagFilter, type NoteFilter } from './pinboard/TagFilter';
import { VocabCard } from './pinboard/VocabCard';
import './pinboard/pinboard.css';

export function VelvetPinboard() {
  const { state } = useVespera();
  const [chosenFilter, setFilter] = useState<NoteFilter>('all');
  const [editingTags, setEditingTags] = useState(false);
  const tagById = new Map(state.noteTags.map((t) => [t.id, t]));
  // A deleted tag's filter falls back to All.
  const filter = chosenFilter === 'all' || tagById.has(chosenFilter) ? chosenFilter : 'all';
  const notes = (filter === 'all' ? state.notes : state.notes.filter((n) => n.tagId === filter)).filter((n) => tagById.has(n.tagId));

  return (
    // A size container: in a narrow column (the triptych's) the header tools fold down to their icons.
    <section aria-label="Pinboard"className="velvet-card @container flex flex-col gap-3 p-5 @max-[26rem]:px-4">
      {/* One row: the title on the left, the tools in one evenly spaced cluster on the right. */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-2xl leading-tight text-gold @max-[26rem]:text-xl">
            <Feather aria-hidden className="h-5 w-5 shrink-0 @max-[20rem]:hidden" />
            Pinboard
          </h2>
          <p className="subheading leading-snug">Notes, lists &amp; flashcards</p>
        </div>
        <div role="group" aria-label="Pinboard tools" className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingTags(true)}
            title="Edit tags"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-gold/30 px-3 text-xs text-gold transition hover:border-gold hover:bg-gold/10 @max-[26rem]:px-0"
          >
            <Tags aria-hidden size={14} />
            <span className="@max-[26rem]:sr-only">Edit tags</span>
          </button>
          <StudyButton />
          <PinboardFoldSeal />
        </div>
      </header>

      <TagFilter tags={state.noteTags} value={filter} onChange={setFilter} />

      {/* An aligned scrapbook: as many columns as the width holds, every row's tops level. */}
      <ul aria-label="Pinned notes" className="pinboard-scrapbook grid items-start gap-3 pt-2 sm:gap-4">
        {notes.length === 0 ? (
          <li className="col-span-full italic text-taupe">Nothing pinned here yet.</li>
        ) : (
          notes.map((note, i) => (
            <li key={note.id} className="drop-shadow-[0_8px_12px_color-mix(in_srgb,var(--shadow-color)_45%,transparent)]">
              {tagById.get(note.tagId)!.vocab ? (
                <VocabCard note={note} tag={tagById.get(note.tagId)!} index={i} />
              ) : (
                <NoteScrap note={note} tag={tagById.get(note.tagId)!} index={i} />
              )}
            </li>
          ))
        )}
      </ul>

      <QuickNoteForm />

      <TagEditor open={editingTags} onClose={() => setEditingTags(false)} />
    </section>
  );
}
