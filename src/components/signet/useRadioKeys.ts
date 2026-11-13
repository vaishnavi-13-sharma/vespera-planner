import { useRef, type KeyboardEvent } from 'react';

/** Roving focus for a radiogroup of buttons: only the checked one is tabbable, and arrow keys move and select. */
export function useRadioKeys<T>(options: readonly T[], value: T, onChange: (value: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  return (option: T, i: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[i] = el;
    },
    tabIndex: option === value ? 0 : -1,
    onKeyDown: (e: KeyboardEvent) => {
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = (i + step + options.length) % options.length;
      onChange(options[next]);
      refs.current[next]?.focus();
    },
  });
}
