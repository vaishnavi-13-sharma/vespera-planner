// Where is Vespera running? Used to decide whether the iPhone "Add to Home Screen" hint makes sense.

/** True for Safari on iPhone / iPad / iPod. Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS) and friends can't add to the Home Screen the same way. */
export function isIosSafari(userAgent: string): boolean {
  if (!/iP(hone|ad|od)/.test(userAgent)) return false;
  if (!/AppleWebKit/.test(userAgent) || !/Safari/.test(userAgent)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo/.test(userAgent);
}

/** True once Vespera is opened from the Home Screen (or installed elsewhere as an app). */
export function isStandalone(win: Window = window): boolean {
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(display-mode: standalone)') : null;
  if (media?.matches) return true;
  return (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
}
