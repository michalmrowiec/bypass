// Matrix rules for a run: the deal, what each cell shows and allows, and what a pick does. No DOM here.
import { burning, inLane, isLegal, newRun, WILD, type Run } from './game';
import { BLOCK, type Puzzle } from './generator';
import {
  bountyFor, bountyHere, burnOf, cutMarks, DATA_BY_LEN, dealRunMatrix, globTarget, isCorner, placeCells, plantRepeat, rewardsFor, roomIce, trapCell,
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

const isUsed = (b: Board, r: number, c: number) => b.run.used.has(r + ',' + c);
const same = (p: Cell | undefined, r: number, c: number) => !!p && p[0] === r && p[1] === c;
const lastPick = (b: Board): Cell | undefined => b.run.path[b.run.path.length - 1];
const onEdge = (b: Board, r: number, c: number) => { const n = b.puzzle.grid.length; return r === 0 || c === 0 || r === n - 1 || c === n - 1; };
// Mux: the next pick may take the row or the column of the last picked cell.
const muxLane = (b: Board, r: number, c: number) => { const p = lastPick(b); return !!p && (r === p[0] || c === p[1]); };
// Side door: before the first pick, any edge cell is open.
export const isDoorOpen = (b: Board) => !b.run.path.length && b.ctx.items.includes('sidedoor');
const doorEdge = (b: Board, r: number, c: number) => isDoorOpen(b) && onEdge(b, r, c);
// Blackout ICE: the SOC's targets stay hidden until the first pick.
export const isBlackout = (b: Board) => b.ctx.ice.includes('blackout') && !b.run.path.length && !b.over;
// Encryption: a free cell's code shows only in the line you pick in; an armed Bridge also sees the 8 cells around the last pick.
const bridgeSees = (b: Board, r: number, c: number) => {
  const p = lastPick(b);
  return b.armed === 'jump' && !!p && Math.max(Math.abs(p[0] - r), Math.abs(p[1] - c)) === 1;
};
export const isEncrypted = (b: Board, r: number, c: number) => !b.over && b.ctx.ice.includes('encryption') && !bridgeSees(b, r, c)
  && !isUsed(b, r, c) && !inLane(b.run, r, c) && !doorEdge(b, r, c);

// Rules only; the UI adds its own locks (dealing, daemon offer).
export function canPick(b: Board, r: number, c: number): boolean {
  const { grid } = b.puzzle;
  if (b.over || grid[r][c] === BLOCK || burning(b.run, r, c)) return false;
  switch (b.armed) {
    case 'wild': return !isUsed(b, r, c) && grid[r][c] !== WILD && !same(b.m.rep, r, c);
    case 'jump': return !isUsed(b, r, c);
    case 'loop': return isUsed(b, r, c) && (loopAny(b) || inLane(b.run, r, c));
    case 'mux': return !isUsed(b, r, c) && muxLane(b, r, c);
    default: return isLegal(b.run, r, c) || doorEdge(b, r, c);
  }
}

export interface CellView { code: string; hidden: boolean; cls: string[]; tags: ('node' | 'trap' | 'rep')[]; burnLeft?: number }

// What a cell shows; `cls` are the cell's CSS classes, except 'ok' (pickable), which the UI adds.
export function cellView(b: Board, r: number, c: number): CellView {
  const { grid, path } = b.puzzle;
  const code = grid[r][c];
  const hidden = code !== BLOCK && isEncrypted(b, r, c);
  const cls: string[] = [], tags: CellView['tags'] = [];
  let burnLeft: number | undefined;
  if (hidden) cls.push('enc');
  if (code === WILD) cls.push('wild');
  if (code === BLOCK) cls.push('ice');
  if (same(b.m.node, r, c)) tags.push('node');
  if (same(b.m.trap, r, c)) { cls.push('trap'); tags.push('trap'); }
  if (same(b.m.rep, r, c)) tags.push('rep');
  // Ping: a solution's first cell, until the first pick.
  if (b.ctx.items.includes('ping') && !b.run.path.length && !b.over && same(path?.[0], r, c)) cls.push('ping');
  if (!b.over && (inLane(b.run, r, c) || doorEdge(b, r, c))) cls.push('lane');
  if (isUsed(b, r, c)) cls.push('used');
  else if (burning(b.run, r, c)) { cls.push('burn'); burnLeft = b.run.burnt!.get(r + ',' + c)! - b.run.path.length; }
  // With a Loopback in the deck, used cells keep their code, greyed out, so a re-pick can be planned.
  if (b.ctx.items.some((id) => TOOLS[id] === 'loop')) cls.push('memo');
  if (b.ctx.daemons.includes('corner') && isCorner([r, c], grid.length)) cls.push('corner');
  return burnLeft === undefined ? { code, hidden, cls, tags } : { code, hidden, cls, tags, burnLeft };
}

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
