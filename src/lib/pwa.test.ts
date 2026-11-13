import { isBusy, reloadWhenSafe, startAutoUpdate, UPDATE_CHECK_MS } from './pwa';

const sw = vi.hoisted(() => ({ options: null as null | Record<string, (...args: never[]) => void> }));
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: Record<string, (...args: never[]) => void>) => {
    sw.options = options;
    return () => Promise.resolve();
  },
}));

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

function openDialog(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('isBusy', () => {
  it('is true only while a dialog is open', () => {
    expect(isBusy()).toBe(false);
    const dialog = openDialog();
    expect(isBusy()).toBe(true);
    dialog.remove();
    expect(isBusy()).toBe(false);
  });
});

describe('reloadWhenSafe', () => {
  it('reloads right away when nothing is open', () => {
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits for an open dialog to close, then reloads once', async () => {
    const reload = vi.fn();
    const dialog = openDialog();
    reloadWhenSafe(reload);
    expect(reload).not.toHaveBeenCalled();
    dialog.remove();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    openDialog().remove();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when the app is put away, even with a dialog open', () => {
    const reload = vi.fn();
    openDialog();
    reloadWhenSafe(reload);
    setVisibility('hidden');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled', async () => {
    const reload = vi.fn();
    const dialog = openDialog();
    reloadWhenSafe(reload)();
    dialog.remove();
    setVisibility('hidden');
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('startAutoUpdate', () => {
  it('reloads onto a replacement version and checks for updates on a timer and on resume', () => {
    vi.useFakeTimers();
    const listeners: Record<string, () => void> = {};
    const container = {
      controller: {}, // an older version already runs this page
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
    const reload = vi.fn();
    const location = window.location;
    Object.defineProperty(window, 'location', { value: { ...location, reload }, configurable: true });
    try {
      startAutoUpdate();
      expect(sw.options).not.toBeNull();

      const update = vi.fn(() => Promise.resolve());
      sw.options!.onRegisteredSW('/sw.js' as never, { update, installing: null } as never);
      vi.advanceTimersByTime(UPDATE_CHECK_MS);
      expect(update).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60_000);
      setVisibility('visible');
      expect(update).toHaveBeenCalledTimes(2);

      listeners.controllerchange();
      sw.options!.onNeedReload();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: location, configurable: true });
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });
});
