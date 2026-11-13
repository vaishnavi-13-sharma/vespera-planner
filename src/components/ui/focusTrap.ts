// Keeps Tab and Shift+Tab inside a modal panel (sheets, dialogs), as aria-modal promises.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** The controls Tab can reach inside `panel`, in order (hidden and inert ones skipped). */
export function tabbables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[hidden],[inert]'));
}

/**
 * Call from a keydown handler while `panel` is the top overlay. Wraps Tab from the last control
 * to the first (and Shift+Tab the other way), and pulls focus back in if it has wandered out.
 */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null): void {
  if (e.key !== 'Tab' || !panel) return;
  const items = tabbables(panel);
  const active = document.activeElement;
  if (items.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const inside = active instanceof Node && panel.contains(active);
  if (e.shiftKey && (!inside || active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault();
    first.focus();
  }
}
