import { useSyncExternalStore } from 'react';

// Whether the Quick Scribe modal is open, shared by the header pill and ⌘K.
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
}

export const openCapture = () => set(true);
export const closeCapture = () => set(false);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCaptureOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
