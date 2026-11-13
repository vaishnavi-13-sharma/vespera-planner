import { RotateCw, X } from 'lucide-react';
import { useVespera, type Notice } from '../context/VesperaContext';

const MESSAGES: Record<Notice, string> = {
  'migration-failed': 'We couldn’t bring your earlier data over, so Vespera started fresh. Your old data is still saved safely in this browser.',
  'import-failed': 'That file isn’t a Vespera backup, so nothing was changed.',
  'save-unreadable': 'Your saved board couldn’t be read, so Vespera started fresh. The original is still saved in this browser.',
  'save-repaired': 'A few parts of your saved board couldn’t be read, so they were left out. Everything else is here, and the original is still saved in this browser.',
  'newer-version': 'A newer version of Vespera is available. This device is running an older one, so your board is read-only to keep newer changes safe.',
};

/** A gentle, dismissible message for things that went sideways. A newer board can't be dismissed, only reloaded. */
export function NoticeBanner() {
  const { state, dismissNotice } = useVespera();
  if (!state.notice) return null;
  const newer = state.notice === 'newer-version';
  return (
    <div role="alert" className="ornate-border mx-auto flex max-w-2xl items-start gap-3 rounded-xl bg-burgundy/30 px-4 py-3 text-sm text-vanilla">
      <p className="flex-1">{MESSAGES[state.notice]}</p>
      {newer ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-xs text-gold transition hover:border-gold hover:bg-gold/10"
        >
          <RotateCw aria-hidden size={12} />
          Reload
        </button>
      ) : (
        <button type="button" aria-label="Dismiss notice" onClick={dismissNotice} className="text-taupe transition hover:text-vanilla">
          <X aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}
