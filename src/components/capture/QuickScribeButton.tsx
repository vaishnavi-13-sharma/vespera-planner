import { openCapture } from './captureStore';
import './capture.css';

/** Apple keyboards say ⌘K; everyone else presses Ctrl K. */
function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * The header pill beside the Vanity Drawer: 🖋️ Quick Scribe with a little ⌘K keycap.
 * Under 640px it folds into a round 44px quill so it never crowds the title (see capture.css).
 */
export function QuickScribeButton() {
  const keycap = isApple() ? '⌘K' : 'Ctrl K';
  return (
    <button
      type="button"
      aria-label="Quick Scribe"
      aria-keyshortcuts="Meta+K Control+K"
      title={`Quick Scribe (${keycap})`}
      onClick={openCapture}
      className="scribe-pill ornate-border flex h-11 items-center gap-2 rounded-full text-taupe transition hover:text-gold"
    >
      <span aria-hidden className="scribe-pill-quill text-base leading-none">
        🖋️
      </span>
      <span aria-hidden className="scribe-pill-label font-serif text-base italic leading-none text-vanilla">
        Quick Scribe
      </span>
      <kbd aria-hidden className="scribe-keycap font-sans">
        {keycap}
      </kbd>
    </button>
  );
}
