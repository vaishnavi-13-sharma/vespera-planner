import { daysBetween, formatDateKey, useVespera, type Note } from '../../context/VesperaContext';

/** The "Next review: Sat" / "New" / "Due today" hint under a vocab card's word. */
export function ReviewHint({ note }: { note: Note }) {
  const { today } = useVespera();
  const due = note.review?.due;

  if (!due) return <p className="mt-0.5 font-serif text-sm italic text-burgundy">New</p>;
  if (due <= today) return <p className="study-due mt-0.5 font-serif text-sm italic text-burgundy">Due today</p>;
  return (
    <p className="mt-0.5 font-serif text-sm italic text-ink/60">
      Next review: {formatDateKey(due, daysBetween(today, due) < 7 ? 'short' : 'tab')}
    </p>
  );
}
