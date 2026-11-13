import { useId, useState, type FormEvent } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useVespera, type BlockKind, type DateKey } from '../../context/VesperaContext';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import type { EditorTarget } from './BlockEditor';
import { parseTimeInput } from './time';

export function QuickAddBlock({ date, onMoreOptions }: { date: DateKey; onMoreOptions: (draft: EditorTarget) => void }) {
  const { addBlock } = useVespera();
  const id = useId();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BlockKind>('focus');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function reset() {
    setTitle('');
    setStart('');
    setEnd('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const s = parseTimeInput(start);
    const en = parseTimeInput(end);
    const timed = s !== null && en !== null && en > s;
    addBlock(
      date,
      timed ? { title: trimmed, kind, start: s, end: en } : { title: trimmed, kind, start: null, end: null, timeLabel: 'Flexible' },
    );
    reset();
  }

  function moreOptions() {
    onMoreOptions({ mode: 'new', date, title: title.trim(), kind, start, end });
    reset();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-gold/20 pt-4">
      <p className="subheading">Add a time block</p>
      <label htmlFor={`${id}-title`} className="sr-only">
        Block title
      </label>
      <input
        id={`${id}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What’s happening?"
        className={FIELD_CLASS}
      />
      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-taupe">
          <label htmlFor={`${id}-kind`}>Block type</label>
          <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as BlockKind)} className={FIELD_CLASS}>
            <option value="focus">Focus</option>
            <option value="flexible">Flexible</option>
            <option value="anchor">Anchor</option>
          </select>
        </div>
        <label htmlFor={`${id}-start`} className="flex min-w-0 flex-col gap-1 text-xs text-taupe">
          Start
          <input id={`${id}-start`} type="time" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD_CLASS} />
        </label>
        <label htmlFor={`${id}-end`} className="flex min-w-0 flex-col gap-1 text-xs text-taupe">
          End
          <input id={`${id}-end`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD_CLASS} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} flex-1`}>
          <Plus aria-hidden size={16} />
          Add block
        </button>
        <button type="button" onClick={moreOptions} className={QUIET_BUTTON_CLASS}>
          <SlidersHorizontal aria-hidden size={14} />
          More options
        </button>
      </div>
    </form>
  );
}
