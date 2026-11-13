import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncProvider } from '../../sync/SyncProvider';
import { createFakeBackend, ME } from '../../test/fakeBackend';
import { ToastProvider } from '../ui/Toast';
import { SyncBadge } from './SyncBadge';

describe('sync badge', () => {
  it('opens "Your account" with the status and closes it on sign out', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <SyncProvider backend={createFakeBackend({ user: ME }).backend} signedOut={<SyncBadge />}>
          <SyncBadge />
        </SyncProvider>
      </ToastProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Account · Synced' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Your account' }));
    expect(sheet.getByText('Synced · just now')).toBeInTheDocument();
    expect(sheet.getByText('me@example.com')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Your account' })).not.toBeInTheDocument();
  });

  it('switches between signing in and creating an account', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <SyncProvider backend={createFakeBackend().backend} signedOut={<SyncBadge />}>
          <SyncBadge />
        </SyncProvider>
      </ToastProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Sign in to sync' }));
    await user.click(sheet.getByRole('button', { name: 'New here? Create an account' }));
    expect(sheet.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'I already have an account' }));
    expect(sheet.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
