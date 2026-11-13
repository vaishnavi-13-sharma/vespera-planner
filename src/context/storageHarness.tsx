// TEST HELPER ONLY (never imported by app code): a provider that loads from localStorage like
// the real app, plus a probe that exposes the live context to the test.
import { render } from '@testing-library/react';
import { SparkleProvider } from '../components/ui/Sparkles';
import { ToastProvider } from '../components/ui/Toast';
import { useVespera, VesperaProvider, type VesperaContextValue } from './VesperaContext';

export const live: { current: VesperaContextValue | null } = { current: null };

function Probe() {
  live.current = useVespera();
  return null;
}

/** Mount the provider the way main.tsx does: no initialState, so it reads (and writes) localStorage. */
export function mountFromStorage() {
  live.current = null;
  return render(
    <VesperaProvider>
      <ToastProvider>
        <SparkleProvider>
          <Probe />
        </SparkleProvider>
      </ToastProvider>
    </VesperaProvider>,
  );
}

/** Every value currently in localStorage. */
export function storedValues(): string[] {
  return Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!) ?? '');
}
