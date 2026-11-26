// Starlight Man: the painted paper sky behind the maze. Daylight, sunset, moonlight.

import { TAU, context, grain, seeded } from './paint.ts';
import type { Ctx } from './paint.ts';

export interface Theme {
  readonly top: string; readonly bottom: string;
  /** The paper sun or moon, and the rays cut round it. */
  readonly disc: string; readonly rays: string;
  readonly hills: readonly [string, string, string];
  /** Cloud paper: the sheet on top, the sheet under it, its pencil lines, its shadow. */
  readonly cloud: string; readonly under: string; readonly line: string; readonly shadow: string;
  /** A star that is not lit: a hole punched in the sky, and its bright lower lip. */
  readonly hole: string; readonly lip: string;
}

export const THEMES: readonly [Theme, Theme, Theme] = [
  { top: '#4b8fdd', bottom: '#a9d6f8', disc: '#ffe08a', rays: 'rgba(255,255,255,.16)', hills: ['#86bdec', '#66a6e2', '#4a8fd3'], cloud: '#ffffff', under: '#cfe3f8', line: '#a5c4e6', shadow: 'rgba(22,62,126,.30)', hole: '#2b66b4', lip: 'rgba(255,255,255,.65)' },
  { top: '#7a78d2', bottom: '#f9bf9d', disc: '#ffae6b', rays: 'rgba(255,240,220,.16)', hills: ['#d795ab', '#b8789f', '#955d94'], cloud: '#fff4e8', under: '#f6d0bb', line: '#dca68f', shadow: 'rgba(84,36,96,.30)', hole: '#7c4b8c', lip: 'rgba(255,245,230,.65)' },
  { top: '#2d4a9f', bottom: '#7d9be2', disc: '#fff5d2', rays: 'rgba(220,232,255,.10)', hills: ['#4a67bd', '#3b56a8', '#2f468f'], cloud: '#eaf0ff', under: '#b7c7f1', line: '#8ea4de', shadow: 'rgba(8,18,66,.42)', hole: '#1b2f74', lip: 'rgba(220,232,255,.55)' },
];

/** Which theme a sky has: three of each. */
export const themeOf = (level: number): Theme => THEMES[Math.floor((level - 1) / 3) % 3] ?? THEMES[0];

/** A bank of cloud or a hill as a row of bumps. */
function bumps(x: Ctx, w: number, base: number, bottom: number, r: () => number, size: number): void {
  x.beginPath();
  x.moveTo(-20, bottom);
  x.lineTo(-20, base);
  for (let px = -20; px < w + 40;) {
    const s = size * (0.6 + r() * 0.8);
    x.quadraticCurveTo(px + s / 2, base - s * 0.62, px + s, base + (r() - 0.5) * size * 0.2);
    px += s;
  }
  x.lineTo(w + 60, bottom);
  x.closePath();
}

/** Draw a sky once: w x h units. `busy` adds hills and a big sun, for the title. */
export function makeSky(t: Theme, w: number, h: number, pixels: number, busy: boolean): HTMLCanvasElement {
  const img = document.createElement('canvas');
  img.width = Math.round(w * pixels);
  img.height = Math.round(h * pixels);
  const x = context(img), r = seeded(busy ? 21 : 8);
  x.scale(img.width / w, img.height / h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, t.top);
  g.addColorStop(1, t.bottom);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  const dx = busy ? w / 2 : w * 0.72, dy = busy ? h * 0.56 : h * 0.36, dr = busy ? 150 : 108;
  x.fillStyle = t.rays; // rays cut from a lighter sheet
  for (let k = 0; k < 18; k++) {
    const a = (k * TAU) / 18 + 0.08;
    x.beginPath();
    x.moveTo(dx, dy);
    x.lineTo(dx + Math.cos(a) * 1500, dy + Math.sin(a) * 1500);
    x.lineTo(dx + Math.cos(a + TAU / 36) * 1500, dy + Math.sin(a + TAU / 36) * 1500);
    x.fill();
  }
  x.globalAlpha = busy ? 1 : 0.2; // behind a maze it is only a pale patch: yellow over blue goes grey
  for (const [s, o] of [[1.22, 0.35], [1.1, 0.5], [1, 1]] as const) { // three discs, one on another
    x.save();
    x.shadowColor = 'rgba(40,40,90,.25)';
    x.shadowBlur = 8;
    x.shadowOffsetY = 3;
    x.globalAlpha *= o;
    x.fillStyle = busy ? t.disc : '#ffffff';
    x.beginPath();
    x.arc(dx, dy, dr * s, 0, TAU);
    x.fill();
    x.restore();
  }
  x.globalAlpha = 1;
  x.shadowColor = 'rgba(30,40,90,.28)';
  x.shadowBlur = 9;
  x.shadowOffsetY = -3;
  t.hills.forEach((c, i) => {
    x.globalAlpha = busy ? 1 : 0.5;
    x.fillStyle = c;
    bumps(x, w, h * (busy ? 0.74 + i * 0.085 : 0.8 + i * 0.07), h + 30, r, 150 - i * 26);
    x.fill();
  });
  x.globalAlpha = 1;
  x.shadowColor = 'transparent';
  grain(x, w, h, 0.055);
  return img;
}

/** A single paper cloud, about 2s wide, centred on 0,0. */
export function cloud(x: Ctx, t: Theme, s: number): void {
  const puffs = [[-0.75, 0.1, 0.34], [-0.3, -0.2, 0.46], [0.25, -0.14, 0.42], [0.72, 0.12, 0.33], [0, 0.18, 0.42]] as const;
  for (const [ox, oy, grow, fill] of [[2, 5, 1, t.shadow], [0, 1.5, 3, t.under], [0, 0, 0, t.cloud]] as const) {
    x.fillStyle = fill;
    x.beginPath();
    for (const [cx, cy, r] of puffs) { x.moveTo(cx * s + ox, cy * s + oy); x.arc(cx * s + ox, cy * s + oy, r * s + grow, 0, TAU); }
    x.fill();
  }
}
