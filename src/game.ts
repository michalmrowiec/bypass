import { hashStr, type Puzzle, type Size, type SizeKey } from './generator';

export const MAX_TRIES = 3;
// Sprint: matrices against the clock, ramping from one target to three; ms is the per-matrix time limit.
type Stage = Size & { ms: number };
const ONE: Stage = { n: 5, lens: [3], links: [0], slack: 1, ms: 10_000 };
const TWO: Stage = { n: 5, lens: [2, 3], links: [1], slack: 1, ms: 15_000 };
const TWO_LONG: Stage = { n: 5, lens: [3, 3], links: [1], slack: 0, ms: 20_000 };
const THREE: Stage = { n: 6, lens: [2, 3, 3], links: [1], slack: 0, ms: 30_000 };
export const SPRINTS = { 3: [ONE, TWO, THREE], 5: [ONE, TWO, TWO_LONG, THREE, THREE] };
export type SprintLen = keyof typeof SPRINTS;

export interface Run {
  buffer: string[];
  used: Set<string>;
  path: [number, number][]; // picked cells in order
  axis: 'row' | 'col';
  idx: number;
  free?: [number, number]; // after a Side door corner: the next pick may take this cell's row or its column
  half?: number; // port boards: which matrix a row lane lies in (0 = A, the left one)
  burn?: number; // Corruption ICE: each pick locks its 4 neighbours for this many moves (Infinity: for good)
  burnt?: Map<string, number>; // cell -> path length from which it is free again
}

// Board shape: the cells of a lane and the lane after a pick. Everything that walks the board (rules, solver) goes through these two.
// Port boards: two matrices side by side, `half` columns each; a row lane stays in its own matrix.
export type Lane = Pick<Run, 'axis' | 'idx' | 'free' | 'half'>;
export const halfOf = (p: Pick<Puzzle, 'half'> | undefined, c: number) => (p?.half ? Math.floor(c / p.half) : 0);
export function laneCells({ axis, idx, free, half }: Lane, p: Puzzle): [number, number][] {
  const rows = p.grid.length, w = p.half ?? p.grid[0].length, out: [number, number][] = [];
  const row = (r: number, h = 0) => { for (let c = h * w; c < h * w + w; c++) out.push([r, c]); };
  const col = (c: number) => { for (let r = 0; r < rows; r++) out.push([r, c]); };
  if (free) { row(free[0], halfOf(p, free[1])); col(free[1]); } else if (axis === 'row') row(idx, half ?? 0); else col(idx);
  return out;
}
// The index of the port pair (r, c) belongs to, or -1; and the port paired with it, if it is one.
export const pairOf = (p: Pick<Puzzle, 'ports'>, r: number, c: number) =>
  p.ports?.findIndex(([a, b]) => (a[0] === r && a[1] === c) || (b[0] === r && b[1] === c)) ?? -1;
export const partner = (p: Pick<Puzzle, 'ports'>, r: number, c: number): [number, number] | undefined => {
  const pair = p.ports?.[pairOf(p, r, c)];
  return pair && (pair[0][0] === r && pair[0][1] === c ? pair[1] : pair[0]);
};
// Loopback v1.0 back through a port: a used port counts as in the lane while its partner is; it then leads
// on through the port itself (no second jump), so the run returns to the port's matrix.
export const portBack = (lane: Lane, p: Pick<Puzzle, 'ports' | 'half'>, r: number, c: number) => {
  const q = partner(p, r, c);
  return !!q && !inLane(lane, r, c, p) && inLane(lane, q[0], q[1], p);
};

// A port sends the next lane through its partner in the other matrix.
export function nextLane({ axis, free }: Lane, r: number, c: number, p: Pick<Puzzle, 'ports' | 'half'>): Lane {
  const alongRow = free ? r === free[0] : axis === 'row';
  const [tr, tc] = partner(p, r, c) ?? [r, c];
  return alongRow ? { axis: 'col', idx: tc, free: undefined, half: undefined } : { axis: 'row', idx: tr, free: undefined, half: p.half ? halfOf(p, tc) : undefined };
}

export const burning = (run: Run, r: number, c: number) => (run.burnt?.get(r + ',' + c) ?? 0) > run.path.length;

// The lane the next pick comes from: one row or column, or both lines through `free`.
// p is needed only on port boards, where a row lane ends at its matrix's edge.
export const inLane = (run: Lane, r: number, c: number, p?: Pick<Puzzle, 'half'>) =>
  run.free ? (r === run.free[0] && halfOf(p, c) === halfOf(p, run.free[1])) || c === run.free[1]
    : run.axis === 'row' ? r === run.idx && halfOf(p, c) === (run.half ?? 0) : c === run.idx;

export const newRun = (): Run => ({ buffer: [], used: new Set(), path: [], axis: 'row', idx: 0 });

// Run-only wildcard: a ** cell stands for any code in the buffer, a ** target code (Glob) takes any code. Other modes never deal it.
export const WILD = '**';
export const fits = (b: string | undefined, code: string) => b !== undefined && (b === code || b === WILD || code === WILD);

export function contains(buf: string[], t: string[]): boolean {
  for (let i = 0; i + t.length <= buf.length; i++) {
    if (t.every((c, j) => fits(buf[i + j], c))) return true;
  }
  return false;
}

// Length of the longest proper prefix of t that the buffer currently ends with.
export function partial(buf: string[], t: string[]): number {
  for (let k = Math.min(t.length - 1, buf.length); k > 0; k--) {
    let m = true;
    for (let j = 0; j < k; j++) if (!fits(buf[buf.length - k + j], t[j])) { m = false; break; }
    if (m) return k;
  }
  return 0;
}

export function targetProgress(buf: string[], t: string[], l: number, over: boolean) {
  if (contains(buf, t)) return { done: true, k: t.length, fail: false };
  const k = partial(buf, t);
  return { done: false, k, fail: t.length - k > l - buf.length || over };
}

export function isLegal(run: Run, r: number, c: number, p?: Pick<Puzzle, 'half'>): boolean {
  return !run.used.has(r + ',' + c) && inLane(run, r, c, p) && !burning(run, r, c);
}

export const anyLegal = (run: Run, p: Puzzle) => laneCells(run, p).some(([r, c]) => isLegal(run, r, c, p));

// through: Loopback v1.0 back through a port; the run stays on the port instead of jumping to its partner.
export function pick(run: Run, puzzle: Puzzle, r: number, c: number, through = false): void {
  run.buffer.push(puzzle.grid[r][c]);
  run.used.add(r + ',' + c);
  run.path.push([r, c]);
  if (run.burn) {
    const burnt = (run.burnt ??= new Map());
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const k = r + dr + ',' + (c + dc);
      burnt.set(k, Math.max(burnt.get(k) ?? 0, run.path.length + run.burn));
    }
  }
  Object.assign(run, nextLane(run, r, c, through ? { half: puzzle.half } : puzzle));
}

export const score = (buf: string[], targets: string[][]) => targets.filter((t) => contains(buf, t)).length;

export const isFinished = (run: Run, p: Puzzle) =>
  score(run.buffer, p.targets) === p.targets.length || run.buffer.length === p.l || !anyLegal(run, p);


// Each sprint matrix gets its own seed derived from the run's seed, so one link reproduces the whole run.
export const stageSeed = (seed: number, stage: number) => hashStr(seed + '/' + stage);

// What a shared link points at: a training matrix of some size, or a whole sprint run.
export type ChallengeKind = SizeKey | 'sprint3' | 'sprint5';
export interface Challenge { kind: ChallengeKind; seed: number; time: number | null }

// Parses ?c=<kind>.<seed>&t=<ms> from a shared link; anything malformed is ignored.
export function parseChallenge(search: string): Challenge | null {
  const q = new URLSearchParams(search);
  const m = /^(easy|normal|hard|sprint3|sprint5)\.(\d{1,10})$/.exec(q.get('c') ?? '');
  if (!m) return null;
  const t = Number(q.get('t'));
  return { kind: m[1] as ChallengeKind, seed: Number(m[2]), time: Number.isInteger(t) && t > 0 && t < 36e5 ? t : null };
}

// Shared challenge code <kind>.<seed>[.<ms>]: pasted into the game, since links can't reach it inside itch's iframe.
export const challengeCode = (kind: ChallengeKind, seed: number, time: number | null) =>
  kind + '.' + seed + (time ? '.' + time : '');

// A pasted code, or a whole old link with ?c=…; anything malformed gives null.
export function parseCode(text: string): Challenge | null {
  const s = text.trim().toLowerCase(), m = /^([a-z0-9]+\.\d+)(?:\.(\d+))?$/.exec(s);
  return parseChallenge(s.includes('?') ? s.slice(s.indexOf('?')) : m ? '?c=' + m[1] + (m[2] ? '&t=' + m[2] : '') : '');
}
