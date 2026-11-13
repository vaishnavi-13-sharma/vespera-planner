import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Accent } from '../../context/VesperaContext';
import { AccentSwatches } from './AccentSwatches';
import { ChoiceDialog, EDIT_SCOPE_CHOICES } from './ChoiceDialog';
import { EmojiField } from './EmojiField';
import { Menu } from './Menu';
import { Sheet } from './Sheet';
import { ToastProvider, useToast } from './Toast';
import { WeekdayChips } from './WeekdayChips';

describe('Sheet', () => {
  it('renders a labelled dialog only when open, and closes on Escape and the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Sheet open={false} onClose={onClose} title="Edit block"><p>body</p></Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<Sheet open onClose={onClose} title="Edit block"><p>body</p></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Edit block' })).toHaveTextContent('body');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Menu', () => {
  it('opens a menu of actions and closes after choosing one', async () => {
    const user = userEvent.setup();
    const rename = vi.fn();
    render(<Menu label="Category options" items={[{ label: 'Rename', onSelect: rename }, { label: 'Archive', onSelect: vi.fn(), tone: 'danger' }]} />);
    const trigger = screen.getByRole('button', { name: 'Category options' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Rename', 'Archive']);
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(rename).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Menu label="More" items={[{ label: 'A', onSelect: vi.fn() }]} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('ChoiceDialog', () => {
  it('offers "Just this one" / "This and all future" and reports the choice', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    render(<ChoiceDialog open title="Edit repeating block" message="This block repeats." choices={EDIT_SCOPE_CHOICES} onChoose={onChoose} onCancel={onCancel} />);
    expect(screen.getByRole('alertdialog', { name: 'Edit repeating block' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /this and all future/i }));
    expect(onChoose).toHaveBeenCalledWith('future');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

function ToastDemo({ onUndo }: { onUndo: () => void }) {
  const showToast = useToast();
  return <button onClick={() => showToast({ message: 'Skipped', actionLabel: 'Undo', onAction: onUndo })}>skip</button>;
}

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a message with an action, then fades after its duration', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(<ToastProvider><ToastDemo onUndo={onUndo} /></ToastProvider>);
    act(() => screen.getByRole('button', { name: 'skip' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('Skipped');
    act(() => screen.getByRole('button', { name: 'Undo' }).click());
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('Skipped')).not.toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'skip' }).click());
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Skipped')).not.toBeInTheDocument();
  });
});

describe('form controls', () => {
  function Controls() {
    const [accent, setAccent] = useState<Accent>('gold');
    const [emoji, setEmoji] = useState('✨');
    const [days, setDays] = useState<number[]>([4]);
    return (
      <>
        <AccentSwatches label="Accent" value={accent} onChange={setAccent} />
        <EmojiField label="Emoji" value={emoji} onChange={setEmoji} />
        <WeekdayChips value={days} onChange={setDays} />
        <output data-testid="out">{`${accent} ${emoji} ${days.join(',')}`}</output>
      </>
    );
  }

  it('picks an accent, an emoji and weekdays', async () => {
    const user = userEvent.setup();
    render(<Controls />);
    expect(screen.getByRole('radio', { name: 'Gold' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Sage' }));
    await user.click(screen.getByRole('button', { name: 'Use 🧪' }));
    await user.click(screen.getByRole('button', { name: 'Friday' }));
    await user.click(screen.getByRole('button', { name: 'Thursday' }));
    expect(screen.getByRole('button', { name: 'Friday' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('out')).toHaveTextContent('sage 🧪 5');
    await user.clear(screen.getByLabelText('Emoji'));
    await user.type(screen.getByLabelText('Emoji'), '🌙');
    expect(screen.getByTestId('out')).toHaveTextContent('sage 🌙 5');
  });
});

describe('stacked overlays', () => {
  it('Escape closes only the topmost layer', async () => {
    const user = userEvent.setup();
    const closeSheet = vi.fn();
    const cancelDialog = vi.fn();
    render(
      <>
        <Sheet open onClose={closeSheet} title="Edit block"><p>body</p></Sheet>
        <ChoiceDialog open title="Save repeating block" choices={EDIT_SCOPE_CHOICES} onChoose={vi.fn()} onCancel={cancelDialog} />
      </>,
    );
    await user.keyboard('{Escape}');
    expect(cancelDialog).toHaveBeenCalledTimes(1);
    expect(closeSheet).not.toHaveBeenCalled();
  });

  it('nested sheets close one at a time', async () => {
    const user = userEvent.setup();
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Sheet open onClose={closeOuter} title="Vanity Drawer"><p>outer</p></Sheet>
        <Sheet open onClose={closeInner} title="Sign in to sync"><p>inner</p></Sheet>
      </>,
    );
    await user.keyboard('{Escape}');
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
