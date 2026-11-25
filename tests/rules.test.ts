import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/maths.ts';
import { DIRS, DX, DY, MAX_COLS, MIN_COLS, Maze, opposite } from '../src/maze.ts';
import { Game, STEP } from '../src/game.ts';
import { ECHO_DELAY } from '../src/foes.ts';
import { Charm, Ev, Kind, Phase } from '../src/types.ts';
import { Bot, broken, encode, go } from './helpers.ts';

const playing = (seed = 1, diff = 1, cols = 11): any => { const g: any = new Game(seed, diff, cols); while (g.phase === Phase.Ready) g.step(go()); return g; };
const alone = (seed = 1, cols = 11): any => { const g = playing(seed, 1, cols); g.foes = []; return g; };

test('every maze is joined up, has no dead ends, and is the same upside down', () => {
  const seen = new Set<string>();
  for (let cols = MIN_COLS; cols <= MAX_COLS; cols++) for (let seed = 1; seed <= 60; seed++) {
    const m = new Maze(cols, new Rng(seed * 101 + cols)), d = m.distances(0, 0);
    let picture = '', posts = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const open = m.isOpen(x, y);
      picture += open ? '.' : '#';
      assert.equal(open, m.isOpen(m.w - 1 - x, m.h - 1 - y), 'half-turn symmetry');
      if (open) { assert.ok(d[m.at(x, y)]! >= 0, 'unreachable'); assert.ok(m.exits(x, y).length >= 2, 'dead end'); }
      if ((x & 1) && (y & 1)) { assert.ok(!open); if (DIRS.every((k) => m.isOpen(x + DX[k], y + DY[k]))) posts++; }
    }
    assert.ok(posts <= 6, `${posts} lone posts`); // cosmetic: a pillar standing alone
    assert.equal([...picture].filter((c) => c === '.').length, m.total);
    seen.add(picture);
  }
  assert.equal(seen.size, 9 * 60, 'no two mazes alike');
});

test('distances are shortest, and heavy nodes are avoided when there is a lighter way', () => {
  const m = new Maze(11, new Rng(4)), plain = m.distances(0, 0);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isOpen(x, y) && (x || y)) {
    assert.equal(plain[m.at(x, y)], 1 + Math.min(...m.exits(x, y).map((d) => plain[m.at(x + DX[d], y + DY[d])]!)));
  }
  const all = new Uint8Array(m.w * m.h).fill(1), heavy = m.distances(0, 0, all);
  assert.ok(heavy.every((v, i) => v === (plain[i]! < 0 ? -1 : plain[i]! * 2)));
});

test('a silly width is brought back into range', () => { for (const [given, want] of [[0, 7], [-4, 7], [99, 15], [NaN, 7], [10.4, 10]] as const) assert.equal(new Game(1, 1, given).cols, want); });

test('the same seed gives the same game, a different seed a different maze', () => {
  const run = (seed: number): string => { const g = new Game(seed, 1, 12), b = new Bot(5); let s = ''; for (let i = 0; i < 3000; i++) { g.step(b.play(g)); if (i % 100 === 0) s += encode(g).join(); } return s; };
  assert.equal(run(9), run(9));
  assert.notEqual(run(9), run(10));
});

test('nothing breaks in bot games at every width and difficulty', () => {
  for (const cols of [7, 8, 10, 11, 13, 15]) for (let diff = 0; diff <= 2; diff++) {
    const g = new Game(cols * 31 + diff, diff, cols), b = new Bot(cols);
    for (let i = 0; i < 9000 && g.phase !== Phase.Over; i++) { g.step(b.play(g)); const why = broken(g); assert.equal(why, null, `cols ${cols} diff ${diff} tick ${i}: ${why}`); }
  }
});

test('a player who cannot be hurt lights every sky, wins, and flies on', () => {
  for (const cols of [7, 11, 15]) {
    const g = new Game(cols, 1, cols), b = new Bot(3), kinds = new Set<number>(); let won = false;
    for (let i = 0; i < 400000 && g.level < 11; i++) {
      if (g.phase === Phase.Play) g.inv = 5;
      g.step(b.play(g));
      for (const f of g.foes) kinds.add(f.kind);
      won ||= g.phase === Phase.Won;
    }
    assert.ok(g.level >= 11 && won, `stuck in sky ${g.level} at ${g.percent}% with ${cols} columns`);
    assert.equal(kinds.size, 5, 'every creature should appear');
  }
});

test('wild input is harmless', () => {
  const g = new Game(3, 1, 13), r = new Rng(9);
  for (let i = 0; i < 20000; i++) { g.step({ dir: (r.next(5) - 1) as never, flare: r.next(20) === 0, pick: r.next(6) - 2 }); assert.equal(broken(g), null); }
});

test('lighting a star counts once, pays by streak, and a pause ends the streak', () => {
  const g = alone(), s = g.score, n = g.litCount;
  assert.equal(g.light(g.hero.x, g.hero.y), false, 'the first star is lit at the start');
  const d = g.maze.exits(g.hero.x, g.hero.y)[0];
  for (let i = 0; i < 12; i++) g.step(go(d));
  assert.equal(g.litCount, n + 1);
  assert.equal(g.score, s + 10);
  g.streak = 30; assert.equal(g.mult, 3); g.streak = 900; assert.equal(g.mult, 5);
  g.want = -1; g.hero.dir = -1; g.hero.p = 0;
  for (let i = 0; i < 70; i++) g.step(go());
  assert.equal(g.streak, 0);
});

test('turning round is instant, turns can be early or a moment late, walls stop you', () => {
  const g = alone(7), m = g.maze;
  const c = m.cells().find((k: any) => m.can(k.x, k.y, 0) && m.can(k.x, k.y, 1) && m.can(k.x, k.y, 2))!;
  Object.assign(g.hero, { x: c.x, y: c.y, dir: 0, p: 200 }); g.want = 0;
  g.step(go(2)); assert.equal(g.hero.dir, 2);
  Object.assign(g.hero, { x: c.x, y: c.y, dir: 0, p: 100 }); g.want = 0;
  g.step(go(1)); assert.deepEqual([g.hero.dir, g.hero.x, g.hero.y], [1, c.x, c.y], 'late turn');
  Object.assign(g.hero, { x: c.x, y: c.y, dir: 0, p: 400 }); g.want = 0;
  g.step(go(1)); assert.equal(g.hero.dir === 0 || g.hero.x > c.x, true, 'too late');
  Object.assign(g.hero, { x: c.x - 1, y: c.y, dir: 0, p: 300 });
  for (let i = 0; i < 6; i++) g.step(go(1)); assert.equal(g.hero.dir, 1, 'early turn is kept');
  const wall = m.cells().find((k: any) => !m.can(k.x, k.y, 3))!;
  Object.assign(g.hero, { x: wall.x, y: wall.y, dir: -1, p: 0 });
  for (let i = 0; i < 20; i++) g.step(go(3)); assert.deepEqual([g.hero.x, g.hero.y, g.hero.dir], [wall.x, wall.y, -1]);
});

test('a flare lights what it sees, stops at walls, dazes in a chain, and costs one', () => {
  const g = playing(5), m = g.maze, h = g.hero;
  const ahead = m.exits(h.x, h.y)[0];
  const mk = (kind: number, n: number): any => ({ kind, n, homeX: 0, homeY: 0, x: h.x + DX[ahead as 0] * n, y: h.y + DY[ahead as 0] * n, dir: -1, p: 0, wake: 0, t: 0, state: 0, daze: 0, a: 0, b: 0 });
  const behindWall = m.cells().find((k: any) => k.x !== h.x && k.y !== h.y)!;
  g.foes = [mk(Kind.Prowler, 1), mk(Kind.Weaver, 2), { ...mk(Kind.Prowler, 0), x: behindWall.x, y: behindWall.y }];
  g.flares = 1; g.fireFlare(); const was = [g.foes[0].daze, g.foes[1].daze, g.foes[2].daze];
  assert.ok(was[0] > 0 && was[1] > 0 && was[2] === 0, String(was));
  assert.deepEqual([g.flares, g.dazed], [0, 2]);
  for (const d of DIRS) for (let k = 1; k <= g.beam.reach[d]; k++) assert.equal(g.lit[m.at(h.x + k * DX[d], h.y + k * DY[d])], 1);
  for (const d of DIRS) if (g.beam.reach[d] < g.flareReach) assert.ok(!m.can(h.x + g.beam.reach[d] * DX[d], h.y + g.beam.reach[d] * DY[d], d));
  const s = g.score; g.beamT = 0; g.fireFlare(); assert.equal(g.score, s, 'no flare left');
  Object.assign(g.foes[0], { x: h.x, y: h.y }); g.meetFoes(); assert.equal(g.phase, Phase.Play, 'a dazed creature cannot catch you');
});

test('being caught costs a spark, keeps the stars, and sends everyone home; the last one ends the run', () => {
  const g = playing(2, 2); // two sparks
  for (let i = 0; i < 60; i++) g.step(go(g.maze.exits(g.hero.x, g.hero.y)[0]));
  const lit = g.litCount;
  for (const left of [1, 0, -1]) {
    g.inv = 0; const f = g.foes[0]; Object.assign(f, { x: g.hero.x, y: g.hero.y, dir: -1, p: 0, daze: 0, wake: 0 });
    g.meetFoes(); assert.deepEqual([g.phase, g.sparks], [Phase.Hit, left]);
    for (let i = 0; i < 101; i++) g.step(go());
    if (left >= 0) { assert.equal(g.phase, Phase.Play); assert.ok(g.inv > 0 && g.litCount >= lit); assert.deepEqual([f.x, f.y], [f.homeX, f.homeY]); }
  }
  assert.deepEqual([g.phase, g.sparks], [Phase.Over, 0]);
});

test('a sentinel warns, then charges straight until a wall, then rests', () => {
  const g = playing(8), m = g.maze, run = m.runs(7).find((r: any) => r.dir === 0)!;
  Object.assign(g.hero, { x: run.x, y: run.y, dir: -1, p: 0 }); g.want = -1; g.inv = 0;
  const f = g.foes.find((k: any) => k.kind === Kind.Sentinel); g.foes = [f];
  Object.assign(f, { x: run.x + run.len - 1, y: run.y, dir: -1, p: 0, wake: 0, state: 0, b: 0 });
  g.step(go()); assert.equal(f.state, 1); assert.equal(f.a, 2);
  let t = 0; while (f.state === 1) { g.step(go()); t++; } assert.ok(t >= 20, `only ${t} ticks of warning`);
  g.inv = 999; while (f.state === 2) g.step(go());
  assert.equal(f.state, 3); assert.ok(!m.can(f.x, f.y, 2));
});

test('an echo repeats your moves five seconds later; a flare makes it fall behind', () => {
  const g = playing(6), b = new Bot(2);
  g.foes = [{ kind: Kind.Echo, n: 0, homeX: 0, homeY: 0, x: 0, y: 0, dir: -1, p: 0, wake: 0, t: 0, state: 0, daze: 0, a: 0, b: 0 }];
  const path: any[] = [];
  for (let i = 0; i < 700 && g.phase === Phase.Play; i++) { g.inv = 9; g.step(b.play(g)); path.push({ ...g.hero }); if (i > ECHO_DELAY + 5) { const e = g.foes[0], w = path[i - ECHO_DELAY]; assert.deepEqual([e.x, e.y, e.dir, e.p], [w.x, w.y, w.dir, w.p]); } }
  assert.equal(g.foes[0].state, 1);
  g.foes[0].daze = 50; for (let i = 0; i < 50; i++) g.step(b.play(g)); assert.equal(g.foes[0].a, 50);
});

test('a snuffer puts stars out, only so many, and is safe to catch', () => {
  const g = playing(4), m = g.maze; for (const c of m.cells()) g.light(c.x, c.y);
  const f: any = { kind: Kind.Snuffer, n: 0, homeX: 0, homeY: 0, x: 0, y: 0, dir: -1, p: 0, wake: 0, t: 0, state: 0, daze: 0, a: 0, b: 0 };
  g.foes = [f]; const lit = g.litCount; let lost = 0;
  for (let i = 0; i < 4000 && lost < 24; i++) { g.hero.dir = -1; g.hero.p = 0; g.want = -1; g.inv = 9; g.step(go()); lost = lit - g.litCount; if (f.wake > g.playT) break; }
  assert.ok(lost > 0 && lost <= 24, `${lost} put out`);
  Object.assign(f, { wake: 0, x: g.hero.x, y: g.hero.y, dir: -1, p: 0 }); const s = g.score; g.meetFoes();
  assert.equal(g.phase, Phase.Play); assert.ok(g.score === s + 300 && f.wake > g.playT);
});

test('webs slow you once; the silk charm ignores them', () => {
  const g = alone(3), d = g.maze.exits(g.hero.x, g.hero.y)[0], i = g.maze.at(g.hero.x + DX[d as 0], g.hero.y + DY[d as 0]);
  g.webs.set(i, 500); for (let k = 0; k < 11; k++) g.step(go(d)); assert.ok(g.slow > 0 && !g.webs.has(i));
  const k = alone(3); k.charms[Charm.Silk] = 1; k.webs.set(i, 500); for (let q = 0; q < 11; q++) k.step(go(d)); assert.equal(k.slow, 0);
});

test('slipstreams speed you up and hold you back', () => {
  const time = (flow: number): number => { const g = alone(8), r = g.maze.runs(7).find((q: any) => q.dir === 0)!; g.flow.fill(0); if (flow) for (let i = 0; i < r.len; i++) g.flow[g.maze.at(r.x + i, r.y)] = flow; Object.assign(g.hero, { x: r.x, y: r.y, dir: -1, p: 0 }); let t = 0; while (g.hero.x < r.x + r.len - 1 && t < 900) { g.step(go(0)); t++; } return t; };
  assert.ok(time(1) < time(0) && time(0) < time(3), `${time(1)} ${time(0)} ${time(3)}`);
});

test('wormholes join two places, rest a moment, and only appear from the third sky', () => {
  const g: any = new Game(12, 1, 11), b = new Bot(1); let seen = 0;
  for (let i = 0; i < 90000 && g.level < 6; i++) { if (g.phase === Phase.Play) g.inv = 5; g.step(b.play(g)); if (g.worm) { assert.ok(g.level >= 3); seen++; } }
  assert.ok(seen > 0);
  const k = alone(5), m = k.maze, far = m.at(0, 0); const d = m.exits(k.hero.x, k.hero.y)[0]; const a = m.at(k.hero.x + DX[d as 0], k.hero.y + DY[d as 0]);
  k.worm = [a, far]; let jumped = 0; for (let i = 0; i < 12; i++) { k.step(go(d)); jumped += k.events.filter((e: any) => e.kind === Ev.Warp).length; }
  assert.equal(jumped, 2, 'once in, once out'); assert.ok(k.hero.x + k.hero.y < 4);
});

test('lighting the last star clears the sky, then charms are offered, all different', () => {
  const g = alone(1); const m = g.maze;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isOpen(x, y)) g.light(x, y);
  g.step(go()); assert.equal(g.phase, Phase.Clear);
  for (let i = 0; i < 191; i++) g.step(go()); assert.equal(g.phase, Phase.Pick); assert.equal(new Set(g.options).size, 3);
  for (let i = 0; i < 12; i++) g.step(go()); g.step(go(-1, false, 1)); assert.deepEqual([g.phase, g.level, g.litCount], [Phase.Ready, 2, 0]);
  assert.ok(g.foes.length >= 2 && g.prisms.length >= 3);
});

test('charms stop at their cap', () => { const g: any = new Game(1, 1); for (let i = 0; i < 80; i++) { g.offer(); g.take(g.options[g.rng.next(3)]); assert.equal(broken(g), null); } });

test('creatures start well away from you, and opposite() is right', () => {
  for (const cols of [7, 11, 15]) for (let s = 1; s < 30; s++) { const g = new Game(s, 1, cols), far = g.maze.distances(g.homeX, g.homeY); for (const f of g.foes) assert.ok(far[g.maze.at(f.homeX, f.homeY)]! >= 14, `a ${f.kind} starts ${far[g.maze.at(f.homeX, f.homeY)]} away`); }
  for (const d of DIRS) assert.ok(DX[d] + DX[opposite(d)] === 0 && DY[d] + DY[opposite(d)] === 0);
  assert.equal(STEP, 512);
});
