import { L, N, type Puzzle } from './generator';

export const MAX_TRIES = 3;

export interface Run {
  buffer: string[];
  used: Set<string>;
  axis: 'row' | 'col';
  idx: number;
}

export const newRun = (): Run => ({ buffer: [], used: new Set(), axis: 'row', idx: 0 });

export function contains(buf: string[], t: string[]): boolean {
  for (let i = 0; i + t.length <= buf.length; i++) {
    if (t.every((c, j) => buf[i + j] === c)) return true;
  }
  return false;
}

// Length of the longest proper prefix of t that the buffer currently ends with.
export function partial(buf: string[], t: string[]): number {
  for (let k = Math.min(t.length - 1, buf.length); k > 0; k--) {
    let m = true;
    for (let j = 0; j < k; j++) if (buf[buf.length - k + j] !== t[j]) { m = false; break; }
    if (m) return k;
  }
  return 0;
}

export function targetProgress(buf: string[], t: string[], over: boolean) {
  if (contains(buf, t)) return { done: true, k: t.length, fail: false };
  const k = partial(buf, t);
  return { done: false, k, fail: t.length - k > L - buf.length || over };
}

export function isLegal(run: Run, r: number, c: number): boolean {
  if (run.used.has(r + ',' + c)) return false;
  return run.axis === 'row' ? r === run.idx : c === run.idx;
}

export function anyLegal(run: Run): boolean {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (isLegal(run, r, c)) return true;
  return false;
}

export function pick(run: Run, puzzle: Puzzle, r: number, c: number): void {
  run.buffer.push(puzzle.grid[r][c]);
  run.used.add(r + ',' + c);
  if (run.axis === 'row') { run.axis = 'col'; run.idx = c; }
  else { run.axis = 'row'; run.idx = r; }
}

export const score = (buf: string[], targets: string[][]) => targets.filter((t) => contains(buf, t)).length;

export const isFinished = (run: Run, puzzle: Puzzle) =>
  score(run.buffer, puzzle.targets) === puzzle.targets.length || run.buffer.length === L || !anyLegal(run);
