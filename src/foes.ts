// Starkindle: the creatures. Where they start, how they choose their way, and
// what each does to you.

import { div } from './maths.ts';
import { DIRS, DX, DY, opposite } from './maze.ts';
import type { Dir } from './maze.ts';
import { Charm, Ev, Kind } from './types.ts';
import type { Comet, Foe, Mover } from './types.ts';
import { STEP, unitX, unitY } from './game.ts';
import type { Game } from './game.ts';

const { Prowler, Sentinel, Weaver, Echo, Snuffer } = Kind;

/** Who lives in each sky; past the last row they all do. */
const SKY_ROSTER: readonly (readonly Kind[])[] = [
  [Prowler, Sentinel],
  [Prowler, Sentinel, Weaver],
  [Prowler, Sentinel, Echo, Prowler],
  [Prowler, Sentinel, Snuffer, Weaver, Prowler],
  [Prowler, Sentinel, Echo, Snuffer, Prowler, Sentinel],
  [Prowler, Sentinel, Weaver, Echo, Snuffer, Prowler],
  [Prowler, Sentinel, Snuffer, Weaver, Prowler, Sentinel, Prowler],
  [Prowler, Sentinel, Echo, Weaver, Snuffer, Prowler, Prowler],
  [Prowler, Sentinel, Weaver, Echo, Snuffer, Prowler, Sentinel, Prowler],
];

/** How far behind you an Echo runs, in ticks. */
export const ECHO_DELAY = 300;
const MAX_WEBS = 6;
const SNUFF_LIMIT = 24;

export function roster(g: Game): Foe[] {
  const row = SKY_ROSTER[Math.min(g.level, SKY_ROSTER.length) - 1] ?? [Prowler];
  // A narrow maze has less room: leave out the last one or two.
  const kinds = g.cols >= 11 ? row : row.slice(0, Math.max(2, row.length - (g.cols <= 8 ? 2 : 1)));
  const m = g.maze, far = m.distances(g.homeX, g.homeY);
  const spots = m.cells().sort((a, b) => (far[m.at(b.x, b.y)] ?? 0) - (far[m.at(a.x, a.y)] ?? 0) || a.x - b.x || a.y - b.y);
  const homes: { x: number; y: number }[] = [];
  for (const c of spots) {
    if (homes.length >= kinds.length) break;
    if (homes.every((h) => Math.abs(h.x - c.x) + Math.abs(h.y - c.y) >= 6)) homes.push(c);
  }
  return kinds.map((kind, n) => {
    const home = homes[n] ?? spots[n] ?? { x: 0, y: 0 };
    return { kind, n, homeX: home.x, homeY: home.y, x: home.x, y: home.y, dir: -1, p: 0, wake: 0, t: 0, state: 0, daze: 0, a: 0, b: 0 };
  });
}

/** Put a creature back where it lives. */
export function sendHome(f: Foe): void {
  Object.assign(f, { x: f.homeX, y: f.homeY, dir: -1, p: 0, t: 0, state: 0, daze: 0, a: 0, b: 0 });
}

/** Have a creature set out at a given play tick. */
export function setOut(g: Game, f: Foe, at: number): void {
  f.wake = f.kind === Echo ? g.playT : at; // an Echo needs no head start: it is one
}

const tough = (g: Game): number => [-5, 0, 4][g.diff] ?? 0;

function speedOf(g: Game, f: Foe): number {
  const lv = Math.min(g.level, 12);
  let s = tough(g) + div(g.percent, 25); // they hurry as the sky fills
  switch (f.kind) {
    case Prowler: s += 41 + Math.min(14, div(lv * 3, 2)); break;
    case Sentinel: return f.state === 2 ? 100 + 2 * lv + tough(g) : s + 32 + lv;
    case Weaver: s += 36 + lv; break;
    default: s += 38;
  }
  if (g.lit[g.maze.at(f.x, f.y)] === 1) s = div(s * (86 - 8 * g.has(Charm.Wake)), 100); // starlight slows them
  return Math.max(12, s);
}

/** Ways on from here, without turning back unless there is no other. */
function onward(g: Game, m: Mover): Dir[] {
  const all = g.maze.exits(m.x, m.y);
  const on = m.dir < 0 ? all : all.filter((d) => d !== opposite(m.dir as Dir));
  return on.length > 0 ? on : all;
}

/** Move along; at each cell, ask which way next (-1 stops). `passing` runs at every node. */
function walk(g: Game, m: Mover, speed: number, next: () => Dir | -1, passing?: () => void): void {
  if (m.dir < 0) {
    m.dir = next();
    m.p = 0;
    if (m.dir < 0) return;
  }
  m.p += speed;
  while (m.p >= STEP && m.dir >= 0) {
    m.p -= STEP;
    m.x += DX[m.dir as Dir];
    m.y += DY[m.dir as Dir];
    passing?.();
    if (g.maze.isCell(m.x, m.y)) m.dir = next();
    if (m.dir < 0) m.p = 0;
  }
}

export function moveFoes(g: Game): void {
  for (const f of g.foes) {
    if (g.playT < f.wake) continue;
    f.t++;
    if (f.daze > 0) {
      f.daze--;
      if (f.kind === Echo) f.a++; // it falls further behind
      continue;
    }
    switch (f.kind) {
      case Prowler: prowl(g, f); break;
      case Sentinel: guard(g, f); break;
      case Weaver: weave(g, f); break;
      case Echo: echo(g, f); break;
      case Snuffer: snuff(g, f); break;
    }
  }
}

/** Hunts for nine seconds, then loses the scent for a few. Every other one keeps out of the light. */
function prowl(g: Game, f: Foe): void {
  const cycle = 780 - 20 * Math.min(g.level, 10), hunting = (f.t + f.n * 170) % cycle < 540 + 60 * g.diff;
  f.state = hunting ? 1 : 0;
  walk(g, f, speedOf(g, f), () => {
    const ways = onward(g, f);
    if (!hunting || g.rng.next(5 + g.level) === 0) return g.rng.pick(ways);
    const dist = g.heroDist(f.n % 2 === 1);
    return ways.reduce((best, d) => (near(g, f, d, dist) < near(g, f, best, dist) ? d : best));
  });
}

function near(g: Game, m: Mover, d: Dir, dist: Int16Array): number {
  return dist[g.maze.at(m.x + DX[d], m.y + DY[d])] ?? 9999;
}

/** Which way the hero is, if there is a clear straight line to it. */
function sees(g: Game, f: Foe): Dir | -1 {
  for (const d of DIRS) {
    for (let x = f.x, y = f.y, n = 0; n < 16 && g.maze.can(x, y, d); n++) {
      x += DX[d];
      y += DY[d];
      if (x === g.hero.x && y === g.hero.y) return d;
    }
  }
  return -1;
}

/** state: 0 patrol, 1 about to charge (a = which way), 2 charging, 3 getting its breath. b = ticks before it can charge again. */
function guard(g: Game, f: Foe): void {
  if (f.b > 0) f.b--;
  switch (f.state) {
    case 0:
      walk(g, f, speedOf(g, f), () => {
        const d = f.b === 0 && g.inv === 0 ? sees(g, f) : -1;
        if (d < 0) return g.rng.pick(onward(g, f));
        f.state = 1;
        f.t = 0;
        f.a = d;
        g.emit(Ev.Tell, unitX(f), unitY(f), d);
        return -1;
      });
      break;
    case 1:
      if (f.t >= 32 - 4 * g.diff) {
        f.state = 2;
        f.dir = f.a as Dir;
        f.p = 0;
        g.emit(Ev.Charge, unitX(f), unitY(f), f.a);
      }
      break;
    case 2:
      walk(g, f, speedOf(g, f), () => (g.maze.can(f.x, f.y, f.a as Dir) ? (f.a as Dir) : -1));
      if (f.dir < 0) {
        f.state = 3;
        f.t = 0;
      }
      break;
    default:
      if (f.t >= 60) {
        f.state = 0;
        f.b = 90;
      }
  }
}

function weave(g: Game, f: Foe): void {
  f.a++;
  walk(g, f, speedOf(g, f), () => {
    const ways = onward(g, f), dist = g.heroDist(false);
    if (g.rng.next(4) === 0) return g.rng.pick(ways);
    return ways.reduce((best, d) => (near(g, f, d, dist) > near(g, f, best, dist) ? d : best));
  }, () => {
    const i = g.maze.at(f.x, f.y);
    if (f.a < 150 || g.webs.size >= MAX_WEBS || g.webs.has(i) || (f.x === g.homeX && f.y === g.homeY)) return;
    f.a = 0;
    g.webs.set(i, 1500);
    g.emit(Ev.Web, unitX(f), unitY(f), 0);
  });
}

/** state 1 = visible. a = extra ticks it has fallen behind. */
function echo(g: Game, f: Foe): void {
  const was = g.trail[g.trail.length - 1 - ECHO_DELAY - f.a];
  f.state = was ? 1 : 0;
  if (was) Object.assign(f, { x: was.x, y: was.y, dir: was.dir, p: was.p });
}

/** a = stars it has put out since it was last caught. */
function snuff(g: Game, f: Foe): void {
  walk(g, f, speedOf(g, f), () => {
    const ways = onward(g, f);
    const bright = ways.filter((d) => g.lit[g.maze.at(f.x + DX[d], f.y + DY[d])] === 1);
    return g.rng.pick(bright.length > 0 ? bright : ways);
  }, () => {
    if (f.a < SNUFF_LIMIT && g.douse(f.x, f.y)) f.a++;
  });
}

export function moveComet(g: Game, c: Comet): void {
  walk(g, c, 34, () => g.rng.pick(onward(g, c)));
}
