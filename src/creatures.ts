// Starkindle: the hero and the creatures, drawn from scratch with paths and
// gradients, in the same glass-and-light style as Space Galaxy.

import { TAU, glow, lin, path, put, rad, sprite } from './paint.ts';
import type { Ctx } from './paint.ts';
import { Kind } from './types.ts';

// ---- the hero: a lantern-hearted comet ----------------------------------------

function heroFin(x: Ctx): void { // right-hand fins, nose up
  x.beginPath();
  x.moveTo(4, -5);
  x.bezierCurveTo(10, -10, 15, -13, 19, -21);
  x.bezierCurveTo(21, -11, 19, -2, 12, 4);
  x.lineTo(5, 9);
  x.closePath();
  x.fillStyle = lin(x, 4, 4, 20, -18, '#15417f', '#4f9be8', '#d8f2ff');
  x.fill();
  x.lineWidth = 1;
  x.strokeStyle = '#eaf7ff';
  x.stroke();
  x.lineWidth = 1.5;
  x.strokeStyle = '#5df2ff';
  x.beginPath();
  x.moveTo(6, -7.5);
  x.bezierCurveTo(11, -11, 15, -14, 18.6, -20);
  x.stroke();
  x.beginPath(); // the small rear fin
  x.moveTo(4, 8);
  x.quadraticCurveTo(11, 10, 14, 19);
  x.quadraticCurveTo(8, 17, 3, 15);
  x.closePath();
  x.fillStyle = lin(x, 4, 8, 14, 18, '#1a4a8d', '#a9d8ff');
  x.fill();
  x.lineWidth = 0.8;
  x.stroke();
}
function heroBody(x: Ctx): void {
  x.beginPath();
  x.moveTo(0, -25);
  x.bezierCurveTo(5, -16, 9, -8, 8.4, 2);
  x.bezierCurveTo(8, 10, 4, 15, 0, 18);
  x.bezierCurveTo(-4, 15, -8, 10, -8.4, 2);
  x.bezierCurveTo(-9, -8, -5, -16, 0, -25);
  x.fillStyle = lin(x, -8, 0, 8, 0, '#3d7ac6', '#dff1ff', '#ffffff', '#a6cdf5', '#22539c');
  x.fill();
  x.lineWidth = 1;
  x.strokeStyle = '#f4faff';
  x.stroke();
  x.fillStyle = '#143a78'; // nose blade
  path(x, [[0, -25], [2.8, -17], [0, -14], [-2.8, -17]]);
  x.fill();
  x.fillStyle = rad(x, 0, 0, 0, 8, '#0b2a5c', '#174a91'); // the lantern's setting
  x.beginPath();
  x.ellipse(0, 0, 6.2, 8, 0, 0, TAU);
  x.fill();
  x.lineWidth = 1.2;
  x.strokeStyle = '#ffd98a';
  x.stroke();
}

export interface HeroLook { readonly t: number; readonly moving: boolean; readonly slow: boolean }

/** Draw the hero at 0,0, nose up. */
export function drawHero(x: Ctx, o: HeroLook): void {
  const beat = Math.sin(o.t * 0.18), len = (o.moving ? 26 : 13) * (0.9 + Math.random() * 0.2) * (o.slow ? 0.5 : 1);
  const op = x.globalCompositeOperation;
  x.globalCompositeOperation = 'lighter';
  for (const [w, k, c] of [[7, 1.15, 'rgba(70,130,255,'], [4.4, 1, 'rgba(110,235,255,'], [2, 0.62, 'rgba(255,255,255,']] as const) {
    x.fillStyle = lin(x, 0, 14, 0, 14 + len * k, c + '.8)', c + '0)');
    x.beginPath();
    x.moveTo(-w, 14);
    x.quadraticCurveTo(-w * 0.6, 14 + len * k * 0.55, 0, 14 + len * k);
    x.quadraticCurveTo(w * 0.6, 14 + len * k * 0.55, w, 14);
    x.fill();
  }
  x.globalCompositeOperation = op;
  const flap = 1 + (o.moving ? beat * 0.07 : 0);
  for (const side of [1, -1]) {
    x.save();
    x.scale(side * flap, 1);
    put(x, sprite('heroFin', 48, 52, heroFin));
    x.restore();
  }
  put(x, sprite('heroBody', 24, 56, heroBody));
  glow(x, 0, 0, 23 + beat * 2.5, '255,190,80', 0.95);
  x.fillStyle = rad(x, 0, 1, 0, 6, '#fffef0', '#ffd668', '#ff9a2e');
  x.beginPath(); // the flame
  x.moveTo(0, -7 - beat);
  x.bezierCurveTo(4.6, -2, 4.4, 5, 0, 6);
  x.bezierCurveTo(-4.4, 5, -4.6, -2, 0, -7 - beat);
  x.fill();
}

// ---- Prowler: a hunting fish of black glass ----------------------------------

function prowlerBody(x: Ctx): void {
  x.beginPath();
  x.moveTo(0, -22);
  x.bezierCurveTo(9, -18, 12, -7, 9, 3);
  x.bezierCurveTo(7, 11, 4, 15, 0, 24);
  x.bezierCurveTo(-4, 15, -7, 11, -9, 3);
  x.bezierCurveTo(-12, -7, -9, -18, 0, -22);
  x.fillStyle = lin(x, -11, 0, 11, 0, '#1c0d2e', '#6b2f8f', '#d79cff', '#5b2580', '#170a27');
  x.fill();
  x.lineWidth = 1.1;
  x.strokeStyle = '#eec6ff';
  x.stroke();
  for (let i = 0; i < 5; i++) { // a ridge of crystals down its back
    const y = -9 + i * 6, r = 4.4 - i * 0.6;
    path(x, [[0, y - r], [r * 0.6, y], [0, y + r], [-r * 0.6, y]]);
    x.fillStyle = lin(x, -r, y, r, y, '#ff4f9a', '#ffd3e8');
    x.fill();
  }
}
function prowlerFin(x: Ctx): void {
  x.beginPath();
  x.moveTo(7, -10);
  x.bezierCurveTo(15, -14, 21, -9, 22, -1);
  x.bezierCurveTo(17, -5, 12, -3, 8, 1);
  x.closePath();
  x.moveTo(7, 3);
  x.bezierCurveTo(14, 2, 18, 8, 17, 15);
  x.bezierCurveTo(13, 10, 9, 9, 6, 11);
  x.closePath();
  x.fillStyle = lin(x, 6, 0, 22, 0, 'rgba(160,60,210,.9)', 'rgba(255,110,190,.7)');
  x.fill();
  x.lineWidth = 0.9;
  x.strokeStyle = 'rgba(255,200,240,.9)';
  x.stroke();
}
function prowler(x: Ctx, o: FoeLook): void {
  const swim = Math.sin(o.t * 0.2);
  for (const side of [1, -1]) {
    x.save();
    x.scale(side, 1);
    x.rotate(swim * 0.12 * side);
    put(x, sprite('prFin', 48, 44, prowlerFin));
    x.restore();
  }
  put(x, sprite('prBody', 28, 52, prowlerBody));
  const hot = o.state === 1 ? '255,80,60' : '255,170,90';
  for (const s of [-1, 1]) {
    glow(x, s * 4.4, -13, 9, hot, 0.95);
    x.fillStyle = '#fff3d6';
    x.beginPath();
    x.ellipse(s * 4.4, -13, 1.7, 2.6, s * 0.4, 0, TAU);
    x.fill();
  }
}

// ---- Sentinel: an eye inside turning rings ------------------------------------

function sentinelEye(x: Ctx): void {
  x.fillStyle = rad(x, -3, -4, 1, 15, '#ffffff', '#8ff0e2', '#127a86', '#052f45');
  x.beginPath();
  x.arc(0, 0, 11, 0, TAU);
  x.fill();
  x.lineWidth = 1.2;
  x.strokeStyle = '#d8fffa';
  x.stroke();
}
function sentinel(x: Ctx, o: FoeLook): void {
  const hot = o.state === 1 || o.state === 2, spin = o.t * (hot ? 0.22 : 0.05), rgb = hot ? '255,90,60' : '90,255,230';
  glow(x, 0, 0, hot ? 34 : 24, rgb, 0.7);
  if (o.state === 1) x.translate(Math.sin(o.t * 2.3) * 1.4, 0);
  for (let k = 0; k < 3; k++) {
    x.save();
    x.rotate(spin * (k % 2 ? -1 : 1) + k * 1.05);
    x.scale(1, 0.34 + 0.28 * Math.abs(Math.sin(spin * 0.6 + k)));
    x.lineWidth = 3.4;
    x.strokeStyle = hot ? '#7c1f12' : '#0b5566';
    x.beginPath();
    x.arc(0, 0, 19 - k * 1.4, 0, TAU);
    x.stroke();
    x.lineWidth = 1.7;
    x.strokeStyle = hot ? '#ffc09a' : '#b9fff4';
    x.stroke();
    x.restore();
  }
  put(x, sprite('senEye', 26, 26, sentinelEye));
  const lx = Math.cos(o.look) * 4, ly = Math.sin(o.look) * 4;
  x.fillStyle = hot ? '#ff3b1f' : '#04202e';
  x.beginPath();
  x.arc(lx, ly, hot ? 5.4 : 4.4, 0, TAU);
  x.fill();
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(lx - 1.6, ly - 1.7, 1.5, 0, TAU);
  x.fill();
}

// ---- Weaver: spins webs of light ---------------------------------------------

function weaverBody(x: Ctx): void {
  x.fillStyle = rad(x, -3, 4, 1, 17, '#f0ffd8', '#63d66b', '#0d7350', '#04342f');
  x.beginPath();
  x.ellipse(0, 8, 9.5, 12, 0, 0, TAU);
  x.fill();
  x.lineWidth = 1.1;
  x.strokeStyle = '#d9ffcf';
  x.stroke();
  x.strokeStyle = 'rgba(255,255,220,.75)';
  for (const r of [3, 5.6, 8]) { x.beginPath(); x.ellipse(0, 9, r * 0.75, r, 0, 0, TAU); x.stroke(); }
  x.fillStyle = rad(x, -1, -9, 1, 9, '#e9ffd6', '#4cc07a', '#0a5b4a');
  x.beginPath();
  x.arc(0, -8, 6.8, 0, TAU);
  x.fill();
  x.strokeStyle = '#d9ffcf';
  x.stroke();
}
function weaver(x: Ctx, o: FoeLook): void {
  x.lineWidth = 1.9;
  for (const side of [1, -1]) for (let k = 0; k < 4; k++) {
    const sw = Math.sin(o.t * 0.28 + k * 1.6 + (side > 0 ? 0 : 1.5)) * 3;
    const ey = -17 + k * 11 + sw;
    x.strokeStyle = '#0a5b4a';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(side * 4, -7 + k * 3);
    x.quadraticCurveTo(side * 15, -14 + k * 8 + sw, side * 21, ey);
    x.stroke();
    x.strokeStyle = '#a5ffb0';
    x.lineWidth = 1.3;
    x.stroke();
  }
  put(x, sprite('weBody', 26, 46, weaverBody));
  glow(x, 0, 9, 15, '130,255,140', 0.5 + 0.2 * Math.sin(o.t * 0.1));
  for (const [ex, ey, r] of [[-2.6, -11, 1.8], [2.6, -11, 1.8], [-4.6, -8, 1.1], [4.6, -8, 1.1]] as const) {
    x.fillStyle = '#fff7b0';
    x.beginPath();
    x.arc(ex, ey, r, 0, TAU);
    x.fill();
  }
}

// ---- Echo: your own shape, broken into colours ------------------------------------

function echoShape(color: string, edge: string): (x: Ctx) => void {
  return (x) => {
    x.fillStyle = color;
    for (const side of [1, -1]) {
      x.beginPath();
      x.moveTo(side * 4, -5);
      x.bezierCurveTo(side * 10, -10, side * 15, -13, side * 19, -21);
      x.bezierCurveTo(side * 21, -11, side * 19, -2, side * 12, 4);
      x.lineTo(side * 5, 9);
      x.closePath();
      x.fill();
    }
    x.beginPath();
    x.moveTo(0, -25);
    x.bezierCurveTo(9, -12, 10, 6, 0, 18);
    x.bezierCurveTo(-10, 6, -9, -12, 0, -25);
    x.fill();
    x.lineWidth = 1.3;
    x.strokeStyle = edge;
    x.stroke();
  };
}
function echo(x: Ctx, o: FoeLook): void {
  const ga = x.globalAlpha;
  glow(x, 0, 0, 30, '170,60,255', 0.6);
  const slip = 3 + 1.4 * Math.sin(o.t * 0.5);
  x.globalAlpha = ga * 0.6;
  put(x, sprite('echoR', 46, 50, echoShape('#e0218a', '#ff9ad2')), -slip, 0);
  put(x, sprite('echoB', 46, 50, echoShape('#2f3fe0', '#9fb0ff')), slip, 0);
  x.globalAlpha = ga;
  put(x, sprite('echo', 46, 50, echoShape('#5a1796', '#e6c2ff')));
  for (let k = 0; k < 3; k++) { // it keeps tearing
    const y = -20 + ((o.t * 0.8 + k * 13) % 38);
    x.fillStyle = 'rgba(240,200,255,.55)';
    x.fillRect(-12 + k * 5, y, 14, 1.4);
  }
  x.fillStyle = '#12042b'; // an empty lantern
  x.beginPath();
  x.ellipse(0, 0, 5, 7, 0, 0, TAU);
  x.fill();
  x.lineWidth = 1.2;
  x.strokeStyle = '#ff8fd0';
  x.stroke();
}

// ---- Snuffer: a soot moth ---------------------------------------------------------

function mothWing(x: Ctx): void {
  x.beginPath();
  x.moveTo(2, -4);
  x.bezierCurveTo(10, -20, 24, -18, 22, -6);
  x.bezierCurveTo(21, 1, 12, 3, 3, 2);
  x.closePath();
  x.moveTo(3, 2);
  x.bezierCurveTo(12, 4, 17, 11, 13, 17);
  x.bezierCurveTo(8, 19, 4, 12, 2, 6);
  x.closePath();
  x.fillStyle = lin(x, 2, 0, 23, -8, '#2b2735', '#6f6780', '#c9c0d6');
  x.fill();
  x.lineWidth = 0.9;
  x.strokeStyle = '#efe8fa';
  x.stroke();
  x.fillStyle = '#ffb84d';
  for (const [cx, cy, r] of [[15, -10, 3], [10, 10, 2]] as const) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }
  x.fillStyle = '#2b1a10';
  for (const [cx, cy, r] of [[15, -10, 1.4], [10, 10, 0.9]] as const) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }
}
function snuffer(x: Ctx, o: FoeLook): void {
  const flap = 0.45 + 0.55 * Math.abs(Math.sin(o.t * 0.32));
  for (const side of [1, -1]) {
    x.save();
    x.scale(side * flap, 1);
    put(x, sprite('moth', 50, 46, mothWing));
    x.restore();
  }
  x.fillStyle = lin(x, -3, 0, 3, 0, '#3a3345', '#b9aecb', '#2c2636');
  x.beginPath();
  x.ellipse(0, 1, 3.2, 11, 0, 0, TAU);
  x.fill();
  x.lineWidth = 1;
  x.strokeStyle = '#d9cfe8';
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s, -9); x.quadraticCurveTo(s * 4, -15, s * 8, -17); x.stroke(); }
  glow(x, 0, -8, 10, '255,190,90', 0.6);
}

/** look = the angle to the hero (it may be turned already; see Renderer). */
export interface FoeLook { readonly kind: Kind; readonly t: number; readonly state: number; readonly look: number; readonly dazed: boolean }

const DRAW: Readonly<Record<Kind, (x: Ctx, o: FoeLook) => void>> = {
  [Kind.Prowler]: prowler, [Kind.Sentinel]: sentinel, [Kind.Weaver]: weaver, [Kind.Echo]: echo, [Kind.Snuffer]: snuffer,
};

/** Does this creature face the way it is going? */
export const faces = (k: Kind): boolean => k !== Kind.Sentinel;

/** Draw a creature at 0,0, facing up. */
export function drawFoe(x: Ctx, o: FoeLook): void {
  x.save();
  x.lineJoin = x.lineCap = 'round';
  if (o.dazed) x.globalAlpha *= 0.55;
  DRAW[o.kind](x, o);
  x.restore();
}

export interface GuideEntry { readonly kind: Kind; readonly name: string; readonly text: string }
export const GUIDE: readonly GuideEntry[] = [
  { kind: Kind.Prowler, name: 'Prowler', text: 'Follows the shortest way to you, then loses the scent for a while. Some keep out of the light.' },
  { kind: Kind.Sentinel, name: 'Sentinel', text: 'Patrols. If it sees you down a corridor it glows red, then charges until it meets a wall.' },
  { kind: Kind.Weaver, name: 'Weaver', text: 'Keeps its distance and strings webs that slow you down.' },
  { kind: Kind.Echo, name: 'Echo', text: 'Repeats every move you made five seconds ago. Do not double back.' },
  { kind: Kind.Snuffer, name: 'Snuffer', text: 'Harmless, but it puts your stars out. Catch it for 300 points.' },
];
