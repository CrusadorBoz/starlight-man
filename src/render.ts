// Starlight Man: everything on the canvas.

import { crane, darkStar, door, drawFoe, drawHero, litStar, match, web, wind } from './creatures.ts';
import { ECHO_DELAY } from './foes.ts';
import { unitX, unitY } from './game.ts';
import type { Game } from './game.ts';
import { CELL, DIRS, DX, DY, HALF, ROWS } from './maze.ts';
import type { Dir, Maze } from './maze.ts';
import { SS, TAU, context, grain, halo, put, seeded } from './paint.ts';
import type { Ctx } from './paint.ts';
import { cloud, makeSky, themeOf } from './sky.ts';
import type { Theme } from './sky.ts';
import { Ev, Kind, Phase } from './types.ts';
import type { GameEvent } from './types.ts';

export const H = ROWS * CELL;
/** Canvas pixels to the unit, at most. */
export const SHARPEST = SS;
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface Wall { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
/** A scrap of coloured paper. */
interface Scrap { x: number; y: number; vx: number; vy: number; turn: number; readonly spin: number; life: number; readonly max: number; readonly color: string; readonly size: number }
interface Ring { readonly x: number; readonly y: number; readonly color: string; readonly r1: number; life: number; readonly max: number }
interface Note { readonly x: number; y: number; readonly text: string; readonly color: string; life: number; readonly max: number }
interface Drift { x: number; readonly y: number; readonly s: number; readonly v: number }

/** The walls of a maze as straight pieces, in units. */
function wallsOf(m: Maze): Wall[] {
  const out: Wall[] = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < m.cols; c++) {
    if (r === 0 || r === ROWS || !m.isOpen(2 * c, 2 * r - 1)) out.push({ x1: c * CELL, y1: r * CELL, x2: (c + 1) * CELL, y2: r * CELL });
  }
  for (let c = 0; c <= m.cols; c++) for (let r = 0; r < ROWS; r++) {
    if (c === 0 || c === m.cols || !m.isOpen(2 * c - 1, 2 * r)) out.push({ x1: c * CELL, y1: r * CELL, x2: c * CELL, y2: (r + 1) * CELL });
  }
  return out;
}

/** The whole maze, drawn once per sky: walls of layered paper cloud. */
function drawMaze(m: Maze, t: Theme, level: number, pixels: number): HTMLCanvasElement {
  const img = document.createElement('canvas'), W = m.cols * CELL, r = seeded(level * 97 + m.cols);
  img.width = Math.round(W * pixels);
  img.height = Math.round(H * pixels);
  const x = context(img);
  x.scale(img.width / W, img.height / H);
  const puffs: { x: number; y: number; r: number }[] = [];
  for (const w of wallsOf(m)) for (let k = 0; k <= 6; k++) {
    const along = k / 6, across = (r() - 0.5) * 4;
    puffs.push({ x: w.x1 + (w.x2 - w.x1) * along + (w.x1 === w.x2 ? across : 0), y: w.y1 + (w.y2 - w.y1) * along + (w.y1 === w.y2 ? across : 0), r: 7 + r() * 3.6 });
  }
  for (let c = 1; c < m.cols; c++) for (let q = 1; q < ROWS; q++) puffs.push({ x: c * CELL, y: q * CELL, r: 11.5 + r() * 1.5 }); // and a puff on every corner
  const sheet = (fill: string, grow: number, ox: number, oy: number): void => {
    x.fillStyle = fill;
    x.beginPath();
    for (const p of puffs) { x.moveTo(p.x + ox, p.y + oy); x.arc(p.x + ox, p.y + oy, p.r + grow, 0, TAU); }
    x.fill();
  };
  sheet(t.shadow, 2.6, 2, 6);
  sheet(t.shadow, 1, 1, 3.4);
  sheet(t.under, 2.4, 0, 1.4);
  sheet(t.cloud, 0, 0, 0);
  x.lineWidth = 1.1; // pencilled curls
  x.lineCap = 'round';
  x.strokeStyle = t.line;
  for (const p of puffs) {
    if (r() < 0.5) continue;
    const a = r() * TAU;
    x.beginPath();
    x.arc(p.x + (r() - 0.5) * 4, p.y + (r() - 0.5) * 4, 2.4 + r() * 3, a, a + 1.6 + r() * 1.2);
    x.stroke();
  }
  x.globalCompositeOperation = 'source-atop';
  grain(x, W, H, 0.05);
  return img;
}

export class Renderer {
  private readonly c: HTMLCanvasElement;
  private readonly x: Ctx;
  /** prefers-reduced-motion */
  private readonly calm: boolean;
  private w = 10 * CELL;
  private readonly skies = new Map<string, HTMLCanvasElement>();
  private drifts: Drift[] = [];
  private maze: HTMLCanvasElement | null = null;
  private mazeOf: Maze | null = null;
  private scraps: Scrap[] = [];
  private rings: Ring[] = [];
  private notes: Note[] = [];
  private shake = 0;
  private flash = 0;
  private time = 0;
  /** The lamplighter keeps facing the way it last went, left or right. */
  private left = false;

  constructor(canvas: HTMLCanvasElement, calm: boolean) {
    this.c = canvas;
    this.x = context(canvas, { alpha: false });
    this.calm = calm;
    this.resize(this.w);
  }

  /** Make the sky w units wide. */
  resize(w: number): void {
    this.w = w;
    this.skies.clear();
    this.maze = null;
    this.drifts = Array.from({ length: Math.round(w / 190) }, (_, i) => ({ x: Math.random() * w, y: 60 + ((i * 137) % 300), s: rand(34, 62), v: rand(0.05, 0.14) }));
  }
  /** Draw with this many canvas pixels to the unit; true if that changed (and wiped) the canvas. */
  sharpness(pixels: number): boolean {
    const w = Math.round(this.w * pixels), h = Math.round(H * pixels);
    if (this.c.width === w && this.c.height === h) return false;
    this.c.width = w;
    this.c.height = h;
    this.maze = null;
    this.skies.clear();
    return true;
  }
  reset(): void {
    this.scraps = [];
    this.rings = [];
    this.notes = [];
    this.shake = this.flash = 0;
    this.left = false;
    this.maze = null;
  }

  private confetti(px: number, py: number, colors: readonly string[], n: number, speed: number, life = 46, size = 4): void {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.scraps.length < 420; i++) {
      const a = Math.random() * TAU, s = speed * rand(0.3, 1.15);
      this.scraps.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.25, turn: Math.random() * TAU, spin: rand(-0.3, 0.3), life: life * rand(0.6, 1.2), max: life, color: colors[i % colors.length] ?? '#fff', size: size * rand(0.6, 1.3) });
    }
  }
  private ring(px: number, py: number, color: string, r1: number, life = 28): void { this.rings.push({ x: px, y: py, color, r1, life, max: life }); }
  private note(px: number, py: number, text: string, color = '#22324f'): void { this.notes.push({ x: px, y: py, text, color, life: 60, max: 60 }); }

  /** Turn this frame's events into paper. */
  events(list: readonly GameEvent[]): void {
    const GOLD = ['#ffd24d', '#f7b928', '#fff0b0'], MIX = ['#e2553d', '#ffd24d', '#4b8fdd', '#fff6e0', '#5f50a2'];
    for (const e of list) {
      const { x: px, y: py } = e;
      switch (e.kind) {
        case Ev.Star: this.confetti(px, py, GOLD, 3, 1.5, 24, 2.4); break;
        case Ev.Streak: this.note(px, py - 18, `Streak ×${e.v}`, '#9a5a00'); this.ring(px, py, '#ffd24d', 40, 24); break;
        case Ev.Prism: this.confetti(px, py, ['#ff9a2e', '#d9402b', '#fff0a8'], 18, 2.6); this.note(px, py - 18, 'Match!', '#a32a16'); break;
        case Ev.Flare: this.flash = Math.max(this.flash, 0.28); this.ring(px, py, '#fff6cf', 110, 30); if (!this.calm) this.shake = Math.max(this.shake, 4); break;
        case Ev.Daze: this.confetti(px, py, ['#fff6cf', '#ffd24d', '#ffffff'], 18, 3); this.note(px, py - 20, `Dazed +${e.v}`, '#7a4a00'); break;
        case Ev.Hit: this.flash = 0.4; if (!this.calm) this.shake = 14; this.confetti(px, py, MIX, 70, 5, 80, 6); this.ring(px, py, '#ffffff', 110, 40); break;
        case Ev.Clear: for (let k = 0; k < 5; k++) this.confetti((this.w * (k + 0.5)) / 5, 120, MIX, 34, 5, 130, 6); break;
        case Ev.CometGot: this.confetti(px, py, ['#f7a9c4', '#ffd0df', '#ffffff'], 40, 4, 60, 5); this.note(px, py - 20, `Crane +${e.v.toLocaleString('en-US')}`, '#a02c5c'); break;
        case Ev.Comet: this.ring(px, py, '#f7a9c4', 60, 36); break;
        case Ev.Snuff: this.confetti(px, py, ['#8d86a3', '#4d465e'], 5, 1.2, 30, 3); break;
        case Ev.Caught: this.confetti(px, py, ['#9b94ad', '#f2b63c', '#ffffff'], 24, 3); this.note(px, py - 20, `Caught +${e.v}`, '#4d465e'); break;
        case Ev.Stuck: this.confetti(px, py, ['#ffffff'], 10, 1.8, 28, 3); this.note(px, py - 20, 'Stuck!', '#16705f'); break;
        case Ev.Warp: this.confetti(px, py, ['#3f4fa8', '#ffd24d', '#ffffff'], 22, 3); break;
        case Ev.Tell: this.ring(px, py, '#ff4a2e', 38, 24); break;
        case Ev.Charge: this.confetti(px, py, ['#a9713a', '#f6e2b8'], 12, 2.4, 30, 4); break;
        case Ev.Spark: this.note(px, py - 26, 'Extra spark!', '#9a5a00'); this.ring(px, py, '#ffd24d', 70, 34); break;
        default: break;
      }
    }
  }

  private sky(t: Theme, busy: boolean): HTMLCanvasElement {
    const key = t.top + busy;
    let s = this.skies.get(key);
    if (!s) {
      s = makeSky(t, this.w, H, this.c.width / this.w, busy);
      this.skies.set(key, s);
    }
    return s;
  }

  /** Draw one frame; null draws the title scene. dt is in ticks. */
  draw(g: Game | null, dt: number): void {
    const x = this.x;
    this.time += dt;
    x.setTransform(this.c.width / this.w, 0, 0, this.c.height / H, 0, 0);
    x.globalAlpha = 1;
    if (this.shake > 0.2) {
      x.translate(rand(-0.5, 0.5) * this.shake, rand(-0.5, 0.5) * this.shake);
      this.shake *= Math.pow(0.88, dt);
    }
    const t = themeOf(g?.level ?? 1);
    x.drawImage(this.sky(t, g === null), 0, 0, this.w, H);
    if (!g) {
      this.titleScene(t, dt);
      return;
    }
    if (!this.maze || this.mazeOf !== g.maze) {
      this.maze = drawMaze(g.maze, t, g.level, this.c.width / this.w);
      this.mazeOf = g.maze;
    }
    const clearing = g.phase === Phase.Clear || g.phase === Phase.Pick || g.phase === Phase.Won;
    this.path(g, clearing);
    this.winds(g);
    // The clouds drop in at the start and part when the sky is done.
    const go = clearing ? Math.min(1, (g.phase === Phase.Clear ? g.phaseT : 200) / 110) : g.phase === Phase.Ready && !this.calm ? 1 - Math.min(1, g.phaseT / 40) : 0;
    x.globalAlpha = 1 - go * (clearing ? 0.9 : 1);
    x.drawImage(this.maze, 0, clearing ? 0 : -go * 60, this.w, H);
    x.globalAlpha = 1;
    this.stars(g, t, clearing);
    if (!clearing) {
      if (g.worm) for (const i of g.worm) put(x, door(), (i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF - 2);
      for (const [i, left] of g.webs) {
        x.globalAlpha = Math.min(1, left / 120);
        put(x, web(), (i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF);
        x.globalAlpha = 1;
      }
      for (const i of g.prisms) this.matchAt((i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF);
      this.beam(g);
      if (g.comet && !(g.comet.life < 120 && g.comet.life % 16 < 6)) put(x, crane(Math.floor(this.time / 5) % 8), unitX(g.comet), unitY(g.comet) + Math.sin(this.time * 0.1) * 2);
      for (const f of g.foes) this.foe(g, f);
    }
    this.hero(g);
    this.loose(dt);
    if (this.flash > 0.01) {
      x.fillStyle = `rgba(255,248,222,${this.calm ? this.flash * 0.3 : this.flash})`;
      x.fillRect(-20, -20, this.w + 40, H + 40);
      this.flash *= Math.pow(0.86, dt);
    }
  }

  private titleScene(t: Theme, dt: number): void {
    const x = this.x;
    for (const d of this.drifts) {
      d.x += d.v * dt * (this.calm ? 0.2 : 1);
      if (d.x > this.w + 90) d.x = -90;
      x.save();
      x.translate(d.x, d.y);
      cloud(x, t, d.s);
      x.restore();
    }
    const n = Math.max(7, Math.round(this.w / 74)); // foil stars on threads
    for (let i = 0; i < n; i++) {
      const px = ((i + 0.5) * this.w) / n, len = Math.abs(px - this.w / 2) < 270 ? 8 + ((i * 83) % 22) : 80 + ((i * 83) % 130), a = this.calm ? 0 : Math.sin(this.time * 0.02 + i * 1.7) * 0.07;
      const sx = px + Math.sin(a) * len, sy = Math.cos(a) * len;
      x.lineWidth = 1.2;
      x.strokeStyle = 'rgba(255,255,255,.75)';
      x.beginPath();
      x.moveTo(px, -4);
      x.lineTo(sx, sy);
      x.stroke();
      x.save();
      x.translate(sx, sy + 8);
      x.rotate(a * 3);
      x.scale(1.9, 1.9);
      put(x, litStar());
      x.restore();
    }
    x.save();
    x.translate(this.w / 2, 432);
    x.scale(3.1, 3.1);
    drawHero(x, { t: this.time, moving: !this.calm, slow: true, left: false });
    x.restore();
  }

  /** A ribbon of cream paper along the lit stars. */
  private path(g: Game, clearing: boolean): void {
    const x = this.x, m = g.maze;
    x.lineCap = 'round';
    x.beginPath();
    for (let y = 0; y < m.h; y++) for (let k = 0; k < m.w; k++) {
      if (g.lit[m.at(k, y)] !== 1) continue;
      for (const d of [0, 1] as const) {
        if (!m.can(k, y, d) || g.lit[m.at(k + DX[d], y + DY[d])] !== 1) continue;
        x.moveTo(HALF + k * HALF, HALF + y * HALF);
        x.lineTo(HALF + (k + DX[d]) * HALF, HALF + (y + DY[d]) * HALF);
      }
    }
    for (const [w, c] of clearing ? [[2.4, 'rgba(255,255,255,.9)']] as const : [[22, 'rgba(40,50,90,.16)'], [18, '#fff4d2']] as const) {
      x.lineWidth = w;
      x.strokeStyle = c;
      x.stroke();
    }
  }

  private stars(g: Game, t: Theme, clearing: boolean): void {
    const x = this.x, m = g.maze, dark = darkStar(t.hole, t.lip), lit = litStar();
    for (let y = 0; y < m.h; y++) for (let k = 0; k < m.w; k++) {
      if (!m.isOpen(k, y)) continue;
      const on = g.lit[m.at(k, y)] === 1, px = HALF + k * HALF, py = HALF + y * HALF;
      if (!on) {
        if (!clearing) put(x, dark, px, py);
        continue;
      }
      const wob = this.calm ? 0 : Math.sin(this.time * 0.06 + k * 1.7 + y * 2.3);
      if (clearing) {
        const s = 1 + 0.35 * Math.abs(Math.sin(this.time * 0.07 + k + y));
        x.save();
        x.translate(px, py);
        x.scale(s, s);
        put(x, lit);
        x.restore();
      } else x.drawImage(lit.img, px - lit.w / 2 - wob * 0.3, py - lit.h / 2 - wob * 0.6, lit.w, lit.h);
    }
  }

  private winds(g: Game): void {
    const x = this.x, m = g.maze, move = this.calm ? 0.5 : (this.time * 0.03) % 1;
    for (let i = 0; i < g.flow.length; i++) {
      const f = g.flow[i] ?? 0;
      if (f === 0) continue;
      const d = (f - 1) as Dir, k = i % m.w, y = Math.floor(i / m.w);
      if (!m.can(k, y, d)) continue;
      x.save();
      x.translate(HALF + (k + DX[d] * move) * HALF, HALF + (y + DY[d] * move) * HALF);
      x.rotate((d * Math.PI) / 2);
      x.globalAlpha = 0.62 * Math.sin(Math.PI * move) + 0.1;
      put(x, wind());
      x.restore();
    }
  }

  private matchAt(px: number, py: number): void {
    const x = this.x;
    halo(x, px, py - 8, 30 + Math.sin(this.time * 0.12) * 3, '255,230,130', 0.8);
    x.save();
    x.translate(px, py + Math.sin(this.time * 0.07) * 1.6);
    x.rotate(Math.sin(this.time * 0.05) * 0.14);
    x.scale(0.95, 0.95);
    put(x, match());
    x.restore();
  }

  private foe(g: Game, f: Game['foes'][number]): void {
    const x = this.x, out = g.isOut(f) || g.phase === Phase.Hit;
    if (f.kind === Kind.Echo && f.state === 0) {
      // Its place is marked while it gathers itself.
      if (g.trail.length > ECHO_DELAY - 120 && f.daze === 0) halo(x, HALF + g.homeX * HALF, HALF + g.homeY * HALF, 24 + 6 * Math.sin(this.time * 0.2), '60,30,110', 0.8);
      return;
    }
    if (!out && f.wake - g.playT > 300) return;
    const px = unitX(f), py = unitY(f);
    x.save();
    x.translate(px, py);
    if (!out) x.globalAlpha = 0.45 + 0.15 * Math.sin(this.time * 0.12);
    const left = f.dir === 2 || (f.dir !== 0 && unitX(g.hero) < px);
    drawFoe(x, { kind: f.kind, t: this.time + f.n * 11, state: f.state, look: Math.atan2(unitY(g.hero) - py, unitX(g.hero) - px), dazed: f.daze > 0, left, moving: f.dir >= 0 && out });
    if (f.daze > 0 && (f.daze > 70 || f.daze % 14 < 8)) for (let k = 0; k < 3; k++) {
      const a = this.time * 0.09 + (k * TAU) / 3;
      x.save();
      x.translate(Math.cos(a) * 17, -22 + Math.sin(a) * 5);
      x.scale(0.62, 0.62);
      put(x, litStar());
      x.restore();
    }
    x.restore();
  }

  private beam(g: Game): void {
    if (g.beamT === 0 || !g.beam) return;
    const x = this.x, k = g.beamT / 34, bx = HALF + g.beam.x * HALF, by = HALF + g.beam.y * HALF;
    x.lineCap = 'round';
    for (const [w, c, a] of [[40, '255,236,150', 0.45], [26, '255,246,200', 0.75], [9, '255,255,255', 1]] as const) {
      x.lineWidth = w * (0.4 + 0.6 * k);
      x.strokeStyle = `rgba(${c},${a * Math.min(1, k * 1.6)})`;
      for (const d of DIRS) {
        const n = g.beam.reach[d];
        if (n === 0) continue;
        x.beginPath();
        x.moveTo(bx, by);
        x.lineTo(bx + DX[d] * n * HALF, by + DY[d] * n * HALF);
        x.stroke();
      }
    }
  }

  private hero(g: Game): void {
    if (g.phase === Phase.Hit || g.phase === Phase.Over) return;
    const x = this.x, h = g.hero;
    if (h.dir === 0) this.left = false;
    if (h.dir === 2) this.left = true;
    const px = unitX(h), py = unitY(h);
    x.save();
    x.translate(px, py);
    if (g.inv > 0 && g.inv % 12 < 5) x.globalAlpha = 0.5;
    x.scale(0.98, 0.98);
    drawHero(x, { t: this.time, moving: h.dir >= 0, slow: g.slow > 0, left: this.left });
    x.restore();
    if (g.inv > 0) {
      x.lineWidth = 2.4;
      x.setLineDash([6, 5]);
      x.lineDashOffset = -this.time * 0.4;
      x.strokeStyle = '#fff6cf';
      x.beginPath();
      x.arc(px, py, 27, 0, TAU);
      x.stroke();
      x.setLineDash([]);
    }
    if (g.slow > 0) {
      x.globalAlpha = Math.min(1, g.slow / 40);
      put(x, web(), px, py);
      x.globalAlpha = 1;
    }
  }

  /** Scraps of paper, rings and words. */
  private loose(dt: number): void {
    const x = this.x;
    this.scraps = this.scraps.filter((b) => {
      b.life -= dt;
      if (b.life <= 0) return false;
      b.vx *= Math.pow(0.965, dt);
      b.vy = b.vy * Math.pow(0.965, dt) + 0.045 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.turn += b.spin * dt;
      x.save();
      x.translate(b.x, b.y);
      x.rotate(b.turn);
      x.scale(1, Math.abs(Math.cos(b.turn * 1.7)) * 0.8 + 0.2);
      x.globalAlpha = Math.min(1, (b.life / b.max) * 2);
      x.fillStyle = b.color;
      x.fillRect(-b.size / 2, -b.size * 0.35, b.size, b.size * 0.7);
      x.restore();
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      if (r.life <= 0) return false;
      const k = 1 - r.life / r.max;
      x.globalAlpha = 1 - k;
      x.lineWidth = 4 * (1 - k) + 1;
      x.setLineDash([9, 7]);
      x.strokeStyle = r.color;
      x.beginPath();
      x.arc(r.x, r.y, r.r1 * (1 - Math.pow(1 - k, 2.4)), 0, TAU);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
      return true;
    });
    x.textAlign = 'center';
    x.lineJoin = 'round';
    this.notes = this.notes.filter((n) => {
      n.life -= dt;
      if (n.life <= 0) return false;
      n.y -= 0.35 * dt;
      x.globalAlpha = Math.min(1, (n.life / n.max) * 2);
      x.font = `bold 17px ${SERIF}`;
      const tx = Math.max(70, Math.min(this.w - 70, n.x)), ty = Math.max(22, n.y);
      x.lineWidth = 5;
      x.strokeStyle = '#fffdf6';
      x.strokeText(n.text, tx, ty);
      x.fillStyle = n.color;
      x.fillText(n.text, tx, ty);
      return true;
    });
    x.globalAlpha = 1;
  }
}
