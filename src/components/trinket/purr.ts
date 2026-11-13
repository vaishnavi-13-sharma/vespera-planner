// The castle kitten's purr, synthesized with Web Audio: a low, filtered rumble pulsing about 24 times a second,
// swelling on the inhale and softening on the exhale. A silent no-op where Web Audio is unavailable (tests, old browsers).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

/** A short purr (about a second) for petting the cat. Always called from a tap, so a suspended context can resume. */
export function playPurr(volume: number): void {
  const c = audio();
  if (!c || volume <= 0) return;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  const t = c.currentTime;
  const end = t + 1.15;
  const peak = 0.34 * volume;

  // The voice: a buzzy low tone, rounded off so it reads as a rumble rather than a hum.
  const voice = c.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(54, t);
  voice.frequency.linearRampToValueAtTime(47, t + 0.55);
  voice.frequency.linearRampToValueAtTime(50, end);
  const soften = c.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 340;
  soften.Q.value = 0.7;

  // The flutter: the throat opening and closing ~24 times a second.
  const flutter = c.createGain();
  flutter.gain.value = 0.55;
  const lfo = c.createOscillator();
  lfo.frequency.setValueAtTime(24, t);
  lfo.frequency.linearRampToValueAtTime(21, end);
  const depth = c.createGain();
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(flutter.gain);

  // The breath: in, a soft dip, out.
  const breath = c.createGain();
  breath.gain.setValueAtTime(0.0001, t);
  breath.gain.exponentialRampToValueAtTime(peak, t + 0.14);
  breath.gain.linearRampToValueAtTime(peak * 0.45, t + 0.55);
  breath.gain.linearRampToValueAtTime(peak * 0.85, t + 0.72);
  breath.gain.exponentialRampToValueAtTime(0.0001, end);

  voice.connect(soften).connect(flutter).connect(breath).connect(c.destination);
  voice.start(t);
  lfo.start(t);
  voice.stop(end + 0.05);
  lfo.stop(end + 0.05);
}
