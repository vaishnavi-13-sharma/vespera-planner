import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isIosSafari } from './detect';
import { InstallHint } from './InstallHint';
import { OfflineBadge } from './OfflineBadge';


const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const setStandalone = (value: boolean) => Object.defineProperty(navigator, 'standalone', { value, configurable: true });

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { userAgent?: string }).userAgent; // back to jsdom's own value
  setStandalone(false);
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('isIosSafari', () => {
  it('recognizes iPhone Safari only', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(MAC_CHROME)).toBe(false);
  });
});

describe('InstallHint', () => {
  it('shows the Add to Home Screen steps on iPhone Safari, once', async () => {
    const user = userEvent.setup();
    setUA(IPHONE_SAFARI);
    const { unmount } = render(<InstallHint />);
    const hint = screen.getByRole('region', { name: 'Add Vespera to your Home Screen' });
    expect(hint).toHaveTextContent(/Add to Home Screen/);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region', { name: 'Add Vespera to your Home Screen' })).not.toBeInTheDocument();
    unmount();
    render(<InstallHint />);
    expect(screen.queryByRole('region', { name: 'Add Vespera to your Home Screen' })).not.toBeInTheDocument();
  });

  it('stays hidden on desktop and once installed', () => {
    setUA(MAC_CHROME);
    const { unmount } = render(<InstallHint />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    unmount();
    setUA(IPHONE_SAFARI);
    setStandalone(true);
    render(<InstallHint />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

describe('OfflineBadge', () => {
  it('appears while offline and goes away when back online', () => {
    render(<OfflineBadge />);
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Offline · saved on this device')).toBeInTheDocument();
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
  });
});
