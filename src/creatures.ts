// Starkindle: the lamplighter and the paper animals. Each is a handful of cut
// shapes with a white edge, drawn once per step of its walk and kept.

import { TAU, halo, put, round, sprite, starPath, sticker } from './paint.ts';
import type { Ctx, Piece, Sprite } from './paint.ts';
import { Kind } from './types.ts';

/** Steps in a walk. */
const STEPS = 8;
const step = (t: number, speed: number): number => Math.floor((t * speed) / 6) % STEPS;
const swing = (f: number): number => Math.sin((f * TAU) / STEPS);

// ---- the lamplighter --------------------------------------------------------------

function lamplighter(f: number, lit: boolean): Piece[] {
  const s = swing(f) * 5, coat = lit ? '#e2553d' : '#3b2a5e', dark = lit ? '#c1402b' : '#2b1d48', hat = lit ? '#22305c' : '#1d1336';
  return [
    [`M-13 ${-5 + s * 0.4}L-5 -5L-5 0L-12 ${1 + s * 0.4}Z`, lit ? '#ffdf8e' : '#5a4685'], // scarf tail
    [`M-4 9L${-4 - s} 20L${1 - s} 20L2 9Z`, lit ? '#2b3558' : '#231638'],
    [`M0 9L${0 + s} 20L${5 + s} 20L5 9Z`, lit ? '#3d4a78' : '#2b1d48'],
    ['M-8 11L-6 -5Q0 -8 6 -5L9 11Q0 14 -8 11Z', coat],
    ['M1 -7Q5 -6.5 6 -5L9 11Q5 13 1 13Z', dark],
    ['M-7 -6Q0 -2 8 -6L7 -2Q0 2 -7 -2Z', lit ? '#fff2c9' : '#6f5aa0'],
    [round(1, -10, 5.4), lit ? '#f9d3ad' : '#4a3873'],
    ['M-7 -13.4L9 -13.4L9 -11.4L-7 -11.4Z', hat],
    ['M-4 -13L-3 -22L6 -22L6.4 -13Z', hat],
    ['M-3.7 -16L6.2 -16L6.4 -13.4L-4 -13.4Z', lit ? '#f2b63c' : '#5a4685'],
    ['M4 0L16 -12L17.6 -10.6L6 3Z', lit ? '#8a5a30' : '#2b1d48'], // pole
    ['M13.6 -12L21 -12L20 -2.6L14.6 -2.6Z', lit ? '#ffd24d' : '#140c26'], // lantern
    ['M13 -14.4L21.6 -14.4L20.4 -11.6L14.2 -11.6Z', hat],
    ...(lit ? [[round(3.6, -10.4, 0.9), '#22305c'] as Piece, ['M16.2 -10L18.4 -10L18 -4.6L16.6 -4.6Z', '#fffbe0'] as Piece] : []),
  ];
}
const lampSprite = (f: number, lit: boolean): Sprite => sprite(`lamp${f}${lit ? 'y' : 'n'}`, 54, 60, (x) => sticker(x, lamplighter(f, lit), lit ? '#fffdf6' : '#d9c8ff'));

export interface HeroLook { readonly t: number; readonly moving: boolean; readonly slow: boolean; readonly left: boolean }

/** Draw the lamplighter at 0,0. */
export function drawHero(x: Ctx, o: HeroLook): void {
  const f = o.moving ? step(o.t, o.slow ? 0.5 : 1.3) : 0;
  x.save();
  x.scale(o.left ? -1 : 1, 1);
  x.translate(0, o.moving ? -Math.abs(swing(f)) * 1.8 : Math.sin(o.t * 0.06) * 0.6);
  halo(x, 17, -7, 30 + Math.sin(o.t * 0.15) * 2, '255,226,120', 0.75);
  put(x, lampSprite(f, true));
  x.restore();
}

// ---- Prowler: a wolf ---------------------------------------------------------------

function wolf(f: number, hunting: boolean): Piece[] {
  const s = swing(f) * 4.5;
  return [
    [`M-11 -1L-22 ${-9 + s * 0.6}L-20 1L-11 5Z`, '#9385cf'],
    [`M-9 5L${-10 - s} 16L${-6 - s} 16L-4 5Z`, '#473a7d'],
    [`M6 4L${6 + s} 16L${10 + s} 16L10 4Z`, '#473a7d'],
    ['M-13 -2L-2 -7L9 -5L11 5L-10 7Z', '#5f50a2'],
    ['M-2 -7L9 -5L11 5L2 6Z', '#6f60b4'],
    [`M-6 6L${-5 + s} 16L${-1 + s} 16L0 6Z`, '#54468f'],
    [`M3 5L${3 - s} 16L${7 - s} 16L8 5Z`, '#54468f'],
    ['M9 -13L7.6 -22L14 -14Z', '#473a7d'],
    ['M6 -3L9 -14L16 -12L24 -5L20 0L10 2Z', '#7567bd'],
    ['M15 -6.4L24 -5L20 0L14 -1Z', '#efe9ff'],
    ['M13 -13L16 -21L17 -11.4Z', '#54468f'],
    [round(23, -4.8, 1.3), '#221a44'],
    [hunting ? 'M12.4 -10.6L18 -8.4L13.4 -7.2Z' : 'M13 -9.6L17 -8.4L13.6 -7.6Z', hunting ? '#ff4a2e' : '#ffd24d'],
  ];
}

// ---- Sentinel: an owl ----------------------------------------------------------------

function owl(spread: boolean, hot: boolean): Piece[] {
  const w = spread ? ['M-8 -8L-25 -15L-22 0L-9 8Z', 'M8 -8L25 -15L22 0L9 8Z'] : ['M-8 -8L-15 -2L-13 11L-7 9Z', 'M8 -8L15 -2L13 11L7 9Z'];
  return [
    [w[0] ?? '', '#7d5128'], [w[1] ?? '', '#7d5128'],
    ['M-4 15L-5 20L-1 18Z', '#f2a03c'], ['M4 15L5 20L1 18Z', '#f2a03c'],
    ['M0 -18L10 -13L11 6L0 18L-11 6L-10 -13Z', '#a9713a'],
    ['M0 -18L10 -13L11 6L0 18Z', '#97622f'],
    ['M0 -2L7.4 3L0 16L-7.4 3Z', '#f6e2b8'],
    ['M-10 -12L-12 -23L-3 -15Z', '#7d5128'], ['M10 -12L12 -23L3 -15Z', '#7d5128'],
    [round(-4.9, -8, 5.2), hot ? '#ff6a4a' : '#fff6da'], [round(4.9, -8, 5.2), hot ? '#ff6a4a' : '#fff6da'],
    ['M-2.2 -5.4L2.2 -5.4L0 -0.6Z', '#f2a03c'],
  ];
}

// ---- Weaver: a spider with a thread of silk ----------------------------------------------

function spider(f: number): Piece[] {
  const out: Piece[] = [];
  for (const side of [1, -1]) for (let k = 0; k < 4; k++) {
    const s = Math.sin((f * TAU) / STEPS + k * 1.7 + (side > 0 ? 0 : 1.4)) * 2.6, y0 = -5 + k * 3.6, y1 = -15 + k * 9.4 + s;
    out.push([`M${side * 4} ${y0}L${side * 14} ${y1 - 4}L${side * 21} ${y1 + 3}L${side * 13.4} ${y1 - 1.4}Z`, k % 2 ? '#16705f' : '#1d8772']);
  }
  out.push(['M0 -2L9 4L7 15L0 19L-7 15L-9 4Z', '#25a58b'], ['M0 -2L9 4L7 15L0 19Z', '#1d8f78'], ['M0 3L4 9L0 15L-4 9Z', '#d9fff2'], [round(0, -7, 6.6), '#1b7d69']);
  out.push([round(-2.6, -9, 1.9), '#fff6b8'], [round(2.6, -9, 1.9), '#fff6b8'], [round(-2.4, -9, 0.8), '#10302b'], [round(2.8, -9, 0.8), '#10302b']);
  return out;
}

// ---- Snuffer: a moth -----------------------------------------------------------------------

function moth(f: number): Piece[] {
  const k = 0.45 + 0.55 * Math.abs(Math.cos((f * Math.PI) / STEPS));
  const wing = (s: number): Piece[] => [
    [`M${s * 2} -4L${s * 20 * k} -17L${s * 23 * k} -5L${s * 12 * k} 3L${s * 2} 2Z`, '#9b94ad'],
    [`M${s * 2} 2L${s * 13 * k} 4L${s * 14 * k} 14L${s * 6 * k} 15L${s * 2} 7Z`, '#7f7893'],
    [round(s * 15 * k, -8, 2.8), '#f2b63c'], [round(s * 15 * k, -8, 1.2), '#3a3346'],
  ];
  return [...wing(1), ...wing(-1), ['M-2.6 -10L2.6 -10L2.2 11L0 14L-2.2 11Z', '#4d465e'], ['M-2 -10L-7 -18L-6 -18.6L-0.6 -10Z', '#4d465e'], ['M2 -10L7 -18L6 -18.6L0.6 -10Z', '#4d465e']];
}

// ---- drawing one -------------------------------------------------------------------------------

/** look = the angle to the lamplighter; left = facing left. */
export interface FoeLook { readonly kind: Kind; readonly t: number; readonly state: number; readonly look: number; readonly dazed: boolean; readonly left: boolean; readonly moving: boolean }

/** Draw a creature at 0,0. */
export function drawFoe(x: Ctx, o: FoeLook): void {
  x.save();
  if (o.dazed) { x.globalAlpha *= 0.72; x.rotate(Math.sin(o.t * 0.12) * 0.16); }
  const f = o.moving && !o.dazed ? step(o.t, 1) : 0, face = o.left ? -1 : 1;
  switch (o.kind) {
    case Kind.Prowler:
      x.scale(face, 1);
      x.translate(0, 2 - Math.abs(swing(f)) * 1.4);
      put(x, sprite(`wolf${f}${o.state}`, 60, 54, (c) => sticker(c, wolf(f, o.state === 1))));
      break;
    case Kind.Sentinel: {
      const hot = o.state === 1 || o.state === 2, flap = o.state === 2 || (o.state === 1 && Math.floor(o.t / 4) % 2 === 0);
      if (o.state === 1) x.translate(Math.sin(o.t * 2.2) * 1.5, 0);
      put(x, sprite(`owl${flap}${hot}`, 64, 58, (c) => sticker(c, owl(flap, hot))));
      for (const s of [-1, 1]) {
        x.fillStyle = hot ? '#4a0f08' : '#2b1a0c';
        x.beginPath();
        x.arc(s * 4.9 + Math.cos(o.look) * 2, -8 + Math.sin(o.look) * 2, 2.4, 0, TAU);
        x.fill();
      }
      break;
    }
    case Kind.Weaver:
      put(x, sprite(`spider${f}`, 58, 56, (c) => sticker(c, spider(f), '#fffdf6', 3.2)));
      break;
    case Kind.Echo:
      x.scale(face, 1);
      x.globalAlpha *= 0.9;
      put(x, lampSprite(f, false));
      break;
    case Kind.Snuffer: {
      const w = step(o.t, 2.6);
      x.translate(0, Math.sin(o.t * 0.13) * 2);
      put(x, sprite(`moth${w}`, 60, 48, (c) => sticker(c, moth(w), '#fffdf6', 3.2)));
      break;
    }
  }
  x.restore();
}

// ---- things in the maze --------------------------------------------------------------------------

export const litStar = (): Sprite => sprite('lit', 24, 24, (x) => {
  const p = new Path2D(starPath(5, 8.4, 3.8));
  x.save();
  x.shadowColor = 'rgba(90,50,0,.5)';
  x.shadowBlur = 3;
  x.shadowOffsetY = 2.4;
  x.fillStyle = '#f7b928';
  x.fill(p);
  x.restore();
  const g = x.createLinearGradient(-6, -7, 6, 7); // foil
  g.addColorStop(0, '#fff3b8');
  g.addColorStop(0.45, '#ffcf45');
  g.addColorStop(1, '#e79a10');
  x.fillStyle = g;
  x.fill(p);
  x.lineWidth = 1;
  x.strokeStyle = '#a8650a';
  x.stroke(p);
});
export const darkStar = (hole: string, lip: string): Sprite => sprite('dark' + hole, 20, 20, (x) => {
  x.fillStyle = lip;
  x.translate(0, 1);
  x.fill(new Path2D(starPath(5, 5.6, 2.6)));
  x.translate(0, -1);
  x.fillStyle = hole;
  x.fill(new Path2D(starPath(5, 5.2, 2.4)));
});
export const match = (): Sprite => sprite('match', 40, 44, (x) => sticker(x, [
  ['M-2 -4L2 -4L2.6 17L-2.6 17Z', '#f0dcb0'], ['M-3 -8L3 -8L3 -1L-3 -1Z', '#d9402b'],
  ['M0 -20C6 -13 7 -8 0 -4C-7 -8 -6 -13 0 -20Z', '#ff9a2e'], ['M0 -15C3 -11 3.4 -8 0 -6C-3.4 -8 -3 -11 0 -15Z', '#fff0a8'],
]));
export const door = (): Sprite => sprite('door', 44, 52, (x) => sticker(x, [
  ['M-12 18L-12 -5A12 12 0 0 1 12 -5L12 18Z', '#3f4fa8'], ['M-9 18L-9 -5A9 9 0 0 1 9 -5L9 18Z', '#232c6b'],
  [starPath(5, 5, 2.3).replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, a: string, b: string) => `${a} ${Number(b) - 3}`), '#ffd24d'], [round(5.6, 8, 1.4), '#f2b63c'],
]));
export const crane = (f: number): Sprite => {
  const w = swing(f) * 6;
  return sprite(`crane${f}`, 60, 56, (x) => sticker(x, [
    ['M-6 4L-24 -2L-12 8Z', '#e886a8'], [`M-4 2L-2 ${-19 + w}L8 4Z`, '#f7a9c4'], [`M0 3L12 ${-17 - w}L12 5Z`, '#ffd0df'],
    ['M-8 3L10 2L4 11L-4 11Z', '#ee97b5'], ['M8 3L20 -10L24 -8L19 -6L12 8Z', '#f7a9c4'],
  ]));
};
export const web = (): Sprite => sprite('web', 50, 50, (x) => {
  x.shadowColor = 'rgba(20,32,70,.5)';
  x.shadowBlur = 2;
  x.shadowOffsetY = 1.4;
  x.lineWidth = 1.3;
  x.strokeStyle = '#ffffff';
  x.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; x.moveTo(0, 0); x.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); }
  for (const r of [6, 11.5, 17]) for (let k = 0; k <= 8; k++) {
    const a = (k * TAU) / 8, b = a - TAU / 16;
    if (k) x.quadraticCurveTo(Math.cos(b) * r * 0.8, Math.sin(b) * r * 0.8, Math.cos(a) * r, Math.sin(a) * r);
    else x.moveTo(r, 0);
  }
  x.stroke();
});
export const wind = (): Sprite => sprite('wind', 26, 24, (x) => {
  x.shadowColor = 'rgba(20,40,90,.35)';
  x.shadowBlur = 2;
  x.shadowOffsetY = 1.5;
  x.fillStyle = '#ffffff';
  x.fill(new Path2D('M-9 -3L0 -3L0 -7.5L9 0L0 7.5L0 3L-9 3L-6 0Z'));
});

export interface GuideEntry { readonly kind: Kind; readonly name: string; readonly text: string }
export const GUIDE: readonly GuideEntry[] = [
  { kind: Kind.Prowler, name: 'Prowler', text: 'A wolf that follows the shortest way to you, then loses the scent for a while. Some keep off your lit stars.' },
  { kind: Kind.Sentinel, name: 'Sentinel', text: 'An owl on patrol. If it sees you down a corridor its eyes turn red, then it swoops until it meets a cloud.' },
  { kind: Kind.Weaver, name: 'Weaver', text: 'A spider that keeps its distance and strings webs that slow you down.' },
  { kind: Kind.Echo, name: 'Echo', text: 'Your own shadow. It repeats every move you made five seconds ago, so do not double back.' },
  { kind: Kind.Snuffer, name: 'Snuffer', text: 'A harmless moth that puts your stars out. Catch it for 300 points.' },
];
