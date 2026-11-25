// Starkindle: drawing helpers. Everything looks cut from paper: flat shapes, a
// white die-cut edge and a soft shadow underneath.

export type Ctx = CanvasRenderingContext2D;
export type Pt = readonly [x: number, y: number];
/** A cached drawing and its size in units. */
export interface Sprite { readonly img: HTMLCanvasElement; readonly w: number; readonly h: number }
/** One piece of paper: an SVG path and its colour. */
export type Piece = readonly [path: string, fill: string];

export const SS = 2; // canvas pixels per game unit, at most
export const TAU = Math.PI * 2;
const cache = new Map<string, Sprite>();

/** The 2D context of a canvas; every browser that runs this page has one. */
export function context(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): Ctx {
  const x = c.getContext('2d', opts);
  if (!x) throw new Error('no 2D canvas');
  return x;
}

/** A cached drawing, centred on 0,0, w x h units. */
export function sprite(key: string, w: number, h: number, draw: (x: Ctx) => void): Sprite {
  let s = cache.get(key);
  if (!s) {
    const img = document.createElement('canvas');
    img.width = Math.ceil(w * SS * 1.5);
    img.height = Math.ceil(h * SS * 1.5);
    const x = context(img);
    x.scale(SS * 1.5, SS * 1.5);
    x.translate(w / 2, h / 2);
    x.lineJoin = x.lineCap = 'round';
    draw(x);
    s = { img, w, h };
    cache.set(key, s);
  }
  return s;
}

export function put(x: Ctx, s: Sprite, px = 0, py = 0): void {
  x.drawImage(s.img, px - s.w / 2, py - s.h / 2, s.w, s.h);
}

/** A soft patch of warm light on the paper. rgb is "r,g,b". */
export function halo(x: Ctx, px: number, py: number, r: number, rgb: string, a = 1): void {
  if (a <= 0 || r <= 0) return;
  const s = sprite('halo' + rgb, 64, 64, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, `rgba(${rgb},.85)`);
    g.addColorStop(0.45, `rgba(${rgb},.35)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(-32, -32, 64, 64);
  });
  const ga = x.globalAlpha;
  x.globalAlpha = ga * Math.min(1, a);
  x.drawImage(s.img, px - r, py - r, r * 2, r * 2);
  x.globalAlpha = ga;
}

/** Draw pieces of paper as one sticker: a white edge with a shadow, then each piece on top. */
export function sticker(x: Ctx, pieces: readonly Piece[], edge = '#fffdf6', width = 4.2): void {
  x.lineJoin = x.lineCap = 'round';
  x.save();
  x.shadowColor = 'rgba(20,32,70,.45)';
  x.shadowBlur = 5;
  x.shadowOffsetY = 4;
  x.strokeStyle = edge;
  x.lineWidth = width;
  for (const [d] of pieces) x.stroke(new Path2D(d));
  x.restore();
  x.strokeStyle = edge;
  x.fillStyle = edge;
  x.lineWidth = width;
  for (const [d] of pieces) { x.stroke(new Path2D(d)); x.fill(new Path2D(d)); }
  x.lineWidth = 0.5;
  x.strokeStyle = 'rgba(30,30,70,.28)';
  for (const [d, fill] of pieces) {
    const p = new Path2D(d);
    x.fillStyle = fill;
    x.fill(p);
    x.stroke(p);
  }
}

/** A circle as an SVG path. */
export const round = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

/** A star with n points as an SVG path. */
export function starPath(n: number, outer: number, inner: number): string {
  return Array.from({ length: n * 2 }, (_, k) => {
    const a = (k * Math.PI) / n - Math.PI / 2, r = k % 2 ? inner : outer;
    return `${k ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  }).join('') + 'Z';
}

/** A small seeded generator, so each sky is always the same. */
export function seeded(n: number): () => number {
  let s = (n * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Paper grain over a picture that is already drawn. */
export function grain(x: Ctx, w: number, h: number, strength: number): void {
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const c = context(n), r = seeded(5);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * strength})` : `rgba(20,30,70,${r() * strength})`;
    c.fillRect(r() * 160, r() * 160, 1 + r() * 2.4, 0.8 + r() * 0.8);
  }
  const p = x.createPattern(n, 'repeat');
  if (!p) return;
  x.fillStyle = p;
  x.fillRect(0, 0, w, h);
}
