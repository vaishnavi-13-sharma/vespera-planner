import { useState, type DragEvent, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useVespera, type Accent, type Category, type Task } from '../../context/VesperaContext';
import { ACCENT_STYLES } from '../ui/accents';
import { Menu, type MenuItem } from '../ui/Menu';
import { NowRibbon } from './NowRibbon';
import { QuestRow } from './QuestRow';

/** Literal gradient starts for the hairline under each header (kept literal so Tailwind can see them). */
const DIVIDER: Record<Accent, string> = {
  gold: 'from-gold/50',
  burgundy: 'from-burgundy',
  rose: 'from-rose/50',
  sage: 'from-sage/50',
  taupe: 'from-taupe/50',
};

export interface SectionMoves {
  /** Undefined at the ends of the list. */
  up?: () => void;
  down?: () => void;
}

/** One category: medallion header with a ⋯ menu, its quests, an inline add, and a drop target for dragged quests. */
export function TaskCategorySection({
  category,
  tasks,
  nowTitle,
  moves,
  onEditCategory,
  onArchive,
  onEditQuest,
  onOpenChronicle,
}: {
  category: Category;
  tasks: Task[];
  /** Title of the linked block in progress, when there is one. */
  nowTitle?: string;
  moves: SectionMoves;
  onEditCategory: () => void;
  onArchive: () => void;
  onEditQuest: (task: Task) => void;
  /** For the starter tutorial's Chronicle quest. */
  onOpenChronicle?: () => void;
}) {
  const { addTask, updateTask, state } = useVespera();
  const [draft, setDraft] = useState('');
  const [dropping, setDropping] = useState(false);
  const accent = ACCENT_STYLES[category.accent];
  const open = tasks.filter((t) => !t.done).length;

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    addTask(title, category.id);
    setDraft('');
  }

  function dragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDropping(true);
  }

  function dragLeave(e: DragEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
  }

  function drop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDropping(false);
    const id = e.dataTransfer?.getData('text/plain');
    const task = state.tasks.find((t) => t.id === id);
    if (task && task.categoryId !== category.id) updateTask(task.id, { categoryId: category.id });
  }

  const menuItems: MenuItem[] = [
    { label: 'Edit category', onSelect: onEditCategory },
    ...(moves.up ? [{ label: 'Move up', onSelect: moves.up }] : []),
    ...(moves.down ? [{ label: 'Move down', onSelect: moves.down }] : []),
    { label: 'Archive', onSelect: onArchive, tone: 'danger' as const },
  ];

  return (
    <section
      aria-label={category.name}
      id={`quest-category-${category.id}`}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
      className={`quest-category relative flex scroll-mt-4 flex-col gap-2 rounded-2xl border p-3 transition sm:p-4 ${
        nowTitle ? 'animate-glow border-gold/70 bg-gold/[0.06]' : 'border-gold/10 bg-espresso/30'
      } ${dropping ? 'quest-drop-target' : ''}`}
    >
      {nowTitle && <NowRibbon emoji={category.emoji} title={nowTitle} />}

      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-lg ${accent.border} ${accent.soft} shadow-[inset_0_0_10px_color-mix(in_srgb,var(--shadow-color)_35%,transparent)]`}
        >
          {category.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`font-serif text-xl leading-tight break-words ${nowTitle ? 'text-gold' : 'text-vanilla'}`}>{category.name}</h3>
          {category.blurb && <p className="subheading text-sm leading-snug">{category.blurb}</p>}
        </div>
        <span className={`mt-1 shrink-0 text-[0.7rem] uppercase tracking-widest ${accent.text}`}>{open} open</span>
        <Menu label={`${category.name} options`} items={menuItems} />
      </header>

      <div aria-hidden className={`ml-[3.25rem] h-px bg-gradient-to-r to-transparent ${DIVIDER[category.accent]}`} />

      {tasks.length === 0 ? (
        <p className="subheading px-2 py-1 text-sm">No quests here yet. Add one, or drag one in.</p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <QuestRow key={task.id} task={task} onEdit={() => onEditQuest(task)} onOpenChronicle={onOpenChronicle} />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label={`New ${category.name} quest`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a quest…"
          className="ornate-border min-w-0 flex-1 rounded-lg bg-espresso/60 px-3 py-2 text-sm text-vanilla placeholder:text-taupe/60 focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          aria-label={`Add ${category.name} quest`}
          className="rounded-lg bg-burgundy px-3 text-vanilla transition hover:text-gold"
        >
          <Plus aria-hidden size={16} />
        </button>
      </form>
    </section>
  );
}
