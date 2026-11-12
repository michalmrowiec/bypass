import { contains, fits, newRun, partner, pick, WILD, type Run } from './game';
import { beltSrc, BLOCK, CODES, generate, hashStr, rng, SIZES, type Puzzle, type Size } from './generator';
import { canComplete } from './solver';

// Roguelike mode: a run breaches one company, a chain of sections (rooms); each plays a few matrices and must reach its data quota by then.
export const RUN_POOL = [...CODES];
export const DATA_BY_LEN: Record<number, number> = { 2: 10, 3: 25, 4: 45, 5: 70, 6: 100 };

// Boss ICE: one rule for the last room, drawn from the run seed and the company's pool, shown from the start of the run.
export const ICE = {
  firewall: { name: 'Firewall', text: 'One row or column is sealed off (##); the solution routes around it' },
  throttle: { name: 'Throttle', text: 'Buffer −1; at least one target always fits' },
  blackout: { name: 'Blackout', text: 'Targets stay hidden until your first pick; every start in the top row reaches one' },
  corruption: { name: 'Corruption', text: 'Each pick locks the cells above, below and beside it for a few moves; every Corruption patch makes it last longer' },
  encryption: { name: 'Encryption', text: 'Codes stay encrypted (??) until you pick in their row or column' },
  honeypot: { name: 'Honeypot', text: 'One marked cell off the solution path is a trap; a path through it halves the matrix score' },
  deadcells: { name: 'Dead cells', text: 'A few scattered cells are dead (##); the solution routes around them' },
  conveyor: { name: 'Conveyor', text: 'One row is a belt: after every pick its codes slide one cell right, wrapping around and under used cells' },
};
// Each company keeps the ICE of the one before and adds its own.
export type IceId = keyof typeof ICE;

// ice: rules this room always runs, on top of the company's.
export interface Section { name: string; quota: number; matrices: number; size: Size; brief: string; ice?: IceId[] }
// ice: the boss rule pool; patches: what the company deploys between iterations; always: ICE in every room.
// codes: the company's own code pool, same size as the default one, so it only changes the look; so do the row and column labels.
export interface Company {
  id: string; name: string; text: string; codes: string[]; sections: Section[]; ice: IceId[]; patches: IceId[]; always?: IceId[];
  rowLabel?: (r: number) => string; colLabel?: (c: number) => string;
  dev?: boolean; // test company: dev server only, open from the start
}
// Test bench for new board shapes, with no ICE; becomes a real company once the shape works.
const LAB: Company = {
  id: 'lab',
  name: 'Lab',
  text: 'Dev test bench: port boards, two matrices joined by ⇄ pairs. No ICE.',
  codes: CODES,
  dev: true,
  sections: [
    { name: 'Ports I', quota: 30, matrices: 2, size: { n: 5, lens: [2, 3, 3], links: [1], slack: 0, ports: 2 }, brief: 'Two matrices, two port pairs.' },
    { name: 'Ports II', quota: 60, matrices: 2, size: { n: 5, lens: [2, 3, 4], links: [1], slack: 0, ports: 2 }, brief: 'Longer targets across both matrices.' },
    { name: 'Ports III', quota: 90, matrices: 2, size: { n: 5, lens: [3, 3, 4], links: [1, 2], slack: 0, ports: 2 }, brief: 'Long chains, both matrices.' },
  ],
  ice: [],
  patches: [],
};

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
    { name: 'Wards', quota: 140, matrices: 2, size: { n: 7, lens: [3, 3, 4], links: [1, 2], slack: 0 }, brief: 'Bedside terminals on a flat network, one VLAN for everything.' },
    { name: 'Records', quota: 240, matrices: 2, size: { n: 8, lens: [3, 4, 4], links: [2], slack: 0 }, brief: 'Decades of patient files on servers older than the interns.' },
    { name: 'SOC', quota: 330, matrices: 2, size: { n: 8, lens: [3, 3, 4, 4], links: [2, 3], slack: 0 }, brief: 'A night-shift analyst and a wall of dashboards. Big matrices, long chains.' },
  ],
  ice: ['firewall', 'throttle', 'blackout', 'encryption'],
  patches: ['firewall', 'throttle', 'blackout', 'corruption', 'encryption'],
}, {
  id: 'ashgrove',
  name: 'Ashgrove & Pike',
  text: 'Boutique law firm. Small offices, a door to every room, and a partner who reads every log.',
  codes: ['A5', '3E', 'D1', '7C', 'B8'],
  rowLabel: (r) => 'S' + (r + 1), // shelf
  colLabel: (c) => 'F-' + String.fromCharCode(65 + c), // folder
  // Many small rooms: 5×5 matrices, where every dead or locked cell hurts.
  sections: [
    { name: 'Lobby', quota: 30, matrices: 1, size: { n: 5, lens: [2, 2, 3], links: [1], slack: 0 }, brief: 'A receptionist, a visitor log, and a kiosk that still runs the old client portal.' },
    { name: 'Mailroom', quota: 45, matrices: 1, size: { n: 5, lens: [2, 3, 3], links: [1], slack: 0 }, brief: 'Scanners that email every document to a shared inbox.' },
    { name: 'Paralegals', quota: 60, matrices: 1, size: { n: 5, lens: [2, 3, 3], links: [1], slack: 0 }, brief: 'Case files on network drives, passwords taped under keyboards.' },
    { name: 'Partners', quota: 140, matrices: 2, size: { n: 5, lens: [3, 3, 3], links: [1, 2], slack: 0 }, brief: 'Corner offices, laptops that never leave, phones that never lock.' },
    { name: 'Archive', quota: 180, matrices: 2, size: { n: 5, lens: [2, 3, 4], links: [1, 2], slack: 0, ports: 2 }, brief: 'Thirty years of settlements on paper and their digital twin, synced through two gateways.' },
    { name: 'SOC', quota: 240, matrices: 2, size: { n: 5, lens: [3, 3, 4], links: [2], slack: 0 }, brief: 'An outsourced SOC on a retainer. Small screens, sharp eyes.' },
  ],
  ice: ['firewall', 'throttle', 'blackout', 'encryption', 'honeypot', 'deadcells'],
  patches: ['firewall', 'throttle', 'blackout', 'corruption', 'encryption', 'honeypot', 'deadcells'],
}, {
  id: 'argus',
  name: 'Argus Telecom',
  text: 'National carrier. Thousands of short calls a second, and never enough bandwidth.',
  codes: ['E1', 'T3', '4G', '7F', 'B2'],
  rowLabel: (r) => 'T' + (r + 1), // trunk
  colLabel: (c) => 'P' + String(c + 1).padStart(2, '0'), // port
  // Many matrices of many short targets, always throttled: links and buffer win here, empty-slot builds starve.
  always: ['throttle'],
  sections: [
    { name: 'Call Center', quota: 70, matrices: 2, size: { n: 6, lens: [2, 2, 3, 3], links: [1], slack: 0 }, brief: 'Headsets, ticket queues and a shared login for the night shift.' },
    { name: 'Switching', quota: 95, matrices: 2, size: { n: 5, lens: [2, 2, 3, 3], links: [1, 2], slack: 0, ports: 2 }, brief: 'Two switch racks that route every call in the region, patched into each other by hand.' },
    { name: 'Backbone', quota: 220, matrices: 3, size: { n: 6, lens: [2, 3, 3, 3], links: [1, 2], slack: 0 }, brief: 'Fibre trunks with packets queued on a belt. Watch the row that moves.', ice: ['conveyor'] },
    { name: 'SOC', quota: 280, matrices: 3, size: { n: 6, lens: [2, 3, 3, 3, 3], links: [2, 3], slack: 0 }, brief: 'A network operations floor that never sleeps, and a belt that never stops.', ice: ['conveyor'] },
  ],
  ice: ['firewall', 'blackout', 'encryption', 'honeypot', 'deadcells'],
  patches: ['firewall', 'blackout', 'corruption', 'encryption', 'honeypot', 'deadcells', 'conveyor'],
}, ...(import.meta.env.DEV ? [LAB] : [])];
// The first company is always open; breaching one opens the next.
export const companyOpen = (breached: string[], i: number) => i === 0 || !!COMPANIES[i]?.dev || breached.includes(COMPANIES[i - 1]?.id);
export const sections = (s: RunState) => COMPANIES[s.company].sections;
export const isBoss = (s: RunState) => s.section === sections(s).length - 1;

// Iterations: after the boss the company patches itself and the rooms come round again, quotas doubled; the last one wins.
export const LOOPS = 3;
export const QUOTA_GROWTH = 2.5;
// Rounded to 5 so later iterations read as clean numbers.
export const quota = (s: RunState, i = s.section) => Math.round((sections(s)[i].quota * QUOTA_GROWTH ** s.loop) / 5) * 5;

// A patch adds one ICE rule to one room, live from iteration `loop` on.
export interface Patch { ice: IceId; room: number; loop: number }
const live = (s: RunState) => s.patches.filter((p) => p.loop <= s.loop);
// A patch shows in the contract once its room has been entered.
export const revealed = (s: RunState, p: Patch) => s.loop > p.loop || s.section >= p.room;

// The ICE rules in a room: the boss rule plus the patches deployed there.
export const roomIce = (s: RunState, i = s.section): IceId[] =>
  [...new Set([...(COMPANIES[s.company].always ?? []), ...(sections(s)[i].ice ?? []),
    ...(i === sections(s).length - 1 && s.ice ? [s.ice] : []), ...live(s).filter((p) => p.room === i).map((p) => p.ice)])];

// Corruption lasts one move per Corruption patch (at least 1), for good from the third.
export function burnOf(s: RunState, i = s.section): number {
  if (!roomIce(s, i).includes('corruption')) return 0;
  const n = live(s).filter((p) => p.ice === 'corruption').length;
  const burn = n >= 3 ? Infinity : Math.max(1, n);
  return !s.items.includes('heatsink') ? burn : burn === Infinity ? 2 : burn - 1;
}

// Patches per iteration: iteration 2 puts ICE in ~60% of rooms, iteration 3 in every room and a second rule in ~1/3 of them.
// Rooms with their own or company-wide ICE count as covered. At most one Corruption per deployment, so its burn grows slowly.
export const PATCH_COVER = [0, 0.6, 1];
// ICE the port board generator does not handle yet; patches skip port rooms for these.
export const NO_PORT_ICE: IceId[] = ['firewall', 'corruption', 'conveyor'];
export const PATCH_DOUBLE = [0, 0, 1 / 3];
function deployPatches(s: RunState): Patch[] {
  const r = rng(hashStr(s.seed + '/patch/' + s.loop));
  const pool = COMPANIES[s.company].patches, rooms = sections(s).length, out: Patch[] = [];
  const add = (room: number) => {
    const opts = pool.filter((id) => !roomIce(s, room).includes(id) && !(id === 'corruption' && out.some((p) => p.ice === id))
      && !(sections(s)[room].size.ports && NO_PORT_ICE.includes(id)));
    if (!opts.length) return;
    const p = { ice: opts[Math.floor(r() * opts.length)], room, loop: s.loop };
    s.patches.push(p);
    out.push(p);
  };
  const order = shuffled(Array.from({ length: rooms }, (_, i) => i), r);
  const bare = () => order.filter((i) => !roomIce(s, i).length);
  const cover = PATCH_COVER[Math.min(s.loop, PATCH_COVER.length - 1)];
  for (const i of bare().slice(0, Math.max(0, Math.ceil(rooms * cover) - (rooms - bare().length)))) add(i);
  const single = order.filter((i) => roomIce(s, i).length === 1);
  for (const i of single.slice(0, Math.round(rooms * PATCH_DOUBLE[Math.min(s.loop, PATCH_DOUBLE.length - 1)]))) add(i);
  // Always at least one new rule, so every iteration brings patch notes.
  for (let k = 0; !out.length && k < 30; k++) add(Math.floor(r() * rooms));
  for (const p of out) logEvent(s, 'patch · new ICE ' + ICE[p.ice].name + ' in a hidden room');
  return out;
}
// Re-dealing a matrix (before the first move) needs a Burner SIM: once per room.
const restartsFor = (s: { items: ItemId[] }) => (s.items.includes('sim') ? 1 : 0);
export const DAEMON_SLOTS = 4;
// Credits: one per SURPLUS_PER_CREDIT data over the quota, SECTION_CREDIT per cleared section,
// one per SLOTS_PER_CREDIT empty buffer slots in a matrix that uploaded something (DC_SLOTS_PER_CREDIT after a Disconnect),
// FULL_CREDIT for a matrix with every target uploaded.
export const SURPLUS_PER_CREDIT = 20;
export const SURPLUS_CAP = 2; // per room, so huge scores don't flood the economy
export const SECTION_CREDIT = 1;
export const SLOTS_PER_CREDIT = 2;
export const DC_SLOTS_PER_CREDIT = 3;
export const FULL_CREDIT = 1;
export const EXIT_CREDIT = 1; // per matrix skipped by leaving a room early

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
  stacks: Partial<Record<string, number>>; // by daemon id (string keeps DAEMONS from typing itself) // streak daemons' banked stacks
  lastStart?: number; // column of the previous matrix's first pick (cron/rotate)
  paint?: Record<string, number>; // Painter: cell 'r,c' → level 1–3, from the last matrix with an upload
  rack: number; // rack slots for items
  items: ItemId[]; // shop items owned, kept for the run
  shelf: ItemId[]; // what the shop offers on this visit
  rerolls: number; // shelf rerolls on this visit
  ice: IceId; // the boss room's rule
  // Run summary; optional so saves from before them still load.
  total?: number; // data banked over the whole run
  ms?: number; // time spent in matrices
  best?: number; // best single matrix
  log?: [number, number, number][]; // finished rooms: iteration, room, data
  carry?: number; // data Overtime carried into this room
  freeRerolls?: number; // bonus rewards
  legendOffer?: boolean; // bonus reward: the next offer leads with a legendary (a rare if none is left)
  charges?: number; // bonus reward: ×2 data charges, spent by hand on a matrix
  bonus?: RewardId[]; // bonus rewards claimed since the last shop, marked in the offer and shop
  events?: string[]; // what happened in the run, shown to the player as a log
  bonusHits?: string[]; // bonus matrices met, as 'loop.room.matrix'; missing on saves from before it, where outcomes are unknown
}

export const bonusKey = (loop: number, room: number, matrix: number) => loop + '.' + room + '.' + matrix;

export const logEvent = (s: RunState, text: string) => { (s.events ??= []).push(text); };
export const dmnFile = (id: DaemonId) => DAEMONS[id].family.toLowerCase() + '/' + DAEMONS[id].name.toLowerCase().replace(/ /g, '_') + '.dmn';
const itemName = (id: ItemId) => ITEMS[id].name + ' v' + ITEMS[id].ver;

export function newRunState(seed: number, company = 0): RunState {
  const { ice, sections: rooms } = COMPANIES[company];
  return {
    seed, company, loop: 0, patches: [], matrix: 0, section: 0, data: 0, scores: rooms.map(() => []), restarts: 0, credits: 0, earned: [], daemons: [], stacks: {}, rack: RACK_BASE, items: [], shelf: [], rerolls: 0, bonusHits: [],
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
export function endMatrix(s: RunState, data: number, emptySlots: number, per = SLOTS_PER_CREDIT): MatrixOutcome {
  s.data += data;
  if (data) earn(s, emptySlots + ' empty buffer slots (1 per ' + per + ')', Math.floor(emptySlots / per));
  s.scores[s.section].push(data);
  s.total = (s.total ?? 0) + data;
  s.best = Math.max(s.best ?? 0, data);
  if (played(s) < sections(s)[s.section].matrices) return 'continue';
  return closeRoom(s);
}

// Quota met before the room's last matrix (not in the boss room): the player may leave now, paid per skipped matrix.
export const canExitRoom = (s: RunState) => !isBoss(s) && played(s) > 0 && played(s) < sections(s)[s.section].matrices && s.data >= quota(s);

export function exitRoom(s: RunState): MatrixOutcome {
  if (!canExitRoom(s)) return 'continue';
  const left = sections(s)[s.section].matrices - played(s);
  s.earned = [];
  logEvent(s, 'room exited early · ' + left + ' matrices skipped');
  earn(s, left + ' matrices skipped (early exit)', left * EXIT_CREDIT);
  const out = closeRoom(s);
  for (const [why, n] of s.earned) if (n) logEvent(s, 'credits +$' + n + ' · ' + why);
  return out;
}

// Closes the room after its last matrix or an early exit: checks the quota and pays the section credits.
function closeRoom(s: RunState): MatrixOutcome {
  const goal = quota(s);
  (s.log ??= []).push([s.loop, s.section, s.data]);
  logEvent(s, 'room ' + (s.data < goal ? 'failed' : 'cleared') + ' · ' + s.data + '/' + goal + ' data');
  if (s.data < goal) return 'lose';
  earn(s, 'section cleared', SECTION_CREDIT);
  earn(s, s.data - goal + ' data over the quota (1 per ' + SURPLUS_PER_CREDIT + ', max ' + SURPLUS_CAP + ')',
    Math.min(SURPLUS_CAP, Math.floor((s.data - goal) / SURPLUS_PER_CREDIT)));
  if (s.items.includes('chip')) earn(s, 'Credit chip', 1);
  return !isBoss(s) ? 'section' : s.loop < LOOPS - 1 ? 'loop' : 'win';
}

// Overtime: half the data over the quota starts the next room (none past the boss).
export const overtimeCarry = (s: RunState, data = s.data) =>
  s.daemons.includes('overtime') && !isBoss(s) ? Math.max(0, Math.floor((data - quota(s)) / 2)) : 0;

// Moves on to the next room; after the boss, starts the next iteration and returns the patches it brought.
export function nextSection(s: RunState): Patch[] | undefined {
  const carry = overtimeCarry(s);
  Object.assign(s, { section: s.section + 1, data: carry, carry, restarts: restartsFor(s) });
  delete s.stacks.sandbag; // room-scoped
  if (s.section < sections(s).length) return;
  // A save from before bonus tracking starts recording with the new iteration.
  Object.assign(s, { section: 0, loop: s.loop + 1, scores: sections(s).map(() => []), data: 0, carry: 0, bonusHits: s.bonusHits ?? [] });
  return deployPatches(s);
}

// --- Daemons: passive upgrades. Matrix score = (data + flat) × (1 + boost) × mult; no upload means 0.

// jumps: path indices of cells reached off the lane (Bridge, Loopback v2.0); those are no lane moves, so daemons skip them.
export interface MatrixCtx {
  buf: string[]; path: [number, number][]; targets: string[][]; l: number; n: number; worth?: number[]; node?: Cell; jumps?: number[];
  par?: number; // length of the planted route (Surgical bonus)
  ports?: Puzzle['ports']; // port board pairs, for move lengths
  stay?: number[]; // port picks that did not jump
  trap?: Cell; // Honeypot cell
  tools?: boolean; // an item tool was used (Bare hands bonus)
  bounty?: BountyId;
  charge?: boolean; // a ×2 data charge is spent on this matrix
}

interface Facts {
  done: string[][];
  all: boolean;
  shared: number; // buffer slots inside 2+ uploaded targets
  empty: number;
  slots: number; // buffer length
  light: boolean; // at most half the buffer used
  moves: number[]; // length of each move along its lane
  edgeJumps: number;
  corner: boolean; // path starts or ends in a corner
  start?: number; // column of the first pick
  codes: number; // codes in the uploaded targets
  picks: number;
  cells: number; // different cells on the path
  wilds: number; // uploaded targets running through a ** slot
  trace: boolean; // every buffer code sits inside an uploaded target
  loop: boolean; // the last pick shares a row or column with the first
  travelled: number; // cells crossed by all moves
  keys: string[]; // 'r,c' of each pick
  upKeys: string[]; // 'r,c' of the picks inside an uploaded target (buffer index = pick index)
}

type Cell = [number, number];
// w: matrix width on a port board, where each matrix has its own corners.
export const isCorner = (p: Cell | undefined, n: number, w = n) => !!p && (p[0] === 0 || p[0] === n - 1) && (p[1] % w === 0 || p[1] % w === w - 1);
// Picks alternate row/column, so consecutive cells share a lane; the move length is the distance along it.
const moveLen = (a: Cell, b: Cell) => (a[0] === b[0] ? Math.abs(a[1] - b[1]) : Math.abs(a[0] - b[0]));
// Move lengths along the path; a move after a port runs along its partner's line, so it is measured from the partner.
// stay: port picks that did not jump (Loopback back through a port), measured from the port itself.
const moveLens = (path: Cell[], jumps: number[] = [], ports?: Puzzle['ports'], stay: number[] = []) =>
  path.slice(1).flatMap((p, i) => (jumps.includes(i + 1) ? [] : [moveLen((!stay.includes(i) && partner({ ports }, ...path[i])) || path[i], p)]));

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

// Buffer slots of a target's first match.
const windowOf = (buf: string[], t: string[]) => {
  const i = buf.findIndex((_, i) => t.every((c, j) => fits(buf[i + j], c)));
  return t.map((_, j) => i + j);
};

function facts({ buf, path, targets, l, n, jumps, ports, stay }: MatrixCtx): Facts {
  const done = targets.filter((t) => contains(buf, t));
  const moves = moveLens(path, jumps, ports, stay);
  const keys = path.map((p) => p[0] + ',' + p[1]);
  const wins = done.map((t) => windowOf(buf, t));
  return {
    codes: done.reduce((a, t) => a + t.length, 0), picks: path.length, cells: new Set(keys).size,
    wilds: wins.filter((w) => w.some((i) => buf[i] === WILD)).length, trace: buf.every((_, i) => wins.some((w) => w.includes(i))),
    done, all: done.length === targets.length, shared: coverage(buf, done).filter((k) => k >= 2).length,
    empty: l - buf.length, slots: l, light: buf.length <= l / 2,
    moves, edgeJumps: moves.filter((d) => d === n - 1).length, corner: isCorner(path[0], n) || isCorner(path[path.length - 1], n),
    start: path[0]?.[1],
    loop: path.length > 1 && (path[0][0] === path[path.length - 1][0] || path[0][1] === path[path.length - 1][1]),
    travelled: moves.reduce((a, d) => a + d, 0),
    keys, upKeys: keys.filter((_, i) => wins.some((w) => w.includes(i))),
  };
}

export interface Effect { flat?: number; boost?: number; mult?: number }
// streak: a stack that grows each matrix its condition holds and resets when it breaks; `next` gives the stack after
// this matrix, so the live score already counts it. Matrices that upload nothing leave every stack alone.
// goal: what keeps the stack growing, shown while the daemon waits on it.
interface Streak { goal: string; next: (n: number, f: Facts, s: RunState, disconnected: boolean) => number; effect: (n: number) => Effect }
// Offer odds per slot, by rarity; a daemon with no rarity is common.
export const RARITY = { common: 0.7, rare: 0.25, legendary: 0.05 };
export type Rarity = keyof typeof RARITY;
interface Daemon {
  name: string;
  family: 'Splicer' | 'Ghost' | 'Runner' | 'Cron';
  text: string;
  rarity?: Rarity;
  scope?: 'room' | 'run'; // room: its stack or count lasts for one room; run: it reaches past the room
  score?: (f: Facts, s: RunState) => Effect | null;
  streak?: Streak;
  end?: (s: RunState, f: Facts, disconnected: boolean) => void; // after a matrix that uploaded something
}

// Flat data per stack: Uptime (no Disconnect) pays more than the easy Rotate.
export const CRON_DATA = 5, ROTATE_DATA = 3;
export const LONGJUMP_DATA = 8;
export const PAINT_DATA = 5, PAINT_LEVELS = 3, PAINT_CELLS = 6;
// Painter: data a painted cell pays when picked.
export const paintData = (level: number) => PAINT_DATA * level;

export const DAEMONS = {
  chain: { name: 'Chain', family: 'Splicer', rarity: 'rare', text: '+0.5 boost per buffer slot shared by 2 uploaded targets',
    score: (f) => (f.shared ? { boost: 0.5 * f.shared } : null) },
  compressor: { name: 'Compressor', family: 'Splicer', text: '+7 data per buffer slot shared by 2 uploaded targets',
    score: (f) => (f.shared ? { flat: 7 * f.shared } : null) },
  fullstack: { name: 'Full stack', family: 'Splicer', rarity: 'legendary', text: '×(1 + 0.4 per target) when every target is uploaded',
    score: (f) => (f.all ? { mult: Math.round((1 + 0.4 * f.done.length) * 10) / 10 } : null) },
  overflow: { name: 'Overflow', family: 'Ghost', text: '+0.25 boost per empty buffer slot',
    score: (f) => (f.empty ? { boost: 0.25 * f.empty } : null) },
  light: { name: 'Light footprint', family: 'Ghost', rarity: 'legendary', text: '×2 when at most half the buffer is used',
    score: (f) => (f.light ? { mult: 2 } : null) },
  silent: { name: 'Silent', family: 'Ghost', text: '+$2 each time you end a matrix early with Disconnect',
    end: (s, _f, disconnected) => { if (disconnected) earn(s, 'Silent daemon', 2); } },
  cache: { name: 'Cache', family: 'Ghost', rarity: 'rare',
    text: '+0.25 boost for every matrix ending with 2+ empty buffer slots, this one included; uploading every target resets the stack',
    streak: { goal: '2+ empty slots, not every target', next: (n, f) => (f.all ? 0 : f.empty >= 2 ? n + 1 : n), effect: (n) => ({ boost: 0.25 * n }) } },
  longjump: { name: 'Long jump', family: 'Runner', text: '+' + LONGJUMP_DATA + ' data per move from one end of a lane to the other',
    score: (f) => (f.edgeJumps ? { flat: LONGJUMP_DATA * f.edgeJumps } : null) },
  corner: { name: 'Corner', family: 'Runner', text: '×1.5 when the path starts or ends in a corner',
    score: (f) => (f.corner ? { mult: 1.5 } : null) },
  zigzag: { name: 'Zigzag', family: 'Runner', rarity: 'rare', text: '+0.5 boost per move longer than the one before',
    score: (f) => { const k = f.moves.filter((d, i) => i > 0 && d > f.moves[i - 1]).length; return k ? { boost: 0.5 * k } : null; } },
  // Cron: scheduled jobs. Keep doing the thing every matrix and the stack grows; slip once and it is gone.
  heartbeat: { name: 'Heartbeat', family: 'Cron', rarity: 'rare', text: '+0.2 boost for every matrix in a row where you upload every target, this one included; missing one resets the stack',
    streak: { goal: 'upload every target', next: (n, f) => (f.all ? n + 1 : 0), effect: (n) => ({ boost: n / 5 }) } },
  rotate: { name: 'Rotate', family: 'Cron', text: '+' + ROTATE_DATA + ' data for every matrix in a row whose first pick is in a different column than the last one; the same column resets the stack',
    streak: { goal: 'start in a new column', next: (n, f, s) => (f.start === undefined ? n : f.start !== s.lastStart ? n + 1 : 0), effect: (n) => ({ flat: ROTATE_DATA * n }) } },
  backup: { name: 'Backup', family: 'Cron', rarity: 'rare', text: '+0.4 boost for every matrix in a row ending with exactly 1 empty buffer slot; any other ending halves the stack',
    streak: { goal: 'end with exactly 1 empty slot', next: (n, f) => (f.empty === 1 ? n + 1 : Math.floor(n / 2)), effect: (n) => ({ boost: n * 2 / 5 }) } },
  uptime: { name: 'Uptime', family: 'Cron', text: '+' + CRON_DATA + ' data for every matrix in a row with no Disconnect and no restart; either resets the stack',
    streak: { goal: 'no Disconnect', next: (n, _f, _s, disconnected) => (disconnected ? 0 : n + 1), effect: (n) => ({ flat: CRON_DATA * n }) } },
  deflate: { name: 'Deflate', family: 'Splicer', rarity: 'legendary', text: '×(codes in uploaded targets ÷ picks), when that beats ×1',
    score: (f) => (f.picks && f.codes > f.picks ? { mult: Math.round((f.codes / f.picks) * 100) / 100 } : null) },
  joker: { name: 'Joker', family: 'Splicer', rarity: 'rare', text: '+0.5 boost per uploaded target that runs through a ** slot',
    score: (f) => (f.wilds ? { boost: 0.5 * f.wilds } : null) },
  saturate: { name: 'Saturate', family: 'Splicer', rarity: 'legendary', text: '×(1 + 0.2 per buffer slot) with a full buffer and every target uploaded',
    score: (f) => (f.all && f.empty === 0 ? { mult: Math.round(10 + 2 * f.slots) / 10 } : null) },
  notrace: { name: 'No trace', family: 'Ghost', rarity: 'rare', text: '×1.5 with 2+ targets uploaded and every code in the buffer inside one of them',
    score: (f) => (f.done.length >= 2 && f.trace ? { mult: 1.5 } : null) },
  crawler: { name: 'Crawler', family: 'Runner', text: '+5 data per different cell on the path',
    score: (f) => (f.cells ? { flat: 5 * f.cells } : null) },
  painter: { name: 'Painter', family: 'Runner', rarity: 'rare', text: 'Cells you upload a target through stay painted in the next matrix; picking one pays +' + PAINT_DATA + ' data, +' + PAINT_DATA + ' more each time it is painted again (up to +' + paintData(PAINT_LEVELS) + ')',
    score: (f, s) => { const v = [...new Set(f.keys)].reduce((a, k) => a + (s.paint?.[k] ? paintData(s.paint[k]) : 0), 0); return v ? { flat: v } : null; },
    end: (s, f) => {
      // Repainted cells go up a level; the highest levels stay when there are too many.
      const next = [...new Set(f.upKeys)].map((k) => [k, Math.min(PAINT_LEVELS, (s.paint?.[k] ?? 0) + 1)] as const);
      s.paint = Object.fromEntries(next.sort((a, b) => b[1] - a[1]).slice(0, PAINT_CELLS));
    } },
  circuit: { name: 'Circuit', family: 'Runner', rarity: 'legendary', text: '×2 when the last pick is in the row or column of the first',
    score: (f) => (f.loop ? { mult: 2 } : null) },
  odometer: { name: 'Odometer', family: 'Runner', rarity: 'legendary', text: '×(1 + 0.05 per cell your moves cross)',
    score: (f) => (f.travelled ? { mult: Math.round((1 + 0.05 * f.travelled) * 100) / 100 } : null) },
  sandbag: { name: 'Sandbag', family: 'Ghost', rarity: 'rare', scope: 'room',
    text: '+1.5 boost for the rest of the room per matrix you Disconnect with at most 1 target uploaded',
    score: (_f, s) => (s.stacks.sandbag ? { boost: 1.5 * s.stacks.sandbag } : null),
    end: (s, f, disconnected) => { if (disconnected && f.done.length <= 1) s.stacks.sandbag = (s.stacks.sandbag ?? 0) + 1; } },
  allin: { name: 'All-in', family: 'Splicer', rarity: 'rare', text: 'A bet on every matrix: ×2 when every target is uploaded, ×0.5 when one is missing',
    score: (f) => ({ mult: f.all ? 2 : 0.5 }) },
  overtime: { name: 'Overtime', family: 'Cron', rarity: 'rare', scope: 'run', text: 'Half the data over a room\'s quota carries into the next room' },
  warmup: { name: 'Warm-up', family: 'Cron', scope: 'room', text: '+0.5 boost per matrix already played in this room',
    score: (_f, s) => (played(s) ? { boost: 0.5 * played(s) } : null) },
} satisfies Record<string, Daemon>;
export type DaemonId = keyof typeof DAEMONS;
export const rarityOf = (id: DaemonId): Rarity => (DAEMONS[id] as Daemon).rarity ?? 'common';
export const streakOf = (id: DaemonId) => (DAEMONS[id] as Daemon).streak;
// How long a daemon's effect lasts: one matrix, or a stack kept for the whole run.
export const scopeOf = (id: DaemonId): 'matrix' | 'room' | 'run' => (DAEMONS[id] as Daemon).scope ?? (streakOf(id) ? 'run' : 'matrix');

// Restarting a matrix breaks an Uptime streak.
export function restartMatrix(s: RunState): void {
  s.restarts--;
  if (s.stacks.uptime) s.stacks.uptime = 0;
}

// gear: shop items that added something to this matrix, like daemons in fired.
export interface Score { base: number; flat: number; boost: number; mult: number; total: number; fired: [DaemonId, Effect][]; gear: [ItemId, Effect][]; ice: [IceId, Effect][]; charge?: boolean }

export function scoreMatrix(ctx: MatrixCtx, s: RunState): Score {
  const f = facts(ctx);
  const sc: Score = { base: matrixData(ctx.buf, ctx.targets, ctx.worth), flat: 0, boost: 0, mult: 1, total: 0, fired: [], gear: [], ice: [] };
  const node = ctx.node;
  if (node && ctx.path.some((p) => p[0] === node[0] && p[1] === node[1])) {
    const v = nodeData(s.items);
    sc.flat += v;
    sc.gear.push([s.items.includes('datanode2') ? 'datanode2' : 'datanode', { flat: v }]);
  }
  const thumb = s.items.includes('thumb2') ? 'thumb2' : s.items.includes('thumb') ? 'thumb' : undefined;
  if (f.done.length && thumb) {
    const v = thumbData(s.items) * f.done.length;
    sc.flat += v;
    sc.gear.push([thumb, { flat: v }]);
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
  const trap = ctx.trap;
  if (trap && ctx.path.some((p) => p[0] === trap[0] && p[1] === trap[1])) {
    sc.mult *= HONEYPOT_MULT;
    sc.ice.push(['honeypot', { mult: HONEYPOT_MULT }]);
  }
  if (ctx.charge) { sc.mult *= 2; sc.charge = true; }
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
// met: the bonus objective held; its reward waits for claimReward.
export function finishMatrix(s: RunState, ctx: MatrixCtx, disconnected: boolean) {
  s.earned = [];
  const score = scoreMatrix(ctx, s);
  daemonsAfterMatrix(ctx, s, disconnected);
  const met = !!ctx.bounty && bountyMet(ctx.bounty, ctx);
  if (facts(ctx).all) earn(s, 'every target uploaded', FULL_CREDIT);
  logEvent(s, 'matrix over' + (disconnected ? ' (disconnect)' : '') + ' · ' + facts(ctx).done.length + '/' + ctx.targets.length + ' uploaded · ' + score.total + ' data');
  if (ctx.bounty) {
    if (met) s.bonusHits?.push(bonusKey(s.loop, s.section, played(s)));
    logEvent(s, 'bonus ' + (met ? 'met' : 'missed') + ' · ' + BOUNTIES[ctx.bounty].name);
  }
  const out = endMatrix(s, score.total, ctx.l - ctx.buf.length, disconnected ? DC_SLOTS_PER_CREDIT : SLOTS_PER_CREDIT);
  for (const [why, n] of s.earned) if (n) logEvent(s, 'credits +$' + n + ' · ' + why);
  return { score, met, out };
}

// Pays a met bonus once the player claims it on the summary; after the streaks moved, so a stack reward is not overwritten.
export const claimReward = (s: RunState, bounty: BountyId, reward: RewardId) => {
  const id = payReward(s, 'bonus · ' + BOUNTIES[bounty].name, reward);
  logEvent(s, 'bonus · ' + BOUNTIES[bounty].name + ' · ' + REWARDS[id]);
  return id;
};

// Bonus objectives: one per matrix, drawn from its seed and shown from the start; meeting it pays credits.
// Bonuses are rare (one matrix per iteration), so what they pay is big.
export const BOUNTY_CREDITS = 5;
export const BOUNTY_REROLLS = 3;
export const BOUNTY_STACKS = 2;
export const BOUNTIES = {
  surgical: { name: 'Surgical', text: (c?: MatrixCtx) => (c?.par ? 'every target in ' + c.par + ' picks or fewer' : 'every target in no more picks than the planted route'), met: (f: Facts, c: MatrixCtx) => f.all && f.picks <= (c.par ?? 0) },
  corners: { name: 'Corners', text: () => 'start and end in a corner', met: (f: Facts, c: MatrixCtx) => !!f.done.length && isCorner(c.path[0], c.n) && isCorner(c.path[c.path.length - 1], c.n) },
  clean: { name: 'Clean', text: () => 'upload with 3+ empty buffer slots', met: (f: Facts) => !!f.done.length && f.empty >= 3 },
  fullhouse: { name: 'Full house', text: () => 'every target with a full buffer', met: (f: Facts) => f.all && f.empty === 0 },
  barehands: { name: 'Bare hands', text: () => 'upload without using an item tool', met: (f: Facts, c: MatrixCtx) => !!f.done.length && !c.tools },
  tiptoe: { name: 'Tiptoe', text: () => 'upload with no move longer than 2 cells', met: (f: Facts) => !!f.done.length && f.moves.every((d) => d <= 2) },
  wild: { name: 'Wild', text: () => '2 uploaded targets through a ** slot (only with a Wildcard)', met: (f: Facts) => f.wilds >= 2 },
};
export type BountyId = keyof typeof BOUNTIES;
// Bonus matrices: BOUNTIES_PER_LOOP of an iteration's matrices outside the boss room, drawn from the run seed, carry a bonus objective.
export const BOUNTIES_PER_LOOP = 1;
// [room, matrix in room] of this iteration's bonus matrices; never in the boss room,
// nor on the run's first matrix (restarting a run would fish for one).
export function bountySpots(s: RunState): [number, number][] {
  const rooms = sections(s).slice(0, -1), total = rooms.reduce((a, r) => a + r.matrices, 0);
  const picks = shuffled(Array.from({ length: total }, (_, i) => i).filter((k) => s.loop || k), rng(hashStr(s.seed + '/bounties/' + s.loop))).slice(0, BOUNTIES_PER_LOOP);
  return picks.map((k) => {
    let i = 0;
    while (k >= rooms[i].matrices) k -= rooms[i++].matrices;
    return [i, k];
  });
}
export const bountyHere = (s: RunState) => bountySpots(s).some(([i, j]) => i === s.section && j === played(s));
// Wild only comes up for a run with a Wildcard.
export const bountyFor = (seed: number, items: ItemId[] = []): BountyId => {
  const ids = (Object.keys(BOUNTIES) as BountyId[]).filter((id) => id !== 'wild' || items.some((i) => i === 'wildcard1' || i === 'wildcard2'));
  return ids[Math.floor(rng(hashStr(seed + '/bounty'))() * ids.length)];
};
// What a met bonus pays, drawn per matrix.
export const REWARDS = {
  cash: '+$' + BOUNTY_CREDITS,
  rerolls: BOUNTY_REROLLS + ' free rerolls',
  stack: '+' + BOUNTY_STACKS + ' stacks on every streak daemon',
  legend: 'a legendary daemon in the next offer',
  double: 'a ×2 data charge for a later matrix',
};
export type RewardId = keyof typeof REWARDS;
// The two rewards a met bonus offers, drawn per matrix; stacks only come up with a streak daemon installed.
export const rewardsFor = (seed: number, daemons: DaemonId[] = []): RewardId[] => {
  const ids = (Object.keys(REWARDS) as RewardId[]).filter((id) => id !== 'stack' || daemons.some((d) => streakOf(d)));
  return shuffled(ids, rng(hashStr(seed + '/reward'))).slice(0, 2);
};
// No streak daemon installed: the stack reward pays credits instead. Returns what was actually paid.
function payReward(s: RunState, why: string, id: RewardId): RewardId {
  const streaks = s.daemons.filter((d) => streakOf(d));
  const note = (text: string) => s.earned.push([why + ' · ' + text, 0]);
  if (id === 'stack' && !streaks.length) id = 'cash';
  if (id === 'rerolls') { s.freeRerolls = (s.freeRerolls ?? 0) + BOUNTY_REROLLS; note(REWARDS.rerolls); }
  else if (id === 'legend') { s.legendOffer = true; note(REWARDS.legend); }
  else if (id === 'double') { s.charges = (s.charges ?? 0) + 1; note(REWARDS.double); }
  else if (id === 'stack') { for (const d of streaks) s.stacks[d] = (s.stacks[d] ?? 0) + BOUNTY_STACKS; note(REWARDS.stack); }
  else earn(s, why, BOUNTY_CREDITS);
  (s.bonus ??= []).push(id);
  return id;
}
export const bountyMet = (id: BountyId, ctx: MatrixCtx) => BOUNTIES[id].met(facts(ctx), ctx);

// Repeater: a planted-route cell inside exactly one target pushes its code twice; that target gets the doubled code
// and the buffer one more slot, so the plant stays solvable. Returns the cell.
export function plantRepeat(seed: number, p: Puzzle): Cell | undefined {
  if (!p.path) return;
  const buf = planBuf(p);
  const cover = coverage(buf, p.targets);
  const spots = cover.flatMap((k, i) => (k === 1 ? [i] : []));
  if (!spots.length) return;
  const i = spots[Math.floor(rng(hashStr(seed + '/repeat'))() * spots.length)];
  const t = p.targets.find((t) => contains(buf, t) && windowOf(buf, t).includes(i))!;
  const j = i - windowOf(buf, t)[0];
  t.splice(j, 0, t[j]);
  p.l++;
  return p.path[i];
}

// Glob: one code of one target becomes **, which takes any code; the same for a matrix seed.
export function globTarget(seed: number, targets: string[][]): void {
  const r = rng(hashStr(seed + '/glob'));
  const t = targets[Math.floor(r() * targets.length)];
  t[Math.floor(r() * t.length)] = WILD;
}

// Three daemons the run doesn't own yet, the same for a given run seed and section.
// Seed key of a visit between rooms; iterations after the first get their own offers and shelves.
const visit = (s: RunState) => s.section + (s.loop ? '.' + s.loop : '');

// With every slot full the offer still comes; taking one swaps out an installed daemon.
export function offerDaemons(s: RunState): DaemonId[] {
  const r = rng(hashStr(s.seed + '/offer/' + visit(s)));
  const pool = shuffled((Object.keys(DAEMONS) as DaemonId[]).filter((id) => !s.daemons.includes(id)), r);
  const out: DaemonId[] = [];
  const lead = s.legendOffer && (pool.find((id) => rarityOf(id) === 'legendary') ?? pool.find((id) => rarityOf(id) === 'rare'));
  if (lead) out.push(lead);
  // Each slot rolls a rarity, then takes the first unpicked daemon of it; an empty rarity falls back to any.
  while (out.length < 3 && out.length < pool.length) {
    const x = r(), tier: Rarity = x < RARITY.legendary ? 'legendary' : x < RARITY.legendary + RARITY.rare ? 'rare' : 'common';
    const left = pool.filter((id) => !out.includes(id));
    out.push(left.find((id) => rarityOf(id) === tier) ?? left[0]);
  }
  return out;
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
export function movePreview(path: Cell[], cell: Cell, n: number, daemons: DaemonId[], jumps: number[] = [], ports?: Puzzle['ports'], stay: number[] = []): Preview[] {
  const out: Preview[] = [];
  const from = (c: Cell, i: number) => (!stay.includes(i) && partner({ ports }, ...c)) || c;
  const prev = path[path.length - 1], before = path[path.length - 2];
  const moves = moveLens(path, jumps, ports, stay);
  const num = (x: number) => (x ? String(x) : undefined);
  if (daemons.includes('corner') && isCorner(cell, n) && !isCorner(path[0], n)) {
    out.push({ id: 'corner', name: path.length ? 'corner' : 'corner start', add: '×1.5', kind: 'boost', ...(path.length ? { note: 'if the path ends here' } : {}) });
  }
  if (prev && daemons.includes('longjump') && moveLen(from(prev, path.length - 1), cell) === n - 1) {
    out.push({ id: 'longjump', name: 'long jump', now: num(LONGJUMP_DATA * moves.filter((d) => d === n - 1).length), add: '+' + LONGJUMP_DATA, kind: 'data' });
  }
  if (before && daemons.includes('zigzag') && moveLen(from(prev, path.length - 1), cell) > moveLen(from(before, path.length - 2), prev)) {
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
  wildcard1: { name: 'Wildcard', ver: '1.0', kind: 'master key', price: 4, text: 'In every matrix one random cell off the solution path turns into **, which fits any code. It can be picked only once: Loopback and Rewind cannot reuse it' },
  wildcard2: { name: 'Wildcard', ver: '2.0', kind: 'tuned master key', price: 4, text: 'Upgrades v1.0: before your first move you choose the cell that turns into ** (not the ×2 cell)', needs: 'wildcard1' },
  datanode: { name: 'Data node', ver: '1.0', kind: 'SSD', price: 3, text: 'One cell in every matrix holds +15 data: route through it and upload a target to bank it' },
  datanode2: { name: 'Data node', ver: '2.0', kind: 'NVMe SSD', price: 3, text: 'Upgrades v1.0: the node cell holds +30 data', needs: 'datanode' },
  split1: { name: 'Split', ver: '1.0', kind: 'Y-splitter', price: 4, text: 'Before your first move, cut one target of 3+ codes at its random cut mark; its data splits by the length of each part' },
  split2: { name: 'Split', ver: '2.0', kind: 'tunable splitter', price: 3, text: 'Upgrades v1.0: you choose where the target of 3+ codes is cut', needs: 'split1' },
  sidedoor: { name: 'Side door', ver: '1.0', kind: 'lockpick set', price: 3, text: 'Your first pick may come from any edge; a corner lets the next pick take its row or its column' },
  bridge: { name: 'Bridge', ver: '1.0', kind: 'antenna', price: 3, text: 'Once per matrix, arm it to jump off your lane to a free cell next to your last pick, diagonals too; daemons skip the jump as a move' },
  bridge2: { name: 'Bridge', ver: '2.0', kind: 'long-range antenna', price: 4, text: 'Upgrades v1.0: the jump reaches any free cell on the matrix, even before your first pick', needs: 'bridge' },
  loopback1: { name: 'Loopback', ver: '1.0', kind: 'loopback plug', price: 3, text: 'Once per matrix, arm it to pick a used cell in your lane again; its code goes into the buffer once more' },
  loopback2: { name: 'Loopback', ver: '2.0', kind: 'twin loopback', price: 3, text: 'Upgrades v1.0: the used cell can be anywhere on the matrix; daemons skip that jump as a move', needs: 'loopback1' },
  // Cheap, modest modules: filler for the shelf and a use for spare credits.
  thumb: { name: 'Thumb drive', ver: '1.0', kind: 'USB stick', price: 2, text: '+3 data for every uploaded target' },
  thumb2: { name: 'Thumb drive', ver: '2.0', kind: 'USB 3 stick', price: 3, text: 'Upgrades v1.0: +7 data for every uploaded target', needs: 'thumb' },
  chip: { name: 'Credit chip', ver: '1.0', kind: 'smart card', price: 2, text: '+$1 for every room you clear' },
  ping: { name: 'Ping', ver: '1.0', kind: 'network probe', price: 2, text: 'Before your first move, marks a top-row cell where a solution starts' },
  heatsink: { name: 'Heatsink', ver: '1.0', kind: 'cooler', price: 2, text: 'Corruption locks cells 1 move shorter; for good becomes 2 moves' },
  sim: { name: 'Burner SIM', ver: '1.0', kind: 'prepaid SIM', price: 3, text: 'Once per room, before your first move, swap the matrix for a fresh one' },
  glob: { name: 'Glob', ver: '1.0', kind: 'pattern ROM', price: 4, text: 'In every matrix one code of one target turns into **, which takes any code' },
  repeater: { name: 'Repeater', ver: '1.0', kind: 'signal repeater', price: 3, text: 'In every matrix one cell (×2) puts its code in the buffer twice; one target holds that code doubled' },
  rewind: { name: 'Rewind', ver: '1.0', kind: 'tape deck', price: 4, text: 'Once per matrix, take back your last pick: its code stays, so uploads stay, but the cell is free, your lane returns and the buffer gains a slot' },
  socket: { name: 'Co-processor', ver: '1.0', kind: 'daemon socket', price: 8, text: '+1 daemon slot; selling it with every slot full drops a daemon of your choice' },
  mux: { name: 'Mux', ver: '1.0', kind: 'multiplexer', price: 3, text: 'Once per matrix, arm it so the next pick may stay in the line you are in or take the crossing one' },
} satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEMS;
export const SHELF = 4;
// Thumb drive data per uploaded target: v1.0, v2.0.
export const THUMB_DATA = [3, 7] as const;
export const thumbData = (items: ItemId[]) => (items.includes('thumb2') ? THUMB_DATA[1] : items.includes('thumb') ? THUMB_DATA[0] : 0);
// The rack holds RACK_BASE modules; more slots cost more each, up to RACK_MAX. A sold module returns half of what it cost.
export const RACK_BASE = 4;
export const RACK_MAX = 9;
export const slotCost = (s: RunState) => 5 + 3 * (s.rack - RACK_BASE);
// The Co-processor module adds one daemon slot.
export const daemonSlots = (s: RunState) => DAEMON_SLOTS + (s.items.includes('socket') ? 1 : 0);
export const rackFull = (s: RunState, id: ItemId) => !item(id).needs && s.items.length >= s.rack;
export const sellValue = (id: ItemId) => Math.floor((item(id).price + (item(id).needs ? item(item(id).needs as ItemId).price : 0)) / 2);
export const REROLL_COST = 1;
// Each reroll on a shop visit costs $1 more than the last; free ones count as steps too.
export const rerollCost = (s: RunState) => REROLL_COST + s.rerolls;
export const SWAP_COST = 6;

const item = (id: ItemId): Item => ITEMS[id];

// Not owned, v1.0 not yet replaced, v2.0 only over its v1.0.
export const forSale = (s: RunState) => (Object.keys(ITEMS) as ItemId[]).filter((id) => !s.items.includes(id)
  && (!item(id).needs || s.items.includes(item(id).needs as ItemId)) && !s.items.some((o) => item(o).needs === id));

// Fills the shelf for a shop visit, the same for a given run seed and section; a paid reroll draws again.
export function stockShop(s: RunState, reroll = false): boolean {
  if (reroll) {
    if (s.freeRerolls) s.freeRerolls--;
    else if (s.credits < rerollCost(s)) return false;
    else s.credits -= rerollCost(s);
    s.rerolls++;
    logEvent(s, 'shop · reroll');
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
  logEvent(s, 'shop · bought ' + itemName(id) + ' −$' + it.price + (it.needs ? ' (replaces ' + itemName(it.needs as ItemId) + ')' : ''));
  return true;
}

export function buySlot(s: RunState): boolean {
  if (s.rack >= RACK_MAX || s.credits < slotCost(s)) return false;
  logEvent(s, 'shop · rack slot +1 −$' + slotCost(s));
  s.credits -= slotCost(s);
  s.rack++;
  return true;
}

// Selling the Co-processor with every daemon slot full drops `drop`, at no cost.
export function sell(s: RunState, id: ItemId, drop?: DaemonId): boolean {
  if (!s.items.includes(id)) return false;
  if (id === 'socket' && s.daemons.length > DAEMON_SLOTS) {
    if (!drop || !s.daemons.includes(drop)) return false;
    s.daemons = s.daemons.filter((d) => d !== drop);
  }
  s.credits += sellValue(id);
  s.items = s.items.filter((o) => o !== id);
  s.restarts = Math.min(s.restarts, restartsFor(s));
  logEvent(s, 'shop · sold ' + itemName(id) + ' +$' + sellValue(id) + (drop && !s.daemons.includes(drop) ? ' · dropped ' + dmnFile(drop) : ''));
  return true;
}

// With every slot full, taking an offered daemon swaps an installed one out, at a steep price.
export function swapDaemon(s: RunState, out: DaemonId, id: DaemonId): boolean {
  const i = s.daemons.indexOf(out);
  if (s.credits < SWAP_COST || i < 0) return false;
  s.credits -= SWAP_COST;
  s.daemons[i] = id;
  logEvent(s, 'offer · swapped ' + dmnFile(out) + ' for ' + dmnFile(id) + ' −$' + SWAP_COST);
  return true;
}

const allCells = (p: Puzzle) => p.grid.flatMap((row, r) => row.map((_, c): Cell => [r, c]));

export const NODE_DATA = 15;
export const nodeData = (items: ItemId[]) => (items.includes('datanode2') ? 2 * NODE_DATA : NODE_DATA);
const NODE_ON_PATH = 0.2;

// Item cells of a matrix, the same for its seed: the Wildcard v1.0 cell never lies on the planted solution path,
// the Data node only in about one matrix in five.
export function placeCells(seed: number, p: Puzzle, items: ItemId[]): { wild?: Cell; node?: Cell } {
  const r = rng(hashStr(seed + '/cells'));
  const cells = allCells(p);
  const onPath = (c: Cell) => !!p.path?.some((q) => q[0] === c[0] && q[1] === c[1]);
  const pickCell = (pool: Cell[]) => pool[Math.floor(r() * pool.length)];
  const open = cells.filter((c) => p.grid[c[0]][c[1]] !== BLOCK);
  const wild = items.includes('wildcard1') ? pickCell(open.filter((c) => !onPath(c))) : undefined;
  const nodeOnPath = r() < NODE_ON_PATH;
  const node = items.includes('datanode') || items.includes('datanode2') ? pickCell(open.filter((c) => c !== wild && onPath(c) === nodeOnPath)) : undefined;
  return { wild, node };
}

export const HONEYPOT_MULT = 0.5;
// Honeypot: a free cell off the planted path, clear of the item cells.
export function trapCell(seed: number, p: Puzzle, avoid: (Cell | undefined)[]): Cell | undefined {
  const r = rng(hashStr(seed + '/trap'));
  const same = (a: Cell, b?: Cell) => !!b && a[0] === b[0] && a[1] === b[1];
  const pool = allCells(p)
    .filter((c) => p.grid[c[0]][c[1]] !== BLOCK && !p.path?.some((q) => same(c, q)) && !avoid.some((a) => same(c, a)));
  return pool[Math.floor(r() * pool.length)];
}

// Dead cells: 2 on a 5×5, 3 on bigger matrices, scattered off the planted path.
function killCells(seed: number, p: Puzzle): Puzzle {
  const r = rng(hashStr(seed + '/dead')), n = p.grid.length;
  const pool = shuffled(allCells(p)
    .filter((c) => p.grid[c[0]][c[1]] !== BLOCK && !p.path?.some((q) => q[0] === c[0] && q[1] === c[1]) && !partner(p, ...c)), r);
  for (const [y, x] of pool.slice(0, n <= 5 ? 2 : 3)) p.grid[y][x] = BLOCK;
  return p;
}

// Split v1.0 cut marks: one random gap per target, the same for a matrix seed.
export const cutMarks = (seed: number, targets: string[][]) => {
  const r = rng(hashStr(seed + '/cuts'));
  return targets.map((t) => 1 + Math.floor(r() * (t.length - 1)));
};

// Split needs 3+ codes: cutting a 2-code target into two 1-code ones lets a single ** upload both.
export const SPLIT_MIN = 3;
export const canSplit = (t: string[]) => t.length >= SPLIT_MIN;

// Cuts target i before code `at` (default: the middle, rounded up) into two targets; each gets data in proportion to its length.
export function splitTarget(targets: string[][], worth: number[], i: number, at = Math.ceil(targets[i].length / 2)) {
  const w = worth[i], head = Math.round((w * at) / targets[i].length);
  return {
    targets: [...targets.slice(0, i), targets[i].slice(0, at), targets[i].slice(at), ...targets.slice(i + 1)],
    worth: [...worth.slice(0, i), head, w - head, ...worth.slice(i + 1)],
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
  // Later iterations: the longest target gets one code more (the buffer follows).
  if (s.loop) { const lens = [...size.lens]; lens[lens.indexOf(Math.max(...lens))]++; size = { ...size, lens }; }
  if (rules.includes('throttle')) size = { ...size, slack: size.slack - 1 };
  if (rules.includes('corruption')) size = { ...size, burn: burnOf(s) };
  if (rules.includes('firewall')) {
    const r = rng(hashStr(seed + '/ice'));
    const row = r() < 0.5;
    size = { ...size, block: row ? ['row', 1 + Math.floor(r() * (size.n - 1))] : ['col', Math.floor(r() * size.n)] };
  }
  const deal = (sd: number) => (rules.includes('deadcells') ? killCells(sd, generate(sd, size)) : generate(sd, size));
  let p = deal(seed);
  // Blackout: redeal until every top-row start can still upload some target.
  if (rules.includes('blackout')) {
    for (let k = 1; k < 50 && !p.grid[0].every((_, c) => (!!p.half && c >= p.half) || startsWell(p, c, size.burn)); k++) p = deal(hashStr(seed + '/' + k));
  }
  return rules.includes('conveyor') ? addBelt(seed, p) : p;
}

// Belt helpers live with the Puzzle type, so the solver can read a moving belt too.
export { beltRow, beltSrc } from './generator';

// The buffer the planted solution fills, reading belt cells as they will be at each pick.
export const planBuf = (p: Puzzle) => (p.path ?? []).map(([r, c], t) => (p.belt?.row === r ? p.belt.base[beltSrc(p.belt.base, c, t)] : p.grid[r][c]));

// Picks a belt row (never the top one) and pre-rotates it so every planted pick in it still finds its code.
// Rows the solution uses come first; a row it never uses always fits.
function addBelt(seed: number, p: Puzzle): Puzzle {
  const r = rng(hashStr(seed + '/belt')), path = p.path ?? [];
  const rows = p.grid.map((_, i) => i).filter((i) => i > 0 && p.grid[i].some((v) => v !== BLOCK)).sort(() => r() - 0.5);
  const onPath = new Set(path.map(([i]) => i));
  for (const row of [...rows.filter((i) => onPath.has(i)), ...rows.filter((i) => !onPath.has(i))]) {
    const base = [...p.grid[row]], set = new Map<number, string>();
    const fits = path.every(([pr, c], t) => {
      if (pr !== row) return true;
      const src = beltSrc(base, c, t), code = p.grid[row][c];
      if (set.has(src) && set.get(src) !== code) return false;
      set.set(src, code);
      return true;
    });
    if (!fits) continue;
    for (const [i, code] of set) base[i] = code;
    p.grid[row] = [...base];
    return { ...p, belt: { row, base } };
  }
  return p;
}
