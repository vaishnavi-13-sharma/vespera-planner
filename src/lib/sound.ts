// Vespera's sounds, synthesized with the Web Audio API: no audio files, works offline.
// Every function is a silent no-op where Web Audio is unavailable (tests, old browsers).

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

/** Browsers start audio suspended until a user gesture; every call comes from one. */
function ready(): AudioContext | null {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
  return c;
}

/** A soft, low wax-seal "thunk" for checking off a quest. */
export function playSeal(volume: number): void {
  const c = ready();
  if (!c || volume <= 0) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.14);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55 * volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

/** A gentle three-note chime for finishing a focus session, a Gentle Start or Daily 5. */
export function playChime(volume: number): void {
  const c = ready();
  if (!c || volume <= 0) return;
  const t = c.currentTime;
  [659.25, 987.77, 1318.51].forEach((freq, i) => {
    const start = t + i * 0.09;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22 * volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 1.9);
  });
}

function noiseBuffer(c: AudioContext, seconds: number, color: 'pink' | 'brown'): AudioBuffer {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

/** Start a looping ambient bed ('rain' or 'fire'). Returns a function that fades it out and stops it. */
export function startAmbient(kind: 'rain' | 'fire', volume: number): () => void {
  const c = ready();
  if (!c || volume <= 0) return () => {};
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime((kind === 'rain' ? 0.28 : 0.4) * volume, c.currentTime + 1.2);
  out.connect(c.destination);

  const bed = c.createBufferSource();
  bed.buffer = noiseBuffer(c, 3, kind === 'rain' ? 'pink' : 'brown');
  bed.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = kind === 'rain' ? 5200 : 700;
  bed.connect(filter).connect(out);
  bed.start();

  let crackle: ReturnType<typeof setTimeout> | undefined;
  if (kind === 'fire') {
    const pop = () => {
      const t = c.currentTime;
      const burst = c.createBufferSource();
      burst.buffer = noiseBuffer(c, 0.03, 'pink');
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1800 + Math.random() * 2400;
      const g = c.createGain();
      g.gain.setValueAtTime((0.2 + Math.random() * 0.5) * volume, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      burst.connect(band).connect(g).connect(c.destination);
      burst.start(t);
      crackle = setTimeout(pop, 90 + Math.random() * 420);
    };
    pop();
  }

  return () => {
    if (crackle) clearTimeout(crackle);
    const t = c.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    bed.stop(t + 0.7);
  };
}
