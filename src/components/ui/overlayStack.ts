// Tracks which overlays (sheets, dialogs) are open, in order, so Escape closes only the topmost.
const stack: symbol[] = [];

export function pushOverlay(): symbol {
  const id = Symbol('overlay');
  stack.push(id);
  return id;
}

export function popOverlay(id: symbol): void {
  const i = stack.lastIndexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopOverlay(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}
