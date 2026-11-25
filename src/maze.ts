// Starkindle: the maze. Every one is generated, joined up, free of dead ends, and
// looks the same when turned upside down, like a galaxy.
//
// The maze is a grid of cells, but everything moves on a finer grid of nodes: the
// cell centres (even, even) and the gaps between them. A star sits on every node
// that can be reached.

import { Rng, clamp } from './maths.ts';

export const CELL = 64; // units
export const HALF = 32;
export const ROWS = 10;
export const MIN_COLS = 7;
export const MAX_COLS = 15;

/** Right, down, left, up. */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
const OPP = [2, 3, 0, 1] as const;
export const opposite = (d: Dir): Dir => OPP[d];

/** A straight corridor: its first node, which way it runs (0 or 1) and its length in nodes. */
export interface Run { readonly x: number; readonly y: number; readonly dir: 0 | 1; readonly len: number }

interface Edge { readonly x: number; readonly y: number; readonly a: number; readonly b: number }

export class Maze {
  readonly cols: number;
  /** Size in nodes. */
  readonly w: number;
  readonly h = 2 * ROWS - 1;
  private readonly open: Uint8Array;
  /** How many nodes can be reached: one star each. */
  readonly total: number;

  constructor(cols: number, rng: Rng) {
    this.cols = clamp(Math.round(cols) || MIN_COLS, MIN_COLS, MAX_COLS);
    this.w = 2 * this.cols - 1;
    this.open = new Uint8Array(this.w * this.h);
    for (let tries = 0; tries < 12; tries++) { // a lone pillar or two is fine, a hall of them is not
      this.open.fill(0);
      for (let y = 0; y < this.h; y += 2) for (let x = 0; x < this.w; x += 2) this.open[this.at(x, y)] = 1;
      this.carve(rng);
      if (this.pillars() <= 2) break;
    }
    this.total = this.open.reduce((n, v) => n + v, 0);
  }

  at(x: number, y: number): number { return y * this.w + x; }
  isCell(x: number, y: number): boolean { return (x & 1) === 0 && (y & 1) === 0; }
  isOpen(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.open[this.at(x, y)] === 1; }
  can(x: number, y: number, d: Dir): boolean { return this.isOpen(x + DX[d], y + DY[d]); }
  exits(x: number, y: number): Dir[] { return DIRS.filter((d) => this.can(x, y, d)); }

  /** Every cell centre. */
  cells(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.h; y += 2) for (let x = 0; x < this.w; x += 2) out.push({ x, y });
    return out;
  }

  /** Open a gap and the one opposite it, so the maze keeps its half-turn symmetry. */
  private cut(x: number, y: number): void {
    this.open[this.at(x, y)] = 1;
    this.open[this.at(this.w - 1 - x, this.h - 1 - y)] = 1;
  }

  private carve(rng: Rng): void {
    const edges: Edge[] = [];
    for (const { x, y } of this.cells()) {
      if (x + 2 < this.w) edges.push({ x: x + 1, y, a: this.at(x, y), b: this.at(x + 2, y) });
      if (y + 2 < this.h) edges.push({ x, y: y + 1, a: this.at(x, y), b: this.at(x, y + 2) });
    }
    rng.shuffle(edges);

    // Join everything up (Kruskal), two mirrored gaps at a time.
    const root = Array.from({ length: this.w * this.h }, (_, i) => i);
    const find = (i: number): number => {
      let r = i;
      for (let p = root[r] ?? r; p !== r; p = root[r] ?? r) r = p;
      root[i] = r;
      return r;
    };
    const last = this.w * this.h - 1; // node i's partner is last - i
    for (const e of edges) {
      if (find(e.a) === find(e.b)) continue;
      this.cut(e.x, e.y);
      root[find(e.a)] = find(e.b);
      root[find(last - e.a)] = find(last - e.b);
    }

    // No dead ends: nothing in here should ever be a trap with no way out.
    for (const { x, y } of rng.shuffle(this.cells())) {
      while (this.exits(x, y).length < 2) {
        const shut = DIRS.filter((d) => !this.can(x, y, d) && this.inside(x + 2 * DX[d], y + 2 * DY[d]));
        const tidy = shut.filter((d) => !this.makesRoom(x + DX[d], y + DY[d]));
        const d = rng.pick(tidy.length > 0 ? tidy : shut);
        this.cut(x + DX[d], y + DY[d]);
      }
    }

    // A few more ways through.
    let extra = Math.round(this.cols * ROWS * 0.05);
    for (const e of edges) {
      if (extra <= 0) break;
      if (this.isOpen(e.x, e.y) || this.makesRoom(e.x, e.y)) continue;
      this.cut(e.x, e.y);
      extra--;
    }
  }

  /** Posts with open space all round them. */
  private pillars(): number {
    let n = 0;
    for (let y = 1; y < this.h; y += 2) for (let x = 1; x < this.w; x += 2) if (DIRS.every((d) => this.isOpen(x + DX[d], y + DY[d]))) n++;
    return n;
  }

  private inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Would opening this gap leave a lone post with open space all round it? */
  private makesRoom(x: number, y: number): boolean {
    const posts = (x & 1) === 1 ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
    return posts.some(([px = -1, py = -1]) => px > 0 && py > 0 && px < this.w - 1 && py < this.h - 1
      && DIRS.every((d) => (px + DX[d] === x && py + DY[d] === y) || this.isOpen(px + DX[d], py + DY[d])));
  }

  /**
   * How far every node is from one node (-1 = unreachable). Nodes marked in
   * `heavy` count double, for creatures that shun them.
   */
  distances(x: number, y: number, heavy?: Uint8Array): Int16Array {
    const d = new Int16Array(this.w * this.h).fill(-1);
    d[this.at(x, y)] = 0;
    const buckets: number[][] = [[this.at(x, y)]];
    for (let k = 0; k < buckets.length; k++) {
      for (const i of buckets[k] ?? []) {
        if (d[i] !== k) continue;
        const nx = i % this.w, ny = (i - nx) / this.w;
        for (const dir of DIRS) {
          if (!this.can(nx, ny, dir)) continue;
          const j = this.at(nx + DX[dir], ny + DY[dir]);
          const far = k + (heavy?.[j] === 1 ? 2 : 1), was = d[j] ?? -1;
          if (was === -1 || far < was) {
            d[j] = far;
            (buckets[far] ??= []).push(j);
          }
        }
      }
    }
    return d;
  }

  /** Every straight corridor at least this many nodes long. */
  runs(atLeast: number): Run[] {
    const out: Run[] = [];
    for (const dir of [0, 1] as const) {
      const [lines, length] = dir === 0 ? [this.h, this.w] : [this.w, this.h];
      for (let line = 0; line < lines; line += 2) {
        let start = 0;
        for (let i = 0; i <= length; i++) {
          if (i < length && (dir === 0 ? this.isOpen(i, line) : this.isOpen(line, i))) continue;
          if (i - start >= atLeast) out.push(dir === 0 ? { x: start, y: line, dir, len: i - start } : { x: line, y: start, dir, len: i - start });
          start = i + 1;
        }
      }
    }
    return out;
  }
}
