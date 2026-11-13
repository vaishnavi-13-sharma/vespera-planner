import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // Node-environment tests (e.g. the dev bridge) have no browser storage.
  globalThis.localStorage?.clear();
});
