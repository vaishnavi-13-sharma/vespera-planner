import { todayProgress, type DateKey, type Task } from '../../context/VesperaContext';

/** A golden ribbon that unspools rose→gold as quests are completed. */
export function RibbonProgress({ tasks, today }: { tasks: Task[]; today: DateKey }) {
  const { done, total, ratio } = todayProgress(tasks, today);
  const pct = Math.round(ratio * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-taupe">
        <span className="subheading text-sm">Today’s progress</span>
        <span>
          {done} / {total} quests
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Today’s progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-3 overflow-hidden rounded-full border border-gold/30 bg-espresso"
      >
        <div className="ribbon-fill h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
