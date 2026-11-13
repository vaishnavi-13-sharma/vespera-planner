// VB-08 · Raw Supabase auth errors are shown word for word, so the sign-in sheet tells anyone whether an
// email has an account. supabaseBackend returns `error.message` and SignInSheet renders it in the alert.
// With email confirmation off (Supabase "autoconfirm"), sign-up for a taken address answers
// "User already registered", which confirms that a given friend or family member uses Vespera.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInSheet } from './SignInSheet';
import { ToastProvider } from '../ui/Toast';
import { SyncProvider } from '../../sync/SyncProvider';
import { createFakeBackend } from '../../test/fakeBackend';

function renderSheet(answers: { signUp?: string }) {
  const fake = createFakeBackend();
  fake.backend.auth.signUp = async () => answers.signUp ?? null;
  render(
    <ToastProvider>
      <SyncProvider backend={fake.backend} signedOut={<SignInSheet open onClose={() => {}} />}>
        <SignInSheet open onClose={() => {}} />
      </SyncProvider>
    </ToastProvider>,
  );
}

async function submit(mode: 'sign-in' | 'create') {
  const user = userEvent.setup();
  if (mode === 'create') await user.click(await screen.findByRole('button', { name: /create an account/i }));
  await user.type(await screen.findByLabelText('Email'), 'friend@example.com');
  await user.type(screen.getByLabelText('Password'), 'a-long-password');
  await user.click(screen.getByRole('button', { name: mode === 'create' ? 'Create account' : 'Sign in' }));
}

describe('VB-08: auth errors never reveal whether an account exists', () => {
  it('creating an account for an existing email does not say so', async () => {
    renderSheet({ signUp: 'User already registered' });
    await submit('create');
    await waitFor(() => expect(screen.queryByRole('alert') ?? screen.queryByRole('status')).not.toBeNull());
    expect(document.body.textContent).not.toMatch(/already registered|already exists|already in use/i);
  });

  it('answers a taken email exactly like a new one: “check your email”', async () => {
    renderSheet({ signUp: 'user_already_exists' });
    await submit('create');
    expect(await screen.findByText(/Almost there\. If a confirmation email arrives/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['Invalid login credentials', /email and password don’t match/],
    ['invalid_credentials', /email and password don’t match/],
    ['Email not confirmed', /confirmation email/],
    ['over_request_rate_limit', /Too many tries/],
    ['Database error querying schema for user@example.com', /Something went wrong/],
  ])('signing in with “%s” shows a fixed, friendly message', async (raw, shown) => {
    const fake = createFakeBackend();
    fake.backend.auth.signInWithPassword = async () => raw;
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend} signedOut={<SignInSheet open onClose={() => {}} />}>
          <SignInSheet open onClose={() => {}} />
        </SyncProvider>
      </ToastProvider>,
    );
    await submit('sign-in');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(shown);
    expect(alert.textContent).not.toContain(raw);
  });
});
