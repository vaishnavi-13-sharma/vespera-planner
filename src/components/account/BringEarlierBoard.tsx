import { useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';
import { ChoiceDialog, type Choice } from '../ui/ChoiceDialog';
import { useToast } from '../ui/Toast';
import { ACCOUNT_QUIET_CLASS } from './shared';

const CHOICES: Choice<'bring'>[] = [
  { value: 'bring', label: 'Bring it in', description: 'It becomes your account’s board and syncs to your other devices.', tone: 'primary' },
];

const RESULT_TOAST = {
  moved: 'Your earlier board is now in your account',
  pending: 'Your earlier board is open here, and will reach your account once Vespera can sync',
  refused: 'The earlier board couldn’t be brought in just now, so nothing changed',
} as const;

/**
 * For someone who chose "Start fresh" (or signed in where their board wasn't brought in): the board this device
 * saved before sign-in can still become the account's board. Shown only while there is one to bring.
 */
export function BringEarlierBoard() {
  const { user, guestBoardWaiting, bringGuestBoard } = useSync();
  const showToast = useToast();
  const [asking, setAsking] = useState(false);
  const [bringing, setBringing] = useState(false);
  if (!user || !guestBoardWaiting) return null;

  async function bring() {
    setAsking(false);
    setBringing(true);
    try {
      showToast({ message: RESULT_TOAST[await bringGuestBoard()] });
    } finally {
      setBringing(false);
    }
  }

  return (
    <>
      <button type="button" disabled={bringing} onClick={() => setAsking(true)} className={ACCOUNT_QUIET_CLASS}>
        {bringing ? <Loader2 aria-hidden size={16} className="shrink-0 animate-spin" /> : <History aria-hidden size={16} className="shrink-0" />}
        <span className="text-left">Bring this device’s earlier board into your account</span>
      </button>
      <ChoiceDialog
        open={asking}
        title="Bring in the earlier board?"
        message="Replace your account’s board with the one this device saved before you signed in? Your account’s current board is kept as a backup on this device."
        choices={CHOICES}
        onChoose={() => void bring()}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
