import { useId, useRef, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useVanityAccordion } from './VanityAccordion';

function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-burgundy/40 text-gold">
      <Icon size={16} />
    </span>
  );
}

/**
 * One velvet-lined compartment of the Vanity Drawer. Inside a VanityAccordion it folds shut to a single
 * header row (icon, title, a one-line summary of what's chosen, and a chevron); standing alone it is always open.
 */
export function VanitySection({
  icon,
  title,
  blurb,
  summary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  /** What's chosen just now, in a few words: shown on the folded header. */
  summary: string;
  children: ReactNode;
}) {
  const accordion = useVanityAccordion();
  const id = useId();
  const headerRef = useRef<HTMLButtonElement>(null);

  if (!accordion) {
    return (
      <section className="vanity-compartment ornate-border flex flex-col gap-3 rounded-2xl bg-espresso/40 p-4">
        <header className="flex items-start gap-3">
          <span className="mt-0.5">
            <SectionIcon icon={icon} />
          </span>
          <div>
            <h3 className="font-serif text-xl leading-tight text-gold">{title}</h3>
            <p className="text-xs italic text-taupe">{blurb}</p>
          </div>
        </header>
        {children}
      </section>
    );
  }

  const open = accordion.openKey === id;
  const titleId = `${id}-title`;
  const summaryId = `${id}-summary`;
  const panelId = `${id}-panel`;

  return (
    <section data-open={open} className="vanity-compartment ornate-border flex flex-col rounded-2xl bg-espresso/40">
      <h3 className="m-0">
        <button
          ref={headerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-labelledby={titleId}
          aria-describedby={summaryId}
          onClick={() => accordion.toggle(id)}
          className="vanity-header flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-gold/[0.04]"
        >
          <SectionIcon icon={icon} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={titleId} className="font-serif text-xl leading-tight text-gold">
              {title}
            </span>
            <span id={summaryId} className="truncate text-xs italic text-taupe">
              {summary}
            </span>
          </span>
          <ChevronDown aria-hidden size={18} className="vanity-chevron shrink-0 text-taupe" />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        inert={!open}
        className="vanity-panel"
        onTransitionEnd={(e) => {
          // Once a drawer has slid open, make sure its header is still in view.
          if (open && e.target === e.currentTarget) headerRef.current?.scrollIntoView?.({ block: 'nearest' });
        }}
      >
        <div className="vanity-panel-inner">
          <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
            <p className="text-xs italic text-taupe">{blurb}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
