// Auth errors in words a person can act on, without ever saying whether an email has an account (VB-08).
// Backends report a raw code or message; only these fixed sentences reach the screen.

export type AuthAction = 'sign-in' | 'sign-up' | 'google';

export const AUTH_MESSAGES = {
  mismatch: 'That email and password don’t match. Please check them and try again.',
  unconfirmed: 'Open the link in your confirmation email first, then sign in here.',
  weakPassword: 'Please choose a stronger password: longer, or less common.',
  badEmail: 'That email address doesn’t look quite right.',
  closed: 'New accounts aren’t open just now.',
  slowDown: 'Too many tries. Please wait a minute and try again.',
  offline: 'Vespera couldn’t reach the cloud. Check your connection and try again.',
  googleOff: 'Google sign-in isn’t switched on yet. Use email for now.',
  unknown: 'Something went wrong. Please try again in a moment.',
} as const;

/**
 * The message to show for a failed sign-in or sign-up, or null when it should look like success.
 * Signing up with an address that already has an account answers exactly like a new sign-up
 * ("check your email"), so the sheet never confirms who uses Vespera.
 */
export function friendlyAuthError(action: AuthAction, raw: string | null): string | null {
  if (raw === null) return null;
  const said = (pattern: RegExp) => pattern.test(raw);
  if (said(/rate.?limit|too many|only request this after/i)) return AUTH_MESSAGES.slowDown;
  if (action === 'google' && said(/provider.?disabled|provider is not enabled|unsupported provider/i)) return AUTH_MESSAGES.googleOff;
  if (action === 'sign-up' && said(/already.*(registered|exists|in.?use)|user_already_exists|email_exists|identity_already_exists/i)) return null;
  if (said(/weak.?password|password should/i)) return AUTH_MESSAGES.weakPassword;
  if (said(/email_address_invalid|invalid.*email|validate email/i)) return AUTH_MESSAGES.badEmail;
  if (said(/signup.?disabled|signups not allowed/i)) return AUTH_MESSAGES.closed;
  if (action === 'sign-in' && said(/email.?not.?confirmed/i)) return AUTH_MESSAGES.unconfirmed;
  if (action === 'sign-in' && said(/invalid.?(login|credentials|grant)/i)) return AUTH_MESSAGES.mismatch;
  if (said(/fetch|network/i)) return AUTH_MESSAGES.offline;
  return AUTH_MESSAGES.unknown;
}
