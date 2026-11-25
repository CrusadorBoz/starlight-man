// Starkindle: everything on the canvas.

import { drawFoe, drawHero, faces } from './creatures.ts';
import { ECHO_DELAY } from './foes.ts';
import { STEP, unitX, unitY } from './game.ts';
import type { Game } from './game.ts';
import { CELL, DIRS, DX, DY, HALF, ROWS } from './maze.ts';
import type { Dir, Maze } from './maze.ts';
import { SS, TAU, context, glow, lin, path, put, rad, sprite } from './paint.ts';
import type { Ctx, Sprite } from './paint.ts';
import { makeGalaxy, makePlanet, makeSky, seeded } from './sky.ts';
import { Ev, Kind, Phase } from './types.ts';
import type { GameEvent, Mover } from './types.ts';

export const H = ROWS * CELL;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface Stone { readonly dark: string; readonly mid: string; readonly light: string; readonly edge: string; readonly rgb: string }
/** Which of the three looks a sky has: blue first, then moonstone, then amethyst. */
const armOf = (level: number): number => (Math.floor((level - 1) / 3) + 1) % 3;

/** The crystal each look's walls are cut from: amethyst, aquamarine, moonstone. */
const STONES: readonly [Stone, Stone, Stone] = [
  { dark: '#34123f', mid: '#8a3f9c', light: '#f0b6ff', edge: '#fff0ff', rgb: '220,120,255' },
  { dark: '#06384a', mid: '#178a96', light: '#9ff5ea', edge: '#f0fffd', rgb: '80,230,230' },
  { dark: '#1f2a63', mid: '#5a76cf', light: '#d3e2ff', edge: '#ffffff', rgb: '150,180,255' },
];

interface Wall { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; readonly max: number; readonly rgb: string; readonly size: number }
interface Ring { readonly x: number; readonly y: number; readonly rgb: string; readonly r1: number; life: number; readonly max: number; readonly w: number }
interface Note { readonly x: number; y: number; readonly text: string; readonly color: string; life: number; readonly max: number }
interface Dot { x: number; y: number; readonly z: number; readonly tw: number }

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

/** The whole maze, drawn once per sky: a floor of shade and walls of cut crystal. */
function drawMaze(m: Maze, level: number, pixels: number): HTMLCanvasElement {
  const img = document.createElement('canvas'), W = m.cols * CELL;
  img.width = Math.round(W * pixels);
  img.height = Math.round(H * pixels);
  const x = context(img), stone = STONES[armOf(level)] ?? STONES[1], r = seeded(level * 97 + m.cols);
  x.scale(img.width / W, img.height / H);
  x.lineCap = x.lineJoin = 'round';
  x.fillStyle = 'rgba(6,18,64,.24)';
  x.fillRect(0, 0, W, H);
  const walls = wallsOf(m);
  const all = (width: number, color: string, ox = 0, oy = 0): void => {
    x.lineWidth = width;
    x.strokeStyle = color;
    x.beginPath();
    for (const w of walls) { x.moveTo(w.x1 + ox, w.y1 + oy); x.lineTo(w.x2 + ox, w.y2 + oy); }
    x.stroke();
  };
  all(26, `rgba(${stone.rgb},.10)`);
  all(19, 'rgba(3,8,28,.5)', 1.5, 2.5);
  all(14, stone.dark);
  all(10, stone.mid);
  x.globalAlpha = 0.85;
  all(3.4, stone.light, -1.6, -1.9);
  x.globalAlpha = 1;
  all(1, stone.edge, -2.1, -2.5);
  for (const w of walls) { // facets
    const along = w.y1 === w.y2;
    for (let k = 0; k < 3; k++) {
      const t = 8 + r() * (CELL - 16), s = 2.5 + r() * 4;
      const px = along ? w.x1 + t : w.x1 + (r() - 0.5) * 6, py = along ? w.y1 + (r() - 0.5) * 6 : w.y1 + t;
      x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.12 + r() * 0.3})` : `rgba(8,14,50,${0.12 + r() * 0.22})`;
      path(x, along ? [[px - s, py], [px, py - 3], [px + s, py + 1], [px, py + 3]] : [[px, py - s], [px + 3, py], [px - 1, py + s], [px - 3, py]]);
      x.fill();
    }
  }
  const posts = new Map<string, readonly [number, number]>();
  for (const w of walls) for (const p of [[w.x1, w.y1], [w.x2, w.y2]] as const) posts.set(p.join(), p);
  for (let c = 1; c < m.cols; c++) for (let q = 1; q < ROWS; q++) posts.set([c * CELL, q * CELL].join(), [c * CELL, q * CELL]);
  for (const [px, py] of posts.values()) { // a cut gem on every corner
    const s = 8.5 + r() * 3.5, turn = r() * TAU;
    const pts = Array.from({ length: 6 }, (_, i) => [px + Math.cos(turn + (i * TAU) / 6) * s, py + Math.sin(turn + (i * TAU) / 6) * s * 0.92] as const);
    x.fillStyle = rad(x, px - s * 0.35, py - s * 0.4, 0.5, s * 1.5, stone.edge, stone.light, stone.mid, stone.dark);
    path(x, pts);
    x.fill();
    x.lineWidth = 0.9;
    x.strokeStyle = stone.light;
    x.stroke();
    x.globalAlpha = 0.5;
    x.beginPath();
    for (const p of pts) { x.moveTo(px - s * 0.15, py - s * 0.2); x.lineTo(p[0], p[1]); }
    x.stroke();
    x.globalAlpha = 1;
  }
  return img;
}

// ---- small things -----------------------------------------------------------------

function darkStar(x: Ctx): void {
  path(x, [[0, -4.2], [3.2, 0], [0, 4.2], [-3.2, 0]]);
  x.fillStyle = 'rgba(150,175,225,.30)';
  x.fill();
  x.lineWidth = 1.1;
  x.strokeStyle = 'rgba(205,222,255,.85)';
  x.stroke();
}
function litStar(x: Ctx): void {
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 13);
  g.addColorStop(0, 'rgba(255,236,170,.85)');
  g.addColorStop(0.3, 'rgba(255,200,90,.34)');
  g.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = g;
  x.fillRect(-14, -14, 28, 28);
  x.fillStyle = '#fffbe6';
  x.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8, r = k % 2 ? 1.5 : 6; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.fill();
}
function prismArt(x: Ctx): void {
  path(x, [[0, -12], [11, 8], [-11, 8]]);
  x.fillStyle = lin(x, -10, 6, 10, -8, '#7fe9ff', '#ffffff', '#ff9de0', '#ffe28a');
  x.fill();
  x.lineWidth = 1.6;
  x.strokeStyle = '#ffffff';
  x.stroke();
  x.lineWidth = 0.8;
  x.strokeStyle = 'rgba(40,60,140,.6)';
  x.beginPath();
  x.moveTo(0, -12); x.lineTo(2, 2); x.lineTo(11, 8);
  x.moveTo(2, 2); x.lineTo(-11, 8);
  x.stroke();
}
function webArt(x: Ctx): void {
  x.lineWidth = 1;
  x.strokeStyle = 'rgba(205,255,205,.95)';
  for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); x.stroke(); }
  for (const r of [6, 11, 16]) {
    x.beginPath();
    for (let k = 0; k <= 8; k++) { const a = (k * TAU) / 8, b = a - TAU / 16; if (k) x.quadraticCurveTo(Math.cos(b) * r * 0.82, Math.sin(b) * r * 0.82, Math.cos(a) * r, Math.sin(a) * r); else x.moveTo(r, 0); }
    x.stroke();
  }
}
function wormArt(x: Ctx): void {
  x.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 40; i++) {
    const t = i / 40, a = (arm * TAU) / 3 + t * 4.6, d = 4 + t * 20, s = 5 * (1 - t) + 2, px = Math.cos(a) * d, py = Math.sin(a) * d;
    x.fillStyle = rad(x, px, py, 0, s, `rgba(150,210,255,${0.5 * (1 - t)})`, 'rgba(150,120,255,0)');
    x.fillRect(px - s, py - s, s * 2, s * 2);
  }
}
function chevron(x: Ctx): void {
  x.lineWidth = 3;
  x.strokeStyle = 'rgba(170,225,255,.9)';
  path(x, [[-5, -7], [3, 0], [-5, 7]], false);
  x.stroke();
}

// ---- the renderer ---------------------------------------------------------------------

export class Renderer {
  private readonly c: HTMLCanvasElement;
  private readonly x: Ctx;
  /** prefers-reduced-motion */
  private readonly calm: boolean;
  private readonly galaxy = makeGalaxy();
  private w = 10 * CELL;
  private skies: HTMLCanvasElement[] = [];
  private dots: Dot[] = [];
  private maze: HTMLCanvasElement | null = null;
  private mazeOf: Maze | null = null;
  private bits: Bit[] = [];
  private rings: Ring[] = [];
  private notes: Note[] = [];
  private shake = 0;
  private flash = 0;
  private time = 0;
  private scroll = 0;
  /** Where the hero was pointing, so it keeps facing that way when it stops. */
  private angle = 0;

  constructor(canvas: HTMLCanvasElement, calm: boolean) {
    this.c = canvas;
    this.x = context(canvas, { alpha: false });
    this.calm = calm;
    this.resize(this.w);
  }

  /** Make the sky w units wide. */
  resize(w: number): void {
    this.w = w;
    this.skies = [];
    this.maze = null;
    this.dots = Array.from({ length: Math.round(w / 5) }, () => ({ x: Math.random() * w, y: Math.random() * H, z: Math.random(), tw: Math.random() * TAU }));
  }
  /** Draw with this many canvas pixels to the unit; true if that changed (and wiped) the canvas. */
  sharpness(pixels: number): boolean {
    const w = Math.round(this.w * pixels), h = Math.round(H * pixels);
    if (this.c.width === w && this.c.height === h) return false;
    this.c.width = w;
    this.c.height = h;
    this.maze = null;
    return true;
  }
  reset(): void {
    this.bits = [];
    this.rings = [];
    this.notes = [];
    this.shake = this.flash = this.angle = 0;
    this.maze = null;
  }

  private burst(px: number, py: number, rgb: string, n: number, speed: number, life = 40, size = 2.4): void {
    if (this.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.bits.length < 560; i++) {
      const a = Math.random() * TAU, s = speed * rand(0.25, 1.15);
      this.bits.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.2), max: life, rgb, size: size * rand(0.6, 1.3) });
    }
  }
  private ring(px: number, py: number, rgb: string, r1: number, life = 26, w = 3): void { this.rings.push({ x: px, y: py, rgb, r1, life, max: life, w }); }
  private note(px: number, py: number, text: string, color: string): void { this.notes.push({ x: px, y: py, text, color, life: 58, max: 58 }); }

  /** Turn this frame's events into light. */
  events(list: readonly GameEvent[]): void {
    for (const e of list) {
      const { x: px, y: py } = e;
      switch (e.kind) {
        case Ev.Star: this.burst(px, py, '255,220,130', 4, 1.5, 22, 1.5); break;
        case Ev.Streak: this.note(px, py - 18, `STREAK ×${e.v}`, '#ffe08a'); this.ring(px, py, '255,215,120', 44, 22, 2); break;
        case Ev.Prism: this.burst(px, py, '190,230,255', 22, 2.8, 36); this.ring(px, py, '220,240,255', 52, 28, 3); this.note(px, py - 18, 'FLARE READY', '#dff6ff'); break;
        case Ev.Flare: this.flash = Math.max(this.flash, 0.22); this.ring(px, py, '255,240,190', 120, 30, 5); if (!this.calm) this.shake = Math.max(this.shake, 5); break;
        case Ev.Daze: this.burst(px, py, '255,245,200', 22, 3.4, 34); this.note(px, py - 18, `DAZED +${e.v}`, '#fff2b8'); break;
        case Ev.Hit: this.flash = 0.5; if (!this.calm) this.shake = 16; this.burst(px, py, '255,190,90', 80, 5.5, 70, 3.2); this.burst(px, py, '120,220,255', 50, 4, 60, 2.6); this.ring(px, py, '255,220,150', 130, 44, 6); break;
        case Ev.CometGot: this.burst(px, py, '180,255,240', 50, 4.4, 52, 2.8); this.ring(px, py, '190,255,240', 80, 34, 4); this.note(px, py - 18, `COMET +${e.v.toLocaleString('en-US')}`, '#c8fff3'); break;
        case Ev.Comet: this.ring(px, py, '180,255,240', 70, 40, 3); break;
        case Ev.Snuff: this.burst(px, py, '120,110,140', 6, 1.2, 30, 2); break;
        case Ev.Caught: this.burst(px, py, '220,205,240', 26, 3.2, 40); this.note(px, py - 18, `CAUGHT +${e.v}`, '#f0e6ff'); break;
        case Ev.Stuck: this.burst(px, py, '190,255,190', 12, 2, 26); this.note(px, py - 18, 'STUCK', '#c8ffcd'); break;
        case Ev.Warp: this.burst(px, py, '170,180,255', 26, 3.4, 36); this.ring(px, py, '170,200,255', 54, 28, 4); break;
        case Ev.Tell: this.ring(px, py, '255,90,60', 40, 24, 3); break;
        case Ev.Charge: this.burst(px, py, '255,120,80', 14, 2.6, 26); break;
        case Ev.Spark: this.note(px, py - 24, 'EXTRA SPARK', '#ffd66b'); this.ring(px, py, '255,210,110', 80, 36, 4); break;
        default: break;
      }
    }
  }

  private background(level: number, dim: boolean, dt: number): void {
    const x = this.x, arm = armOf(level);
    this.scroll += 0.16 * dt * (this.calm ? 0.3 : 1);
    const off = this.scroll % (H * 2), sky = (this.skies[arm] ??= makeSky(arm, this.w));
    x.drawImage(sky, 0, off - H * 2, this.w, H * 2);
    x.drawImage(sky, 0, off, this.w, H * 2);
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = dim ? 0.3 : 0.85;
    x.translate(dim ? this.w * 0.7 : this.w / 2, dim ? 210 : 270);
    x.rotate(-0.45);
    x.scale(1, 0.6);
    x.rotate(this.time * (this.calm ? 0.0002 : 0.0011));
    const gs = (dim ? 420 : 560) + (this.w - 448) * 0.4;
    x.drawImage(this.galaxy, -gs / 2, -gs / 2, gs, gs);
    x.restore();
    if (dim) {
      const r = seeded(level * 17 + 3);
      x.globalAlpha = 0.5;
      put(x, makePlanet(level, arm), this.w * (r() < 0.5 ? 0.12 : 0.88), 150 + r() * 320);
      x.globalAlpha = 1;
    }
    for (const d of this.dots) {
      x.fillStyle = `rgba(230,240,255,${(0.3 + d.z * 0.5) * (0.7 + 0.3 * Math.sin(this.time * 0.05 + d.tw))})`;
      x.fillRect(d.x, d.y, 0.8 + d.z, 0.8 + d.z);
    }
  }

  /** Draw one frame; null draws the title scene. dt is in ticks. */
  draw(g: Game | null, dt: number): void {
    const x = this.x;
    this.time += dt;
    x.setTransform(this.c.width / this.w, 0, 0, this.c.height / H, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    if (this.shake > 0.2) {
      x.translate(rand(-0.5, 0.5) * this.shake, rand(-0.5, 0.5) * this.shake);
      this.shake *= Math.pow(0.88, dt);
    }
    this.background(g?.level ?? 1, g !== null, dt);
    if (!g) {
      this.titleScene();
      return;
    }
    if (!this.maze || this.mazeOf !== g.maze) {
      this.maze = drawMaze(g.maze, g.level, this.c.width / this.w);
      this.mazeOf = g.maze;
    }
    const clearing = g.phase === Phase.Clear || g.phase === Phase.Pick || g.phase === Phase.Won;
    const fade = clearing ? Math.max(0.12, 1 - (g.phase === Phase.Clear ? g.phaseT : 200) / 110) : g.phase === Phase.Ready ? Math.min(1, g.phaseT / 45) : 1;
    x.globalAlpha = fade;
    x.drawImage(this.maze, 0, 0, this.w, H);
    x.globalAlpha = 1;
    this.streams(g);
    this.stars(g, clearing);
    if (!clearing) {
      if (g.worm) for (const i of g.worm) this.worm((i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF);
      for (const [i, t] of g.webs) {
        x.globalAlpha = Math.min(1, t / 120);
        put(x, sprite('web', 46, 46, webArt), (i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF);
        x.globalAlpha = 1;
      }
      for (const i of g.prisms) this.prism((i % g.maze.w) * HALF + HALF, Math.floor(i / g.maze.w) * HALF + HALF);
      if (g.comet) this.comet(g.comet, g.comet.life);
      for (const f of g.foes) this.foe(g, f);
      this.beam(g);
    }
    this.hero(g);
    this.particles(dt);
    if (this.flash > 0.01) {
      x.fillStyle = `rgba(255,246,222,${this.calm ? this.flash * 0.3 : this.flash})`;
      x.fillRect(-20, -20, this.w + 40, H + 40);
      this.flash *= Math.pow(0.86, dt);
    }
  }

  private titleScene(): void {
    const x = this.x, t = this.time, cx = this.w / 2, cy = 404;
    for (let i = 0; i < 22; i++) { // a ring of stars being lit
      const a = (i * TAU) / 22 - Math.PI / 2, on = ((t * 0.05) % 30) > i;
      put(x, sprite(on ? 'lit' : 'dark', 28, 28, on ? litStar : darkStar), cx + Math.cos(a) * 185, cy + Math.sin(a) * 84);
    }
    const a = (Math.min(22, (t * 0.05) % 30) / 22) * TAU - Math.PI / 2;
    x.save();
    x.translate(cx + Math.cos(a) * 185, cy + Math.sin(a) * 84);
    x.rotate(Math.atan2(Math.cos(a) * 84, -Math.sin(a) * 185) + Math.PI / 2);
    x.scale(1.9, 1.9);
    drawHero(x, { t, moving: !this.calm, slow: false });
    x.restore();
  }

  private stars(g: Game, clearing: boolean): void {
    const x = this.x, m = g.maze, dark = sprite('dark', 28, 28, darkStar), lit = sprite('lit', 28, 28, litStar);
    // The lit path glows.
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.lineCap = 'round';
    x.lineWidth = clearing ? 4 : 15;
    const swell = clearing ? 0.5 + 0.4 * Math.sin(this.time * 0.09) : 0.15;
    x.strokeStyle = `rgba(255,206,110,${swell})`;
    x.beginPath();
    for (let y = 0; y < m.h; y++) for (let k = 0; k < m.w; k++) {
      if (g.lit[m.at(k, y)] !== 1) continue;
      for (const d of [0, 1] as const) {
        if (!m.can(k, y, d) || g.lit[m.at(k + DX[d], y + DY[d])] !== 1) continue;
        x.moveTo(HALF + k * HALF, HALF + y * HALF);
        x.lineTo(HALF + (k + DX[d]) * HALF, HALF + (y + DY[d]) * HALF);
      }
    }
    x.stroke();
    x.restore();
    const up = clearing && g.phase === Phase.Clear && !this.calm ? Math.min(1, g.phaseT / 190) : 0;
    for (let y = 0; y < m.h; y++) for (let k = 0; k < m.w; k++) {
      if (!m.isOpen(k, y)) continue;
      const on = g.lit[m.at(k, y)] === 1;
      if (!on && clearing) continue;
      const tw = on ? 0.82 + 0.18 * Math.sin(this.time * 0.07 + k * 1.7 + y * 2.3) : 0.75;
      x.globalAlpha = tw;
      put(x, on ? lit : dark, HALF + k * HALF, HALF + y * HALF - up * up * 14 * Math.sin(k + y));
    }
    x.globalAlpha = 1;
  }

  private streams(g: Game): void {
    const x = this.x, m = g.maze, art = sprite('chev', 16, 20, chevron), move = this.calm ? 0.5 : (this.time * 0.03) % 1;
    for (let i = 0; i < g.flow.length; i++) {
      const f = g.flow[i] ?? 0;
      if (f === 0) continue;
      const d = (f - 1) as Dir, k = i % m.w, y = Math.floor(i / m.w);
      if (!m.can(k, y, d)) continue;
      x.save();
      x.translate(HALF + (k + DX[d] * move) * HALF, HALF + (y + DY[d] * move) * HALF);
      x.rotate((d * Math.PI) / 2);
      x.globalAlpha = 0.5 * Math.sin(Math.PI * move) + 0.12;
      put(x, art);
      x.restore();
    }
  }

  private worm(px: number, py: number): void {
    const x = this.x;
    x.save();
    x.translate(px, py);
    glow(x, 0, 0, 30, '140,160,255', 0.8);
    x.rotate(-this.time * (this.calm ? 0.01 : 0.06));
    put(x, sprite('worm', 56, 56, wormArt));
    x.restore();
    x.fillStyle = '#05041a';
    x.beginPath(); x.arc(px, py, 5.5, 0, TAU); x.fill();
    x.lineWidth = 1.6;
    x.strokeStyle = '#cfe0ff';
    x.stroke();
  }

  private prism(px: number, py: number): void {
    const x = this.x;
    glow(x, px, py, 27 + Math.sin(this.time * 0.1) * 4, '200,225,255', 0.85);
    x.save();
    x.translate(px, py + Math.sin(this.time * 0.07) * 2);
    x.rotate(Math.sin(this.time * 0.04) * 0.3);
    put(x, sprite('prism', 30, 30, prismArt));
    x.restore();
  }

  private comet(c: Mover, life: number): void {
    const x = this.x, px = unitX(c), py = unitY(c);
    if (life < 120 && life % 16 < 6) return;
    glow(x, px, py, 30, '140,255,235', 0.95);
    x.save();
    x.translate(px, py);
    x.rotate(this.time * 0.06);
    for (let k = 0; k < 6; k++) {
      x.rotate(TAU / 6);
      path(x, [[0, -4], [4, -9], [0, -17], [-4, -9]]);
      x.fillStyle = k % 2 ? '#9ffbea' : '#ffe9a8';
      x.fill();
    }
    x.fillStyle = rad(x, -1, -1, 0, 7, '#ffffff', '#c9fff5', '#3fc7b5');
    x.beginPath(); x.arc(0, 0, 6, 0, TAU); x.fill();
    x.restore();
  }

  private foe(g: Game, f: Game['foes'][number]): void {
    const x = this.x, out = g.isOut(f) || g.phase === Phase.Hit;
    if (f.kind === Kind.Echo && f.state === 0) {
      // Its place is marked while it gathers itself.
      if (g.trail.length > ECHO_DELAY - 120 && f.daze === 0) glow(x, HALF + g.homeX * HALF, HALF + g.homeY * HALF, 18 + 8 * Math.sin(this.time * 0.2), '190,110,255', 0.7);
      return;
    }
    const px = unitX(f), py = unitY(f);
    x.save();
    x.translate(px, py);
    if (!out) x.globalAlpha = f.wake - g.playT > 300 ? 0 : 0.35 + 0.15 * Math.sin(this.time * 0.12);
    if (x.globalAlpha > 0.01) {
      const face = faces(f.kind) && f.dir >= 0 ? (f.dir * Math.PI) / 2 + Math.PI / 2 : 0;
      x.save();
      x.rotate(face);
      x.scale(0.96, 0.96);
      drawFoe(x, { kind: f.kind, t: this.time, state: f.state, look: Math.atan2(unitY(g.hero) - py, unitX(g.hero) - px), dazed: f.daze > 0 });
      x.restore();
      if (f.daze > 0 && (f.daze > 70 || f.daze % 14 < 8)) for (let k = 0; k < 4; k++) {
        const a = this.time * 0.09 + (k * TAU) / 4;
        put(x, sprite('lit', 28, 28, litStar), Math.cos(a) * 17, -8 + Math.sin(a) * 7);
      }
    }
    x.restore();
  }

  private beam(g: Game): void {
    if (g.beamT === 0 || !g.beam) return;
    const x = this.x, k = g.beamT / 34, bx = HALF + g.beam.x * HALF, by = HALF + g.beam.y * HALF;
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.lineCap = 'round';
    for (const d of DIRS) {
      const n = g.beam.reach[d];
      if (n === 0) continue;
      const ex = bx + DX[d] * n * HALF, ey = by + DY[d] * n * HALF;
      for (const [w, c, a] of [[34, '255,190,80', 0.22], [18, '255,225,150', 0.5], [6, '255,255,245', 1]] as const) {
        x.lineWidth = w * (0.35 + 0.65 * k);
        x.strokeStyle = `rgba(${c},${a * k})`;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
      }
      glow(x, ex, ey, 26, '255,220,140', k);
    }
    x.restore();
  }

  private hero(g: Game): void {
    if (g.phase === Phase.Hit || g.phase === Phase.Over) return;
    const x = this.x, h = g.hero;
    if (h.dir >= 0) {
      const to = (h.dir * Math.PI) / 2 + Math.PI / 2;
      let turn = (to - this.angle) % TAU;
      if (turn > Math.PI) turn -= TAU;
      if (turn < -Math.PI) turn += TAU;
      this.angle += turn * 0.4;
    }
    const px = unitX(h), py = unitY(h);
    glow(x, px, py, 64, '255,205,120', 0.34); // it lights the walls around it
    if (g.phase === Phase.Play && h.dir >= 0 && Math.random() < 0.6 && this.bits.length < 400) {
      this.bits.push({ x: px - DX[h.dir as Dir] * 15, y: py - DY[h.dir as Dir] * 15, vx: rand(-0.4, 0.4) - DX[h.dir as Dir] * 0.8, vy: rand(-0.4, 0.4) - DY[h.dir as Dir] * 0.8, life: 24, max: 24, rgb: '110,200,255', size: 1.7 });
    }
    x.save();
    x.translate(px, py);
    if (g.inv > 0 && g.inv % 12 < 5) x.globalAlpha = 0.45;
    x.rotate(this.angle);
    x.scale(0.96, 0.96);
    drawHero(x, { t: this.time, moving: h.dir >= 0 && h.p < STEP, slow: g.slow > 0 });
    x.restore();
    if (g.inv > 0) {
      x.lineWidth = 2;
      x.strokeStyle = `rgba(160,225,255,${0.35 + 0.3 * Math.sin(this.time * 0.2)})`;
      x.beginPath(); x.arc(px, py, 25, 0, TAU); x.stroke();
    }
    if (g.slow > 0) {
      x.globalAlpha = Math.min(1, g.slow / 40);
      put(x, sprite('web', 46, 46, webArt), px, py);
      x.globalAlpha = 1;
    }
  }

  private particles(dt: number): void {
    const x = this.x;
    x.save();
    x.globalCompositeOperation = 'lighter';
    this.bits = this.bits.filter((b) => {
      b.life -= dt;
      if (b.life <= 0) return false;
      const drag = Math.pow(0.96, dt);
      b.vx *= drag;
      b.vy *= drag;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      glow(x, b.x, b.y, b.size * 2.2, b.rgb, Math.min(1, (b.life / b.max) * 1.2));
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      if (r.life <= 0) return false;
      const k = 1 - r.life / r.max;
      x.lineWidth = r.w * (1 - k) + 0.4;
      x.strokeStyle = `rgba(${r.rgb},${(1 - k) * 0.9})`;
      x.beginPath(); x.arc(r.x, r.y, r.r1 * (1 - Math.pow(1 - k, 2.4)), 0, TAU); x.stroke();
      return true;
    });
    x.restore();
    x.textAlign = 'center';
    this.notes = this.notes.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) return false;
      t.y -= 0.35 * dt;
      x.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      x.font = '800 14px Inter, system-ui, sans-serif';
      const tx = Math.max(70, Math.min(this.w - 70, t.x)), ty = Math.max(20, t.y);
      x.lineWidth = 4;
      x.strokeStyle = 'rgba(8,16,48,.9)';
      x.strokeText(t.text, tx, ty);
      x.fillStyle = t.color;
      x.fillText(t.text, tx, ty);
      return true;
    });
    x.globalAlpha = 1;
  }
}

/** Canvas pixels to the unit, at most. */
export const SHARPEST = SS;
export type { Sprite };
