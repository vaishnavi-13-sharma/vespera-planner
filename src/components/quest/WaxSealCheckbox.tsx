import { useVespera } from '../../context/VesperaContext';
import { WaxSeal } from '../signet/WaxSeal';

/** A quest's checkbox: an empty gold ring, or your signet pressed into warm wax once it's done. */
export function WaxSealCheckbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  const { state } = useVespera();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      // A 44px tap target around the 28px seal, without moving the row.
      className="group -m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full"
    >
      {checked ? (
        <span className="signet-press grid h-7 w-7 place-items-center">
          <WaxSeal signet={state.settings.signet} decorative size={28} />
        </span>
      ) : (
        <span
          aria-hidden
          className="h-7 w-7 rounded-full border border-gold/40 transition group-hover:border-gold group-hover:bg-gold/10 group-focus-visible:border-gold"
        />
      )}
    </button>
  );
}
