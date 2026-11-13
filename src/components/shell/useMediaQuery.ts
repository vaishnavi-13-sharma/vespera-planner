import { useEffect, useState } from 'react';

/** Without `matchMedia` (jsdom, very old browsers) assume a desktop-sized window: min-width queries match. */
function read(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return /min-width/.test(query);
  return window.matchMedia(query).matches;
}

/** Follows `window.matchMedia(query)` and its `change` event. */
export function useMediaQuery(query: string): boolean {
  const [state, setState] = useState(() => ({ query, matches: read(query) }));
  if (state.query !== query) setState({ query, matches: read(query) });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: { matches: boolean }) => setState({ query, matches: e.matches });
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Safari before 14 only has the deprecated listener API.
    mql.addListener?.(onChange);
    return () => mql.removeListener?.(onChange);
  }, [query]);

  return state.matches;
}
