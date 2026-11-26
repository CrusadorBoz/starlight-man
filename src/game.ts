// Starlight Man: the game. Moving, lighting stars, flares, skies, charms and scoring.
// The creatures are in foes.ts and the maze in maze.ts. Nothing in these files
// knows about browsers or drawing.

import { Rng, clamp, div } from './maths.ts';
import { DIRS, DX, DY, HALF, Maze, ROWS, opposite } from './maze.ts';
import type { Dir } from './maze.ts';
import { Charm, Ev, Kind, Phase } from './types.ts';
import type { Beam, Comet, Foe, GameEvent, Input, Mover } from './types.ts';
import { moveComet, moveFoes, roster, sendHome, setOut } from './foes.ts';

/** Steps between two nodes (32 units). */
export const STEP = 512;
export const MAX_FLARES = 3;
export const MAX_SPARKS = 6;
export const SKIES = 9;
/** How many of each charm can be carried (0 = no limit, used on the spot). */
export const CHARM_CAP: readonly number[] = [3, 2, 0, 2, 1, 2];
/** How late a turn can be and still count, in steps. */
const LATE = 150;
/** How close counts as caught, in steps. */
const TOUCH = 350;
const LIFE_EVERY = 25000;

export const unitX = (m: Mover): number => HALF + m.x * HALF + (m.dir < 0 ? 0 : div(DX[m.dir as Dir] * m.p * HALF, STEP));
export const unitY = (m: Mover): number => HALF + m.y * HALF + (m.dir < 0 ? 0 : div(DY[m.dir as Dir] * m.p * HALF, STEP));
const stepX = (m: Mover): number => m.x * STEP + (m.dir < 0 ? 0 : DX[m.dir as Dir] * m.p);
const stepY = (m: Mover): number => m.y * STEP + (m.dir < 0 ? 0 : DY[m.dir as Dir] * m.p);

export class Game {
  readonly diff: number;
  readonly cols: number;
  readonly rng: Rng;

  tick = 0;
  phase: Phase = Phase.Ready;
  phaseT = 0;
  /** Ticks played since the last start or capture in this sky. */
  playT = 0;
  level = 1;
  score = 0;
  private nextLife = LIFE_EVERY;

  maze: Maze;
  lit: Uint8Array;
  litCount = 0;
  /** 0, or 1 + the direction a slipstream blows through this node. */
  flow: Uint8Array;
  /** Node index -> ticks left. */
  readonly webs = new Map<number, number>();
  prisms: number[] = [];
  /** Two linked nodes, or none. */
  worm: readonly [number, number] | null = null;

  readonly hero: Mover = { x: 0, y: 0, dir: -1, p: 0 };
  want: Dir | -1 = -1;
  homeX = 0;
  homeY = 0;
  sparks: number;
  flares = 1;
  inv = 0;
  /** Ticks left of being slowed by a web. */
  slow = 0;
  private wormRest = 0;
  readonly charms: number[] = [0, 0, 0, 0, 0, 0];
  readonly options: number[] = [0, 0, 0];

  streak = 0;
  private streakT = 0;
  foes: Foe[] = [];
  comet: Comet | null = null;
  private comets = 0;
  beam: Beam | null = null;
  beamT = 0;
  /** Where the hero was on each tick, for the Echo. */
  trail: Mover[] = [];
  hitSky = false;

  events: GameEvent[] = [];
  starsLit = 0;
  dazed = 0;
  caught = 0;
  hits = 0;
  private distT = -1;
  private distPlain: Int16Array | null = null;
  private distShy: Int16Array | null = null;

  /** Start a run. diff is 0 (easy), 1 or 2 (hard); cols is how wide the maze is. */
  constructor(seed: number, diff: number, cols = 10) {
    this.diff = diff === 0 || diff === 2 ? diff : 1;
    this.rng = new Rng(seed);
    this.sparks = [5, 3, 2][this.diff] ?? 3;
    this.maze = new Maze(cols, this.rng);
    this.cols = this.maze.cols;
    this.lit = new Uint8Array(0);
    this.flow = new Uint8Array(0);
    this.startSky(1, this.maze);
  }

  has(c: Charm): number { return this.charms[c] ?? 0; }
  emit(kind: Ev, x: number, y: number, v: number): void { if (this.events.length < 160) this.events.push({ kind, x, y, v }); }
  private emitHere(kind: Ev, v: number): void { this.emit(kind, unitX(this.hero), unitY(this.hero), v); }
  private setPhase(p: Phase): void { this.phase = p; this.phaseT = 0; }
  isPlaying(): boolean { return this.phase === Phase.Play; }

  get mult(): number { return 1 + Math.min(4, div(this.streak, 15)); }
  /** How much of the sky is lit, 0..100. */
  get percent(): number { return div(this.litCount * 100, this.maze.total); }
  get flareReach(): number { return 10 + 4 * this.has(Charm.Flare); }
  get dazeTicks(): number { return 270 + 70 * this.has(Charm.Flare); }

  // ---- skies --------------------------------------------------------------------

  private startSky(n: number, maze = new Maze(this.cols, this.rng)): void {
    this.level = n;
    this.maze = maze;
    const size = maze.w * maze.h;
    this.lit = new Uint8Array(size);
    this.flow = new Uint8Array(size);
    this.litCount = 0;
    this.webs.clear();
    this.comet = null;
    this.comets = 0;
    this.beam = null;
    this.hitSky = false;
    this.distT = -1;
    this.homeX = 2 * div(this.cols, 2);
    this.homeY = 2 * (ROWS - 1);
    this.flares = Math.min(MAX_FLARES, Math.max(this.flares, 1 + this.has(Charm.Lantern)));
    this.placeThings();
    this.foes = roster(this);
    this.restart();
    this.setPhase(Phase.Ready);
    this.emitHere(Ev.Sky, n);
  }

  /** Put the hero and the creatures back where they set out from. */
  private restart(): void {
    Object.assign(this.hero, { x: this.homeX, y: this.homeY, dir: -1, p: 0 });
    this.want = -1;
    this.playT = 0;
    this.slow = this.wormRest = this.streak = 0;
    this.trail = [];
    for (const f of this.foes) sendHome(f);
    this.foes.forEach((f, i) => setOut(this, f, 40 + i * 75));
  }

  private placeThings(): void {
    const m = this.maze, far = m.distances(this.homeX, this.homeY);
    const away = (x: number, y: number): number => far[m.at(x, y)] ?? 0;
    // Prisms: spread out, none next door to the start.
    const spots = this.rng.shuffle(m.cells().filter((c) => away(c.x, c.y) > 8));
    const chosen: { x: number; y: number }[] = [];
    for (const c of spots) {
      if (chosen.length >= (this.cols >= 11 ? 5 : 4)) break;
      if (chosen.every((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) > 9)) chosen.push(c);
    }
    this.prisms = chosen.map((c) => m.at(c.x, c.y));
    // Slipstreams, from the second sky on.
    if (this.level >= 2) {
      const runs = this.rng.shuffle(m.runs(7));
      for (const r of runs.slice(0, 1 + div(this.cols, 4))) {
        const d = (r.dir + 2 * this.rng.next(2)) as Dir;
        for (let i = 0; i < r.len; i++) this.flow[m.at(r.x + i * DX[r.dir], r.y + i * DY[r.dir])] = d + 1;
      }
    }
    // A pair of wormholes, from the third sky on.
    this.worm = null;
    if (this.level >= 3) {
      const ends = spots.filter((c) => !this.prisms.includes(m.at(c.x, c.y)) && c.y < m.h / 2 - 1 && away(c.x, c.y) > 12);
      const c = ends[0];
      if (c) this.worm = [m.at(c.x, c.y), m.at(m.w - 1 - c.x, m.h - 1 - c.y)];
      if (this.worm && (this.worm[1] === m.at(this.homeX, this.homeY) || this.prisms.includes(this.worm[1]))) this.worm = null;
    }
  }

  // ---- the tick -------------------------------------------------------------------

  /** Advance one tick (1/60 s). */
  step(input: Input): void {
    if (this.tick > 0) this.events = []; // the constructor's own events belong to tick one
    this.tick++;
    this.phaseT++;
    if (input.dir >= 0 && this.phase !== Phase.Hit) this.want = input.dir;
    if (this.beamT > 0) this.beamT--;
    switch (this.phase) {
      case Phase.Ready:
        if (this.phaseT >= 100) {
          this.setPhase(Phase.Play);
          this.light(this.hero.x, this.hero.y);
        }
        break;
      case Phase.Play:
        this.play(input);
        break;
      case Phase.Hit:
        if (this.phaseT >= 100) {
          if (this.sparks < 0) {
            this.sparks = 0;
            this.setPhase(Phase.Over);
            this.emitHere(Ev.Over, 0);
          } else {
            this.restart();
            this.inv = 150;
            this.setPhase(Phase.Play);
          }
        }
        break;
      case Phase.Clear:
        if (this.phaseT >= 190) {
          if (this.level === SKIES) {
            this.setPhase(Phase.Won);
            this.emitHere(Ev.Won, 0);
          } else this.offer();
        }
        break;
      case Phase.Pick:
        if (input.pick >= 0 && input.pick < 3 && this.phaseT > 10) {
          this.take(this.options[input.pick] ?? -1);
          this.startSky(this.level + 1);
        }
        break;
      case Phase.Won:
        if (input.pick >= 0 && this.phaseT > 10) this.offer();
        break;
      case Phase.Over:
        break;
    }
  }

  private play(input: Input): void {
    this.playT++;
    if (this.inv > 0) this.inv--;
    if (this.slow > 0) this.slow--;
    if (this.wormRest > 0) this.wormRest--;
    if (this.streakT > 0 && --this.streakT === 0) this.streak = 0;
    for (const [i, t] of this.webs) {
      if (t <= 1) this.webs.delete(i);
      else this.webs.set(i, t - 1);
    }
    this.moveHero();
    this.trail.push({ ...this.hero });
    if (this.trail.length > 4000) this.trail.splice(0, 2000);
    if (input.flare) this.fireFlare();
    moveFoes(this);
    this.meetFoes();
    if (!this.isPlaying()) return;
    this.runComet();
    if (this.litCount >= this.maze.total) this.clearSky();
  }

  // ---- the hero --------------------------------------------------------------------

  private heroSpeed(): number {
    let s = 56 + 3 * this.has(Charm.Fins);
    const f = this.flow[this.maze.at(this.hero.x, this.hero.y)] ?? 0;
    if (f > 0 && this.hero.dir >= 0) {
      if (f - 1 === this.hero.dir) s = div(s * 150, 100);
      else if (opposite((f - 1) as Dir) === this.hero.dir) s = div(s * 70, 100);
    }
    return this.slow > 0 ? div(s * 45, 100) : s;
  }

  private moveHero(): void {
    const h = this.hero, m = this.maze, want = this.want;
    if (want >= 0 && h.dir >= 0 && want === opposite(h.dir as Dir)) { // turn round at once
      if (h.p > 0) {
        h.x += DX[h.dir as Dir];
        h.y += DY[h.dir as Dir];
        h.p = STEP - h.p;
        h.dir = want;
      } else if (m.can(h.x, h.y, want)) h.dir = want;
    }
    if (h.dir < 0) {
      if (want < 0 || !m.can(h.x, h.y, want as Dir)) return;
      h.dir = want;
      h.p = 0;
    } else if (want >= 0 && want !== h.dir && h.p > 0 && h.p <= LATE && m.can(h.x, h.y, want as Dir) && want !== opposite(h.dir as Dir)) {
      h.dir = want; // a turn pressed a moment too late still counts
      h.p = 0;
    }
    h.p += this.heroSpeed();
    while (h.p >= STEP && h.dir >= 0) {
      h.p -= STEP;
      h.x += DX[h.dir as Dir];
      h.y += DY[h.dir as Dir];
      this.arrive();
      if (this.want >= 0 && m.can(h.x, h.y, this.want as Dir)) h.dir = this.want;
      else if (!m.can(h.x, h.y, h.dir as Dir)) {
        h.dir = -1;
        h.p = 0;
      }
    }
  }

  private arrive(): void {
    const h = this.hero, i = this.maze.at(h.x, h.y);
    this.light(h.x, h.y);
    const prism = this.prisms.indexOf(i);
    if (prism >= 0) {
      this.prisms.splice(prism, 1);
      this.flares = Math.min(MAX_FLARES, this.flares + 1);
      this.award(50);
      this.emitHere(Ev.Prism, this.flares);
    }
    if (this.webs.delete(i)) {
      this.award(20);
      if (this.has(Charm.Silk) === 0) {
        this.slow = 75;
        this.emitHere(Ev.Stuck, 0);
      }
    }
    if (this.worm && this.wormRest === 0 && this.worm.includes(i)) {
      const to = this.worm[0] === i ? this.worm[1] : this.worm[0];
      this.emitHere(Ev.Warp, 0);
      h.x = to % this.maze.w;
      h.y = div(to, this.maze.w);
      this.wormRest = 50;
      this.light(h.x, h.y);
      this.emitHere(Ev.Warp, 1);
    }
  }

  /** Light the star on a node, if it is dark. */
  private light(x: number, y: number): boolean {
    const i = this.maze.at(x, y);
    if (this.lit[i] === 1) return false;
    this.lit[i] = 1;
    this.litCount++;
    this.starsLit++;
    this.streak++;
    this.streakT = 60;
    this.award(10 * this.mult);
    this.emit(Ev.Star, HALF + x * HALF, HALF + y * HALF, this.streak);
    if (this.streak % 15 === 0 && this.streak <= 60) this.emit(Ev.Streak, HALF + x * HALF, HALF + y * HALF, this.mult);
    return true;
  }

  /** Put a star out again. */
  douse(x: number, y: number): boolean {
    const i = this.maze.at(x, y);
    if (this.lit[i] !== 1) return false;
    this.lit[i] = 0;
    this.litCount--;
    this.emit(Ev.Snuff, HALF + x * HALF, HALF + y * HALF, 0);
    return true;
  }

  award(points: number): void {
    this.score += points;
    if (this.score >= this.nextLife) {
      this.nextLife += LIFE_EVERY;
      if (this.sparks < MAX_SPARKS) {
        this.sparks++;
        this.emitHere(Ev.Spark, this.sparks);
      }
    }
  }

  /** Light every star in sight, four ways at once, and daze every creature there. */
  private fireFlare(): void {
    if (this.flares === 0 || this.beamT > 0) return;
    this.flares--;
    const h = this.hero, m = this.maze;
    // From the nearer node, so a flare fired just past a junction still uses it.
    const on = h.dir >= 0 && h.p * 2 > STEP ? { x: h.x + DX[h.dir as Dir], y: h.y + DY[h.dir as Dir] } : { x: h.x, y: h.y };
    const hitNodes = new Set<number>([m.at(on.x, on.y)]);
    this.light(on.x, on.y);
    const reach = DIRS.map((d) => {
      let n = 0;
      while (n < this.flareReach && m.can(on.x + n * DX[d], on.y + n * DY[d], d)) {
        n++;
        hitNodes.add(m.at(on.x + n * DX[d], on.y + n * DY[d]));
        this.light(on.x + n * DX[d], on.y + n * DY[d]);
      }
      return n;
    });
    this.beam = { x: on.x, y: on.y, reach: [reach[0] ?? 0, reach[1] ?? 0, reach[2] ?? 0, reach[3] ?? 0] };
    this.beamT = 34;
    this.emit(Ev.Flare, HALF + on.x * HALF, HALF + on.y * HALF, 0);
    let chain = 200;
    for (const f of this.foes) {
      if (!this.isOut(f)) continue;
      const next = f.dir >= 0 ? m.at(f.x + DX[f.dir as Dir], f.y + DY[f.dir as Dir]) : -1;
      if (!hitNodes.has(m.at(f.x, f.y)) && !(f.p * 2 > STEP && hitNodes.has(next))) continue;
      if (f.kind === Kind.Snuffer) {
        this.catchSnuffer(f);
        continue;
      }
      f.daze = this.dazeTicks;
      this.dazed++;
      this.award(chain);
      this.emit(Ev.Daze, unitX(f), unitY(f), chain);
      chain = Math.min(1600, chain * 2);
    }
  }

  // ---- meeting creatures ----------------------------------------------------------

  /** Is this creature out in the maze (awake, and for an Echo, visible)? */
  isOut(f: Foe): boolean { return this.playT >= f.wake && (f.kind !== Kind.Echo || f.state === 1); }

  private touching(m: Mover): boolean {
    return Math.abs(stepX(m) - stepX(this.hero)) + Math.abs(stepY(m) - stepY(this.hero)) < TOUCH;
  }

  private catchSnuffer(f: Foe): void {
    this.caught++;
    this.award(300);
    this.emit(Ev.Caught, unitX(f), unitY(f), 300);
    sendHome(f);
    setOut(this, f, this.playT + 900);
  }

  private meetFoes(): void {
    for (const f of this.foes) {
      if (!this.isOut(f) || !this.touching(f)) continue;
      if (f.kind === Kind.Snuffer) this.catchSnuffer(f);
      else if (f.daze === 0 && this.inv === 0) {
        this.sparks--;
        this.hits++;
        this.hitSky = true;
        this.streak = 0;
        this.emitHere(Ev.Hit, this.sparks);
        this.setPhase(Phase.Hit);
        return;
      }
    }
  }

  private runComet(): void {
    const due = this.comets === 0 ? 35 : this.comets === 1 ? 70 : 101;
    if (!this.comet && this.percent >= due) {
      this.comets++;
      const far = this.heroDist(false), spots = this.maze.cells().filter((c) => (far[this.maze.at(c.x, c.y)] ?? 0) > 10);
      if (spots.length > 0) {
        const c = this.rng.pick(spots);
        this.comet = { x: c.x, y: c.y, dir: -1, p: 0, life: 720 };
        this.emit(Ev.Comet, unitX(this.comet), unitY(this.comet), 0);
      }
    }
    if (!this.comet) return;
    moveComet(this, this.comet);
    if (this.touching(this.comet)) {
      const pts = 500 * Math.min(10, this.level);
      this.award(pts);
      this.emit(Ev.CometGot, unitX(this.comet), unitY(this.comet), pts);
      this.comet = null;
    } else if (--this.comet.life <= 0) this.comet = null;
  }

  /** Distance from the hero to every node; `shy` makes lit nodes count double. */
  heroDist(shy: boolean): Int16Array {
    if (this.distT !== this.tick) {
      this.distT = this.tick;
      this.distPlain = this.distShy = null;
    }
    if (shy) return (this.distShy ??= this.maze.distances(this.hero.x, this.hero.y, this.lit));
    return (this.distPlain ??= this.maze.distances(this.hero.x, this.hero.y));
  }

  // ---- between skies ----------------------------------------------------------------

  private clearSky(): void {
    const clean = this.hitSky ? 0 : 1;
    const bonus = 1000 * this.level + 1500 * clean + 250 * this.flares;
    this.award(bonus);
    this.comet = null;
    this.setPhase(Phase.Clear);
    this.emitHere(Ev.Clear, bonus * 2 + clean);
  }

  private available(c: number): boolean {
    return c === Charm.Spark ? this.sparks < MAX_SPARKS : (this.charms[c] ?? 0) < (CHARM_CAP[c] ?? 0);
  }

  private offer(): void {
    const pool = this.charms.map((_, c) => c).filter((c) => this.available(c));
    for (let i = 0; i < 3; i++) this.options[i] = pool.length > 0 ? pool.splice(this.rng.next(pool.length), 1)[0] ?? -1 : -1;
    this.setPhase(Phase.Pick);
  }

  private take(c: number): void {
    if (c < 0) this.award(2000);
    else if (c === Charm.Spark) this.sparks = clamp(this.sparks + 1, 0, MAX_SPARKS);
    else this.charms[c] = (this.charms[c] ?? 0) + 1;
    this.emitHere(Ev.Pick, c);
  }
}
