// Starlight Man: sound, synthesised on the spot. Nothing is sampled or copied.
import { Ev } from './types.ts';
import type { GameEvent } from './types.ts';

/** Everything that exists once the browser has allowed sound. */
interface Rig { readonly ctx: AudioContext; readonly out: GainNode; readonly noise: AudioBuffer }

const SCALE: readonly number[] = [523, 587, 659, 784, 880, 1047, 1175, 1319];

export class Sound {
  on: boolean;
  private rig: Rig | null = null;
  private readonly last = new Map<string, number>();

  constructor(on: boolean) { this.on = on; }

  /** Browsers only allow sound after a click or key press: call this then. */
  wake(): void {
    if (!this.on) return;
    try {
      this.rig ??= Sound.build();
      if (this.rig.ctx.state === 'suspended') void this.rig.ctx.resume();
    } catch {
      this.rig = null; // no sound in this browser: play on in silence
    }
  }
  private static build(): Rig {
    const ctx = new AudioContext(), out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    noise.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
    return { ctx, out, noise };
  }
  set(on: boolean): void {
    this.on = on;
    if (on) this.wake();
    else if (this.rig) void this.rig.ctx.suspend();
  }

  /** Not more often than every `gap` seconds for each name. */
  private ok(name: string, gap: number): boolean {
    if (!this.on || this.rig?.ctx.state !== 'running') return false;
    const t = this.rig.ctx.currentTime;
    if (t - (this.last.get(name) ?? -9) < gap) return false;
    this.last.set(name, t);
    return true;
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    if (!this.rig) return;
    const { ctx, out } = this.rig, t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  private noise(f0: number, f1: number, dur: number, vol: number): void {
    if (!this.rig) return;
    const { ctx, out, noise } = this.rig, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    s.loop = true; // the longest effects outlast the one-second buffer
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }
  private chord(notes: readonly number[], type: OscillatorType, dur: number, vol: number, step = 0.09): void {
    notes.forEach((n, i) => this.tone(type, n, n, dur, vol, i * step));
  }

  /** Play this frame's events. */
  events(list: readonly GameEvent[]): void {
    for (const e of list) {
      switch (e.kind) {
        case Ev.Star: if (this.ok('star', 0.045)) { const n = SCALE[e.v % SCALE.length] ?? 523; this.tone('sine', n, n * 1.004, 0.16, 0.06); this.tone('triangle', n * 2, n * 2, 0.07, 0.018); } break;
        case Ev.Streak: if (this.ok('streak', 0.2)) this.chord([659, 988, 1319], 'triangle', 0.16, 0.08, 0.05); break;
        case Ev.Prism: if (this.ok('prism', 0.1)) this.chord([740, 932, 1109, 1480], 'sine', 0.24, 0.11, 0.06); break;
        case Ev.Flare: if (this.ok('flare', 0.1)) { this.noise(400, 7000, 0.45, 0.22); this.tone('sawtooth', 180, 1500, 0.35, 0.1); this.chord([523, 784, 1047], 'triangle', 0.5, 0.1, 0.03); } break;
        case Ev.Daze: if (this.ok('daze', 0.05)) this.tone('square', 520, 130, 0.28, 0.06); break;
        case Ev.Hit: if (this.ok('hit', 0.3)) { this.noise(1600, 50, 0.9, 0.5); this.chord([392, 311, 233, 156], 'triangle', 0.32, 0.16, 0.11); } break;
        case Ev.Clear: if (this.ok('clear', 0.5)) this.chord([392, 494, 587, 784, 988, 1175, 1568], 'triangle', 0.6, 0.12, 0.11); break;
        case Ev.Sky: if (this.ok('sky', 0.5)) { this.noise(160, 2400, 1.1, 0.1); this.chord([220, 330, 440, 659], 'sine', 0.7, 0.11, 0.15); } break;
        case Ev.Comet: if (this.ok('comet', 0.3)) this.chord([1760, 1480, 1760, 1976], 'sine', 0.14, 0.07, 0.09); break;
        case Ev.CometGot: if (this.ok('cometgot', 0.2)) this.chord([1047, 1319, 1568, 2093], 'triangle', 0.26, 0.13, 0.06); break;
        case Ev.Snuff: if (this.ok('snuff', 0.1)) this.tone('sine', 300, 120, 0.16, 0.05); break;
        case Ev.Caught: if (this.ok('caught', 0.1)) this.chord([880, 660, 1047], 'triangle', 0.16, 0.11, 0.05); break;
        case Ev.Web: if (this.ok('web', 0.2)) this.tone('triangle', 900, 500, 0.12, 0.03); break;
        case Ev.Stuck: if (this.ok('stuck', 0.2)) this.tone('sawtooth', 160, 70, 0.4, 0.1); break;
        case Ev.Warp: if (this.ok('warp', 0.2)) { this.tone('sine', 200, 1800, 0.4, 0.14); this.tone('sine', 1800, 300, 0.45, 0.08, 0.12); } break;
        case Ev.Tell: if (this.ok('tell', 0.1)) { this.tone('square', 660, 660, 0.09, 0.06); this.tone('square', 660, 660, 0.09, 0.06, 0.14); } break;
        case Ev.Charge: if (this.ok('charge', 0.1)) { this.tone('sawtooth', 110, 620, 0.5, 0.11); this.noise(600, 2400, 0.4, 0.12); } break;
        case Ev.Spark: if (this.ok('spark', 0.3)) this.chord([784, 988, 1175, 1568, 1976], 'sine', 0.3, 0.12, 0.07); break;
        case Ev.Pick: if (this.ok('pick', 0.1)) this.chord([440, 660, 990], 'sine', 0.3, 0.13, 0.06); break;
        case Ev.Won: if (this.ok('won', 1)) this.chord([392, 523, 659, 784, 1047, 1319, 1568], 'triangle', 0.8, 0.14, 0.16); break;
        case Ev.Over: if (this.ok('over', 1)) this.chord([330, 294, 262, 196], 'sine', 0.6, 0.14, 0.22); break;
      }
    }
  }
}
