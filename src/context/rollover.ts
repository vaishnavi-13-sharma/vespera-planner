import { compactBoard } from './compact';
import type { ChronicleEntry, DateKey, VesperaState } from './types';

/** The new-morning pass: quests finished before today move off the board into the Chronicle, and anything over 90 days old is archived. */
export function rollover(state: VesperaState, today: DateKey): VesperaState {
  if (state.lastRolloverDate === today) return state;
  const finished: ChronicleEntry[] = [];
  const tasks = state.tasks.filter((t) => {
    if (!t.done) return true;
    const completedOn = t.completedOn ?? state.lastRolloverDate;
    if (completedOn >= today) return true;
    finished.push({ ...t, completedOn });
    return false;
  });
  return compactBoard({ ...state, tasks, chronicle: [...finished, ...state.chronicle], lastRolloverDate: today }, today);
}
