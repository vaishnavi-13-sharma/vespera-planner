import { useId, useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';
import { GoogleMark } from './GoogleMark';
import { ACCOUNT_FIELD_CLASS, ACCOUNT_PRIMARY_CLASS } from './shared';

type Mode = 'sign-in' | 'create';
const MIN_PASSWORD = 8;

/** Google, or email and password (sign in or create an account). Used by the sign-in gate and the sign-in sheet. */
export function SignInForm() {
  const { signInWithGoogle, signInWithPassword, signUp } = useSync();
  const id = useId();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function run(request: () => Promise<string | null>, onSuccess?: () => void) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const failure = await request();
      if (failure) setError(failure);
      else onSuccess?.();
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address.includes('@')) {
      setError('Enter the email address for your account');
      return;
    }
    if (mode === 'create') {
      if (password.length < MIN_PASSWORD) {
        setError(`Use at least ${MIN_PASSWORD} characters for your password`);
        return;
      }
      void run(
        () => signUp(address, password),
        () => setNotice('Almost there. If a confirmation email arrives, open its link, then sign in here.'),
      );
    } else {
      if (!password) {
        setError('Enter your password');
        return;
      }
      void run(() => signInWithPassword(address, password));
    }
  }

  const creating = mode === 'create';

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(signInWithGoogle)}
        className="google-button inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-parchment px-4 py-2.5 font-sans text-base font-medium text-ink transition hover:bg-vanilla/90 disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleMark size={20} />
        Continue with Google
      </button>

      <p className="account-or font-serif text-sm italic text-taupe">or</p>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm text-taupe">
            Email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ACCOUNT_FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-password`} className="text-sm text-taupe">
            Password
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            placeholder={creating ? `At least ${MIN_PASSWORD} characters` : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ACCOUNT_FIELD_CLASS}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose/40 bg-burgundy/30 px-3 py-2 text-sm text-vanilla">
            {error}
          </p>
        )}
        {/* Always mounted, so screen readers announce the notice when it appears. */}
        <div aria-live="polite" className="contents">
          {notice && <p className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-vanilla">{notice}</p>}
        </div>

        <button type="submit" disabled={pending} className={ACCOUNT_PRIMARY_CLASS}>
          {pending ? <Loader2 aria-hidden size={18} className="animate-spin" /> : <KeyRound aria-hidden size={18} />}
          {creating ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        disabled={pending}
        onClick={() => switchMode(creating ? 'sign-in' : 'create')}
        className="min-h-11 self-center px-3 text-sm text-rose underline decoration-rose/40 decoration-dotted underline-offset-4 transition hover:text-gold hover:decoration-gold disabled:opacity-60"
      >
        {creating ? 'I already have an account' : 'New here? Create an account'}
      </button>
    </>
  );
}
