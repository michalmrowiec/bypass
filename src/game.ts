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
  burn?: number; // Corruption ICE: each pick locks its 4 neighbours for this many moves (Infinity: for good)
  burnt?: Map<string, number>; // cell -> path length from which it is free again
}

export const burning = (run: Run, r: number, c: number) => (run.burnt?.get(r + ',' + c) ?? 0) > run.path.length;

// The lane the next pick comes from: one row or column, or both lines through `free`.
export const inLane = (run: Run, r: number, c: number) =>
  run.free ? r === run.free[0] || c === run.free[1] : run.axis === 'row' ? r === run.idx : c === run.idx;

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

export function isLegal(run: Run, r: number, c: number): boolean {
  return !run.used.has(r + ',' + c) && inLane(run, r, c) && !burning(run, r, c);
}

export function anyLegal(run: Run, n: number): boolean {
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (isLegal(run, r, c)) return true;
  return false;
}

export function pick(run: Run, puzzle: Puzzle, r: number, c: number): void {
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
  const alongRow = run.free ? r === run.free[0] : run.axis === 'row';
  run.free = undefined;
  if (alongRow) { run.axis = 'col'; run.idx = c; }
  else { run.axis = 'row'; run.idx = r; }
}

export const score = (buf: string[], targets: string[][]) => targets.filter((t) => contains(buf, t)).length;

export const isFinished = (run: Run, p: Puzzle) =>
  score(run.buffer, p.targets) === p.targets.length || run.buffer.length === p.l || !anyLegal(run, p.grid.length);


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

export const challengeQuery = (kind: ChallengeKind, seed: number, time: number | null) =>
  '?c=' + kind + '.' + seed + (time ? '&t=' + time : '');
