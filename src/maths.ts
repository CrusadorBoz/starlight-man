// Starkindle: whole-number maths. The rules use integers only, so the same seed
// and the same key presses always give exactly the same game.

/** Divide, dropping the remainder (towards zero). */
export const div = (a: number, b: number): number => Math.trunc(a / b);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A small seeded random generator (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  /** 0..n-1 */
  next(n: number): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % n;
  }
  /** One of a list that is not empty. */
  pick<T>(list: readonly T[]): T {
    const v = list[this.next(list.length)];
    if (v === undefined) throw new Error('nothing to pick from');
    return v;
  }
  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.next(i + 1), a = list[i], b = list[j];
      if (a !== undefined && b !== undefined) { list[i] = b; list[j] = a; }
    }
    return list;
  }
}
