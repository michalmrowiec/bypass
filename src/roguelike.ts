import { contains, fits, newRun, pick, type Run } from './game';
import { BLOCK, CODES, generate, hashStr, rng, SIZES, type Puzzle, type Size } from './generator';
import { canComplete } from './solver';

// Roguelike mode: a run breaches one company, a chain of sections (rooms); each plays a few matrices and must reach its data quota by then.
export const RUN_POOL = [...CODES];
export const DATA_BY_LEN: Record<number, number> = { 2: 10, 3: 25, 4: 45 };

// Boss ICE: one rule for the last room, drawn from the run seed and the company's pool, shown from the start of the run.
export const ICE = {
  firewall: { name: 'Firewall', text: 'One row or column is sealed off (##); the solution routes around it' },
  throttle: { name: 'Throttle', text: 'Buffer −1; at least one target always fits' },
  blackout: { name: 'Blackout', text: 'Targets stay hidden until your first pick; every start in the top row reaches one' },
  corruption: { name: 'Corruption', text: 'Each pick locks the cells above, below and beside it for a few moves; every Corruption patch makes it last longer' },
};
export type IceId = keyof typeof ICE;

export interface Section { name: string; quota: number; matrices: number; size: Size; brief: string }
// ice: the boss rule pool; patches: what the company deploys between iterations.
// codes: the company's own code pool, same size as the default one, so it only changes the look; so do the row and column labels.
export interface Company {
  id: string; name: string; text: string; codes: string[]; sections: Section[]; ice: IceId[]; patches: IceId[];
  rowLabel?: (r: number) => string; colLabel?: (c: number) => string;
}
export const COMPANIES: Company[] = [{
  id: 'kestrel',
  name: 'Kestrel Logistics',
  text: 'Mid-size freight forwarder. Flat office network, one SOC on day shift.',
  codes: RUN_POOL,
  sections: [
    { name: 'Reception', quota: 25, matrices: 1, size: SIZES.easy, brief: 'Front desk terminals. Guest Wi-Fi. Nobody watching.' },
    { name: 'Offices', quota: 90, matrices: 2, size: SIZES.normal, brief: 'Open-plan desks, unlocked workstations, passwords on sticky notes.' },
    { name: 'Server Room', quota: 320, matrices: 3, size: SIZES.hard, brief: 'Cold air, humming racks. This is where the real data lives.' },
    { name: 'SOC', quota: 250, matrices: 2, size: SIZES.hard, brief: 'Security Operations Center. Analysts on shift, alerts on every port.' },
  ],
  ice: ['firewall', 'throttle', 'blackout'],
  patches: ['firewall', 'throttle', 'blackout', 'corruption'],
}, {
  id: 'meridian',
  name: 'Meridian Health',
  text: 'Regional hospital group. Sprawling legacy systems, huge patient record stores.',
  codes: ['A3', '5C', 'F0', '2E', '9B'],
  rowLabel: (r) => 'W' + (r + 1), // ward
  colLabel: (c) => 'B' + String(c + 1).padStart(2, '0'), // bed
  sections: [
    { name: 'Lobby', quota: 50, matrices: 1, size: { n: 6, lens: [2, 3, 4], links: [1], slack: 0 }, brief: 'Visitor kiosks and a nurse station login nobody ever locks.' },
    { name: 'Wards', quota: 150, matrices: 2, size: { n: 7, lens: [3, 3, 4], links: [1, 2], slack: 0 }, brief: 'Bedside terminals on a flat network, one VLAN for everything.' },
    { name: 'Records', quota: 300, matrices: 2, size: { n: 8, lens: [3, 4, 4], links: [2], slack: 0 }, brief: 'Decades of patient files on servers older than the interns.' },
    { name: 'SOC', quota: 400, matrices: 2, size: { n: 8, lens: [3, 3, 4, 4], links: [2, 3], slack: 0 }, brief: 'A night-shift analyst and a wall of dashboards. Big matrices, long chains.' },
  ],
  ice: ['firewall', 'throttle', 'blackout'],
  patches: ['firewall', 'throttle', 'blackout', 'corruption'],
}];
// The first company is always open; breaching one opens the next.
export const companyOpen = (breached: string[], i: number) => i === 0 || breached.includes(COMPANIES[i - 1]?.id);
export const sections = (s: RunState) => COMPANIES[s.company].sections;
export const isBoss = (s: RunState) => s.section === sections(s).length - 1;

// Iterations: after the boss the company patches itself and the rooms come round again, quotas doubled; the last one wins.
export const LOOPS = 3;
export const QUOTA_GROWTH = 2;
export const quota = (s: RunState, i = s.section) => sections(s)[i].quota * QUOTA_GROWTH ** s.loop;

// A patch adds one ICE rule to one room, live from iteration `loop` on.
export interface Patch { ice: IceId; room: number; loop: number }
const live = (s: RunState) => s.patches.filter((p) => p.loop <= s.loop);
// A patch shows in the contract once its room has been entered.
export const revealed = (s: RunState, p: Patch) => s.loop > p.loop || s.section >= p.room;

// The ICE rules in a room: the boss rule plus the patches deployed there.
export const roomIce = (s: RunState, i = s.section): IceId[] =>
  [...new Set([...(i === sections(s).length - 1 ? [s.ice] : []), ...live(s).filter((p) => p.room === i).map((p) => p.ice)])];

// Corruption lasts one move per Corruption patch (at least 1), for good from the third.
export function burnOf(s: RunState, i = s.section): number {
  if (!roomIce(s, i).includes('corruption')) return 0;
  const n = live(s).filter((p) => p.ice === 'corruption').length;
  const burn = n >= 3 ? Infinity : Math.max(1, n);
  return !s.items.includes('heatsink') ? burn : burn === Infinity ? 2 : burn - 1;
}

function deployPatch(s: RunState): Patch {
  const r = rng(hashStr(s.seed + '/patch/' + s.loop));
  const pool = COMPANIES[s.company].patches, rooms = sections(s).length;
  for (let k = 0; ; k++) {
    const p = { ice: pool[Math.floor(r() * pool.length)], room: Math.floor(r() * rooms), loop: s.loop };
    // A rule already in that room adds nothing, except Corruption, which grows.
    if (k < 30 && p.ice !== 'corruption' && roomIce(s, p.room).includes(p.ice)) continue;
    s.patches.push(p);
    return p;
  }
}
// Re-dealing a matrix (before the first move) needs a Burner SIM: once per room.
const restartsFor = (s: { items: ItemId[] }) => (s.items.includes('sim') ? 1 : 0);
export const DAEMON_SLOTS = 4;
// Credits: one per SURPLUS_PER_CREDIT data over the quota, SECTION_CREDIT per cleared section,
// one per SLOTS_PER_CREDIT empty buffer slots in a matrix that uploaded something.
export const SURPLUS_PER_CREDIT = 20;
export const SURPLUS_CAP = 3; // per room, so huge scores don't flood the economy
export const SECTION_CREDIT = 1;
export const SLOTS_PER_CREDIT = 2;

// Run buffers have no spare slots of their own; shop items add buffer, links and shorter targets.
export function sectionMatrix(section: number, items: ItemId[] = [], company = 0): Size {
  const size = COMPANIES[company].sections[section].size;
  const has = (id: ItemId) => items.includes(id);
  const lens = [...size.lens];
  let slack = has('buffer2') ? 2 : has('buffer1') ? 1 : 0;
  // Short key trims the longest target but keeps the buffer, so the cut code becomes a spare slot.
  if (has('shortkey')) { lens[lens.indexOf(Math.max(...lens))]--; slack++; }
  const links = has('linker1') || has('linker2') ? size.links.map((k) => k + 1) : size.links;
  return { ...size, lens, slack, links, deep: has('linker2') ? 1 : 0, codes: COMPANIES[company].codes };
}

export interface RunState {
  seed: number;
  company: number; // index into COMPANIES
  loop: number; // iteration, 0-based
  patches: Patch[];
  matrix: number; // matrices dealt so far (restarts included), feeds the per-matrix seed
  section: number;
  data: number;
  scores: number[][]; // banked score of each finished matrix, per section
  restarts: number;
  credits: number;
  earned: [string, number][]; // credits from the last finished matrix, by source
  daemons: DaemonId[];
  stacks: Partial<Record<DaemonId, number>>; // streak daemons' banked stacks
  lastStart?: number; // column of the previous matrix's first pick (cron/rotate)
  rack: number; // rack slots for items
  items: ItemId[]; // shop items owned, kept for the run
  shelf: ItemId[]; // what the shop offers on this visit
  rerolls: number; // shelf rerolls on this visit
  ice: IceId; // the boss room's rule
}

export function newRunState(seed: number, company = 0): RunState {
  const { ice, sections: rooms } = COMPANIES[company];
  return {
    seed, company, loop: 0, patches: [], matrix: 0, section: 0, data: 0, scores: rooms.map(() => []), restarts: 0, credits: 0, earned: [], daemons: [], stacks: {}, rack: RACK_BASE, items: [], shelf: [], rerolls: 0,
    ice: ice[Math.floor(rng(hashStr(seed + '/ice'))() * ice.length)],
  };
}

export const played = (s: RunState) => s.scores[s.section].length;

const earn = (s: RunState, why: string, n: number) => {
  if (n) { s.credits += n; s.earned.push([why, n]); }
};

// worth: data per target when it differs from its length's value (split targets).
export const matrixData = (buf: string[], targets: string[][], worth?: number[]) =>
  targets.reduce((a, t, i) => (contains(buf, t) ? a + (worth?.[i] ?? DATA_BY_LEN[t.length]) : a), 0);

export type MatrixOutcome = 'continue' | 'section' | 'loop' | 'win' | 'lose';

// Banks a finished matrix; after the section's last one, checks the quota and pays the section credits.
export function endMatrix(s: RunState, data: number, emptySlots: number): MatrixOutcome {
  s.data += data;
  if (data) earn(s, emptySlots + ' empty buffer slots (1 per ' + SLOTS_PER_CREDIT + ')', Math.floor(emptySlots / SLOTS_PER_CREDIT));
  s.scores[s.section].push(data);
  const goal = quota(s);
  if (played(s) < sections(s)[s.section].matrices) return 'continue';
  if (s.data < goal) return 'lose';
  earn(s, 'section cleared', SECTION_CREDIT);
  earn(s, s.data - goal + ' data over the quota (1 per ' + SURPLUS_PER_CREDIT + ', max ' + SURPLUS_CAP + ')',
    Math.min(SURPLUS_CAP, Math.floor((s.data - goal) / SURPLUS_PER_CREDIT)));
  if (s.items.includes('chip')) earn(s, 'Credit chip', 1);
  return !isBoss(s) ? 'section' : s.loop < LOOPS - 1 ? 'loop' : 'win';
}

// Moves on to the next room; after the boss, starts the next iteration and returns the patch it brought.
export function nextSection(s: RunState): Patch | undefined {
  Object.assign(s, { section: s.section + 1, data: 0, restarts: restartsFor(s) });
  if (s.section < sections(s).length) return;
  Object.assign(s, { section: 0, loop: s.loop + 1, scores: sections(s).map(() => []) });
  return deployPatch(s);
}

// --- Daemons: passive upgrades. Matrix score = (data + flat) × (1 + boost) × mult; no upload means 0.

// jumps: path indices of cells reached off the lane (Bridge, Loopback v2.0); those are no lane moves, so daemons skip them.
export interface MatrixCtx {
  buf: string[]; path: [number, number][]; targets: string[][]; l: number; n: number; worth?: number[]; node?: Cell; jumps?: number[];
}

interface Facts {
  done: string[][];
  all: boolean;
  shared: number; // buffer slots inside 2+ uploaded targets
  empty: number;
  light: boolean; // at most half the buffer used
  moves: number[]; // length of each move along its lane
  edgeJumps: number;
  corner: boolean; // path starts or ends in a corner
  start?: number; // column of the first pick
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

function facts({ buf, path, targets, l, n, jumps }: MatrixCtx): Facts {
  const done = targets.filter((t) => contains(buf, t));
  const moves = path.slice(1).flatMap((p, i) => (jumps?.includes(i + 1) ? [] : [moveLen(path[i], p)]));
  return {
    done, all: done.length === targets.length, shared: coverage(buf, done).filter((k) => k >= 2).length,
    empty: l - buf.length, light: buf.length <= l / 2,
    moves, edgeJumps: moves.filter((d) => d === n - 1).length, corner: isCorner(path[0], n) || isCorner(path[path.length - 1], n),
    start: path[0]?.[1],
  };
}

export interface Effect { flat?: number; boost?: number; mult?: number }
// streak: a stack that grows each matrix its condition holds and resets when it breaks; `next` gives the stack after
// this matrix, so the live score already counts it. Matrices that upload nothing leave every stack alone.
interface Streak { next: (n: number, f: Facts, s: RunState, disconnected: boolean) => number; effect: (n: number) => Effect }
interface Daemon {
  name: string;
  family: 'Splicer' | 'Ghost' | 'Runner' | 'Cron';
  text: string;
  score?: (f: Facts, s: RunState) => Effect | null;
  streak?: Streak;
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
  silent: { name: 'Silent', family: 'Ghost', text: '+$2 each time you end a matrix early with Disconnect',
    end: (s, _f, disconnected) => { if (disconnected) earn(s, 'Silent daemon', 2); } },
  cache: { name: 'Cache', family: 'Ghost',
    text: '+0.25 boost for every matrix in a row ending with 2+ empty buffer slots, this one included; a full buffer resets the stack',
    streak: { next: (n, f) => (f.empty === 0 ? 0 : f.empty >= 2 ? n + 1 : n), effect: (n) => ({ boost: 0.25 * n }) } },
  longjump: { name: 'Long jump', family: 'Runner', text: '+5 data per move from one end of a lane to the other',
    score: (f) => (f.edgeJumps ? { flat: 5 * f.edgeJumps } : null) },
  corner: { name: 'Corner', family: 'Runner', text: '×1.5 when the path starts or ends in a corner',
    score: (f) => (f.corner ? { mult: 1.5 } : null) },
  zigzag: { name: 'Zigzag', family: 'Runner', text: '+0.5 boost per move longer than the one before',
    score: (f) => { const k = f.moves.filter((d, i) => i > 0 && d > f.moves[i - 1]).length; return k ? { boost: 0.5 * k } : null; } },
  // Cron: scheduled jobs. Keep doing the thing every matrix and the stack grows; slip once and it is gone.
  heartbeat: { name: 'Heartbeat', family: 'Cron', text: '+0.25 boost for every matrix in a row where you upload every target, this one included; missing one resets the stack',
    streak: { next: (n, f) => (f.all ? n + 1 : 0), effect: (n) => ({ boost: 0.25 * n }) } },
  rotate: { name: 'Rotate', family: 'Cron', text: '+5 data for every matrix in a row whose first pick is in a different column than the last one; the same column resets the stack',
    streak: { next: (n, f, s) => (f.start === undefined ? n : f.start !== s.lastStart ? n + 1 : 0), effect: (n) => ({ flat: 5 * n }) } },
  backup: { name: 'Backup', family: 'Cron', text: '+0.5 boost for every matrix in a row ending with exactly 1 empty buffer slot; any other ending resets the stack',
    streak: { next: (n, f) => (f.empty === 1 ? n + 1 : 0), effect: (n) => ({ boost: 0.5 * n }) } },
  uptime: { name: 'Uptime', family: 'Cron', text: '+10 data for every matrix in a row with no Disconnect and no restart; either resets the stack',
    streak: { next: (n, _f, _s, disconnected) => (disconnected ? 0 : n + 1), effect: (n) => ({ flat: 10 * n }) } },
} satisfies Record<string, Daemon>;
export type DaemonId = keyof typeof DAEMONS;
export const streakOf = (id: DaemonId) => (DAEMONS[id] as Daemon).streak;

// Restarting a matrix breaks an Uptime streak.
export function restartMatrix(s: RunState): void {
  s.restarts--;
  if (s.stacks.uptime) s.stacks.uptime = 0;
}

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
  if (f.done.length && s.items.includes('thumb')) {
    sc.flat += THUMB_DATA;
    sc.gear.push(['thumb', { flat: THUMB_DATA }]);
  }
  for (const id of s.daemons) {
    const d = DAEMONS[id] as Daemon;
    const n = d.streak?.next(s.stacks[id] ?? 0, f, s, false);
    const e = d.streak ? (n ? d.streak.effect(n) : null) : d.score?.(f, s);
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
  if (!f.done.length) return;
  for (const id of s.daemons) {
    const d = DAEMONS[id] as Daemon;
    if (d.streak) s.stacks[id] = d.streak.next(s.stacks[id] ?? 0, f, s, disconnected);
    d.end?.(s, f, disconnected);
  }
  s.lastStart = f.start;
}

// Ends a matrix: scores it, applies after-matrix daemons and banks it; s.earned then lists its credits.
export function finishMatrix(s: RunState, ctx: MatrixCtx, disconnected: boolean) {
  s.earned = [];
  const score = scoreMatrix(ctx, s);
  daemonsAfterMatrix(ctx, s, disconnected);
  return { score, out: endMatrix(s, score.total, ctx.l - ctx.buf.length) };
}

// Three daemons the run doesn't own yet, the same for a given run seed and section.
// Seed key of a visit between rooms; iterations after the first get their own offers and shelves.
const visit = (s: RunState) => s.section + (s.loop ? '.' + s.loop : '');

// With every slot full the offer still comes; taking one swaps out an installed daemon.
export function offerDaemons(s: RunState): DaemonId[] {
  const r = rng(hashStr(s.seed + '/offer/' + visit(s)));
  return shuffled((Object.keys(DAEMONS) as DaemonId[]).filter((id) => !s.daemons.includes(id)), r).slice(0, 3);
}

const shuffled = <T>(a: T[], r: () => number) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// One line of the move preview: the daemon, what it gives so far (now), what this pick adds, an optional note.
// kind picks the colour: data, or boost/multiplier.
export interface Preview { id?: DaemonId; name: string; now?: string; add: string; kind: 'data' | 'boost'; note?: string }

// What the owned path daemons would make of picking `cell` next. Shown for the cell under the cursor only,
// so the player still plans the route. jumps: path indices reached off the lane, which are no moves.
export function movePreview(path: Cell[], cell: Cell, n: number, daemons: DaemonId[], jumps: number[] = []): Preview[] {
  const out: Preview[] = [];
  const prev = path[path.length - 1], before = path[path.length - 2];
  const moves = path.slice(1).flatMap((p, i) => (jumps.includes(i + 1) ? [] : [moveLen(path[i], p)]));
  const num = (x: number) => (x ? String(x) : undefined);
  if (daemons.includes('corner') && isCorner(cell, n) && !isCorner(path[0], n)) {
    out.push({ id: 'corner', name: path.length ? 'corner' : 'corner start', add: '×1.5', kind: 'boost', ...(path.length ? { note: 'if the path ends here' } : {}) });
  }
  if (prev && daemons.includes('longjump') && moveLen(prev, cell) === n - 1) {
    out.push({ id: 'longjump', name: 'long jump', now: num(5 * moves.filter((d) => d === n - 1).length), add: '+5', kind: 'data' });
  }
  if (before && daemons.includes('zigzag') && moveLen(prev, cell) > moveLen(before, prev)) {
    out.push({ id: 'zigzag', name: 'zigzag', now: num(0.5 * moves.filter((d, i) => i > 0 && d > moves[i - 1]).length), add: '+0.5 boost', kind: 'boost' });
  }
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
  sidedoor: { name: 'Side door', ver: '1.0', kind: 'lockpick set', price: 3, text: 'Your first pick may come from any edge; a corner lets the next pick take its row or its column' },
  bridge: { name: 'Bridge', ver: '1.0', kind: 'antenna', price: 5, text: 'Once per matrix, arm it to jump to any free cell off your lane; daemons skip the jump as a move' },
  loopback1: { name: 'Loopback', ver: '1.0', kind: 'loopback plug', price: 3, text: 'Once per matrix, arm it to pick a used cell in your lane again; its code goes into the buffer once more' },
  loopback2: { name: 'Loopback', ver: '2.0', kind: 'twin loopback', price: 3, text: 'Upgrades v1.0: the used cell can be anywhere on the matrix; daemons skip that jump as a move', needs: 'loopback1' },
  // Cheap, modest modules: filler for the shelf and a use for spare credits.
  thumb: { name: 'Thumb drive', ver: '1.0', kind: 'USB stick', price: 2, text: '+5 data in every matrix that uploads a target' },
  chip: { name: 'Credit chip', ver: '1.0', kind: 'smart card', price: 2, text: '+$1 for every room you clear' },
  ping: { name: 'Ping', ver: '1.0', kind: 'network probe', price: 2, text: 'Before your first move, marks a top-row cell where a solution starts' },
  heatsink: { name: 'Heatsink', ver: '1.0', kind: 'cooler', price: 2, text: 'Corruption locks cells 1 move shorter; for good becomes 2 moves' },
  sim: { name: 'Burner SIM', ver: '1.0', kind: 'prepaid SIM', price: 3, text: 'Once per room, before your first move, swap the matrix for a fresh one' },
} satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEMS;
export const SHELF = 3;
export const THUMB_DATA = 5;
// The rack holds RACK_BASE modules; more slots cost more each, up to RACK_MAX. A sold module returns half of what it cost.
export const RACK_BASE = 4;
export const RACK_MAX = 9;
export const slotCost = (s: RunState) => 5 + 2 * (s.rack - RACK_BASE);
export const rackFull = (s: RunState, id: ItemId) => !item(id).needs && s.items.length >= s.rack;
export const sellValue = (id: ItemId) => Math.floor((item(id).price + (item(id).needs ? item(item(id).needs as ItemId).price : 0)) / 2);
export const REROLL_COST = 1;
export const SWAP_COST = 6;

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
  s.shelf = shuffled(forSale(s), rng(hashStr(s.seed + '/shop/' + visit(s) + '/' + s.rerolls))).slice(0, SHELF);
  return true;
}

export function buy(s: RunState, id: ItemId): boolean {
  const it = item(id);
  if (!s.shelf.includes(id) || s.credits < it.price || rackFull(s, id)) return false;
  s.credits -= it.price;
  s.items = s.items.filter((o) => o !== it.needs).concat(id);
  s.restarts = Math.max(s.restarts, restartsFor(s)); // a SIM bought in the shop works in the next room
  s.shelf = s.shelf.filter((o) => o !== id);
  return true;
}

export function buySlot(s: RunState): boolean {
  if (s.rack >= RACK_MAX || s.credits < slotCost(s)) return false;
  s.credits -= slotCost(s);
  s.rack++;
  return true;
}

export function sell(s: RunState, id: ItemId): boolean {
  if (!s.items.includes(id)) return false;
  s.credits += sellValue(id);
  s.items = s.items.filter((o) => o !== id);
  s.restarts = Math.min(s.restarts, restartsFor(s));
  return true;
}

// With every slot full, taking an offered daemon swaps an installed one out, at a steep price.
export function swapDaemon(s: RunState, out: DaemonId, id: DaemonId): boolean {
  const i = s.daemons.indexOf(out);
  if (s.credits < SWAP_COST || i < 0) return false;
  s.credits -= SWAP_COST;
  s.daemons[i] = id;
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
  const pickCell = (pool: Cell[]) => pool[Math.floor(r() * pool.length)];
  const open = cells.filter((c) => p.grid[c[0]][c[1]] !== BLOCK);
  const wild = items.includes('wildcard1') ? pickCell(open.filter((c) => !onPath(c))) : undefined;
  const nodeOnPath = r() < NODE_ON_PATH;
  const node = items.includes('datanode') ? pickCell(open.filter((c) => c !== wild && onPath(c) === nodeOnPath)) : undefined;
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

// Side door, after a first pick on an edge: the left or right edge goes on along its row, a corner frees the next axis.
export function sideDoor(run: Run, r: number, c: number, n: number): void {
  const side = c === 0 || c === n - 1, end = r === 0 || r === n - 1;
  if (side && end) run.free = [r, c];
  else if (side) { run.axis = 'row'; run.idx = r; }
}

// A Blackout start is fair if, after that first pick, some target can still be uploaded.
const startsWell = (p: Puzzle, c: number, burn?: number) => {
  if (p.grid[0][c] === BLOCK) return true;
  const run = newRun();
  run.burn = burn;
  pick(run, p, 0, c);
  return p.targets.some((t) => contains(run.buffer, t) || canComplete(run, { ...p, targets: [t] }, 5_000));
};

// The run's matrix for a seed: the room's size with the items, plus the room's ICE rules.
export function dealRunMatrix(seed: number, s: RunState): Puzzle {
  const rules = roomIce(s);
  let size = sectionMatrix(s.section, s.items, s.company);
  if (rules.includes('throttle')) size = { ...size, slack: size.slack - 1 };
  if (rules.includes('corruption')) size = { ...size, burn: burnOf(s) };
  if (rules.includes('firewall')) {
    const r = rng(hashStr(seed + '/ice'));
    const row = r() < 0.5;
    size = { ...size, block: row ? ['row', 1 + Math.floor(r() * (size.n - 1))] : ['col', Math.floor(r() * size.n)] };
  }
  let p = generate(seed, size);
  // Blackout: redeal until every top-row start can still upload some target.
  if (rules.includes('blackout')) {
    for (let k = 1; k < 50 && !p.grid[0].every((_, c) => startsWell(p, c, size.burn)); k++) p = generate(hashStr(seed + '/' + k), size);
  }
  return p;
}
