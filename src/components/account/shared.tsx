import { useState } from 'react';
import type { SyncStatus } from '../../sync/SyncProvider';
import type { SyncUser } from '../../sync/types';
import './account.css';

/** Phone-sized (44px+) buttons for the account sheets. */
export const ACCOUNT_PRIMARY_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-4 py-2.5 font-serif text-lg text-vanilla transition hover:bg-burgundy/80 hover:text-gold disabled:cursor-wait disabled:opacity-60';

export const ACCOUNT_QUIET_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 px-4 py-2.5 text-sm text-taupe transition hover:border-gold hover:text-vanilla disabled:cursor-wait disabled:opacity-60';

/** 16px text so iPhone Safari doesn't zoom into the field. */
export const ACCOUNT_FIELD_CLASS =
  'ornate-border min-h-11 w-full rounded-xl bg-espresso/60 px-3 py-2 text-base text-vanilla placeholder:text-taupe/60 focus:border-gold focus:outline-none';

/** The words after "Account ·" on the badge. */
export const STATUS_LABEL: Partial<Record<SyncStatus, string>> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Sync problem',
  'update-required': 'Update needed',
};

export const STATUS_DOT: Partial<Record<SyncStatus, string>> = {
  synced: 'bg-sage',
  syncing: 'bg-gold sync-dot-pulse',
  offline: 'bg-taupe',
  error: 'bg-rose',
  'update-required': 'bg-gold',
};

/** Reloads the page (a seam so tests can watch it). */
export const page = { reload: () => window.location.reload() };

export function statusLabel(status: SyncStatus): string {
  return STATUS_LABEL[status] ?? 'Syncing…';
}

export function initialOf(user: SyncUser): string {
  const source = (user.name ?? user.email ?? '').trim();
  return source ? source[0].toUpperCase() : '✦';
}

/** The person's photo, or their initial in gold on burgundy velvet. */
export function Avatar({ user, size }: { user: SyncUser; size: number }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = user.avatarUrl && !broken;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className="account-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif leading-none text-gold"
    >
      {showPhoto ? (
        <img src={user.avatarUrl!} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        initialOf(user)
      )}
    </span>
  );
}
