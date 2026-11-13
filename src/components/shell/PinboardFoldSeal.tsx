import { useContext } from 'react';
import { PanelRightClose } from 'lucide-react';
import { FoldSlotContext } from './foldSlot';
import './shell.css';

/**
 * The wax seal that folds the Pinboard into a slim strip. The Pinboard places it in its own header row;
 * it renders only in the triptych, where the shell offers the fold.
 */
export function PinboardFoldSeal() {
  const slot = useContext(FoldSlotContext);
  if (!slot) return null;
  return (
    <button
      type="button"
      aria-label="Fold Pinboard"
      aria-expanded
      aria-controls={slot.controls}
      title="Fold the Pinboard away"
      onClick={slot.onFold}
      className="shell-seal flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gold transition hover:text-vanilla"
    >
      <PanelRightClose aria-hidden size={18} />
    </button>
  );
}
