// Efek suara kejadian Ludo: bidak terinjak (dipilih acak), keluar base, finish, dan pemakaian item.
// Setiap fungsi menerima { synth, out, verb }: out = jalur SFX biasa, verb = jalur SFX dengan reverb.
import { midi } from './synth';

const start = synth => synth.ctx.currentTime + 0.02;

// ---------- Bidak terinjak ----------

function kentut({ synth, out }) {
  const { ctx, noise, tone } = synth;
  const t = start(synth);
  const d = 0.75;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, t);
  o.frequency.linearRampToValueAtTime(70, t + d);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(28, t);
  lfo.frequency.linearRampToValueAtTime(14, t + d);
  lfoGain.gain.value = 35;
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  const am = ctx.createGain();
  const amLfo = ctx.createOscillator();
  const amDepth = ctx.createGain();
  amLfo.frequency.value = 19;
  amDepth.gain.value = 0.5;
  amLfo.connect(amDepth);
  amDepth.connect(am.gain);
  am.gain.value = 0.6;
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = 520;
  fl.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.55, t + 0.04);
  g.gain.setValueAtTime(0.5, t + d * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(fl);
  fl.connect(am);
  am.connect(g);
  g.connect(out);
  [o, lfo, amLfo].forEach(n => {
    n.start(t);
    n.stop(t + d + 0.05);
  });
  noise({ t, dur: d * 0.8, gain: 0.08, f: 400, q: 3, out });
  tone({ t: t + d + 0.05, f: 900, f2: 1600, dur: 0.12, gain: 0.12, out });
}

function tawaEjekan({ synth, out }) {
  const { tone, noise } = synth;
  const t = start(synth);
  [0, 0.17, 0.34, 0.51, 0.7].forEach((d, i) => {
    const f = 260 - i * 14;
    const dur = i === 4 ? 0.32 : 0.13;
    [[800, 0.22], [1250, 0.14], [2600, 0.05]].forEach(([formant, gain]) =>
      tone({ t: t + d, f, f2: f * 0.86, dur, type: 'sawtooth', gain, attack: 0.015, filter: { type: 'bandpass', f: formant, q: 7 }, out })
    );
    noise({ t: t + d, dur: 0.04, gain: 0.12, f: 1800, q: 1, out });
  });
}

function penontonBoo({ synth, verb }) {
  const { tone, noise } = synth;
  const t = start(synth);
  const d = 1.5;
  for (let i = 0; i < 14; i++) {
    const f = 100 + Math.random() * 90;
    tone({
      t: t + Math.random() * 0.15,
      f,
      f2: f * 0.85,
      dur: d,
      type: 'sawtooth',
      gain: 0.05,
      attack: 0.18,
      vib: { rate: 3 + Math.random() * 3, depth: 4 },
      filter: { type: 'bandpass', f: 380, q: 3 },
      out: verb
    });
  }
  noise({ t, dur: d, gain: 0.05, f: 500, q: 1, attack: 0.2, out: verb });
}

function peluitJatuh({ synth, out }) {
  const { tone } = synth;
  const t = start(synth);
  tone({ t, f: 1900, f2: 260, dur: 0.75, gain: 0.25, attack: 0.02, vib: { rate: 9, depth: 25 }, out });
  tone({ t: t + 0.78, f: 520, f2: 90, dur: 0.18, type: 'triangle', gain: 0.4, out });
  tone({ t: t + 0.78, f: 1200, f2: 800, dur: 0.25, gain: 0.12, vib: { rate: 30, depth: 60 }, out });
}

function burungKukuk({ synth, out, verb }) {
  const { tone, noise } = synth;
  const t = start(synth);
  tone({ t, f: 600, f2: 90, dur: 0.15, type: 'triangle', gain: 0.45, out });
  noise({ t, dur: 0.05, gain: 0.25, f: 900, out });
  [0.25, 0.62, 0.95].forEach((d, i) => {
    const speed = 1 - i * 0.12;
    tone({ t: t + d, f: midi(84), dur: 0.16 * speed, gain: 0.2, attack: 0.02, out: verb });
    tone({ t: t + d + 0.17 * speed, f: midi(80), dur: 0.24 * speed, gain: 0.2, attack: 0.02, out: verb });
  });
  tone({ t: t + 0.2, f: 1800, f2: 2400, dur: 1.2, gain: 0.03, vib: { rate: 12, depth: 300 }, out });
}

// Pool suara injak selain trombon sedih (yang tetap ada di sound.js); dipilih acak murni
export const CAPTURE_SOUNDS = [kentut, tawaEjekan, penontonBoo, peluitJatuh, burungKukuk];

// ---------- Kejadian & item ----------

export function keluarBase({ synth, out }) {
  const { tone, noise } = synth;
  const t = start(synth);
  noise({ t, dur: 0.05, gain: 0.25, f: 1500, q: 1.5, out });
  tone({ t, f: 180, f2: 950, dur: 0.16, gain: 0.35, out });
  tone({ t: t + 0.14, f: 520, dur: 0.45, gain: 0.2, vib: { rate: 16, depth: 70 }, out });
  tone({ t: t + 0.18, f: 1568, dur: 0.18, gain: 0.08, out });
  tone({ t: t + 0.26, f: 2093, dur: 0.22, gain: 0.07, out });
}

// Force Return: laso "wush", tarikan, lalu "duk" mendarat di base
export function forceReturn({ synth, out }) {
  const { tone, noise } = synth;
  const t = start(synth);
  noise({ t, dur: 0.35, gain: 0.3, f: 400, f2: 3500, q: 2, out });
  tone({ t: t + 0.32, f: 1400, f2: 160, dur: 0.45, type: 'sawtooth', gain: 0.18, filter: { f: 2500, f2: 500 }, out });
  tone({ t: t + 0.32, f: 700, f2: 120, dur: 0.45, type: 'square', gain: 0.06, out });
  tone({ t: t + 0.8, f: 140, f2: 50, dur: 0.3, gain: 0.7, out });
  noise({ t: t + 0.8, dur: 0.12, gain: 0.25, f: 600, out });
}

export function universalShield({ synth, out }) {
  const { tone, noise } = synth;
  const t = start(synth);
  [72, 76, 79, 84, 88].forEach((n, i) =>
    tone({ t: t + i * 0.05, f: midi(n), dur: 0.9 - i * 0.08, gain: 0.1, attack: 0.02, vib: { rate: 8, depth: 4 }, out })
  );
  noise({ t, dur: 0.6, gain: 0.08, type: 'highpass', f: 6000, f2: 9000, out });
  tone({ t: t + 0.3, f: midi(96), dur: 1.0, gain: 0.08, out });
  tone({ t: t + 0.3, f: midi(96) * 2.76, dur: 0.6, gain: 0.03, out });
}

// Blackhole Shield: pusaran berbalik arah lalu dentang energi (FM) yang menolak sedotan
export function blackholeShield({ synth, out }) {
  const { ctx, tone } = synth;
  const t = start(synth);
  tone({ t, f: 90, f2: 900, dur: 0.55, type: 'sawtooth', gain: 0.16, vib: { rate: 14, depth: 90 }, filter: { f: 600, f2: 3000 }, out });
  const bell = t + 0.5;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const g = ctx.createGain();
  carrier.frequency.value = 330;
  mod.frequency.value = 330 * 1.4;
  modGain.gain.setValueAtTime(600, bell);
  modGain.gain.exponentialRampToValueAtTime(5, bell + 0.9);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  g.gain.setValueAtTime(0.0001, bell);
  g.gain.linearRampToValueAtTime(0.3, bell + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, bell + 1);
  carrier.connect(g);
  g.connect(out);
  [carrier, mod].forEach(n => {
    n.start(bell);
    n.stop(bell + 1.05);
  });
}

// Finish "Gong raja": saron gamelan naik cepat, kendang, lalu gong besar yang megah
export function gongRaja({ synth, out, verb }) {
  const { ctx, tone, noise } = synth;
  const t = start(synth);
  [62, 64, 67, 69, 71, 74, 76, 79].forEach((n, i) => {
    tone({ t: t + i * 0.07, f: midi(n), dur: 0.5, gain: 0.12, out: verb });
    tone({ t: t + i * 0.07, f: midi(n) * 2.4, dur: 0.15, gain: 0.04, out: verb });
  });
  [0.62, 0.7, 0.78, 0.86].forEach((d, i) =>
    tone({ t: t + d, f: i % 2 ? 220 : 130, f2: i % 2 ? 180 : 85, dur: 0.18, gain: 0.4, out })
  );
  const gt = t + 0.95;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const g = ctx.createGain();
  carrier.frequency.setValueAtTime(82, gt);
  carrier.frequency.linearRampToValueAtTime(79, gt + 3);
  mod.frequency.value = 82 * 1.48;
  modGain.gain.setValueAtTime(220, gt);
  modGain.gain.exponentialRampToValueAtTime(8, gt + 3);
  g.gain.setValueAtTime(0.0001, gt);
  g.gain.linearRampToValueAtTime(0.6, gt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, gt + 3.2);
  const wobble = ctx.createOscillator();
  const wobbleGain = ctx.createGain();
  wobble.frequency.value = 3;
  wobbleGain.gain.value = 0.15;
  wobble.connect(wobbleGain);
  wobbleGain.connect(g.gain);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(g);
  g.connect(verb);
  [carrier, mod, wobble].forEach(n => {
    n.start(gt);
    n.stop(gt + 3.3);
  });
  noise({ t: gt, dur: 0.6, gain: 0.08, type: 'lowpass', f: 900, out: verb });
}
