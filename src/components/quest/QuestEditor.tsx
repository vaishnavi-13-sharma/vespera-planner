import { useId, useState, type FormEvent } from 'react';
import { CalendarX } from 'lucide-react';
import { formatDateKey, useVespera, visibleCategories, type Task } from '../../context/VesperaContext';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS, QUIET_BUTTON_CLASS } from '../ui/accents';
import { Sheet } from '../ui/Sheet';

/** Sheet "Edit quest": title, category (move to…) and an optional soft due date. */
export function QuestEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, updateTask } = useVespera();
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const formId = useId();
  const titleId = useId();
  const categoryFieldId = useId();
  const dueId = useId();

  const categories = visibleCategories(state.categories);
  // A quest whose category was archived can still be edited; keep its current home selectable.
  const current = state.categories.find((c) => c.id === task.categoryId);
  const options = current && current.archived ? [...categories, current] : categories;

  function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTask(task.id, { title: trimmed, categoryId, dueDate: dueDate || null });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit quest"
      footer={
        <>
          <button type="button" onClick={onClose} className={QUIET_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={!title.trim()} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}>
            Save
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={save} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={titleId} className="text-xs text-taupe">
            Title
          </label>
          <textarea
            id={titleId}
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={categoryFieldId} className="text-xs text-taupe">
            Category
          </label>
          <select id={categoryFieldId} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={FIELD_CLASS}>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={dueId} className="text-xs text-taupe">
            Due date
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input id={dueId} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${FIELD_CLASS} min-w-0 flex-1`} />
            <button type="button" onClick={() => setDueDate('')} disabled={!dueDate} className={`${QUIET_BUTTON_CLASS} disabled:opacity-40`}>
              <CalendarX aria-hidden size={14} />
              Clear due date
            </button>
          </div>
          <p className="subheading text-sm">
            {dueDate ? `Due ${formatDateKey(dueDate, 'long')}. A reminder, not a hard deadline.` : 'No due date set.'}
          </p>
        </div>
      </form>
    </Sheet>
  );
}
