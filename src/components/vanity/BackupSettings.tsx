import { useId, useState, type ChangeEvent } from 'react';
import { Archive, Download, RotateCcw, Upload } from 'lucide-react';
import { exportState, useVespera } from '../../context/VesperaContext';
import { ChoiceDialog } from '../ui/ChoiceDialog';
import { useToast } from '../ui/Toast';
import { QUIET_BUTTON_CLASS } from '../ui/accents';
import { VanitySection } from './VanitySection';
import { ClearTutorialButton } from '../TutorialRibbon';

/** A file's text, via Blob.text() where available and FileReader otherwise. */
export function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const ACTION_CLASS = `${QUIET_BUTTON_CLASS} w-full justify-start`;

export function BackupSettings() {
  const { state, today, importBackup, resetToStarter, dismissNotice } = useVespera();
  const showToast = useToast();
  const id = useId();
  const [failed, setFailed] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([exportState(state)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vespera-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast({ message: 'Backup saved to your downloads' });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let ok = false;
    try {
      ok = importBackup(await readFileText(file));
    } catch {
      ok = false;
    }
    setFailed(!ok);
    if (ok) {
      showToast({ message: 'Backup restored' });
    } else {
      // The message is shown right here; don't also raise the page-wide banner.
      dismissNotice();
    }
  }

  return (
    <VanitySection icon={Archive} title="Backup & reset" blurb="Save a copy of your board, or start over." summary="Export or import">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={exportBackup} className={ACTION_CLASS}>
          <Download aria-hidden size={15} /> Export backup
        </button>

        <label htmlFor={`${id}-import`} className={`${ACTION_CLASS} cursor-pointer focus-within:border-gold focus-within:text-vanilla`}>
          <Upload aria-hidden size={15} />
          Import backup
          <input id={`${id}-import`} type="file" accept=".json,application/json" onChange={onFile} className="sr-only" />
        </label>
        {failed && (
          <p role="alert" className="rounded-lg border border-rose/40 bg-burgundy/30 px-3 py-2 text-sm text-vanilla">
            That file isn’t a Vespera backup, so nothing was changed.
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="inline-flex w-full items-center justify-start gap-1.5 rounded-lg border border-rose/30 px-3 py-2 text-sm text-rose transition hover:border-rose hover:bg-rose/10"
        >
          <RotateCcw aria-hidden size={15} /> Reset to the starter guide
        </button>
        <ClearTutorialButton />
      </div>

      <ChoiceDialog
        open={confirmingReset}
        title="Reset Vespera?"
        message="Every block, quest, note and setting goes back to the Welcome to Vespera starter guide. Export a backup first if you’d like to keep this one."
        choices={[{ value: 'reset', label: 'Reset everything', tone: 'danger' }]}
        onChoose={() => {
          setConfirmingReset(false);
          setFailed(false);
          resetToStarter();
          showToast({ message: 'Back to the starter guide' });
        }}
        onCancel={() => setConfirmingReset(false)}
      />
    </VanitySection>
  );
}
