import type { ReactNode } from 'react';
import { Flame, LockKeyhole } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';
import { SignInForm } from '../account/SignInForm';
import './gate.css';

/** The full-screen candlelit hall around the gate and the loading candle. Reads no board, ever. */
function GateHall({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <main aria-label={label} className="gate-hall flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-serif text-5xl font-semibold italic tracking-wide text-gold">Vespera</h1>
        <p className="subheading text-lg">a storybook planner</p>
      </header>
      {children}
    </main>
  );
}

/**
 * What a signed-out visitor sees, and all they see: sign in with Google or email to open Vespera.
 * Outside a configured sync backend it only says sign-in isn't set up (no form, nothing to open).
 */
export function SignInGate() {
  const { enabled } = useSync();
  return (
    <GateHall label="Sign in to Vespera">
      <section className="velvet-card ornate-border flex w-full max-w-md flex-col gap-4 rounded-[1.25rem] p-5 sm:p-7">
        {enabled ? (
          <>
            <h2 className="text-center font-serif text-2xl text-vanilla">Sign in to open your board</h2>
            <SignInForm />
            <p className="flex items-center justify-center gap-2 text-center text-sm text-taupe">
              <LockKeyhole aria-hidden size={14} className="shrink-0 text-gold" />
              Your board stays private to you.
            </p>
          </>
        ) : (
          <p className="text-center font-serif text-xl text-vanilla">Sign-in isn’t set up for this copy of Vespera yet.</p>
        )}
      </section>
    </GateHall>
  );
}

/** A quiet candle while Vespera checks who is signed in. Shows nothing of any board. */
export function LightingCandles() {
  return (
    <GateHall>
      <p role="status" className="flex flex-col items-center gap-3 font-serif text-lg italic text-taupe">
        <Flame aria-hidden size={28} className="gate-candle text-gold" />
        Loading…
      </p>
    </GateHall>
  );
}
