import { formatTime } from '../../context/VesperaContext';

/** ── now · 6:12 PM ── : a gold thread drawn between today's cards. */
export function NowLine({ minutes }: { minutes: number }) {
  const label = formatTime(minutes);
  return (
    <li role="separator" aria-label={`Now · ${label}`} className="flex items-center gap-2 py-0.5">
      <span aria-hidden className="tl-now-flame h-2 w-2 shrink-0 rounded-full bg-gold" />
      <span aria-hidden className="tl-now-rule h-px flex-1" />
      <span aria-hidden className="shrink-0 font-serif text-sm italic text-gold">
        now · {label}
      </span>
      <span aria-hidden className="tl-now-rule h-px w-6 shrink-0" />
    </li>
  );
}
