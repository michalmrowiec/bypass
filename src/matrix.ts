// Matrix rules for a run: the deal, what each cell shows and allows, and what a pick does. No DOM here.
import { newRun, WILD, type Run } from './game';
import type { Puzzle } from './generator';
import {
  bountyFor, bountyHere, burnOf, cutMarks, DATA_BY_LEN, dealRunMatrix, globTarget, placeCells, plantRepeat, rewardsFor, roomIce, trapCell,
  type BountyId, type DaemonId, type IceId, type ItemId, type RewardId, type RunState,
} from './roguelike';

type Cell = [number, number];
export type Tool = 'wild' | 'split' | 'jump' | 'loop' | 'mux' | 'rewind';
export const TOOLS: Partial<Record<ItemId, Tool>> = { wildcard2: 'wild', split1: 'split', split2: 'split', bridge: 'jump', loopback1: 'loop', loopback2: 'loop', mux: 'mux', rewind: 'rewind' };

// Item state of the run matrix in play: data node cell, data per target, and the before-first-move tools still unused.
// tools: an item tool was used this matrix (Bare hands bonus); bounty: the matrix's bonus objective.
// rep: the Repeater cell; rewind: Rewind still unused, back: the lane before the last pick; charge: a ×2 data charge is spent here.
export interface ItemState {
  node?: Cell; trap?: Cell; worth: number[]; cuts: number[]; wild: boolean; split: boolean; jump: boolean; loop: boolean; mux: boolean; jumps: number[]; tools: boolean;
  bounty?: BountyId; rewards: RewardId[]; rep?: Cell; rewind: boolean; back?: Pick<Run, 'axis' | 'idx' | 'free'>; charge?: boolean;
}
export const emptyItems = (): ItemState => ({ worth: [], cuts: [], wild: false, split: false, jump: false, loop: false, mux: false, jumps: [], tools: false, rewind: false, rewards: [] });

// What the run brings into the matrix; other modes pass EMPTY_CTX.
export interface Ctx { items: ItemId[]; daemons: DaemonId[]; ice: IceId[]; lastStart?: number }
export const EMPTY_CTX: Ctx = { items: [], daemons: [], ice: [] };
export const ctxOf = (s: RunState): Ctx => ({ items: s.items, daemons: s.daemons, ice: roomIce(s), lastStart: s.lastStart });

export interface Board { puzzle: Puzzle; run: Run; m: ItemState; armed: Tool | null; ctx: Ctx; over: boolean }

export const loopAny = (b: Board) => b.ctx.items.includes('loopback2');

export function dealBoard(seed: number, s: RunState): Board {
  const has = (id: ItemId) => s.items.includes(id);
  const puzzle = dealRunMatrix(seed, s);
  const cells = placeCells(seed, puzzle, s.items);
  if (cells.wild) puzzle.grid[cells.wild[0]][cells.wild[1]] = WILD;
  // Target data is set before Repeater and Glob reshape the targets.
  const worth = puzzle.targets.map((t) => DATA_BY_LEN[t.length]);
  const rep = has('repeater') ? plantRepeat(seed, puzzle) : undefined;
  if (has('glob')) globTarget(seed, puzzle.targets);
  const m: ItemState = {
    ...emptyItems(), node: cells.node, trap: roomIce(s).includes('honeypot') ? trapCell(seed, puzzle, [cells.wild, cells.node]) : undefined, worth, rep,
    rewind: has('rewind'), cuts: cutMarks(seed, puzzle.targets), wild: has('wildcard2'), split: has('split1') || has('split2'), jump: has('bridge'),
    loop: has('loopback1') || has('loopback2'), mux: has('mux'), bounty: bountyHere(s) ? bountyFor(seed, s.items) : undefined, rewards: rewardsFor(seed, s.daemons),
  };
  const run = newRun();
  run.burn = burnOf(s) || undefined;
  return { puzzle, run, m, armed: null, ctx: ctxOf(s), over: false };
}
