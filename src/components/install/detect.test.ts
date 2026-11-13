import { isIosSafari, isStandalone } from './detect';

const IPAD_SAFARI = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_EDGE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.0.2849.80 Mobile/15E148 Safari/605.1.15';

const fakeWindow = (opts: { matchMedia?: boolean; matches?: boolean; standalone?: boolean }) =>
  ({
    matchMedia: opts.matchMedia ? () => ({ matches: !!opts.matches }) : undefined,
    navigator: { standalone: opts.standalone },
  }) as unknown as Window;

describe('isIosSafari', () => {
  it('accepts iPad Safari and rejects other iOS browsers', () => {
    expect(isIosSafari(IPAD_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_FIREFOX)).toBe(false);
    expect(isIosSafari(IPHONE_EDGE)).toBe(false);
  });
});

describe('isStandalone', () => {
  it('reads display-mode and navigator.standalone, and survives a missing matchMedia', () => {
    expect(isStandalone(fakeWindow({ matchMedia: true, matches: true }))).toBe(true);
    expect(isStandalone(fakeWindow({ matchMedia: true, matches: false }))).toBe(false);
    expect(isStandalone(fakeWindow({ matchMedia: false, standalone: true }))).toBe(true);
    expect(isStandalone(fakeWindow({ matchMedia: false }))).toBe(false);
  });
});
