import { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';
import { Sheet } from '../ui/Sheet';
import { AccountDetails } from './AccountDetails';
import { SignInSheet } from './SignInSheet';
import { Avatar, STATUS_DOT, statusLabel } from './shared';

/** Header badge: a "Sign in" pill, or the signed-in avatar with a sync-status dot. */
export function SyncBadge() {
  const { enabled, user, status } = useSync();
  const [signingIn, setSigningIn] = useState(false);
  const [viewing, setViewing] = useState(false);

  // Signed out from the account sheet: don't reopen it on the next sign-in.
  useEffect(() => {
    if (!user) setViewing(false);
  }, [user]);

  if (!enabled) return null;

  return (
    <>
      {user ? (
        <button
          type="button"
          aria-label={`Account · ${statusLabel(status)}`}
          onClick={() => setViewing(true)}
          className="sync-badge relative flex h-11 w-11 items-center justify-center rounded-full transition"
        >
          <Avatar user={user} size={36} />
          <span
            aria-hidden
            className={`absolute bottom-1 right-1 h-3 w-3 rounded-full ring-2 ring-mahogany ${STATUS_DOT[status] ?? 'bg-gold sync-dot-pulse'}`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSigningIn(true)}
          className="ornate-border inline-flex min-h-11 items-center gap-1.5 rounded-full bg-burgundy/40 px-3.5 text-sm text-vanilla transition hover:bg-burgundy/70 hover:text-gold"
        >
          <Cloud aria-hidden size={16} className="text-gold" />
          Sign in
        </button>
      )}

      <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} />
      <Sheet open={viewing && !!user} onClose={() => setViewing(false)} title="Your account">
        <AccountDetails />
      </Sheet>
    </>
  );
}
