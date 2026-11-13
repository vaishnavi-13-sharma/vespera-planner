// CG-09 (same gap): the choice dialog is aria-modal too, so Tab must stay inside it.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoiceDialog, EDIT_SCOPE_CHOICES } from './ChoiceDialog';
import { Sheet } from './Sheet';
import { renderWithVespera } from '../../test/renderWithVespera';

function dialog() {
  return <ChoiceDialog open title="Edit which?" choices={EDIT_SCOPE_CHOICES} onChoose={() => {}} onCancel={() => {}} />;
}

it('Tab from Cancel wraps to the first choice', async () => {
  const user = userEvent.setup();
  renderWithVespera(
    <>
      <button type="button">Behind the backdrop</button>
      {dialog()}
    </>,
  );

  screen.getByRole('button', { name: 'Cancel' }).focus();
  await user.tab();

  expect(screen.getByRole('button', { name: /Just this one/ })).toHaveFocus();
});

it('Shift+Tab from the first choice wraps to Cancel', async () => {
  const user = userEvent.setup();
  renderWithVespera(dialog());

  expect(screen.getByRole('button', { name: /Just this one/ })).toHaveFocus();
  await user.tab({ shift: true });

  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
});

it('over an open sheet, Tab stays in the dialog, not the sheet beneath', async () => {
  const user = userEvent.setup();
  renderWithVespera(
    <>
      <Sheet open onClose={() => {}} title="Edit block">
        <button type="button">Save</button>
      </Sheet>
      {dialog()}
    </>,
  );
  const top = screen.getByRole('alertdialog', { name: 'Edit which?' });

  screen.getByRole('button', { name: 'Cancel' }).focus();
  await user.tab();

  expect(top).toContainElement(document.activeElement as HTMLElement);
});
