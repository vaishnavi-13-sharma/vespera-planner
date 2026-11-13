import { useId, useState, type FormEvent } from 'react';
import { useVespera, type Accent, type Category } from '../../context/VesperaContext';
import { AccentSwatches } from '../ui/AccentSwatches';
import { EmojiField } from '../ui/EmojiField';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import { Sheet } from '../ui/Sheet';

/** Sheet "New category" (no category) or "Edit category": name, emoji, accent and a short description. */
export function CategoryEditor({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { addCategory, updateCategory } = useVespera();
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '✨');
  const [accent, setAccent] = useState<Accent>(category?.accent ?? 'gold');
  const [blurb, setBlurb] = useState(category?.blurb ?? '');
  const formId = useId();
  const nameId = useId();
  const blurbId = useId();
  const title = category ? 'Edit category' : 'New category';

  function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const glyph = emoji.trim() || '✨';
    const description = blurb.trim();
    if (category) {
      updateCategory(category.id, { name: trimmed, emoji: glyph, accent, blurb: description || undefined });
    } else {
      const id = addCategory(trimmed, glyph, accent);
      if (description) updateCategory(id, { blurb: description });
    }
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className={QUIET_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={!name.trim()} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}>
            Save
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={save} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-xs text-taupe">
            Name
          </label>
          <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} placeholder="Job 3 · Lab" className={FIELD_CLASS} />
        </div>
        <EmojiField label="Emoji" value={emoji} onChange={setEmoji} />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-taupe">Accent</span>
          <AccentSwatches label="Accent" value={accent} onChange={setAccent} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={blurbId} className="text-xs text-taupe">
            Description
          </label>
          <textarea
            id={blurbId}
            rows={2}
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="What goes in this category?"
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>
      </form>
    </Sheet>
  );
}
