import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SparkleProvider } from '../components/ui/Sparkles';
import { ToastProvider } from '../components/ui/Toast';
import { VesperaProvider, type VesperaState } from '../context/VesperaContext';
import { createSeedState } from './ownerWeek';

/** Render UI inside a VesperaProvider (seeded with the real week, or a custom state), the ToastProvider and the SparkleProvider. */
export function renderWithVespera(ui: ReactElement, state: VesperaState = createSeedState(), options?: RenderOptions) {
  return render(
    <VesperaProvider initialState={state}>
      <ToastProvider>
        <SparkleProvider>{ui}</SparkleProvider>
      </ToastProvider>
    </VesperaProvider>,
    options,
  );
}
