import { useRef, useState, type DragEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { daysBetween, formatDateKey, isCarriedOver, useVespera, type DateKey, type Task } from '../../context/VesperaContext';
import { Menu } from '../ui/Menu';
import { useCelebrate } from '../ui/Sparkles';
import { spotlight, tutorialAction } from './spotlight';
import { WaxSealCheckbox } from './WaxSealCheckbox';

/** "Due Sat" within the coming week; "Due Thu 26" further out, so the weekday is never ambiguous. */
function dueLabel(dueDate: DateKey, today: DateKey): string {
  return `Due ${formatDateKey(dueDate, daysBetween(today, dueDate) < 7 ? 'short' : 'tab')}`;
}

/**
 * One quest: wax seal, title, due chip or "carried over" ribbon, and a ⋯ menu. Drag it to another category.
 * A starter-tutorial quest's title is a "show me" button (see TUTORIAL_ACTIONS); the seal still checks it off.
 */
export function QuestRow({ task, onEdit, onOpenChronicle }: { task: Task; onEdit: () => void; onOpenChronicle?: () => void }) {
  const { state, today, toggleTask, deleteTask, triggerFiveMinuteReset } = useVespera();
  const celebrate = useCelebrate();
  const rowRef = useRef<HTMLLIElement>(null);
  const [dragging, setDragging] = useState(false);
  const carried = isCarriedOver(task, today);
  const showDue = !task.done && !!task.dueDate && !carried;
  const action = tutorialAction(task.id);
  const titleClass = `text-sm leading-snug break-words ${task.done ? 'text-sage line-through decoration-gold/60' : 'text-vanilla'}`;

  function showMe() {
    if (action === 'gentle-start') triggerFiveMinuteReset();
    else if (action === 'edit') onEdit();
    else if (action === 'chronicle') onOpenChronicle?.();
    else if (action === 'drag-handle') spotlight(rowRef.current?.querySelector('[data-grip]'));
    else if (action === 'category-menu') {
      const trigger = rowRef.current?.closest('section')?.querySelector<HTMLButtonElement>(':scope > header button[aria-haspopup="menu"]');
      trigger?.focus();
      trigger?.click();
    }
  }

  function toggle() {
    if (!task.done) {
      celebrate('small', rowRef.current?.querySelector('[role="checkbox"]'));
      const lastOpen = !state.tasks.some((t) => t.id !== task.id && t.categoryId === task.categoryId && !t.done);
      if (lastOpen) celebrate('big', rowRef.current?.closest('section'), 'chime');
    }
    toggleTask(task.id);
  }

  function startDrag(e: DragEvent<HTMLLIElement>) {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }

  return (
    <li
      ref={rowRef}
      draggable
      onDragStart={startDrag}
      onDragEnd={() => setDragging(false)}
      className={`quest-row group flex items-start gap-2.5 rounded-xl py-2 pr-1 pl-1.5 transition hover:bg-vanilla/[0.04] sm:pl-0.5 ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <GripVertical
        aria-hidden
        data-grip
        size={14}
        className="quest-grip mt-1.5 hidden shrink-0 cursor-grab text-taupe/40 opacity-0 transition group-hover:opacity-100 sm:block"
      />
      <WaxSealCheckbox checked={task.done} label={task.title} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        {action ? (
          // A 44px tap target around the title, without moving the row.
          <button type="button" onClick={showMe} className={`quest-show-me -my-2.5 min-h-11 py-2.5 text-left ${titleClass}`}>
            {task.title}
          </button>
        ) : (
          <span className={titleClass}>{task.title}</span>
        )}
        {(showDue || carried) && (
          <span className="flex flex-wrap gap-1.5">
            {showDue && (
              <span
                title={formatDateKey(task.dueDate!, 'long')}
                className="rounded-full border border-gold/35 bg-gold/10 px-2 py-px text-[0.7rem] tracking-wide text-gold"
              >
                {dueLabel(task.dueDate!, today)}
              </span>
            )}
            {carried && (
              <span
                title={`Was due ${formatDateKey(task.dueDate!, 'long')}`}
                className="carried-ribbon py-px pr-3 pl-2 text-[0.7rem] font-medium tracking-wide text-rose"
              >
                carried over
              </span>
            )}
          </span>
        )}
      </div>
      <Menu
        label={`${task.title} options`}
        items={[
          { label: 'Edit', onSelect: onEdit },
          { label: 'Delete', onSelect: () => deleteTask(task.id), tone: 'danger' },
        ]}
      />
    </li>
  );
}
