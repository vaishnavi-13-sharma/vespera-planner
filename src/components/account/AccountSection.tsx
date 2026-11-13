import { useState } from 'react';
import { Cloud } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';
import { VanitySection } from '../vanity/VanitySection';
import { AccountDetails } from './AccountDetails';
import { BringEarlierBoard } from './BringEarlierBoard';
import { SignInSheet } from './SignInSheet';
import { ACCOUNT_PRIMARY_CLASS } from './shared';

/** Vanity Drawer section: who is signed in, sync status, sign in/out. Hidden in local-only builds. */
export function AccountSection() {
  const { enabled, user } = useSync();
  const [signingIn, setSigningIn] = useState(false);
  if (!enabled) return null;

  return (
    <VanitySection
      icon={Cloud}
      title="Account"
      blurb="Sync your board across devices."
      summary={user ? `Signed in as ${user.email ?? user.name ?? 'you'}` : 'Not signed in'}
    >
      {user ? (
        <>
          <AccountDetails />
          <BringEarlierBoard />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-vanilla">Sign in to sync between your devices.</p>
          <button type="button" onClick={() => setSigningIn(true)} className={ACCOUNT_PRIMARY_CLASS}>
            <Cloud aria-hidden size={18} />
            Sign in to sync
          </button>
        </div>
      )}
      <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} />
    </VanitySection>
  );
}
