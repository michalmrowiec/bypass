import { contains } from './game';
import { CODES, hashStr, rng, SIZES, type Size } from './generator';

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

// Run buffers have no spare slots; extra buffer will come from the shop.
export const sectionMatrix = (section: number): Size => ({ ...SECTIONS[section].size, slack: 0, codes: RUN_POOL });

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
}

export const newRunState = (seed: number): RunState =>
  ({
    seed, matrix: 0, section: 0, data: 0, scores: SECTIONS.map(() => []), restarts: RESTARTS, credits: 0, earned: [], daemons: [], cache: 0,
  });

export const played = (s: RunState) => s.scores[s.section].length;

const earn = (s: RunState, why: string, n: number) => {
  if (n) { s.credits += n; s.earned.push([why, n]); }
};

export const matrixData = (buf: string[], targets: string[][]) =>
  targets.filter((t) => contains(buf, t)).reduce((a, t) => a + DATA_BY_LEN[t.length], 0);

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

export interface MatrixCtx { buf: string[]; path: [number, number][]; targets: string[][]; l: number; n: number }

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
    const i = buf.findIndex((_, i) => t.every((c, j) => buf[i + j] === c));
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
  silent: { name: 'Silent', family: 'Ghost', text: '+2 credits each time you end a matrix early with Disconnect',
    end: (s, _f, disconnected) => { if (disconnected) earn(s, 'Silent daemon', 2); } },
  cache: { name: 'Cache', family: 'Ghost', text: '+0.25 boost for good per matrix with 2+ empty slots; a full buffer resets it',
    score: (_f, s) => (s.cache ? { boost: s.cache } : null),
    end: (s, f) => { s.cache = f.empty === 0 ? 0 : f.empty >= 2 ? s.cache + 0.25 : s.cache; } },
  longjump: { name: 'Long jump', family: 'Runner', text: '+5 data per move from one end of a lane to the other',
    score: (f) => (f.edgeJumps ? { flat: 5 * f.edgeJumps } : null) },
  corner: { name: 'Corner', family: 'Runner', text: '×1.5 when the path starts or ends in a corner',
    score: (f) => (f.corner ? { mult: 1.5 } : null) },
  zigzag: { name: 'Zigzag', family: 'Runner', text: '+0.5 boost per move longer than the one before',
    score: (f) => { const k = f.moves.filter((d, i) => i > 0 && d > f.moves[i - 1]).length; return k ? { boost: 0.5 * k } : null; } },
} satisfies Record<string, Daemon>;
export type DaemonId = keyof typeof DAEMONS;

export interface Score { base: number; flat: number; boost: number; mult: number; total: number; fired: [DaemonId, Effect][] }

export function scoreMatrix(ctx: MatrixCtx, s: RunState): Score {
  const f = facts(ctx);
  const sc: Score = { base: matrixData(ctx.buf, ctx.targets), flat: 0, boost: 0, mult: 1, total: 0, fired: [] };
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
  const pool = (Object.keys(DAEMONS) as DaemonId[]).filter((id) => !s.daemons.includes(id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

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
