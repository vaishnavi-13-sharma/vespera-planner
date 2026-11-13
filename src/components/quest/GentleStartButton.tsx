import { Sparkles } from 'lucide-react';

export function GentleStartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full animate-glow items-center justify-center gap-3 rounded-2xl border border-gold/70 bg-gold/15 px-5 py-4 font-serif text-2xl text-gold transition hover:bg-gold/25"
    >
      <Sparkles aria-hidden className="h-6 w-6 transition-transform group-hover:rotate-12" />
      Gentle Start
      <span className="font-sans text-xs uppercase tracking-widest text-taupe">5-minute start</span>
    </button>
  );
}
