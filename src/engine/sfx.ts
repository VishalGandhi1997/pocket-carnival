// Khel Mela sound identity — 100% synthesized with WebAudio, zero asset
// files. One shared AudioContext, lazily unlocked on the first user gesture
// (browser autoplay policy). Every sound is short, bright, and "toy-like"
// to match the carnival brand.

export type SfxName =
  | "click" // UI button press
  | "tick" // tiny gameplay tap (piece pickup, card flip)
  | "pop" // placement / capture / merge
  | "clear" // line clear / combo — rising arpeggio
  | "coin" // coin earned blip
  | "win" // round-won fanfare
  | "lose" // round-lost womp
  | "whoosh"; // screen transition

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once — unlocks audio on the first real user gesture. */
export function armAudio() {
  const unlock = () => {
    ac();
    document.removeEventListener("pointerdown", unlock);
  };
  document.addEventListener("pointerdown", unlock);
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

/** One oscillator note with a fast attack/decay envelope. */
function note(
  a: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Frequency glide — used for pops and womps. */
function slide(
  a: AudioContext,
  from: number,
  to: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Short filtered-noise burst — the whoosh. */
function noise(a: AudioContext, start: number, dur: number, peak: number) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, start);
  filter.frequency.exponentialRampToValueAtTime(1800, start + dur);
  const gain = a.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(start);
}

export function play(name: SfxName) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  switch (name) {
    case "click":
      note(a, 620, t, 0.07, "triangle", 0.18);
      break;
    case "tick":
      note(a, 900, t, 0.045, "sine", 0.12);
      break;
    case "pop":
      slide(a, 420, 180, t, 0.1, "square", 0.12);
      break;
    case "clear":
      // rising major arpeggio — the "nice one!" sound
      note(a, 523, t, 0.09, "triangle", 0.16);
      note(a, 659, t + 0.06, 0.09, "triangle", 0.16);
      note(a, 784, t + 0.12, 0.14, "triangle", 0.18);
      break;
    case "coin":
      note(a, 1318, t, 0.05, "sine", 0.14);
      note(a, 1760, t + 0.04, 0.08, "sine", 0.12);
      break;
    case "win":
      // C-E-G-C fanfare with a sparkle on top
      note(a, 523, t, 0.12, "triangle", 0.2);
      note(a, 659, t + 0.09, 0.12, "triangle", 0.2);
      note(a, 784, t + 0.18, 0.12, "triangle", 0.2);
      note(a, 1046, t + 0.27, 0.3, "triangle", 0.22);
      note(a, 2093, t + 0.3, 0.18, "sine", 0.08);
      break;
    case "lose":
      slide(a, 330, 165, t, 0.28, "sawtooth", 0.1);
      slide(a, 247, 123, t + 0.16, 0.34, "sawtooth", 0.1);
      break;
    case "whoosh":
      noise(a, t, 0.22, 0.16);
      break;
  }
}
