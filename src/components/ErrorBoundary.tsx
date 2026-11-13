import { Component, useId, useState, type ChangeEvent, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import { restoreBackup, startFresh, type RecoveryResult } from './boardRecovery';
import { readFileText } from './vanity/BackupSettings';

/**
 * Last line of defence: if anything throws while rendering, show a calm recovery screen
 * instead of a blank page (VB-01). It sits outside every provider, so recovering means fixing
 * the stored board and remounting the whole app.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Vespera hit an error', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <RecoveryScreen onRecovered={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

const PROBLEM: Record<Exclude<RecoveryResult, 'recovered'>, string> = {
  'not-a-backup': 'That file isn’t a Vespera backup, so nothing was changed. Try another one, or start fresh.',
  'no-room': 'There’s no room on this device to keep a copy of your board, so nothing was changed. Free up some space and try again.',
  'no-storage': 'This browser isn’t letting Vespera save right now, so the backup couldn’t be kept. Check that site storage is allowed, then try again.',
};

const ACTION_CLASS =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-serif text-lg transition';

function RecoveryScreen({ onRecovered }: { onRecovered: () => void }) {
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);

  function settle(result: RecoveryResult) {
    if (result === 'recovered') onRecovered();
    else setProblem(PROBLEM[result]);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      return setProblem(PROBLEM['not-a-backup']);
    }
    // Outside the providers there is no `today`; the clock is read once, here.
    settle(restoreBackup(text, new Date()));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-espresso px-4 py-10 text-vanilla">
      <section aria-labelledby={`${id}-title`} className="velvet-card ornate-border flex w-full max-w-md flex-col gap-4 p-6 text-center">
        <span aria-hidden className="text-4xl">
          🕯️
        </span>
        <h1 id={`${id}-title`} className="font-serif text-3xl italic text-gold">
          Something went wrong
        </h1>
        <p className="text-sm leading-relaxed text-taupe">
          Vespera hit a problem opening your board. Nothing has been deleted: restore a backup, or start a fresh board.
          Either way, a copy of this one stays saved on this device.
        </p>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${id}-backup`}
            className={`${ACTION_CLASS} cursor-pointer bg-burgundy text-vanilla hover:bg-burgundy/80 hover:text-gold focus-within:outline focus-within:outline-2 focus-within:outline-gold`}
          >
            <Upload aria-hidden size={18} />
            Restore a backup
            <input id={`${id}-backup`} type="file" accept=".json,application/json" onChange={onFile} className="sr-only" />
          </label>
          <button
            type="button"
            onClick={() => settle(startFresh(new Date()))}
            className={`${ACTION_CLASS} flex-col gap-0 border border-gold/30 text-vanilla hover:border-gold/70 hover:text-gold`}
          >
            <span className="inline-flex items-center gap-2">
              <RotateCcw aria-hidden size={16} /> Start fresh
            </span>{' '}
            <span className="font-sans text-xs text-taupe">(keeps a copy of the broken board)</span>
          </button>
        </div>

        {problem && (
          <p role="alert" className="rounded-lg border border-rose/40 bg-burgundy/30 px-3 py-2 text-sm text-vanilla">
            {problem}
          </p>
        )}
      </section>
    </main>
  );
}
