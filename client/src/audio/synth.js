// Primitif sintesis Web Audio yang dipakai musik latar dan efek suara Ludo.
// Semua suara dibuat langsung di browser, jadi tidak ada file audio yang perlu diunduh.

export const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// Respons impuls buatan untuk reverb (ruang) tanpa file IR
export function makeImpulse(ctx, sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Kurva distorsi lembut (dipakai bunyi terompet/klakson agar lebih "kasar")
export function softClip(ctx, amount = 4) {
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = i / 512 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  ws.curve = curve;
  return ws;
}

// Satu set alat sintesis yang terikat ke AudioContext tertentu
export function createSynth(ctx) {
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // Osilator dengan amplop attack/decay, glide nada (f2), vibrato, dan filter opsional
  function tone({ t, f, f2, dur = 0.2, type = 'sine', gain = 0.3, attack = 0.005, out, filter, vib }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vib) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = vib.rate;
      lfoGain.gain.value = vib.depth;
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = filter.type || 'lowpass';
      fl.frequency.setValueAtTime(filter.f, t);
      if (filter.f2) fl.frequency.exponentialRampToValueAtTime(filter.f2, t + dur);
      fl.Q.value = filter.q || 1;
      node.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // Derau tersaring (hi-hat, tepuk tangan, desis, sorakan)
  function noise({ t, dur = 0.1, gain = 0.3, type = 'bandpass', f = 2000, f2, q = 1, out, attack = 0.002 }) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  return { ctx, tone, noise, noiseBuf };
}
