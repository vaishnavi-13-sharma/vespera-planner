import { act, render, screen } from '@testing-library/react';
import { VesperaProvider, type VesperaState } from '../../context/VesperaContext';
import * as sound from '../../lib/sound';
import { SparkleProvider, useCelebrate, type CelebrationSize, type CelebrationSound } from './Sparkles';
import { createSeedState } from '../../test/ownerWeek';

function Trigger({ size, sound: s }: { size: CelebrationSize; sound?: CelebrationSound }) {
  const celebrate = useCelebrate();
  return <button onClick={(e) => celebrate(size, e.currentTarget, s)}>go</button>;
}

function setup(size: CelebrationSize, settings: Partial<VesperaState['settings']> = {}, s?: CelebrationSound) {
  const state = createSeedState();
  state.settings = { ...state.settings, ...settings };
  render(
    <VesperaProvider initialState={state}>
      <SparkleProvider>
        <Trigger size={size} sound={s} />
      </SparkleProvider>
    </VesperaProvider>,
  );
  act(() => screen.getByRole('button', { name: 'go' }).click());
}

const particles = () => screen.getByTestId('sparkle-layer').querySelectorAll('[data-sparkle]').length;

describe('celebrations', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bursts sparkles and plays the seal sound for small wins', () => {
    const seal = vi.spyOn(sound, 'playSeal');
    setup('small');
    expect(particles()).toBe(10);
    expect(seal).toHaveBeenCalledWith(0.5);
  });

  it('bigger bursts and a chime for big wins', () => {
    const chime = vi.spyOn(sound, 'playChime');
    setup('big');
    expect(particles()).toBe(28);
    expect(chime).toHaveBeenCalledWith(0.5);
  });

  it('respects the sparkles and sounds toggles', () => {
    const seal = vi.spyOn(sound, 'playSeal');
    setup('small', { sparkles: false, sounds: false });
    expect(particles()).toBe(0);
    expect(seal).not.toHaveBeenCalled();
  });

  it('can celebrate silently', () => {
    const seal = vi.spyOn(sound, 'playSeal');
    setup('small', {}, 'none');
    expect(seal).not.toHaveBeenCalled();
  });

  it('clears the burst after it fades', () => {
    vi.useFakeTimers();
    setup('small');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(particles()).toBe(0);
  });

  it('is a silent no-op without the provider', () => {
    render(<Trigger size="big" />);
    expect(() => act(() => screen.getByRole('button', { name: 'go' }).click())).not.toThrow();
  });
});
