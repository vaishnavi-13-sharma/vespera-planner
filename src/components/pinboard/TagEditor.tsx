import { useId, useRef, useState, type FormEvent } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useVespera, type NoteTag } from '../../context/VesperaContext';
import { EmojiField } from '../ui/EmojiField';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '../ui/accents';

/** Sheet "Edit tags": rename, re-emoji, delete and add note tags. */
export function TagEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit tags">
      <TagEditorBody />
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so the label snapshot below starts fresh each time. */
function TagEditorBody() {
  const { state, updateTag, deleteTag } = useVespera();
  const showToast = useToast();
  // Each row's aria-label uses the tag's name as it was when the sheet opened, so it doesn't shift mid-typing.
  const labelNames = useRef(new Map<string, string>());
  const labelFor = (tag: NoteTag) => {
    if (!labelNames.current.has(tag.id)) labelNames.current.set(tag.id, tag.name);
    return labelNames.current.get(tag.id)!;
  };

  function remove(tag: NoteTag) {
    const heir = state.noteTags.find((t) => t.id !== tag.id && t.vocab === tag.vocab);
    if (!heir) return;
    const moved = state.notes.filter((n) => n.tagId === tag.id).length;
    deleteTag(tag.id);
    const name = tag.name.trim() || labelFor(tag);
    showToast({
      message:
        moved === 0
          ? `Deleted ${name}. It had no notes.`
          : `Deleted ${name}. Its ${moved === 1 ? 'note' : `${moved} notes`} moved to ${heir.emoji} ${heir.name}.`,
    });
  }

  return (
    <>
      <p className="subheading">Rename them, give them a new charm, or tidy a few away. Notes always find a new home.</p>

      <ul aria-label="Note tags" className="flex flex-col gap-2.5">
        {state.noteTags.map((tag) => {
          const label = labelFor(tag);
          const lastOfKind = !state.noteTags.some((t) => t.id !== tag.id && t.vocab === tag.vocab);
          const count = state.notes.filter((n) => n.tagId === tag.id).length;
          return (
            <li key={tag.id} className="tag-row ornate-border flex flex-col gap-2 rounded-xl bg-espresso/40 p-3">
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Emoji of ${label}`}
                  value={tag.emoji}
                  maxLength={8}
                  onChange={(e) => updateTag(tag.id, { emoji: e.target.value })}
                  className={`${FIELD_CLASS} w-12 shrink-0 text-center text-lg`}
                />
                <input
                  aria-label={`Name of ${label}`}
                  value={tag.name}
                  onChange={(e) => updateTag(tag.id, { name: e.target.value })}
                  onBlur={() => {
                    if (!tag.name.trim()) updateTag(tag.id, { name: label });
                  }}
                  className={`${FIELD_CLASS} min-w-0 flex-1 font-serif text-base`}
                />
                <button
                  type="button"
                  aria-label={`Delete ${label} tag`}
                  disabled={lastOfKind}
                  title={lastOfKind ? `Keep at least one ${tag.vocab ? 'vocab deck' : 'note tag'}` : undefined}
                  onClick={() => remove(tag)}
                  className="shrink-0 rounded-full p-2 text-taupe transition hover:bg-rose/10 hover:text-rose disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-taupe"
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-taupe">
                <span>{count === 0 ? 'Nothing pinned' : `${count} pinned`}</span>
                {tag.vocab && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-2 py-0.5 text-gold/90">
                    <Sparkles aria-hidden size={11} /> flip cards
                  </span>
                )}
                {lastOfKind && <span className="italic text-taupe/70">can’t delete the last one</span>}
              </p>
            </li>
          );
        })}
      </ul>

      <AddTagForm />
    </>
  );
}

function AddTagForm() {
  const { addTag } = useVespera();
  const showToast = useToast();
  const id = useId();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [vocab, setVocab] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const charm = emoji.trim() || (vocab ? '📜' : '✨');
    addTag(trimmed, charm, vocab);
    showToast({ message: `Added the ${charm} ${trimmed} tag` });
    setName('');
    setEmoji('✨');
    setVocab(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-gold/20 pt-4">
      <h3 className="font-serif text-xl text-gold">Add a tag</h3>
      <label className="flex flex-col gap-1.5 text-xs text-taupe">
        New tag name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recipes" className={FIELD_CLASS} />
      </label>
      <EmojiField label="New tag emoji" value={emoji} onChange={setEmoji} />
      <div className="flex items-start gap-2.5">
        <input
          id={`${id}-vocab`}
          type="checkbox"
          checked={vocab}
          aria-describedby={`${id}-vocab-hint`}
          onChange={(e) => setVocab(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-gold"
        />
        <div>
          <label htmlFor={`${id}-vocab`} className="cursor-pointer text-sm text-vanilla">
            Vocab cards
          </label>
          <p id={`${id}-vocab-hint`} className="text-xs text-taupe">
            Notes become flip cards: the word on the front, its meaning hidden until you reveal it.
          </p>
        </div>
      </div>
      <button type="submit" disabled={!name.trim()} className={`${PRIMARY_BUTTON_CLASS} self-start disabled:opacity-50`}>
        <Plus aria-hidden size={16} /> Add tag
      </button>
    </form>
  );
}
