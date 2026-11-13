import { createContext } from 'react';

/** What the Pinboard's fold seal needs from the shell; null wherever the Pinboard can't fold (below the triptych). */
export interface FoldSlot {
  /** Id of the Pinboard body the seal folds away. */
  controls: string;
  onFold: () => void;
}

export const FoldSlotContext = createContext<FoldSlot | null>(null);
