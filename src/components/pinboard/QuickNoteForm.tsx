import { useId, useState, type FormEvent } from 'react';
import { useVespera } from '../../context/VesperaContext';

const FIELD = 'ornate-border min-h-11 rounded-lg bg-espresso/60 px-2.5 py-1.5 text-sm text-vanilla placeholder:text-taupe/60 focus:border-gold focus:outline-none';

export function QuickNoteForm() {
  const { state, addNote } = useVespera();
  const id = useId();
  const [tagId, setTagId] = useState(() => (state.noteTags.find((t) => !t.vocab) ?? state.noteTags[0]).id);
  const tag = state.noteTags.find((t) => t.id === tagId) ?? state.noteTags[0];
  const [text, setText] = useState('');
  const [definition, setDefinition] = useState('');
  const isVocab = tag.vocab;

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    addNote(tag.id, body, isVocab ? definition.trim() || undefined : undefined);
    setText('');
    setDefinition('');
  }

  return (
    <form onSubmit={submit} className="ornate-border flex flex-col gap-2 rounded-xl bg-espresso/40 p-3">
      <label htmlFor={`${id}-kind`} className="text-xs text-taupe">
        Note type
      </label>
      <select id={`${id}-kind`} value={tag.id} onChange={(e) => setTagId(e.target.value)} className={FIELD}>
        {state.noteTags.map((t) => (
          <option key={t.id} value={t.id} className="bg-mahogany">
            {t.emoji} {t.name}
          </option>
        ))}
      </select>

      <label htmlFor={`${id}-text`} className="text-xs text-taupe">
        {isVocab ? 'Word' : 'Note'}
      </label>
      <textarea
        id={`${id}-text`}
        rows={isVocab ? 1 : 2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isVocab ? 'e.g. Garrulous' : 'Write a note…'}
        className={`${FIELD} resize-none`}
      />

      {isVocab && (
        <>
          <label htmlFor={`${id}-def`} className="text-xs text-taupe">
            Definition
          </label>
          <input id={`${id}-def`} value={definition} onChange={(e) => setDefinition(e.target.value)} className={FIELD} />
        </>
      )}

      <button
        type="submit"
        className="rounded-lg bg-burgundy px-3 py-2 font-serif text-lg text-vanilla transition hover:text-gold"
      >
        Pin it
      </button>
    </form>
  );
}
