import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBaseState, noteVariant, useVespera, type Signet, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { VelvetPinboard } from '../VelvetPinboard';
import { ChronicleSheet } from '../quest/ChronicleSheet';
import { WaxSealCheckbox } from '../quest/WaxSealCheckbox';
import { FastenerSection } from './FastenerSection';
import { SignetSection } from './SignetSection';
import { WaxSeal } from './WaxSeal';

function Probe() {
  const { state } = useVespera();
  const { signet, fastener, sprigs } = state.settings;
  return <output data-testid="probe">{`${signet.color} ${signet.emblem} ${signet.initial} ${fastener} ${sprigs}`}</output>;
}

function board(patch: Partial<VesperaState['settings']> = {}, extra: Partial<VesperaState> = {}): VesperaState {
  const s = createBaseState('2026-11-12');
  return { ...s, ...extra, settings: { ...s.settings, ...patch } };
}

describe('WaxSeal', () => {
  it('is a labelled image of the chosen color and emblem', () => {
    render(<WaxSeal signet={{ color: 'gold', emblem: 'crown', initial: 'V' }} />);
    const seal = screen.getByRole('img', { name: 'Gold wax seal with a crown' });
    expect(seal).toHaveAttribute('data-emblem', 'crown');
    expect(seal).toHaveAttribute('data-seal-color', 'gold');
  });

  it('names an initial seal by its letter, and hides decorative seals', () => {
    const signet: Signet = { color: 'sage', emblem: 'initial', initial: 'Q' };
    const { container } = render(<><WaxSeal signet={signet} /><WaxSeal signet={signet} decorative /></>);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Sage wax seal with the initial Q' })).toHaveTextContent('Q');
    expect(container.querySelectorAll('[data-emblem="initial"]')).toHaveLength(2);
  });
});

describe('WaxSealCheckbox', () => {
  it('presses your signet into a checked quest', () => {
    renderWithVespera(
      <>
        <WaxSealCheckbox checked label="Done: Water plants" onToggle={() => {}} />
        <WaxSealCheckbox checked={false} label="Done: Call mum" onToggle={() => {}} />
      </>,
      board({ signet: { color: 'rose', emblem: 'cat', initial: 'V' } }),
    );
    const checked = screen.getByRole('checkbox', { name: 'Done: Water plants' });
    expect(checked).toHaveAttribute('aria-checked', 'true');
    expect(checked.querySelector('[data-emblem]')).toHaveAttribute('data-emblem', 'cat');
    expect(checked.querySelector('[data-seal-color]')).toHaveAttribute('data-seal-color', 'rose');
    expect(screen.getByRole('checkbox', { name: 'Done: Call mum' }).querySelector('[data-emblem]')).toBeNull();
  });
});

describe('SignetSection', () => {
  it('picks a color and an emblem, with a live preview', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><SignetSection /><Probe /></>, board());
    expect(screen.getByRole('img', { name: 'Burgundy wax seal with a crescent moon' })).toBeInTheDocument();
    const colors = screen.getByRole('radiogroup', { name: 'Seal color' });
    expect(within(colors).getAllByRole('radio').map((r) => r.textContent?.trim())).toEqual(['Burgundy', 'Gold', 'Rose', 'Sage', 'Moonstone']);
    const emblems = screen.getByRole('radiogroup', { name: 'Emblem' });
    expect(within(emblems).getAllByRole('radio')).toHaveLength(7);
    await user.click(within(colors).getByRole('radio', { name: /Moonstone/ }));
    await user.click(within(emblems).getByRole('radio', { name: /Sword/ }));
    expect(screen.getByTestId('probe')).toHaveTextContent('moonstone sword V');
    expect(screen.getByRole('img', { name: 'Moonstone wax seal with a sword' })).toBeInTheDocument();
  });

  it('asks for an initial only when Initial is chosen, and keeps it to one letter', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><SignetSection /><Probe /></>, board());
    expect(screen.queryByRole('textbox', { name: 'Initial' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Initial/ }));
    const field = screen.getByRole('textbox', { name: 'Initial' });
    await user.clear(field);
    await user.type(field, 'n');
    expect(screen.getByTestId('probe')).toHaveTextContent('burgundy initial N');
    expect(screen.getByRole('img', { name: 'Burgundy wax seal with the initial N' })).toBeInTheDocument();
  });
});

describe('ChronicleSheet', () => {
  it('stamps every finished quest with your signet', () => {
    const state = board(
      { signet: { color: 'gold', emblem: 'star', initial: 'V' } },
      {
        chronicle: [
          { id: 'c1', title: 'Wrote the essay', categoryId: 'cat-study', done: true, completedOn: '2026-11-11' },
          { id: 'c2', title: 'Paid rent', categoryId: 'cat-admin', done: true, completedOn: '2026-11-10' },
        ],
      },
    );
    renderWithVespera(<ChronicleSheet onClose={() => {}} />, state);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.querySelector('[data-emblem="star"]')).not.toBeNull();
  });
});

describe('Fasteners', () => {
  const notes: VesperaState['notes'] = Array.from({ length: 12 }, (_, i) => ({ id: `note-${i}`, tagId: 'tag-braindump', text: `Scrap ${i}` }));

  it('pins notes with the chosen fastener and tucks in sprigs when asked', () => {
    const base = createBaseState('2026-11-12');
    const tagId = base.noteTags.find((t) => !t.vocab)!.id;
    const pinned = notes.map((n) => ({ ...n, tagId }));
    const { container, unmount } = renderWithVespera(<VelvetPinboard />, board({ fastener: 'washi' }, { notes: pinned }));
    expect(container.querySelectorAll('[data-fastener="washi"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-sprig]')).toHaveLength(0);
    unmount();
    const withSprigs = renderWithVespera(<VelvetPinboard />, board({ fastener: 'bows', sprigs: true }, { notes: pinned }));
    expect(withSprigs.container.querySelectorAll('[data-fastener="bows"]')).toHaveLength(12);
    expect(withSprigs.container.querySelectorAll('[data-sprig]')).toHaveLength(pinned.filter((n) => noteVariant(n.id).sprig).length);
  });

  it('chooses the fastener and sprigs in the Vanity Drawer section', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><FastenerSection /><Probe /></>, board());
    const group = screen.getByRole('radiogroup', { name: 'Fastener' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent?.trim())).toEqual(['Brass tacks', 'Velvet bows', 'Washi tape']);
    expect(within(group).getByRole('radio', { name: /Brass tacks/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: /Washi tape/ }));
    await user.click(screen.getByRole('switch', { name: 'Flower sprigs' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('washi true');
  });
});
