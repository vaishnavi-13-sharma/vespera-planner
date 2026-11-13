import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useVespera } from '../../context/VesperaContext';
import { useSync, type SyncStatus } from '../../sync/SyncProvider';
import { ChoiceDialog, type Choice } from '../ui/ChoiceDialog';
import { ACCOUNT_QUIET_CLASS, Avatar, STATUS_DOT } from './shared';
import { UpdateRequired } from './UpdateRequired';

const PROVIDER_LINE = { google: 'Signed in with Google', email: 'Signed in with email', other: 'Signed in' } as const;

type LeaveChoice = 'stay' | 'forget';

const LEAVE_CHOICES: Choice<LeaveChoice>[] = [
  { value: 'stay', label: 'Stay signed in', description: 'Vespera keeps trying to sync them.', tone: 'primary' },
  { value: 'forget', label: 'Sign out anyway', description: 'This device forgets your board, unsynced changes included.', tone: 'danger' },
];

function statusLine(status: SyncStatus, lastSyncedAt: number | null, nowMs: number, problem: string | null): string {
  switch (status) {
    case 'synced': {
      if (lastSyncedAt === null) return 'Synced';
      const minutes = Math.floor((nowMs - lastSyncedAt) / 60_000);
      if (minutes < 1) return 'Synced · just now';
      if (minutes < 60) return `Synced · ${minutes} min ago`;
      return `Synced · ${Math.floor(minutes / 60)} hr ago`;
    }
    case 'offline':
      return 'Offline. Changes are saved on this device and will sync when you’re back.';
    case 'error':
      return problem ?? 'Sync problem. Your board is safe on this device.';
    default:
      return 'Syncing…';
  }
}

/** Who is signed in, how the sync is going, and a way out. Shared by the badge's sheet and the Vanity Drawer. */
export function AccountDetails() {
  const { user, status, problem, lastSyncedAt, signOut } = useSync();
  const { now } = useVespera();
  const [leaving, setLeaving] = useState(false);
  const [unsynced, setUnsynced] = useState(false);
  if (!user) return null;

  // Just signed in: this account's board is still on its way (and remounts when it lands).
  // For a beat the status can still read 'signed-out' before the first sync begins.
  if (lastSyncedAt === null && (status === 'syncing' || status === 'signed-out')) {
    return (
      <div role="status" className="flex items-center gap-3">
        <Avatar user={user} size={52} />
        <p className="flex items-center gap-2 font-serif text-lg italic text-taupe">
          <Loader2 aria-hidden size={16} className="animate-spin text-gold" />
          Opening your board…
        </p>
      </div>
    );
  }

  const title = user.name ?? user.email ?? 'Your account';
  const subtitle = user.name ? user.email : null;

  /** Sign out once the cloud has everything; if it doesn't, ask before forgetting this device's copy. */
  async function leave(force = false) {
    setUnsynced(false);
    setLeaving(true);
    try {
      if ((await signOut({ force })) === 'unsynced') setUnsynced(true);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={52} />
        <div className="min-w-0">
          <p className="truncate font-serif text-xl leading-tight text-vanilla">{title}</p>
          {subtitle && <p className="truncate text-sm text-taupe">{subtitle}</p>}
          <p className="text-xs italic text-gold/80">{PROVIDER_LINE[user.provider]}</p>
        </div>
      </div>

      {status === 'update-required' ? (
        <UpdateRequired />
      ) : (
        <p className="flex items-start gap-2.5 rounded-xl border border-gold/15 bg-espresso/50 px-3 py-2.5 text-sm text-vanilla">
          <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-gold sync-dot-pulse'}`} />
          <span>{statusLine(status, lastSyncedAt, now.getTime(), problem)}</span>
        </p>
      )}

      <button type="button" disabled={leaving} onClick={() => void leave()} className={ACCOUNT_QUIET_CLASS}>
        {leaving ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <LogOut aria-hidden size={16} />}
        Sign out
      </button>

      <ChoiceDialog
        open={unsynced}
        title="Sign out and forget this device?"
        message="A few changes haven’t reached the cloud yet. Signing out removes your board from this device, and those changes with it."
        choices={LEAVE_CHOICES}
        onChoose={(choice) => (choice === 'forget' ? void leave(true) : setUnsynced(false))}
        onCancel={() => setUnsynced(false)}
      />
    </div>
  );
}
