// CG-09 · Sheets are aria-modal, so Tab and Shift+Tab must stay inside the panel.
import type { ReactNode } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';
import { renderWithVespera } from '../../test/renderWithVespera';

it('Tab from the last control in an open sheet wraps inside the sheet', async () => {
  const user = userEvent.setup();
  renderWithVespera(
    <>
      <button type="button">Behind the backdrop</button>
      <Sheet open onClose={() => {}} title="Edit block">
        <input aria-label="Title" />
        <button type="button">Save</button>
      </Sheet>
    </>,
  );
  const sheet = screen.getByRole('dialog', { name: 'Edit block' });

  screen.getByRole('button', { name: 'Save' }).focus();
  await user.tab();

  expect(sheet).toContainElement(document.activeElement as HTMLElement);
  expect(screen.getByRole('button', { name: 'Behind the backdrop' })).not.toHaveFocus();
});

it('Shift+Tab from the first control in an open sheet wraps inside the sheet', async () => {
  const user = userEvent.setup();
  renderWithVespera(
    <>
      <button type="button">Behind the backdrop</button>
      <Sheet open onClose={() => {}} title="Edit block">
        <input aria-label="Title" />
        <button type="button">Save</button>
      </Sheet>
    </>,
  );
  const sheet = screen.getByRole('dialog', { name: 'Edit block' });

  screen.getByRole('button', { name: 'Close' }).focus();
  await user.tab({ shift: true });

  expect(sheet).toContainElement(document.activeElement as HTMLElement);
});

describe('edge cases', () => {
  function renderSheet(footer?: ReactNode) {
    return renderWithVespera(
      <>
        <button type="button">Behind the backdrop</button>
        <Sheet open onClose={() => {}} title="Edit block" footer={footer}>
          <input aria-label="Title" />
          <button type="button" disabled>
            Disabled
          </button>
          <a href="#somewhere">A link</a>
          <select aria-label="Hidden choice" hidden />
        </Sheet>
      </>,
    );
  }

  it('Shift+Tab from the panel itself (focused on open) wraps to the last control', async () => {
    const user = userEvent.setup();
    renderSheet(<button type="button">Save</button>);
    const sheet = screen.getByRole('dialog', { name: 'Edit block' });
    expect(sheet).toHaveFocus(); // the sheet focuses its panel when it opens

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('Tab from the footer wraps to Close, skipping disabled and hidden controls', async () => {
    const user = userEvent.setup();
    renderSheet(<button type="button">Save</button>);

    screen.getByRole('button', { name: 'Save' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('a link can be the last stop when there is no footer', async () => {
    const user = userEvent.setup();
    renderSheet();

    screen.getByRole('link', { name: 'A link' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('Tab between controls inside the sheet still moves normally', async () => {
    const user = userEvent.setup();
    renderSheet(<button type="button">Save</button>);

    screen.getByRole('button', { name: 'Close' }).focus();
    await user.tab();

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
  });

  it('only the top sheet traps Tab when two are stacked', async () => {
    const user = userEvent.setup();
    renderWithVespera(
      <>
        <Sheet open onClose={() => {}} title="Vanity">
          <button type="button">Vanity control</button>
        </Sheet>
        <Sheet open onClose={() => {}} title="Confirm">
          <button type="button">Yes</button>
        </Sheet>
      </>,
    );
    const top = screen.getByRole('dialog', { name: 'Confirm' });

    screen.getByRole('button', { name: 'Yes' }).focus();
    await user.tab();

    expect(top).toContainElement(document.activeElement as HTMLElement);
  });
});
