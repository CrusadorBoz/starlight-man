// Starkindle: the sky behind the maze. Nebula, a turning galaxy and planets.

import { TAU, context, sprite } from './paint.ts';
import type { Sprite } from './paint.ts';

const H = 640;

// A small seeded generator, so each sector's sky is always the same.
export function seeded(n: number): () => number {
  let s = (n * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

interface Sky { readonly top: string; readonly bot: string; readonly blobs: readonly string[] }
const SKIES: readonly [Sky, Sky, Sky] = [
  { top: '#3d2260', bot: '#1c3d82', blobs: ['255,122,77', '208,70,150', '98,74,220', '60,110,230'] },
  { top: '#0c3f72', bot: '#14679a', blobs: ['31,182,217', '43,108,255', '24,224,176', '90,150,255'] },
  { top: '#2b2a72', bot: '#4a3596', blobs: ['143,123,255', '91,200,255', '255,200,160', '220,110,220'] },
];

// ---- the sky --------------------------------------------------------------

export function makeSky(arm: number, W: number): HTMLCanvasElement {
  const sky = SKIES[arm] ?? SKIES[1];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H * 2;
  const x = context(c);
  const r = seeded(arm + 11);
  const g = x.createLinearGradient(0, 0, 0, H * 2);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.5, sky.bot);
  g.addColorStop(1, sky.top);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H * 2);
  const blob = (bx: number, by: number, br: number, rgb: string, a: number): void => {
    for (const oy of [-H * 2, 0, H * 2]) { // wraps top to bottom
      const b = x.createRadialGradient(bx, by + oy, 0, bx, by + oy, br);
      b.addColorStop(0, `rgba(${rgb},${a})`);
      b.addColorStop(0.5, `rgba(${rgb},${a * 0.42})`);
      b.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = b;
      x.fillRect(bx - br, by + oy - br, br * 2, br * 2);
    }
  };
  x.globalCompositeOperation = 'lighter';
  const spread = Math.round(W / 240); // a wider sky needs more of everything
  for (const rgb of [...sky.blobs, ...(spread > 2 ? sky.blobs : [])]) { // drifting banks of cloud
    let bx = r() * W, by = r() * H * 2, dir = r() * TAU;
    for (let k = 0; k < 46; k++) {
      blob(bx, by, 22 + r() * 92, rgb, 0.045 + r() * 0.055);
      dir += (r() - 0.5) * 1.1;
      bx = (bx + Math.cos(dir) * 26 + W) % W;
      by = (by + Math.sin(dir) * 26 + H * 2) % (H * 2);
    }
  }
  x.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 20 * spread; k++) blob(r() * W, r() * H * 2, 26 + r() * 60, '6,10,34', 0.06 + r() * 0.07); // dust lanes
  x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 210 * spread; k++) {
    x.fillStyle = `rgba(220,234,255,${0.1 + r() * 0.4})`;
    x.fillRect(r() * W, r() * H * 2, 0.8, 0.8);
  }
  return c;
}

export function makeGalaxy(): HTMLCanvasElement {
  const n = 620, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = context(c), r = seeded(77);
  x.translate(n / 2, n / 2);
  x.globalCompositeOperation = 'lighter';
  const core = x.createRadialGradient(0, 0, 0, 0, 0, 120);
  core.addColorStop(0, 'rgba(255,246,220,.95)');
  core.addColorStop(0.25, 'rgba(255,206,160,.4)');
  core.addColorStop(1, 'rgba(140,120,255,0)');
  x.fillStyle = core;
  x.fillRect(-n / 2, -n / 2, n, n);
  for (let i = 0; i < 4600; i++) {
    const t = Math.pow(r(), 0.7), arm = Math.floor(r() * 3);
    const a = (arm * TAU) / 3 + t * 5.4 + (r() - 0.5) * (0.85 - t * 0.4);
    const d = 14 + t * 282 + (r() - 0.5) * 26;
    const blue = t > 0.3 + r() * 0.4;
    x.fillStyle = blue ? `rgba(130,190,255,${0.16 + r() * 0.5})` : `rgba(255,214,176,${0.15 + r() * 0.5})`;
    const s = r() < 0.04 ? 2.4 : 0.6 + r() * 0.9;
    x.fillRect(Math.cos(a) * d, Math.sin(a) * d, s, s);
    if (r() < 0.03) {
      const g = x.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, 16);
      g.addColorStop(0, blue ? 'rgba(90,150,255,.16)' : 'rgba(255,140,190,.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(Math.cos(a) * d - 16, Math.sin(a) * d - 16, 32, 32);
    }
  }
  return c;
}

export function makePlanet(seed: number, arm: number): Sprite {
  const r = seeded(seed * 131 + 7);
  const R = 62 + r() * 52, ring = r() < 0.6;
  const hue = ([14, 204, 268][arm] ?? 204) + (r() - 0.5) * 44;
  return sprite('planet' + seed, R * 4, R * 4, (x) => {
    const tilt = -0.35 - r() * 0.3;
    const half = (front: boolean): void => {
      x.save();
      x.rotate(tilt);
      x.scale(1, 0.28);
      for (let k = 0; k < 9; k++) {
        x.lineWidth = R * 0.05;
        x.strokeStyle = `hsla(${hue + 30 + k * 4},60%,${60 + (k % 3) * 9}%,${0.16 + (k % 4) * 0.09})`;
        x.beginPath();
        x.arc(0, 0, R * (1.28 + k * 0.066), front ? 0 : Math.PI, front ? Math.PI : TAU);
        x.stroke();
      }
      x.restore();
    };
    if (ring) half(false);
    x.save();
    x.beginPath();
    x.arc(0, 0, R, 0, TAU);
    x.clip();
    const b = x.createLinearGradient(0, -R, 0, R);
    for (let k = 0; k <= 10; k++) b.addColorStop(k / 10, `hsl(${hue + (r() - 0.5) * 26},${48 + r() * 22}%,${38 + r() * 24}%)`);
    x.rotate(tilt);
    x.fillStyle = b;
    x.fillRect(-R, -R, R * 2, R * 2);
    for (let k = 0; k < 22; k++) {
      x.fillStyle = `hsla(${hue + (r() - 0.5) * 30},55%,${45 + r() * 25}%,.22)`;
      x.beginPath();
      x.ellipse((r() - 0.5) * R * 1.8, (r() - 0.5) * R * 1.8, R * (0.2 + r() * 0.5), R * (0.02 + r() * 0.05), 0, 0, TAU);
      x.fill();
    }
    x.rotate(-tilt);
    const sh = x.createRadialGradient(-R * 0.5, -R * 0.55, R * 0.2, -R * 0.15, -R * 0.15, R * 1.35);
    sh.addColorStop(0, 'rgba(255,255,255,.28)');
    sh.addColorStop(0.45, 'rgba(10,14,48,0)');
    sh.addColorStop(1, 'rgba(8,10,40,.92)');
    x.fillStyle = sh;
    x.fillRect(-R, -R, R * 2, R * 2);
    x.restore();
    x.lineWidth = 2.5;
    x.strokeStyle = `hsla(${hue},90%,80%,.35)`;
    x.beginPath();
    x.arc(0, 0, R, Math.PI * 0.85, Math.PI * 1.75);
    x.stroke();
    if (ring) half(true);
  });
}
