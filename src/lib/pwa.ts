// Service-worker registration (vite-plugin-pwa, autoUpdate). The app shell is cached for offline use, and a
// new version installs and takes over by itself (skipWaiting + clientsClaim in vite.config.ts). Open tabs and
// Home Screen apps then reload onto it: right away when nothing is open, otherwise as soon as the open dialog
// closes or the app is put away. The board is saved on every change, so a reload never loses work.
import { registerSW } from 'virtual:pwa-register';

/** How often an open app checks for a new version. It also checks whenever it comes back into view. */
export const UPDATE_CHECK_MS = 30 * 60_000;
/** Coming back into view checks at most this often. */
const RESUME_CHECK_MS = 60_000;

/** Something the person is in the middle of is on screen: a dialog, sheet, Quick Scribe or the Focus Timer. */
export function isBusy(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]') !== null;
}

/**
 * Calls `reload` once, at the first safe moment: now if the page is hidden or nothing is open, otherwise when
 * the last dialog closes or the page is hidden. Returns a cancel function.
 */
export function reloadWhenSafe(reload: () => void, doc: Document = document): () => void {
  let done = false;
  let observer: MutationObserver | null = null;
  const cleanup = () => {
    observer?.disconnect();
    doc.removeEventListener('visibilitychange', check);
  };
  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    reload();
  };
  function check() {
    if (doc.visibilityState === 'hidden' || !isBusy(doc)) fire();
  }
  check();
  if (!done) {
    observer = new MutationObserver(check);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] });
    doc.addEventListener('visibilitychange', check);
  }
  return () => {
    done = true;
    cleanup();
  };
}

let started = false;

/** Registers the service worker and keeps the app on the newest version. Safe to call more than once. */
export function startAutoUpdate(): void {
  if (started || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  started = true;

  // The very first install also takes control of the page; only a *replacement* needs a reload.
  const hadController = navigator.serviceWorker.controller !== null;
  let reloadScheduled = false;
  const scheduleReload = () => {
    if (reloadScheduled) return;
    reloadScheduled = true;
    reloadWhenSafe(() => window.location.reload());
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) scheduleReload();
  });

  registerSW({
    immediate: true,
    onNeedReload: scheduleReload,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let lastCheck = Date.now();
      const checkForUpdate = () => {
        if (!navigator.onLine || registration.installing) return;
        lastCheck = Date.now();
        registration.update().catch(() => {}); // offline or the server hiccuped: try again later
      };
      setInterval(checkForUpdate, UPDATE_CHECK_MS);
      const onResume = () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck >= RESUME_CHECK_MS) checkForUpdate();
      };
      document.addEventListener('visibilitychange', onResume);
      window.addEventListener('focus', onResume);
    },
  });
}
