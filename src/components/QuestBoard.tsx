import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import {
  activeCategoryIds,
  currentOccurrence,
  occurrencesForDate,
  useVespera,
  visibleCategories,
  type Category,
  type Task,
} from '../context/VesperaContext';
import { useToast } from './ui/Toast';
import { CategoryEditor } from './quest/CategoryEditor';
import { ChronicleSheet } from './quest/ChronicleSheet';
import { FocusVeil } from './quest/FocusVeil';
import { GentleStartButton } from './quest/GentleStartButton';
import { QuestEditor } from './quest/QuestEditor';
import { RibbonProgress } from './quest/RibbonProgress';
import { TaskCategorySection } from './quest/TaskCategorySection';
import './quest/quest.css';

type CategoryEditing = { mode: 'new' } | { mode: 'edit'; category: Category } | null;

export function QuestBoard() {
  const { state, today, nowMinutes, triggerFiveMinuteReset, moveCategory, updateCategory } = useVespera();
  const showToast = useToast();
  const [editingCategory, setEditingCategory] = useState<CategoryEditing>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const veilOpen = state.focusVeil !== null;

  const visible = visibleCategories(state.categories);
  const active = new Set(activeCategoryIds(state, today, nowMinutes));
  const ordered = [...visible.filter((c) => active.has(c.id)), ...visible.filter((c) => !active.has(c.id))];
  const todayOccurrences = active.size ? occurrencesForDate(state, today) : [];

  /** Move past any archived categories in between, so one tap always swaps with the visible neighbour. */
  function moveTo(category: Category, neighbour: Category | undefined, direction: -1 | 1) {
    if (!neighbour) return undefined;
    return () => {
      const steps = Math.abs(state.categories.indexOf(neighbour) - state.categories.indexOf(category));
      for (let i = 0; i < steps; i++) moveCategory(category.id, direction);
    };
  }

  function archive(category: Category) {
    updateCategory(category.id, { archived: true });
    showToast({ message: `Archived “${category.name}”`, actionLabel: 'Undo', onAction: () => updateCategory(category.id, { archived: false }) });
  }

  return (
    <section aria-label="Quest Board" className="velvet-card relative flex flex-col gap-5 overflow-hidden p-4 sm:p-5">
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl text-gold">Quest Board</h2>
            <p className="subheading">Your tasks for today</p>
          </div>
          <button
            type="button"
            onClick={() => setChronicleOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-gold/30 bg-espresso/40 px-3 py-1.5 font-serif text-base text-taupe transition hover:border-gold hover:text-gold"
          >
            <BookOpen aria-hidden size={15} />
            History
            {state.chronicle.length > 0 && (
              <span className="rounded-full bg-gold/15 px-1.5 font-sans text-[0.65rem] text-gold">{state.chronicle.length}</span>
            )}
          </button>
        </div>
        <RibbonProgress tasks={state.tasks} today={today} />
        <GentleStartButton onClick={triggerFiveMinuteReset} />
      </header>

      <div
        aria-hidden={veilOpen}
        className={`flex flex-col gap-4 transition duration-500 ${veilOpen ? 'pointer-events-none opacity-20 blur-sm' : ''}`}
      >
        {ordered.length === 0 && <p className="subheading py-4 text-center">No categories yet. Add one below.</p>}

        {ordered.map((category) => {
          const i = visible.indexOf(category);
          const now = active.has(category.id)
            ? currentOccurrence(todayOccurrences.filter((o) => o.categoryId === category.id), nowMinutes)
            : null;
          return (
            <TaskCategorySection
              key={category.id}
              category={category}
              tasks={state.tasks.filter((t) => t.categoryId === category.id)}
              nowTitle={now?.title}
              moves={{ up: moveTo(category, visible[i - 1], -1), down: moveTo(category, visible[i + 1], 1) }}
              onEditCategory={() => setEditingCategory({ mode: 'edit', category })}
              onArchive={() => archive(category)}
              onEditQuest={setEditingTask}
              onOpenChronicle={() => setChronicleOpen(true)}
            />
          );
        })}

        <button
          type="button"
          onClick={() => setEditingCategory({ mode: 'new' })}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/30 px-4 py-3 font-serif text-lg text-taupe transition hover:border-gold hover:bg-gold/5 hover:text-gold"
        >
          <Plus aria-hidden size={16} />
          New category
        </button>
      </div>

      {state.focusVeil && <FocusVeil session={state.focusVeil} />}

      {editingCategory && (
        <CategoryEditor
          category={editingCategory.mode === 'edit' ? editingCategory.category : undefined}
          onClose={() => setEditingCategory(null)}
        />
      )}
      {editingTask && <QuestEditor task={editingTask} onClose={() => setEditingTask(null)} />}
      {chronicleOpen && <ChronicleSheet onClose={() => setChronicleOpen(false)} />}
    </section>
  );
}
