// CG-08 · Medium · ⌘K during a focus session opens Quick Scribe *underneath* the Focus Chamber and steals keyboard focus.
import { fireEvent, screen } from '@testing-library/react';
import { CaptureLauncher } from './CaptureLauncher';
import { FocusChamber } from '../focus/FocusChamber';
import { createBaseState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';

const today = '2026-11-12';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 5));
});
afterEach(() => vi.useRealTimers());

function focusing() {
  const s = createBaseState(today);
  s.focusSession = {
    title: 'Deep work',
    date: today,
    occurrenceKey: 'blk-deep',
    rhythm: 'whole',
    sound: 'off',
    startedAt: new Date(2026, 10, 12, 10, 0).getTime(),
    totalMinutes: 60,
    pausedAt: null,
    pausedMs: 0,
  };
  return s;
}

it('keyboard focus stays in the Focus Chamber when ⌘K is pressed (the Quick Scribe modal would sit behind it, z-40 under z-55)', () => {
  renderWithVespera(
    <>
      <FocusChamber />
      <CaptureLauncher />
    </>,
    focusing(),
  );
  const chamber = screen.getByRole('dialog', { name: 'Focus Timer' });
  expect(chamber).toContainElement(document.activeElement as HTMLElement);

  fireEvent.keyDown(document, { key: 'k', metaKey: true });

  // Whatever has keyboard focus must be something the person can see: inside the chamber, not a hidden modal beneath it.
  expect(chamber).toContainElement(document.activeElement as HTMLElement);
  expect(screen.queryByRole('dialog', { name: 'Quick Scribe' })).toBeNull();
});

it('Ctrl+K is ignored in the chamber too', () => {
  renderWithVespera(
    <>
      <FocusChamber />
      <CaptureLauncher />
    </>,
    focusing(),
  );
  fireEvent.keyDown(document, { key: 'K', ctrlKey: true });
  expect(screen.queryByRole('dialog', { name: 'Quick Scribe' })).toBeNull();
});

it('⌘K opens Quick Scribe again once the candle is snuffed', () => {
  renderWithVespera(
    <>
      <FocusChamber />
      <CaptureLauncher />
    </>,
    focusing(),
  );
  fireEvent.click(screen.getByRole('button', { name: /end/i }));
  expect(screen.queryByRole('dialog', { name: 'Focus Timer' })).toBeNull();
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  expect(screen.getByRole('dialog', { name: 'Quick Scribe' })).toBeInTheDocument();
});
