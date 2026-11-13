import { useCallback, useState } from 'react';

// Layout choices are per-device view preferences (not board data), so they live outside the synced Vespera state.
function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return allowed.includes(saved as T) ? (saved as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A string choice remembered in `localStorage[key]`; unknown or unreadable values fall back. */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState(() => load(key, allowed, fallback));
  // Stable, so effects and memos can depend on it.
  const choose = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Private mode or storage full: the choice just isn't remembered.
      }
    },
    [key],
  );
  return [value, choose];
}

/** Arrow keys, Home and End for a horizontal tablist (WAI-ARIA tabs pattern). Returns the next index, or null. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  const last = count - 1;
  if (key === 'ArrowRight') return index === last ? 0 : index + 1;
  if (key === 'ArrowLeft') return index === 0 ? last : index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}
