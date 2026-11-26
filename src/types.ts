// Starlight Man: the shapes the rules work with.

import type { Dir } from './maze.ts';

export const Phase = {
  Ready: 0, // about to start a sky
  Play: 1,
  Hit: 2, // caught
  Clear: 3, // every star is lit
  Pick: 4, // choosing a charm
  Over: 5,
  Won: 6, // the ninth sky is lit
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

/** One tick of the player's controls. */
export interface Input {
  /** The way the player wants to go; -1 keeps the last wish. */
  readonly dir: Dir | -1;
  readonly flare: boolean;
  /** Which of the three charms to take, or -1. Also continues after winning. */
  readonly pick: number;
}

/** The creatures. Each hunts in its own way. */
export const Kind = {
  Prowler: 0, // follows the shortest way to you
  Sentinel: 1, // patrols, and charges down any corridor it sees you in
  Weaver: 2, // keeps away, and strings webs that slow you
  Echo: 3, // repeats every move you made five seconds ago
  Snuffer: 4, // harmless, but puts stars out; catch it
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export const Charm = { Fins: 0, Flare: 1, Spark: 2, Lantern: 3, Silk: 4, Wake: 5 } as const;
export type Charm = (typeof Charm)[keyof typeof Charm];

/** Something that moves between nodes: at node x, y, and p of the way (0..STEP) to the next in direction dir. */
export interface Mover { x: number; y: number; dir: Dir | -1; p: number }

export interface Foe extends Mover {
  readonly kind: Kind;
  /** Its place in the roster: 0, 1, 2... */
  readonly n: number;
  readonly homeX: number;
  readonly homeY: number;
  /** The play tick it sets off. */
  wake: number;
  t: number;
  state: number;
  /** Ticks left of being dazed by a flare. */
  daze: number;
  /** What a and b mean depends on the kind. */
  a: number;
  b: number;
}

/** A passing comet, worth catching. */
export interface Comet extends Mover { life: number }

/** How far a flare reached each way, in nodes, and when. */
export interface Beam { readonly x: number; readonly y: number; readonly reach: readonly [number, number, number, number] }

export const Ev = {
  Star: 0, Prism: 1, Flare: 2, Daze: 3, Hit: 4, Clear: 5, Sky: 6, Comet: 7, CometGot: 8, Snuff: 9, Caught: 10,
  Web: 11, Stuck: 12, Warp: 13, Tell: 14, Charge: 15, Spark: 16, Won: 17, Over: 18, Pick: 19, Streak: 20,
} as const;
export type Ev = (typeof Ev)[keyof typeof Ev];

/** Something that happened this tick, at a place in units, with a value. */
export interface GameEvent { readonly kind: Ev; readonly x: number; readonly y: number; readonly v: number }
