import { contains, fits } from './game';
import { CODES, hashStr, rng, SIZES, type Puzzle, type Size } from './generator';

// Roguelike mode: a run is a chain of sections (rooms); each plays a few matrices and must reach its data quota by then.
export const RUN_POOL = [...CODES];
export const DATA_BY_LEN: Record<number, number> = { 2: 10, 3: 25, 4: 45 };
export const SECTIONS = [
  { name: 'Reception', quota: 25, matrices: 1, size: SIZES.easy },
  { name: 'Offices', quota: 70, matrices: 2, size: SIZES.normal },
  { name: 'Server Room', quota: 170, matrices: 3, size: SIZES.hard },
];
export const RESTARTS = 1;
export const DAEMON_SLOTS = 4;
// Credits: one per SURPLUS_PER_CREDIT data over the quota, SECTION_CREDIT per cleared section,
// one per SLOTS_PER_CREDIT empty buffer slots in a matrix that uploaded something.
export const SURPLUS_PER_CREDIT = 20;
export const SECTION_CREDIT = 1;
export const SLOTS_PER_CREDIT = 2;

// Run buffers have no spare slots of their own; shop items add buffer, links and shorter targets.
export function sectionMatrix(section: number, items: ItemId[] = []): Size {
  const size = SECTIONS[section].size;
  const has = (id: ItemId) => items.includes(id);
  const lens = [...size.lens];
  let slack = has('buffer2') ? 2 : has('buffer1') ? 1 : 0;
  // Short key trims the longest target but keeps the buffer, so the cut code becomes a spare slot.
  if (has('shortkey')) { lens[lens.indexOf(Math.max(...lens))]--; slack++; }
  const links = has('linker1') || has('linker2') ? size.links.map((k) => k + 1) : size.links;
  return { ...size, lens, slack, links, deep: has('linker2') ? 1 : 0, codes: RUN_POOL };
}

export interface RunState {
  seed: number;
  matrix: number; // matrices dealt so far (restarts included), feeds the per-matrix seed
  section: number;
  data: number;
  scores: number[][]; // banked score of each finished matrix, per section
  restarts: number;
  credits: number;
  earned: [string, number][]; // credits from the last finished matrix, by source
  daemons: DaemonId[];
  cache: number; // boost banked by the Cache daemon
  items: ItemId[]; // shop items owned, kept for the run
  shelf: ItemId[]; // what the shop offers on this visit
  rerolls: number; // shelf rerolls on this visit
}

export const newRunState = (seed: number): RunState =>
  ({
    seed, matrix: 0, section: 0, data: 0, scores: SECTIONS.map(() => []), restarts: RESTARTS, credits: 0, earned: [], daemons: [], cache: 0, items: [], shelf: [], rerolls: 0,
  });

export const played = (s: RunState) => s.scores[s.section].length;

const earn = (s: RunState, why: string, n: number) => {
  if (n) { s.credits += n; s.earned.push([why, n]); }
};

// worth: data per target when it differs from its length's value (split targets).
export const matrixData = (buf: string[], targets: string[][], worth?: number[]) =>
  targets.reduce((a, t, i) => (contains(buf, t) ? a + (worth?.[i] ?? DATA_BY_LEN[t.length]) : a), 0);

export type MatrixOutcome = 'continue' | 'section' | 'win' | 'lose';

// Banks a finished matrix; after the section's last one, checks the quota and pays the section credits.
export function endMatrix(s: RunState, data: number, emptySlots: number): MatrixOutcome {
  s.data += data;
  if (data) earn(s, emptySlots + ' empty buffer slots (1 per ' + SLOTS_PER_CREDIT + ')', Math.floor(emptySlots / SLOTS_PER_CREDIT));
  s.scores[s.section].push(data);
  const { quota, matrices } = SECTIONS[s.section];
  if (played(s) < matrices) return 'continue';
  if (s.data < quota) return 'lose';
  earn(s, 'section cleared', SECTION_CREDIT);
  earn(s, s.data - quota + ' data over the quota (1 per ' + SURPLUS_PER_CREDIT + ')', Math.floor((s.data - quota) / SURPLUS_PER_CREDIT));
  return s.section === SECTIONS.length - 1 ? 'win' : 'section';
}

export function nextSection(s: RunState): void {
  Object.assign(s, { section: s.section + 1, data: 0, restarts: RESTARTS });
}

// --- Daemons: passive upgrades. Matrix score = (data + flat) × (1 + boost) × mult; no upload means 0.

export interface MatrixCtx { buf: string[]; path: [number, number][]; targets: string[][]; l: number; n: number; worth?: number[]; node?: Cell }

interface Facts {
  done: string[][];
  all: boolean;
  shared: number; // buffer slots inside 2+ uploaded targets
  empty: number;
  light: boolean; // at most half the buffer used
  moves: number[]; // length of each move along its lane
  edgeJumps: number;
  corner: boolean; // path starts or ends in a corner
}

type Cell = [number, number];
export const isCorner = (p: Cell | undefined, n: number) => !!p && (p[0] === 0 || p[0] === n - 1) && (p[1] === 0 || p[1] === n - 1);
// Picks alternate row/column, so consecutive cells share a lane; the move length is the distance along it.
const moveLen = (a: Cell, b: Cell) => (a[0] === b[0] ? Math.abs(a[1] - b[1]) : Math.abs(a[0] - b[0]));

// How many uploaded targets cover each buffer slot.
// shortcut: counts each target's first occurrence only; repeats in one buffer are rare.
export function coverage(buf: string[], targets: string[][]): number[] {
  const cover = buf.map(() => 0);
  for (const t of targets) {
    const i = buf.findIndex((_, i) => t.every((c, j) => fits(buf[i + j], c)));
    if (i >= 0) for (let j = 0; j < t.length; j++) cover[i + j]++;
  }
  return cover;
}

function facts({ buf, path, targets, l, n }: MatrixCtx): Facts {
  const done = targets.filter((t) => contains(buf, t));
  const moves = path.slice(1).map((p, i) => moveLen(path[i], p));
  return {
    done, all: done.length === targets.length, shared: coverage(buf, done).filter((k) => k >= 2).length,
    empty: l - buf.length, light: buf.length <= l / 2,
    moves, edgeJumps: moves.filter((d) => d === n - 1).length, corner: isCorner(path[0], n) || isCorner(path[path.length - 1], n),
  };
}

export interface Effect { flat?: number; boost?: number; mult?: number }
interface Daemon {
  name: string;
  family: 'Splicer' | 'Ghost' | 'Runner';
  text: string;
  score?: (f: Facts, s: RunState) => Effect | null;
  end?: (s: RunState, f: Facts, disconnected: boolean) => void; // after a matrix that uploaded something
}

// Cache stack once a matrix ends with `empty` buffer slots; the live score already counts the current matrix.
const cacheAfter = (stack: number, empty: number) => (empty === 0 ? 0 : empty >= 2 ? stack + 0.25 : stack);

export const DAEMONS = {
  chain: { name: 'Chain', family: 'Splicer', text: '+0.5 boost per buffer slot shared by 2 uploaded targets',
    score: (f) => (f.shared ? { boost: 0.5 * f.shared } : null) },
  compressor: { name: 'Compressor', family: 'Splicer', text: '+5 data per buffer slot shared by 2 uploaded targets',
    score: (f) => (f.shared ? { flat: 5 * f.shared } : null) },
  fullstack: { name: 'Full stack', family: 'Splicer', text: '×2 when every target is uploaded',
    score: (f) => (f.all ? { mult: 2 } : null) },
  overflow: { name: 'Overflow', family: 'Ghost', text: '+0.5 boost per empty buffer slot',
    score: (f) => (f.empty ? { boost: 0.5 * f.empty } : null) },
  light: { name: 'Light footprint', family: 'Ghost', text: '×2 when at most half the buffer is used',
    score: (f) => (f.light ? { mult: 2 } : null) },
  silent: { name: 'Silent', family: 'Ghost', text: '+$2 each time you end a matrix early with Disconnect',
    end: (s, _f, disconnected) => { if (disconnected) earn(s, 'Silent daemon', 2); } },
  cache: { name: 'Cache', family: 'Ghost',
    text: '+0.25 boost for every matrix in a row ending with 2+ empty buffer slots, this one included; a full buffer resets the stack',
    score: (f, s) => { const b = cacheAfter(s.cache, f.empty); return b ? { boost: b } : null; },
    end: (s, f) => { s.cache = cacheAfter(s.cache, f.empty); } },
  longjump: { name: 'Long jump', family: 'Runner', text: '+5 data per move from one end of a lane to the other',
    score: (f) => (f.edgeJumps ? { flat: 5 * f.edgeJumps } : null) },
  corner: { name: 'Corner', family: 'Runner', text: '×1.5 when the path starts or ends in a corner',
    score: (f) => (f.corner ? { mult: 1.5 } : null) },
  zigzag: { name: 'Zigzag', family: 'Runner', text: '+0.5 boost per move longer than the one before',
    score: (f) => { const k = f.moves.filter((d, i) => i > 0 && d > f.moves[i - 1]).length; return k ? { boost: 0.5 * k } : null; } },
} satisfies Record<string, Daemon>;
export type DaemonId = keyof typeof DAEMONS;

// gear: shop items that added something to this matrix, like daemons in fired.
export interface Score { base: number; flat: number; boost: number; mult: number; total: number; fired: [DaemonId, Effect][]; gear: [ItemId, Effect][] }

export function scoreMatrix(ctx: MatrixCtx, s: RunState): Score {
  const f = facts(ctx);
  const sc: Score = { base: matrixData(ctx.buf, ctx.targets, ctx.worth), flat: 0, boost: 0, mult: 1, total: 0, fired: [], gear: [] };
  const node = ctx.node;
  if (node && ctx.path.some((p) => p[0] === node[0] && p[1] === node[1])) {
    sc.flat += NODE_DATA;
    sc.gear.push(['datanode', { flat: NODE_DATA }]);
  }
  for (const id of s.daemons) {
    const e = (DAEMONS[id] as Daemon).score?.(f, s);
    if (!e) continue;
    sc.flat += e.flat ?? 0;
    sc.boost += e.boost ?? 0;
    sc.mult *= e.mult ?? 1;
    sc.fired.push([id, e]);
  }
  // Modifiers show while the path is built, but nothing scores until a target is uploaded.
  sc.total = f.done.length ? Math.floor((sc.base + sc.flat) * (1 + sc.boost) * sc.mult) : 0;
  return sc;
}

// Daemon effects that land once a matrix is over (credits, banked boosts); call before endMatrix.
export function daemonsAfterMatrix(ctx: MatrixCtx, s: RunState, disconnected: boolean): void {
  const f = facts(ctx);
  if (f.done.length) for (const id of s.daemons) (DAEMONS[id] as Daemon).end?.(s, f, disconnected);
}

// Ends a matrix: scores it, applies after-matrix daemons and banks it; s.earned then lists its credits.
export function finishMatrix(s: RunState, ctx: MatrixCtx, disconnected: boolean) {
  s.earned = [];
  const score = scoreMatrix(ctx, s);
  daemonsAfterMatrix(ctx, s, disconnected);
  return { score, out: endMatrix(s, score.total, ctx.l - ctx.buf.length) };
}

// Three daemons the run doesn't own yet, the same for a given run seed and section.
export function offerDaemons(s: RunState): DaemonId[] {
  if (s.daemons.length >= DAEMON_SLOTS) return [];
  const r = rng(hashStr(s.seed + '/offer/' + s.section));
  return shuffled((Object.keys(DAEMONS) as DaemonId[]).filter((id) => !s.daemons.includes(id)), r).slice(0, 3);
}

const shuffled = <T>(a: T[], r: () => number) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// What the owned path daemons would make of picking `cell` next. Shown for the cell under the cursor only,
// so the player still plans the route.
export function movePreview(path: Cell[], cell: Cell, n: number, daemons: DaemonId[]): string[] {
  const out: string[] = [];
  const prev = path[path.length - 1], before = path[path.length - 2];
  if (daemons.includes('corner') && isCorner(cell, n) && !isCorner(path[0], n)) {
    out.push(path.length ? 'corner ×1.5 if the path ends here' : 'corner start ×1.5');
  }
  if (prev && daemons.includes('longjump') && moveLen(prev, cell) === n - 1) out.push('long jump +5');
  if (before && daemons.includes('zigzag') && moveLen(prev, cell) > moveLen(before, prev)) out.push('zigzag +0.5 boost');
  return out;
}

// Shop items: hardware bought with credits and kept for the run. Daemons change the scoring; items change the matrix
// or the rules, with no family, so any of them can feed any build. A v2.0 is sold only to owners of its v1.0 and replaces it.
interface Item { name: string; ver: string; kind: string; price: number; text: string; needs?: string }
export const ITEMS = {
  buffer1: { name: 'Buffer', ver: '1.0', kind: 'memory module', price: 4, text: '+1 buffer slot in every matrix' },
  buffer2: { name: 'Buffer', ver: '2.0', kind: 'dual channel', price: 4, text: 'Upgrades v1.0 with one more slot: +2 in every matrix', needs: 'buffer1' },
  shortkey: { name: 'Short key', ver: '1.0', kind: 'cut key', price: 3, text: 'The longest target is 1 code shorter; the buffer keeps its size' },
  linker1: { name: 'Linker', ver: '1.0', kind: 'patch cable', price: 4, text: 'One more target starts with the last code of another' },
  linker2: { name: 'Linker', ver: '2.0', kind: 'twin cable', price: 4, text: 'Upgrades v1.0: one link also shares 2 codes (targets of 3+ codes)', needs: 'linker1' },
  wildcard1: { name: 'Wildcard', ver: '1.0', kind: 'master key', price: 4, text: 'In every matrix one random cell off the solution path turns into **, which fits any code' },
  wildcard2: { name: 'Wildcard', ver: '2.0', kind: 'tuned master key', price: 4, text: 'Upgrades v1.0: before your first move you choose the cell that turns into **', needs: 'wildcard1' },
  datanode: { name: 'Data node', ver: '1.0', kind: 'SSD', price: 3, text: 'One cell in every matrix holds +15 data: route through it and upload a target to bank it' },
  split1: { name: 'Split', ver: '1.0', kind: 'Y-splitter', price: 4, text: 'Before your first move, cut one target at its random cut mark; the parts share its data' },
  split2: { name: 'Split', ver: '2.0', kind: 'tunable splitter', price: 3, text: 'Upgrades v1.0: you choose where the target is cut', needs: 'split1' },
} satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEMS;
export const SHELF = 3;
export const REROLL_COST = 1;
export const REMOVE_COST = 2;

const item = (id: ItemId): Item => ITEMS[id];

// Not owned, v1.0 not yet replaced, v2.0 only over its v1.0.
export const forSale = (s: RunState) => (Object.keys(ITEMS) as ItemId[]).filter((id) => !s.items.includes(id)
  && (!item(id).needs || s.items.includes(item(id).needs as ItemId)) && !s.items.some((o) => item(o).needs === id));

// Fills the shelf for a shop visit, the same for a given run seed and section; a paid reroll draws again.
export function stockShop(s: RunState, reroll = false): boolean {
  if (reroll) {
    if (s.credits < REROLL_COST) return false;
    s.credits -= REROLL_COST;
    s.rerolls++;
  } else s.rerolls = 0;
  s.shelf = shuffled(forSale(s), rng(hashStr(s.seed + '/shop/' + s.section + '/' + s.rerolls))).slice(0, SHELF);
  return true;
}

export function buy(s: RunState, id: ItemId): boolean {
  const it = item(id);
  if (!s.shelf.includes(id) || s.credits < it.price) return false;
  s.credits -= it.price;
  s.items = s.items.filter((o) => o !== it.needs).concat(id);
  s.shelf = s.shelf.filter((o) => o !== id);
  return true;
}

export function removeDaemon(s: RunState, id: DaemonId): boolean {
  if (s.credits < REMOVE_COST || !s.daemons.includes(id)) return false;
  s.credits -= REMOVE_COST;
  s.daemons = s.daemons.filter((d) => d !== id);
  return true;
}

export const NODE_DATA = 15;
const NODE_ON_PATH = 0.2;

// Item cells of a matrix, the same for its seed: the Wildcard v1.0 cell never lies on the planted solution path,
// the Data node only in about one matrix in five.
export function placeCells(seed: number, p: Puzzle, items: ItemId[]): { wild?: Cell; node?: Cell } {
  const r = rng(hashStr(seed + '/cells'));
  const n = p.grid.length;
  const cells = Array.from({ length: n * n }, (_, i): Cell => [Math.floor(i / n), i % n]);
  const onPath = (c: Cell) => !!p.path?.some((q) => q[0] === c[0] && q[1] === c[1]);
  const pick = (pool: Cell[]) => pool[Math.floor(r() * pool.length)];
  const wild = items.includes('wildcard1') ? pick(cells.filter((c) => !onPath(c))) : undefined;
  const nodeOnPath = r() < NODE_ON_PATH;
  const node = items.includes('datanode') ? pick(cells.filter((c) => c !== wild && onPath(c) === nodeOnPath)) : undefined;
  return { wild, node };
}

// Split v1.0 cut marks: one random gap per target, the same for a matrix seed.
export const cutMarks = (seed: number, targets: string[][]) => {
  const r = rng(hashStr(seed + '/cuts'));
  return targets.map((t) => 1 + Math.floor(r() * (t.length - 1)));
};

// Cuts target i before code `at` (default: the middle, rounded up) into two targets that share its data.
export function splitTarget(targets: string[][], worth: number[], i: number, at = Math.ceil(targets[i].length / 2)) {
  const w = worth[i];
  return {
    targets: [...targets.slice(0, i), targets[i].slice(0, at), targets[i].slice(at), ...targets.slice(i + 1)],
    worth: [...worth.slice(0, i), Math.ceil(w / 2), Math.floor(w / 2), ...worth.slice(i + 1)],
  };
}
