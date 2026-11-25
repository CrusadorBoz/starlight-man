import { Rng } from '../src/maths.ts';
import { DIRS, DX, DY } from '../src/maze.ts';
import type { Dir } from '../src/maze.ts';
import { Game, MAX_FLARES, MAX_SPARKS, STEP, CHARM_CAP } from '../src/game.ts';
import { Kind, Phase } from '../src/types.ts';
import type { Input } from '../src/types.ts';

export const go = (dir: Dir | -1 = -1, flare = false, pick = -1): Input => ({ dir, flare, pick });

/** A careful player: heads for the nearest dark star by the safest way, flares when cornered. */
export class Bot {
  private r: Rng; private last = -1; private dir: Dir | -1 = -1;
  constructor(seed: number) { this.r = new Rng(seed); }
  play(g: Game): Input {
    if (g.phase === Phase.Pick || g.phase === Phase.Won) return go(-1, false, g.phaseT > 12 ? this.r.next(3) : -1);
    if (g.phase !== Phase.Play) return go();
    const m = g.maze, h = g.hero, here = m.at(h.x, h.y);
    const threat = g.foes.filter((f) => f.kind !== Kind.Snuffer && g.isOut(f) && f.daze === 0);
    if (this.last === here * 8 + h.dir && g.tick % 6 !== 0) return go(this.dir);
    this.last = here * 8 + h.dir;
    const risk = new Float64Array(m.w * m.h);
    let closest = 99, seen = false;
    for (const f of threat) {
      const d = m.distances(f.x, f.y), mine = d[here]!;
      closest = Math.min(closest, mine);
      if (mine <= 4 && (f.x === h.x || f.y === h.y)) seen = true;
      for (let i = 0; i < risk.length; i++) if (d[i]! >= 0 && d[i]! < 8) risk[i]! += (8 - d[i]!) * (8 - d[i]!) * 2;
    }
    if (seen && closest <= 3 && g.flares > 0) return go(this.dir, true);
    const cost = new Float64Array(m.w * m.h).fill(Infinity), from = new Int32Array(m.w * m.h).fill(-1), done = new Uint8Array(m.w * m.h);
    cost[here] = 0;
    let goal = -1;
    for (;;) {
      let at = -1;
      for (let i = 0; i < cost.length; i++) if (!done[i] && cost[i]! < Infinity && (at < 0 || cost[i]! < cost[at]!)) at = i;
      if (at < 0) break;
      done[at] = 1;
      if (at !== here && (g.lit[at] !== 1 || g.prisms.includes(at)) && risk[at]! < 90) { goal = at; break; }
      const x = at % m.w, y = (at - x) / m.w;
      for (const d of DIRS) if (m.can(x, y, d)) { const j = m.at(x + DX[d], y + DY[d]), c = cost[at]! + 1 + risk[j]!; if (c < cost[j]!) { cost[j] = c; from[j] = at; } }
    }
    if (goal < 0) { // nowhere safe to light: just get away
      const ways = m.exits(h.x, h.y);
      this.dir = ways.reduce((b, d) => (risk[m.at(h.x + DX[d], h.y + DY[d])]! < risk[m.at(h.x + DX[b], h.y + DY[b])]! ? d : b), ways[0]!);
      return go(this.dir);
    }
    while (from[goal] !== here && from[goal]! >= 0) goal = from[goal]!;
    const gx = goal % m.w, gy = (goal - gx) / m.w;
    this.dir = DIRS.find((d) => h.x + DX[d] === gx && h.y + DY[d] === gy) ?? -1;
    return go(this.dir);
  }
}

/** The whole state as whole numbers. */
export function encode(g: Game): number[] {
  const out = [g.tick, g.phase, g.phaseT, g.playT, g.level, g.score, g.litCount, g.hero.x, g.hero.y, g.hero.dir, g.hero.p, g.want, g.sparks, g.flares, g.inv, g.slow, g.streak, g.hits, g.dazed, g.caught, ...g.charms, ...g.prisms];
  for (const f of g.foes) out.push(f.kind, f.x, f.y, f.dir, f.p, f.t, f.state, f.daze, f.a, f.b, f.wake);
  for (const [i, t] of g.webs) out.push(i, t);
  if (g.comet) out.push(g.comet.x, g.comet.y, g.comet.dir, g.comet.p, g.comet.life);
  for (const e of g.events) out.push(e.kind, e.x, e.y, e.v);
  return out;
}

/** What must be true after every tick; returns the first thing that is not. */
export function broken(g: Game): string | null {
  const m = g.maze;
  for (const c of [g.hero, ...g.foes, ...(g.comet ? [g.comet] : [])]) {
    if (!m.isOpen(c.x, c.y)) return `something is inside a wall at ${c.x},${c.y}`;
    if (c.dir >= 0 && !m.can(c.x, c.y, c.dir as Dir) && c.p > 0) return `something is walking into a wall at ${c.x},${c.y} dir ${c.dir}`;
    if (c.p < 0 || c.p >= STEP) return `p is ${c.p}`;
  }
  if (g.lit.reduce((n, v) => n + v, 0) !== g.litCount || g.litCount > m.total) return `lit count ${g.litCount}`;
  for (let i = 0; i < g.lit.length; i++) if (g.lit[i] === 1 && !m.isOpen(i % m.w, Math.floor(i / m.w))) return 'a star is lit inside a wall';
  if (g.flares < 0 || g.flares > MAX_FLARES || g.sparks < -1 || g.sparks > MAX_SPARKS) return `flares ${g.flares} sparks ${g.sparks}`;
  for (const [c, n] of g.charms.entries()) if (CHARM_CAP[c]! > 0 && n > CHARM_CAP[c]!) return `charm ${c} taken ${n} times`;
  if (g.webs.size > 6 || g.events.length > 160 || g.trail.length > 4000) return 'a list overflowed';
  for (const n of encode(g)) if (!Number.isSafeInteger(n)) return `not a whole number: ${n}`;
  return null;
}

/** One recorded run: who plays it, how long, and a hash of the state every 500 ticks. */
export interface Run { seed: number; diff: number; cols: number; style: 'bot' | 'wild' | 'unbeatable'; ticks: number; hashes: number[]; score: number; level: number; hits: number }

export function play(run: Omit<Run, 'hashes' | 'score' | 'level' | 'hits'>): Run {
  const g = new Game(run.seed, run.diff, run.cols), b = new Bot(run.seed), r = new Rng(run.seed), hashes: number[] = [];
  let h = 2166136261;
  for (let i = 1; i <= run.ticks; i++) {
    if (run.style === 'unbeatable' && g.phase === Phase.Play) g.inv = 5;
    g.step(run.style === 'wild' ? { dir: (r.next(5) - 1) as Dir | -1, flare: r.next(50) === 0, pick: r.next(4) - 1 } : b.play(g));
    for (const v of encode(g)) for (let s = 0; s < 32; s += 8) h = Math.imul(h ^ ((v >>> s) & 255), 16777619);
    if (i % 500 === 0) hashes.push(h >>> 0);
  }
  return { ...run, hashes, score: g.score, level: g.level, hits: g.hits };
}
