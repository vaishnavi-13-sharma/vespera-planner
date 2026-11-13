import { Sparkles } from 'lucide-react';

/** A small gold ribbon pinned to a category while its linked block is in progress. */
export function NowRibbon({ emoji, title }: { emoji: string; title: string }) {
  return (
    <p className="now-ribbon inline-flex max-w-full items-center gap-1.5 self-start py-1 pr-5 pl-3 text-xs font-semibold text-espresso">
      <Sparkles aria-hidden size={12} className="shrink-0" />
      <span className="truncate">
        {emoji} {title} · happening now
      </span>
    </p>
  );
}
