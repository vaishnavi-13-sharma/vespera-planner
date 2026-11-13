import { useEffect, useId, useState, type FormEvent } from 'react';
import { ChevronDown, Feather, KeyRound, Laptop, type LucideIcon } from 'lucide-react';
import { hasOracleKey, ORACLE_KEY_EVENT, removeOracleKey, saveOracleKey, useOracleAvailability, type OracleVia } from '../../ai/askOracle';
import { useSync } from '../../sync/SyncProvider';
import { useToast } from '../ui/Toast';
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '../ui/accents';
import { VanitySection } from '../vanity/VanitySection';
import './oracle-settings.css';

/** `summary`: the few words on the folded Vanity Drawer header. */
const STATUS: Record<'bridge' | 'key' | 'off', { label: string; summary: string; icon: LucideIcon; tone: string; lit: boolean }> = {
  bridge: { label: 'Connected on this computer', summary: 'Connected on this computer', icon: Laptop, tone: 'border-sage/40 bg-sage/10 text-sage', lit: true },
  key: { label: 'Using your key', summary: 'Using your key', icon: KeyRound, tone: 'border-gold/40 bg-gold/10 text-gold', lit: true },
  off: { label: 'Free and works offline', summary: 'Free and offline', icon: Feather, tone: 'border-taupe/30 bg-espresso/40 text-taupe', lit: false },
};

/** Is a key stored on this device? Follows saves and removals made anywhere in the app. */
function useKeyStored(): boolean {
  const [stored, setStored] = useState(hasOracleKey);
  useEffect(() => {
    const check = () => setStored(hasOracleKey());
    window.addEventListener(ORACLE_KEY_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(ORACLE_KEY_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, []);
  return stored;
}

function StatusSeal({ via }: { via: OracleVia | null }) {
  const status = STATUS[via ?? 'off'];
  const Icon = status.icon;
  return (
    <p role="status" className="flex items-center gap-3 rounded-xl border border-gold/15 bg-mahogany/40 px-3 py-2.5">
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${status.tone} ${status.lit ? 'scribe-seal-lit' : ''}`}
      >
        <Icon size={15} />
      </span>
      <span className="font-serif text-base leading-tight text-vanilla">{status.label}</span>
    </p>
  );
}

/** Vanity Drawer "Quick Scribe" section: free and offline by default, with your own AI key tucked in a closed drawer. */
export function OracleSection() {
  const { via } = useOracleAvailability();
  const stored = useKeyStored();
  const showToast = useToast();
  const { enabled: canSignIn } = useSync();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [refused, setRefused] = useState(false);

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const saved = saveOracleKey(draft);
    setRefused(!saved);
    if (saved) {
      setDraft('');
      showToast({ message: 'Key saved on this device' });
    }
  }

  function onRemove() {
    removeOracleKey();
    setRefused(false);
    showToast({ message: 'Key removed from this device' });
  }

  return (
    <VanitySection icon={Feather} title="Quick Scribe" blurb="Writing things down is free and works offline. AI is optional." summary={STATUS[via ?? 'off'].summary}>
      <StatusSeal via={via} />

      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-own-key`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-sm text-taupe transition hover:text-vanilla"
      >
        <span className="flex items-center gap-2">
          <KeyRound aria-hidden size={15} className="shrink-0 text-gold/80" />
          Use your own AI key (optional)
        </span>
        <ChevronDown aria-hidden size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={`${id}-own-key`} className="scribe-reveal flex flex-col gap-3 border-t border-gold/15 pt-3">
          <p className="text-sm italic leading-snug text-taupe">
            Vespera stays free. With a key, your own Anthropic account pays for each request. The key stays on this device and is never synced or backed up
            {canSignIn ? ', and it’s removed when you sign out.' : '.'}
          </p>

          <form onSubmit={onSave} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-key`} className="subheading text-xs text-gold">
              Your Anthropic key
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={`${id}-key`}
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={stored ? 'A key is stored; paste a new one to replace it' : 'sk-ant-…'}
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD_CLASS} min-h-11 min-w-0 flex-1 basis-48 font-mono`}
              />
              <button type="submit" disabled={!draft.trim()} className={`${PRIMARY_BUTTON_CLASS} min-h-11 disabled:opacity-50`}>
                <KeyRound aria-hidden size={15} /> Save key
              </button>
            </div>
          </form>
          {refused && (
            <p role="alert" className="rounded-lg border border-rose/40 bg-burgundy/30 px-3 py-2 text-sm text-vanilla">
              This browser couldn’t save the key (are you in private browsing?), so nothing was saved.
            </p>
          )}

          {stored && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-h-11 w-full items-center justify-start gap-1.5 rounded-lg border border-rose/30 px-3 py-2 text-sm text-rose transition hover:border-rose hover:bg-rose/10"
            >
              Remove key
            </button>
          )}
        </div>
      )}
    </VanitySection>
  );
}
