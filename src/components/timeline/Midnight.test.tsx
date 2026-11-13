// CG-06 in the timeline: no button offers to push a block past midnight.
import { screen } from '@testing-library/react';
import { createBaseState, occurrencesForDate, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { BlockCard } from './BlockCard';
import { LateRibbon } from './LateRibbon';

const today = '2026-11-12';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 23, 0));
});
afterEach(() => vi.useRealTimers());

function lateEvening(): VesperaState {
  const s = createBaseState(today);
  s.blocks = [
    { id: 'blk-tea', date: today, title: 'Evening tea', kind: 'flexible', start: 21 * 60, end: 21 * 60 + 30 },
    { id: 'blk-read', date: today, title: 'Read in bed', kind: 'flexible', start: 22 * 60 + 30, end: 23 * 60 + 15 },
    { id: 'blk-wind', date: today, title: 'Wind down', kind: 'flexible', start: 23 * 60 + 15, end: 23 * 60 + 45 },
  ];
  return s;
}

const occurrence = (s: VesperaState, key: string) => occurrencesForDate(s, today).find((o) => o.key === key)!;

it('Push 30m is disabled, with a gentle reason, when the day has no room left', () => {
  const s = lateEvening();
  renderWithVespera(<BlockCard block={occurrence(s, 'blk-read')} inProgress={false} onEdit={() => {}} />, s);
  const push = screen.getByRole('button', { name: /Push 30m/ });
  expect(push).toBeDisabled();
  expect(push).toHaveAttribute('title', 'No room left before midnight');
});

it('Push 30m stays available when the push fits', () => {
  const s = lateEvening();
  renderWithVespera(<BlockCard block={occurrence(s, 'blk-tea')} inProgress={false} onEdit={() => {}} />, s);
  expect(screen.getByRole('button', { name: /Push 30m/ })).toBeEnabled();
});

it('the running-late ribbon offers no slide that would cross midnight', () => {
  // 23:00, "Read in bed" was set for 22:30: sliding it to now would push "Wind down" to 00:15.
  const s = lateEvening();
  renderWithVespera(<LateRibbon offer={occurrence(s, 'blk-read')} />, s);
  expect(screen.queryByRole('button', { name: 'Move the rest of today to now' })).toBeNull();
  expect(screen.getByRole('button', { name: /I'm on it/ })).toBeInTheDocument();
  expect(screen.getByText(/There isn’t room to move everything before midnight/)).toBeInTheDocument();
});

it('the running-late ribbon still offers a slide that fits', () => {
  vi.setSystemTime(new Date(2026, 10, 12, 21, 10));
  const s = lateEvening();
  renderWithVespera(<LateRibbon offer={occurrence(s, 'blk-tea')} />, s);
  expect(screen.getByRole('button', { name: 'Move the rest of today to now' })).toBeInTheDocument();
});
