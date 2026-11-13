import type { ReactNode } from 'react';
import { noteVariant, useVespera } from '../../context/VesperaContext';
import { Fastener } from './Fastener';
import { Sprig } from './Sprig';

/**
 * Slight alternating tilts so the board looks hand-pinned. Each paper swings from its top-centre pin,
 * and the angles stay small enough that a row's tops still line up (within about a pixel).
 */
export const TILTS = ['-rotate-[0.6deg]', 'rotate-[0.6deg]', '-rotate-[0.3deg]', 'rotate-0'] as const;

/**
 * Holds one paper note on the board: an optional sprig tucked behind it, the paper itself, and the board's fastener on top.
 * The paper's torn edge is a clip-path, so the fastener and sprig sit outside it to overhang freely.
 */
export function PinnedPaper({ noteId, index, children }: { noteId: string; index: number; children: ReactNode }) {
  const { state } = useVespera();
  const { fastener, sprigs } = state.settings;
  return (
    <div className={`relative isolate origin-top ${TILTS[index % TILTS.length]}`}>
      {sprigs && noteVariant(noteId).sprig && <Sprig noteId={noteId} />}
      {children}
      <Fastener kind={fastener} noteId={noteId} />
    </div>
  );
}
