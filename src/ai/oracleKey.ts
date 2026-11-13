// The person's own Anthropic key: kept only in this browser, never in VesperaState, never synced or backed up.
export const ORACLE_KEY_STORAGE = 'vespera_oracle_key';
/** Fired on window whenever the key is saved or removed, so every Scribe surface re-checks. */
export const ORACLE_KEY_EVENT = 'vespera-oracle-key';

export function readOracleKey(): string | null {
  try {
    return localStorage.getItem(ORACLE_KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

export function hasOracleKey(): boolean {
  return readOracleKey() !== null;
}

function announce() {
  try {
    window.dispatchEvent(new Event(ORACLE_KEY_EVENT));
  } catch {
    // No window (or no Event): nobody to tell.
  }
}

/** Store the key on this device. Returns false if the browser refused (private mode, storage full). */
export function saveOracleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  try {
    localStorage.setItem(ORACLE_KEY_STORAGE, trimmed);
  } catch {
    return false;
  }
  announce();
  return true;
}

export function removeOracleKey(): void {
  try {
    localStorage.removeItem(ORACLE_KEY_STORAGE);
  } catch {
    // Nothing stored, or storage unavailable: either way there is no key.
  }
  announce();
}
