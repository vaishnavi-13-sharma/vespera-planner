import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AccordionValue {
  /** The one section open just now (by its key), or null when every drawer is shut. */
  openKey: string | null;
  toggle(key: string): void;
}

const AccordionContext = createContext<AccordionValue | null>(null);

/** The Vanity Drawer's compartments, as a single-open accordion: opening one closes the one that was open. */
export function VanityAccordion({ children }: { children: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = useCallback((key: string) => setOpenKey((current) => (current === key ? null : key)), []);
  const value = useMemo(() => ({ openKey, toggle }), [openKey, toggle]);
  return <AccordionContext.Provider value={value}>{children}</AccordionContext.Provider>;
}

/** The accordion a section sits in, or null when it stands alone (then it is always open). */
export function useVanityAccordion(): AccordionValue | null {
  return useContext(AccordionContext);
}
