// audio.js — every sound in Solana Heat is synthesised with WebAudio.
//
// There are no audio files: a gunshot is a filtered noise burst, the police
// siren is two alternating tones, the engine is a sawtooth whose pitch
// follows the car's speed, and rewards are small square-wave arpeggios.
// The context is created lazily on the first user gesture, and every call
// is guarded so the game stays silent rather than broken if audio fails.

let ctx = null;
let master = null;
let sirenNodes = null; // { osc, gain } while a siren is sounding
let engineNodes = null; // { osc, gain, filter } while the player drives

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function noiseBuffer() {
  const len = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function sfxShot() {
  if (!ctx) return;
  try {
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.16);
  } catch { /* keep playing silently */ }
}

export function sfxHit() {
  if (!ctx) return;
  try {
    const t = now();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.30, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch { /* ignore */ }
}

export function sfxCrash(strength = 1) {
  if (!ctx) return;
  try {
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + strength * 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.7, 0.25 + strength * 0.3), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.3);
  } catch { /* ignore */ }
}

function blip(freq, start, dur, type = 'square', vol = 0.16) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function sfxChime() {
  if (!ctx) return;
  try {
    const t = now();
    blip(880, t, 0.12, 'sine', 0.22);
    blip(1318, t + 0.09, 0.18, 'sine', 0.20);
  } catch { /* ignore */ }
}

export function sfxCash() {
  if (!ctx) return;
  try {
    const t = now();
    blip(988, t, 0.09);
    blip(1319, t + 0.07, 0.09);
    blip(1568, t + 0.14, 0.16);
  } catch { /* ignore */ }
}

export function sfxFail() {
  if (!ctx) return;
  try {
    const t = now();
    blip(392, t, 0.16, 'sawtooth', 0.14);
    blip(311, t + 0.14, 0.16, 'sawtooth', 0.14);
    blip(233, t + 0.28, 0.30, 'sawtooth', 0.14);
  } catch { /* ignore */ }
}

// The siren loops while the player is wanted and a police car is close.
// Two tones alternate in the oscillator's frequency via an LFO.
export function setSiren(on) {
  if (!ctx) return;
  try {
    if (on && !sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 760;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    } else if (!on && sirenNodes) {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
      sirenNodes.gain.disconnect();
      sirenNodes = null;
    }
  } catch { /* ignore */ }
}

// The engine hum follows the player's car speed while driving.
export function setEngine(speedRatio, throttle) {
  if (!ctx) return;
  try {
    if (speedRatio === null) {
      if (engineNodes) {
        engineNodes.osc.stop();
        engineNodes.gain.disconnect();
        engineNodes = null;
      }
      return;
    }
    if (!engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      engineNodes = { osc, gain, filter };
    }
    const t = now();
    engineNodes.osc.frequency.setTargetAtTime(52 + speedRatio * 165, t, 0.06);
    engineNodes.gain.gain.setTargetAtTime(0.028 + throttle * 0.035 + speedRatio * 0.02, t, 0.08);
  } catch { /* ignore */ }
}
