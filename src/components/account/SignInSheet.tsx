import { useEffect, useRef } from 'react';
import { useSync } from '../../sync/SyncProvider';
import { Sheet } from '../ui/Sheet';
import { SignInForm } from './SignInForm';

/** "Sign in to sync": the sign-in form in a sheet. Closing it clears what was typed. */
export function SignInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSync();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Signed in (here, or by returning from Google): this sheet's work is done.
  useEffect(() => {
    if (open && user) closeRef.current();
  }, [open, user]);

  return (
    <Sheet open={open && !user} onClose={onClose} title="Sign in to sync">
      <p className="subheading text-base">Sync your board between your laptop and phone. It stays private to you.</p>
      <SignInForm />
    </Sheet>
  );
}
