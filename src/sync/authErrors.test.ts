import { AUTH_MESSAGES, friendlyAuthError } from './authErrors';

describe('friendlyAuthError (VB-08)', () => {
  it('passes success through', () => {
    expect(friendlyAuthError('sign-in', null)).toBeNull();
  });

  it.each(['User already registered', 'user_already_exists', 'email_exists', 'A user with this email address has already been registered'])(
    'treats sign-up for a taken email (“%s”) exactly like success',
    (raw) => {
      expect(friendlyAuthError('sign-up', raw)).toBeNull();
    },
  );

  it.each([
    ['sign-in', 'Invalid login credentials', AUTH_MESSAGES.mismatch],
    ['sign-in', 'invalid_credentials', AUTH_MESSAGES.mismatch],
    ['sign-in', 'email_not_confirmed', AUTH_MESSAGES.unconfirmed],
    ['sign-up', 'weak_password', AUTH_MESSAGES.weakPassword],
    ['sign-up', 'email_address_invalid', AUTH_MESSAGES.badEmail],
    ['sign-up', 'signup_disabled', AUTH_MESSAGES.closed],
    ['sign-up', 'over_email_send_rate_limit', AUTH_MESSAGES.slowDown],
    ['google', 'TypeError: Failed to fetch', AUTH_MESSAGES.offline],
    ['google', 'provider_disabled', AUTH_MESSAGES.googleOff],
    ['google', 'Unsupported provider: provider is not enabled', AUTH_MESSAGES.googleOff],
    ['sign-in', 'User already registered', AUTH_MESSAGES.unknown],
    ['sign-in', 'Database error finding user friend@example.com', AUTH_MESSAGES.unknown],
  ] as const)('%s + “%s” → a fixed message', (action, raw, expected) => {
    expect(friendlyAuthError(action, raw)).toBe(expected);
  });

  it('words Google being switched off gently', () => {
    expect(AUTH_MESSAGES.googleOff).toBe('Google sign-in isn’t switched on yet. Use email for now.');
  });

  it('never echoes what the server said', () => {
    for (const message of Object.values(AUTH_MESSAGES)) expect(message).not.toMatch(/already|exists|registered|not found/i);
  });
});
