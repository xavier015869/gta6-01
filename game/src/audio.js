// audio.js — every sound in Solana Heat is synthesised with WebAudio at the moment it is
// needed: no audio files, nothing to load. A tiny synth voice plays one-shot effects (a
// gunshot's crack, a crash's crunch, the payday chime), while two standing oscillators carry
// the continuous sounds of play — the engine hum that follows your speed and the two-tone
// siren that follows the police. Browsers only allow audio after a gesture, so the context
// wakes on the first key press or click.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;

  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  let cachedNoise = null;
  function noise() {
    if (!cachedNoise) cachedNoise = noiseBuffer();
    return cachedNoise;
  }

  // A short filtered noise burst: the shape of gunshots, crashes and door slams.
  function burst({ dur = 0.15, freq = 1200, q = 0.8, gain = 0.5, type = 'bandpass', slideTo = null }) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(); src.stop(ctx.currentTime + dur + 0.02);
  }

  // A little pitched blip with an envelope: chimes, clicks, the taxi meter's ding.
  function tone({ freq = 660, dur = 0.12, gain = 0.25, type = 'sine', at = 0, slideTo = null }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
  }
  function stopEngine() {
    if (!engineOsc) return;
    try { engineOsc.stop(); } catch { /* already stopped */ }
    engineOsc.disconnect(); engineOsc = null; engineGain = null; engineFilter = null;
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }
  function stopSiren() {
    if (!sirenOsc) return;
    try { sirenOsc.stop(); } catch { /* already stopped */ }
    sirenOsc.disconnect(); sirenOsc = null; sirenGain = null;
  }

  return {
    wake,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // One-shots the game calls by name.
    shot() { burst({ dur: 0.13, freq: 2100, gain: 0.5, slideTo: 300 }); tone({ freq: 160, dur: 0.08, gain: 0.2, type: 'square' }); },
    dryFire() { tone({ freq: 1200, dur: 0.03, gain: 0.1, type: 'square' }); },
    crash(strength = 1) { burst({ dur: 0.22, freq: 300, q: 0.4, gain: 0.35 * strength, type: 'lowpass' }); },
    door() { burst({ dur: 0.07, freq: 500, gain: 0.22 }); },
    chime() { tone({ freq: 880, dur: 0.1 }); tone({ freq: 1318, dur: 0.16, at: 0.07 }); },
    payday() { tone({ freq: 988, dur: 0.09 }); tone({ freq: 1318, dur: 0.09, at: 0.08 }); tone({ freq: 1568, dur: 0.2, at: 0.16 }); },
    fail() { tone({ freq: 330, dur: 0.16, type: 'sawtooth', gain: 0.12 }); tone({ freq: 233, dur: 0.26, at: 0.13, type: 'sawtooth', gain: 0.12 }); },
    hurt() { tone({ freq: 140, dur: 0.12, gain: 0.3, type: 'square', slideTo: 70 }); },
    pickup() { tone({ freq: 740, dur: 0.07 }); tone({ freq: 988, dur: 0.1, at: 0.05 }); },
    // Continuous sounds, steered every frame.
    engine(speedRatio, driving) {
      if (!ctx || ctx.state === 'closed') return;
      if (driving && !muted) {
        startEngine();
        if (engineOsc) {
          engineOsc.frequency.value = 50 + speedRatio * 130;
          engineFilter.frequency.value = 260 + speedRatio * 700;
          engineGain.gain.value = 0.05 + speedRatio * 0.075;
        }
      } else if (engineGain) {
        engineGain.gain.value = 0;
      }
    },
    siren(active, dt) {
      if (!ctx || ctx.state === 'closed') return;
      if (active && !muted) {
        startSiren();
        if (sirenOsc) {
          sirenTimer += dt;
          if (sirenTimer > 0.42) { sirenTimer = 0; sirenHigh = !sirenHigh; }
          sirenOsc.frequency.value = sirenHigh ? 950 : 680;
          sirenGain.gain.value = 0.035;
        }
      } else if (sirenGain) {
        sirenGain.gain.value = 0;
      }
    },
    stopLoops() { stopEngine(); stopSiren(); },
  };
}
