import type { ShellTab } from './TabBar';

const REVEAL_EVENT = 'vespera:reveal-panel';

/**
 * Ask the shell to show a panel: the matching tab on a phone, the matching page on a tablet, nothing in the
 * triptych (every panel already shows). The shell turns to it synchronously, so the caller can scroll right after.
 */
export function revealPanel(panel: ShellTab): void {
  window.dispatchEvent(new CustomEvent<ShellTab>(REVEAL_EVENT, { detail: panel }));
}

/** Listen for `revealPanel` calls; returns the unsubscribe. */
export function onRevealPanel(listener: (panel: ShellTab) => void): () => void {
  const handle = (e: Event) => listener((e as CustomEvent<ShellTab>).detail);
  window.addEventListener(REVEAL_EVENT, handle);
  return () => window.removeEventListener(REVEAL_EVENT, handle);
}
