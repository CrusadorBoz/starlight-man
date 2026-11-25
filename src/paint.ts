// Starkindle: drawing helpers, shared by the art.

export type Ctx = CanvasRenderingContext2D;
export type Pt = readonly [x: number, y: number];
/** A cached drawing and its size in units. */
export interface Sprite { readonly img: HTMLCanvasElement; readonly w: number; readonly h: number }

export const SS = 2; // canvas pixels per game unit

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
    img.width = Math.ceil(w * SS);
    img.height = Math.ceil(h * SS);
    const x = context(img);
    x.scale(SS, SS);
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

/** A soft additive glow. rgb is "r,g,b". */
export function glow(x: Ctx, px: number, py: number, r: number, rgb: string, a = 1): void {
  if (a <= 0 || r <= 0) return;
  const s = sprite('glow' + rgb, 64, 64, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, `rgba(${rgb},.95)`);
    g.addColorStop(0.18, `rgba(${rgb},.55)`);
    g.addColorStop(0.5, `rgba(${rgb},.16)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(-32, -32, 64, 64);
  });
  const op = x.globalCompositeOperation, ga = x.globalAlpha;
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = ga * Math.min(1, a);
  x.drawImage(s.img, px - r, py - r, r * 2, r * 2);
  x.globalCompositeOperation = op;
  x.globalAlpha = ga;
}

export function lin(x: Ctx, x0: number, y0: number, x1: number, y1: number, ...stops: string[]): CanvasGradient {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function rad(x: Ctx, cx: number, cy: number, r0: number, r1: number, ...stops: string[]): CanvasGradient {
  const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function path(x: Ctx, pts: readonly Pt[], close = true): void {
  x.beginPath();
  pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
  if (close) x.closePath();
}
