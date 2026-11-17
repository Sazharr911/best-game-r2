// audio.js — THE LAST GLAZIER's sound, all synthesized with WebAudio:
// glass chimes for fits (pitch climbs with the streak), a soft noise
// sizzle while the solder runs, a deep chapel bell, warm chords for
// sealed circuits and dawn. No audio assets; the context is created
// lazily on the first user gesture and every call is safe before that.

let ctx = null;
let master = null;
let muted = false;
let sizzleGain = null;
let sizzleOn = false;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    buildSizzle();
  } catch {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
}
export function isMuted() { return muted; }

// ------------------------------------------------------------ voices

function tone(freq, { type = 'sine', at = 0, dur = 0.4, vol = 0.2, glide = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// A struck-glass voice: fundamental + bright partials, fast decay.
function glass(freq, at, vol, dur = 0.7) {
  tone(freq, { at, vol, dur });
  tone(freq * 2.76, { at, vol: vol * 0.35, dur: dur * 0.5 });
  tone(freq * 5.4, { at, vol: vol * 0.12, dur: dur * 0.25 });
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];

export function sfxFit(streak = 0) {
  if (!ctx) return;
  glass(PENTA[Math.min(streak, PENTA.length - 1)] * 0.5, 0, 0.16, 0.45);
}

export function sfxPerfect(streak = 1) {
  if (!ctx) return;
  const base = Math.min(streak - 1, PENTA.length - 3);
  glass(PENTA[base] * 0.5, 0, 0.15, 0.6);
  glass(PENTA[base + 1] * 0.5, 0.07, 0.15, 0.6);
  glass(PENTA[base + 2] * 0.5, 0.14, 0.17, 0.85);
}

export function sfxCrack() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.14);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1400;
  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
  tone(140, { dur: 0.18, vol: 0.22, type: 'triangle', glide: -60 }); // the dull thud under it
}

export function sfxSeal() {
  if (!ctx) return;
  // a warm major chord blooming, then a chime arpeggio over it
  for (const f of [261.63, 329.63, 392.0, 523.25]) tone(f, { vol: 0.07, dur: 1.6, type: 'triangle' });
  glass(523.25, 0.05, 0.12, 0.9);
  glass(659.25, 0.16, 0.12, 0.9);
  glass(783.99, 0.27, 0.13, 1.1);
  glass(1046.5, 0.38, 0.12, 1.3);
}

export function sfxBell() {
  if (!ctx) return;
  const f = 98; // a deep chapel bell
  tone(f, { vol: 0.5, dur: 3.2 });
  tone(f * 2.02, { vol: 0.22, dur: 2.4 });
  tone(f * 2.74, { vol: 0.14, dur: 1.7 });
  tone(f * 3.76, { vol: 0.08, dur: 1.1 });
  tone(f * 5.4, { vol: 0.05, dur: 0.7 });
}

export function sfxDawn() {
  if (!ctx) return;
  const chord = [261.63, 329.63, 392.0, 493.88, 587.33];
  chord.forEach((f, i) => tone(f, { at: i * 0.13, vol: 0.09, dur: 2.6, type: 'triangle' }));
  glass(1046.5, 0.7, 0.1, 1.6);
  glass(1318.5, 0.9, 0.09, 1.8);
}

export function sfxClick() {
  if (!ctx) return;
  glass(880, 0, 0.08, 0.25);
}

// ------------------------------------------------------------ the solder sizzle

function buildSizzle() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 5200;
  filter.Q.value = 0.6;
  sizzleGain = ctx.createGain();
  sizzleGain.gain.value = 0;
  src.connect(filter).connect(sizzleGain).connect(master);
  src.start();
}

export function setSizzle(on) {
  if (!ctx || !sizzleGain || on === sizzleOn) return;
  sizzleOn = on;
  sizzleGain.gain.setTargetAtTime(on && !muted ? 0.05 : 0, ctx.currentTime, 0.06);
}
