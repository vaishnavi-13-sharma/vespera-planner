import { RefreshCw } from 'lucide-react';
import { ACCOUNT_PRIMARY_CLASS, page } from './shared';

/**
 * Sync paused because a newer Vespera wrote this board (status 'update-required'): say so gently, and offer
 * the reload that fixes it. Reloading fetches the newest app; the service worker switches over by itself.
 */
export function UpdateRequired() {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-gold/30 bg-espresso/50 px-3 py-3">
      <p className="font-serif text-lg leading-tight text-gold">Update needed</p>
      <p className="text-sm text-vanilla">
        A newer version of Vespera has saved your board, and this device paused syncing so it can’t overwrite those changes.
        Anything you do here stays safe on this device for now. Reload to catch up.
      </p>
      <button type="button" onClick={() => page.reload()} className={ACCOUNT_PRIMARY_CLASS}>
        <RefreshCw aria-hidden size={18} />
        Reload
      </button>
    </div>
  );
}
