// Musik latar Ludo "Electro Pop Arena" (124 BPM, four-on-the-floor, supersaw berpompa, pluck lead).
// Dimainkan secara prosedural lewat Web Audio: tidak ada file mp3, hanya penjadwal nada kecil.
import { createSynth, makeImpulse, midi } from './synth';

const BPM = 124;
const STEP = 60 / BPM / 4; // durasi satu langkah 1/16
const LENGTH = 128; // 8 bar
const LOOKAHEAD = 0.15; // detik nada dijadwalkan di depan
const OUTPUT_GAIN = 1.1; // volume 0.25 (default) ≈ level yang dicoba di sound lab

const CHORDS = [[65, 69, 72], [67, 71, 74], [64, 67, 71], [69, 72, 76]]; // F G Em Am
const ROOTS = [41, 43, 40, 45];
const MELODY = new Map(
  [
    [0, 72, 2], [2, 72, 2], [4, 74, 2], [6, 76, 2], [8, 77, 2], [10, 76, 2], [12, 74, 4],
    [16, 74, 2], [18, 74, 2], [20, 76, 2], [22, 79, 2], [24, 77, 2], [26, 76, 2], [28, 74, 4],
    [32, 76, 2], [34, 76, 2], [36, 79, 2], [38, 83, 2], [40, 81, 2], [42, 79, 2], [44, 76, 4],
    [48, 81, 4], [52, 79, 2], [54, 76, 2], [56, 72, 8]
  ].map(([step, note, len]) => [step, [note, len]])
);

export class ElectroBgm {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.step = 0;
    this.volume = 0;
  }

  get playing() {
    return this.timer !== null;
  }

  // Rangkaian node: bus (kena reverb) & dry (kick/bass) -> out (volume) -> kompresor -> speaker.
  // pump = bus khusus pad supersaw yang "dipompa" setiap ketukan kick.
  attach(ctx) {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.synth = createSynth(ctx);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.out = ctx.createGain();
    this.out.gain.value = this.volume * OUTPUT_GAIN;
    this.out.connect(comp);
    this.bus = ctx.createGain();
    this.bus.connect(this.out);
    this.dry = ctx.createGain();
    this.dry.connect(this.out);
    this.pump = ctx.createGain();
    this.pump.connect(this.bus);
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 2.2, 3);
    const send = ctx.createGain();
    send.gain.value = 0.32;
    this.bus.connect(send);
    send.connect(verb);
    verb.connect(this.out);
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.out) this.out.gain.setTargetAtTime(volume * OUTPUT_GAIN, this.ctx.currentTime, 0.05);
  }

  start(ctx) {
    this.attach(ctx);
    if (this.timer) return;
    this.next = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const now = this.ctx.currentTime;
    // Tab sempat tertahan (timer di-throttle): lompati nada yang terlewat, jangan diputar sekaligus
    if (this.next < now - 0.05) this.next = now + 0.05;
    while (this.next < now + LOOKAHEAD) {
      this.playStep(this.step % LENGTH, this.next);
      this.next += STEP;
      this.step += 1;
    }
  }

  playStep(step, t) {
    const { tone, noise } = this.synth;
    const bar = Math.floor(step / 16) % 4;
    const b = step % 16;
    const secondHalf = step >= 64;

    // Kick setiap ketukan + efek pompa pada pad
    if (b % 4 === 0) {
      tone({ t, f: 160, f2: 40, dur: 0.3, gain: 0.95, out: this.dry });
      noise({ t, dur: 0.015, gain: 0.2, f: 4000, out: this.dry });
      this.pump.gain.setValueAtTime(0.25, t);
      this.pump.gain.linearRampToValueAtTime(1, t + STEP * 4 * 0.7);
    }
    // Clap di ketukan 2 dan 4
    if (b === 4 || b === 12) {
      [0, 0.01, 0.022].forEach(d => noise({ t: t + d, dur: 0.12, gain: 0.22, f: 1400, q: 1.3, out: this.bus }));
    }
    // Hi-hat: terbuka di offbeat
    const offbeat = b % 4 === 2;
    noise({ t, dur: offbeat ? 0.2 : 0.035, gain: offbeat ? 0.05 : 0.03, type: 'highpass', f: 8000, out: this.bus });
    // Bass offbeat
    if (offbeat) {
      tone({ t, f: midi(ROOTS[bar] + 12), dur: STEP * 1.8, type: 'sawtooth', gain: 0.3, filter: { f: 1200, f2: 180, q: 3 }, out: this.dry });
    }
    // Pad supersaw sepanjang bar (5 saw sedikit fals untuk kesan lebar)
    if (b === 0) {
      CHORDS[bar].forEach(n =>
        [-14, -6, 0, 6, 14].forEach(cents =>
          tone({ t, f: midi(n) * Math.pow(2, cents / 1200), dur: STEP * 15.5, type: 'sawtooth', gain: 0.022, attack: 0.03, filter: { f: 3200, q: 0.7 }, out: this.pump })
        )
      );
    }
    // Melodi pluck; paruh kedua satu oktaf lebih tinggi, celahnya diisi glockenspiel
    const note = MELODY.get(step % 64);
    if (note) {
      const f = midi(note[0] + (secondHalf ? 12 : 0));
      const dur = Math.max(note[1] * STEP, 0.25);
      tone({ t, f, dur, type: 'square', gain: 0.08, attack: 0.003, filter: { f: 4500, f2: 900, q: 2 }, out: this.bus });
      tone({ t, f: f * 1.005, dur, type: 'sawtooth', gain: 0.05, attack: 0.003, filter: { f: 4000, f2: 800 }, out: this.bus });
    } else if (secondHalf && b % 2 === 0) {
      const f = midi(CHORDS[bar][(b / 2) % 3] + 12);
      tone({ t, f, dur: 0.3, gain: 0.09, attack: 0.001, out: this.bus });
      tone({ t, f: f * 2.76, dur: 0.12, gain: 0.04, out: this.bus });
    }
  }
}
