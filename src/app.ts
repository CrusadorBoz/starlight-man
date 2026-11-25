// Starkindle: the page. Reads the controls, keeps time, runs the rules and shows
// what they report.

import { GUIDE, drawFoe } from './creatures.ts';
import { Game, MAX_FLARES, MAX_SPARKS, SKIES } from './game.ts';
import { clamp } from './maths.ts';
import { CELL, MAX_COLS, MIN_COLS } from './maze.ts';
import type { Dir } from './maze.ts';
import { SS, context } from './paint.ts';
import { H, Renderer, SHARPEST } from './render.ts';
import { Sound } from './audio.ts';
import { Ev, Kind, Phase } from './types.ts';
import type { GameEvent } from './types.ts';

type Mode = 'loading' | 'title' | 'play' | 'paused' | 'over' | 'failed';
type Screen = 'loading' | 'fail' | 'title' | 'pause' | 'pick' | 'over' | 'won';

const TICK_MS = 1000 / 60;
const NAMES = ['The First Spark', 'Tidal Glass', 'Echo Gallery', 'Moonstone Stair', 'The Moth Garden', 'The Long Quiet', 'Amethyst Hollow', 'Glimmerdeep', 'Crown of Lanterns'] as const;
interface CharmText { readonly name: string; readonly text: string }
const CHARMS: readonly CharmText[] = [
  { name: 'Swift fins', text: 'You fly faster.' },
  { name: 'Long flare', text: 'Flares reach further and daze for longer.' },
  { name: 'Spare spark', text: 'One more life.' },
  { name: 'Deep lantern', text: 'Start each sky with one more flare.' },
  { name: 'Silk scales', text: 'Webs no longer slow you.' },
  { name: 'Bright wake', text: 'Creatures are slower among your lit stars.' },
];
const SCRAP: CharmText = { name: 'Stardust', text: 'You carry every charm. Take 2,000 points.' };

/** An element that must be on the page, of the type it must be. */
function el<T extends HTMLElement>(id: string, type: new () => T): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} is missing`);
  return e;
}
const box = (id: string): HTMLElement => el(id, HTMLElement);
const btn = (id: string): HTMLButtonElement => el(id, HTMLButtonElement);

const num = new Intl.NumberFormat('en-US');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** This browser's small memory; a private window may refuse it. */
const store = {
  get(k: string, d: string): string { try { return localStorage.getItem('starkindle:' + k) ?? d; } catch { return d; } },
  set(k: string, v: string): void { try { localStorage.setItem('starkindle:' + k, v); } catch { /* not kept */ } },
};

const canvas = el('sky', HTMLCanvasElement);
const help = el('help', HTMLDialogElement);
const view = new Renderer(canvas, calm);
const sound = new Sound(store.get('sound', 'on') === 'on');

let game: Game | null = null;
let mode: Mode = 'loading';
let best = Number(store.get('best', '0')) || 0;
let wish: Dir | -1 = -1; // the way last asked for
let flare = false; // both of these last for exactly one tick
let choice = -1;

// ---- the size of the sky ------------------------------------------------------------

// A run keeps the maze width it started with. Between runs the sky takes the shape
// of the window: 7 columns on a phone held upright, up to 15.
let cols = 0;
const layout = box('layout');
const screen = box('screen');
function fit(): void {
  const room = layout.clientWidth - 2 * parseFloat(getComputedStyle(layout).paddingLeft);
  const under = getComputedStyle(btn('flareBtn')).position === 'fixed' ? 0 : btn('flareBtn').offsetHeight;
  const tall = Math.max(260, innerHeight - (screen.getBoundingClientRect().top + scrollY) - 14 - (under > 0 ? under + 8 : 0));
  if (!game) {
    const n = clamp(Math.round((H * room) / tall / CELL), MIN_COLS, MAX_COLS);
    if (n !== cols) {
      cols = n;
      view.resize(n * CELL);
    }
  }
  const w = cols * CELL, h = Math.min(tall, (room * H) / w);
  box('stage').style.width = `${Math.floor((h * w) / H)}px`;
  screen.style.aspectRatio = `${w} / ${H}`;
  // As sharp as this screen can show, and no sharper: extra pixels cost frames.
  const pixels = clamp(Math.ceil(((h * devicePixelRatio) / H) * 8) / 8, 1, SHARPEST);
  if (view.sharpness(pixels) && mode === 'paused') view.draw(game, 0);
}
addEventListener('resize', fit);

// ---- controls -------------------------------------------------------------------------

const KEYMAP: ReadonlyMap<string, Dir> = new Map<string, Dir>([
  ['ArrowRight', 0], ['KeyD', 0], ['ArrowDown', 1], ['KeyS', 1], ['ArrowLeft', 2], ['KeyA', 2], ['ArrowUp', 3], ['KeyW', 3],
]);
/** Directions held down, newest last: letting go of one goes back to the one before. */
let held: Dir[] = [];

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || help.open) return;
  const onControl = e.target instanceof Element && e.target.closest('button, a, input, select, summary') !== null;
  // A key still held from play must not press the button that just got focus.
  if (onControl && e.repeat && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); return; }
  const pauseKey = e.code === 'KeyP' || e.code === 'Escape';
  if (mode === 'play') {
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (game?.phase === Phase.Pick && n >= 0) { pick(n); return; }
    if (pauseKey) { if (!e.repeat) pause(); e.preventDefault(); return; }
    const d = KEYMAP.get(e.code);
    if (d !== undefined && game?.phase !== Phase.Pick) {
      if (!e.repeat) { held = [...held.filter((k) => k !== d), d]; wish = d; }
      e.preventDefault();
      return;
    }
    if ((e.code === 'Space' || e.code === 'KeyX') && !onControl) { if (!e.repeat) flare = true; e.preventDefault(); return; }
  } else if (mode === 'paused' && pauseKey && !e.repeat) {
    resume();
    e.preventDefault();
  }
  if (e.code === 'KeyM' && !e.repeat) toggleSound();
  if (e.code === 'KeyH' && !e.repeat) { openHelp(); e.preventDefault(); }
});
addEventListener('keyup', (e) => {
  const d = KEYMAP.get(e.code);
  if (d === undefined) return;
  held = held.filter((k) => k !== d);
  const back = held.at(-1);
  if (back !== undefined) wish = back;
});

// Touch and mouse: swipe or drag anywhere on the maze; keep dragging to keep turning.
let swipe: { readonly id: number; x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  canvas.setPointerCapture(e.pointerId);
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  sound.wake();
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
  wish = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
  swipe.x = e.clientX;
  swipe.y = e.clientY;
});
const letGo = (e: PointerEvent): void => { if (swipe?.id === e.pointerId) swipe = null; };
canvas.addEventListener('pointerup', letGo);
canvas.addEventListener('pointercancel', letGo);
btn('flareBtn').addEventListener('pointerdown', (e) => { flare = true; sound.wake(); e.preventDefault(); });
btn('flareBtn').addEventListener('click', (e) => { if (e.detail === 0) flare = true; }); // keyboard

// ---- screens ----------------------------------------------------------------------------

const SCREENS: readonly Screen[] = ['loading', 'fail', 'title', 'pause', 'pick', 'over', 'won'];
const quiet = { preventScroll: true };
function showOnly(id: Screen | null): void {
  for (const s of SCREENS) box(s).hidden = s !== id;
  box('veil').hidden = id === null;
}
function setMode(m: Mode): void {
  mode = m;
  document.body.dataset['mode'] = m;
  btn('pauseBtn').disabled = m !== 'play' && m !== 'paused';
  btn('pauseBtn').textContent = m === 'paused' ? 'Resume' : 'Pause';
  if (m === 'title') { game = null; fit(); showOnly('title'); btn('startBtn').focus(quiet); }
  if (m === 'play') { showOnly(null); canvas.focus(quiet); }
  if (m === 'paused') { showOnly('pause'); btn('resumeBtn').focus(quiet); }
}
function fail(err: unknown): void {
  console.error('Starkindle stopped:', err);
  mode = 'failed';
  box('failText').textContent = 'Something went wrong. Reload the page to play again.';
  showOnly('fail');
}
function letGoOfAll(): void {
  held = [];
  wish = -1;
  swipe = null;
  flare = false;
  choice = -1;
}
function start(): void {
  sound.wake();
  const diff = Number(document.querySelector<HTMLInputElement>('input[name=diff]:checked')?.value ?? '1');
  store.set('diff', String(diff));
  game = null;
  setMode('play');
  fit();
  game = new Game(Math.floor(Math.random() * 2 ** 32), diff, cols);
  letGoOfAll();
  acc = 0;
  view.reset();
  tick(1);
}
function pause(): void {
  if (mode !== 'play') return;
  letGoOfAll();
  setMode('paused');
}
function resume(): void {
  if (mode !== 'paused') return;
  sound.wake();
  setMode('play');
  if (game) screensFor(game, true);
}
function pick(i: number): void { choice = i; sound.wake(); }
function toggleSound(): void {
  sound.set(!sound.on);
  store.set('sound', sound.on ? 'on' : 'off');
  showSound();
}
function showSound(): void {
  btn('soundBtn').setAttribute('aria-pressed', String(sound.on));
  btn('soundBtn').textContent = sound.on ? 'Sound on' : 'Sound off';
}

for (const id of ['startBtn', 'againBtn']) btn(id).addEventListener('click', start);
for (const id of ['homeBtn', 'quitBtn']) btn(id).addEventListener('click', () => setMode('title'));
btn('resumeBtn').addEventListener('click', resume);
btn('pauseBtn').addEventListener('click', () => (mode === 'paused' ? resume() : pause()));
btn('soundBtn').addEventListener('click', toggleSound);
btn('onBtn').addEventListener('click', () => pick(0));
for (let i = 0; i < 3; i++) btn(`opt${i}`).addEventListener('click', () => pick(i));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', pause);
const seat = document.querySelector<HTMLInputElement>(`input[name=diff][value="${['0', '1', '2'].find((v) => v === store.get('diff', '1')) ?? '1'}"]`);
if (seat) seat.checked = true;

let shown: Screen | null = null;
function screensFor(g: Game, force = false): void {
  const ready = g.phaseT > 12;
  let want: Screen | null = null;
  if (g.phase === Phase.Pick && ready) want = 'pick';
  if (g.phase === Phase.Won && ready) want = 'won';
  if (g.phase === Phase.Over) want = 'over';
  if (want === shown && !force) return;
  shown = want;
  if (want === 'pick') {
    g.options.forEach((c, i) => {
      const o = CHARMS[c] ?? SCRAP;
      box(`opt${i}name`).textContent = o.name;
      box(`opt${i}text`).textContent = o.text;
    });
    box('pickTitle').textContent = `Sky ${g.level} is alight`;
    showOnly('pick');
    btn('opt0').focus(quiet);
  } else if (want === 'won') {
    keepBest(g.score);
    fillStats('wonStats', g);
    showOnly('won');
    btn('onBtn').focus(quiet);
  } else if (want === 'over') {
    const record = g.score > best;
    keepBest(g.score);
    fillStats('overStats', g);
    box('overTitle').textContent = record ? 'New best score' : 'The light goes out';
    setMode('over');
    showOnly('over');
    btn('againBtn').focus(quiet);
  } else if (mode === 'play') {
    showOnly(null);
    canvas.focus(quiet);
  }
}
function fillStats(id: string, g: Game): void {
  const rows: readonly (readonly [string, number])[] = [['Score', g.score], ['Best', best], ['Sky reached', g.level], ['Stars lit', g.starsLit], ['Creatures dazed', g.dazed], ['Snuffers caught', g.caught], ['Times caught', g.hits]];
  box(id).replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = num.format(value);
    row.append(dt, dd);
    return row;
  }));
}
function keepBest(score: number): void {
  if (score <= best) return;
  best = score;
  store.set('best', String(best));
}

// ---- the strip above the sky -----------------------------------------------------------

const hud = new Map<string, string>();
/** True when an entry changed, so the page is only touched when it must be. */
function changed(id: string, v: string): boolean {
  if (hud.get(id) === v) return false;
  hud.set(id, v);
  return true;
}
function text(id: string, v: string): void { if (changed(id, v)) box(id).textContent = v; }
function pips(id: string, on: number, total: number, label: string): void {
  if (!changed(id, `${on}/${total}`)) return;
  box(id).setAttribute('aria-label', `${label}: ${on} of ${total}`);
  box(id).replaceChildren(...Array.from({ length: total }, (_, i) => {
    const p = document.createElement('span');
    p.className = i < on ? 'pip is-on' : 'pip';
    return p;
  }));
}
function showHud(g: Game | null): void {
  text('score', num.format(g?.score ?? 0));
  text('best', num.format(Math.max(best, g?.score ?? 0)));
  text('mult', `×${g?.mult ?? 1}`);
  text('level', String(g?.level ?? 1));
  text('stars', `${g?.percent ?? 0}%`);
  const left = Math.max(0, g?.sparks ?? 3);
  pips('sparks', left, Math.min(MAX_SPARKS, Math.max(3, left)), 'Sparks');
  pips('flares', g?.flares ?? 1, MAX_FLARES, 'Flares');
  if (changed('flareBtn', String(g?.flares ?? 1))) btn('flareBtn').textContent = `Flare (${g?.flares ?? 1})`;
}

let bannerT = 0;
function banner(title: string, sub: string): void {
  box('bannerTitle').textContent = title;
  box('bannerSub').textContent = sub;
  box('banner').classList.add('is-on');
  bannerT = 115;
}
function hideBanner(): void { box('banner').classList.remove('is-on'); }
function announce(e: GameEvent): void {
  if (e.kind === Ev.Sky) {
    const lap = Math.floor((e.v - 1) / SKIES) + 1;
    banner(NAMES[(e.v - 1) % SKIES] ?? '', `Sky ${e.v}${lap > 1 ? ` · Lap ${lap}` : ''}`);
  }
  if (e.kind === Ev.Clear) banner('Every star is lit', `${e.v % 2 ? 'Never caught! ' : ''}Bonus ${num.format(Math.floor(e.v / 2))}`);
}

// ---- time ---------------------------------------------------------------------------------

let acc = 0, last = 0;
function tick(n: number): void {
  if (!game) return;
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    game.step({ dir: wish, flare, pick: choice });
    flare = false;
    choice = -1;
    events.push(...game.events);
  }
  // Back at the start after being caught: the old wish goes with it, unless a key is still down.
  if (events.some((e) => e.kind === Ev.Hit || e.kind === Ev.Sky)) wish = held.at(-1) ?? -1;
  view.events(events);
  sound.events(events);
  events.forEach(announce);
  screensFor(game);
}
function frame(now: number): void {
  if (mode === 'failed') return;
  requestAnimationFrame(frame);
  try {
    const ms = Math.min(100, now - last || TICK_MS), dt = ms / TICK_MS;
    last = now;
    if (mode === 'play') {
      acc += ms;
      const n = Math.floor(acc / TICK_MS + 0.02);
      if (n > 0) {
        acc = Math.max(0, acc - n * TICK_MS);
        tick(Math.min(n, 4));
      }
    }
    if (mode !== 'paused') view.draw(game, dt);
    showHud(game);
    if (mode === 'play' && bannerT > 0 && (bannerT -= dt) <= 0) hideBanner();
    if (mode === 'title') hideBanner();
    if (help.open) guide(now);
  } catch (err) {
    fail(err);
  }
}

// ---- the instructions: a panel that slides in and pauses the game ---------------------

function openHelp(): void {
  if (help.open) return;
  pause();
  help.showModal();
  help.scrollTop = 0;
}
for (const id of ['helpBtn', 'helpBtn2']) btn(id).addEventListener('click', openHelp);
btn('helpClose').addEventListener('click', () => help.close());
help.addEventListener('click', (e) => { // a click on the shade beside the panel
  if (e.target === help && e.clientX < help.getBoundingClientRect().left) help.close();
});
help.addEventListener('close', () => {
  if (mode === 'paused') btn('resumeBtn').focus(quiet);
  if (mode === 'title') btn('startBtn').focus(quiet);
});

const cards = GUIDE.map((g) => {
  const li = document.createElement('li'), c = document.createElement('canvas'), body = document.createElement('div');
  const h = document.createElement('h4'), p = document.createElement('p');
  c.width = c.height = 72 * SS;
  c.setAttribute('aria-hidden', 'true');
  h.textContent = g.name;
  p.textContent = g.text;
  body.append(h, p);
  li.append(c, body);
  box('guide').append(li);
  return { kind: g.kind, x: context(c) };
});
let guideAt = 0;
function guide(now: number): void {
  if (guideAt > 0 && (calm || now - guideAt < 40)) return;
  guideAt = now;
  cards.forEach(({ kind, x }, i) => {
    const t = calm ? 60 : now / TICK_MS + i * 40;
    x.setTransform(SS, 0, 0, SS, 0, 0);
    x.clearRect(0, 0, 72, 72);
    x.translate(36, 37);
    x.scale(1.22, 1.22);
    drawFoe(x, { kind, t, state: kind === Kind.Prowler ? 1 : 0, look: t / 60, dazed: false });
  });
}

showSound();
document.fonts.load('800 13px Inter').catch(() => { /* the system font will do */ });
document.fonts.ready.then(fit).catch(() => { /* already fitted once */ });
setMode('title');
requestAnimationFrame(frame);
