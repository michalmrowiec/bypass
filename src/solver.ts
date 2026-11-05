import { contains, partial, type Run } from './game';
import type { Puzzle } from './generator';

// Once-per-matrix moves a run may still hold: jump to any free cell, or pick a used cell again (in the lane, or anywhere with loopAny).
export interface Tools { jump?: boolean; loop?: boolean; loopAny?: boolean }

// True if some sequence of legal picks from this state still uploads every target.
// Gives up and answers true after `budget` nodes, so it can only ever end a game late, never wrongly.
export function canComplete(run: Run, p: Puzzle, budget = 60_000, tools: Tools = {}): boolean {
  const n = p.grid.length;
  const buf = [...run.buffer];
  const used = new Set(run.used);
  let nodes = 0;
  // Picks (r, c) and goes on along the other axis; a reused cell stays used.
  const step = (r: number, c: number, alongRow: boolean, jump: boolean, loop: boolean): boolean => {
    const key = r + ',' + c;
    const fresh = !used.has(key);
    used.add(key);
    buf.push(p.grid[r][c]);
    const ok = alongRow ? dfs('col', c, undefined, jump, loop) : dfs('row', r, undefined, jump, loop);
    buf.pop();
    if (fresh) used.delete(key);
    return ok;
  };
  const dfs = (axis: 'row' | 'col', idx: number, free: [number, number] | undefined, jump: boolean, loop: boolean): boolean => {
    const undone = p.targets.filter((t) => !contains(buf, t));
    if (!undone.length) return true;
    const left = p.l - buf.length;
    if (undone.some((t) => t.length - partial(buf, t) > left)) return false;
    if (++nodes > budget) return true;
    const lanes: ['row' | 'col', number][] = free ? [['row', free[0]], ['col', free[1]]] : [[axis, idx]];
    for (const [ax, ix] of lanes) {
      for (let i = 0; i < n; i++) {
        const [r, c] = ax === 'row' ? [ix, i] : [i, ix];
        if (!used.has(r + ',' + c)) { if (step(r, c, ax === 'row', jump, loop)) return true; }
        else if (loop && !tools.loopAny && step(r, c, ax === 'row', jump, false)) return true;
      }
    }
    if (loop && tools.loopAny) for (const key of [...used]) {
      const [r, c] = key.split(',').map(Number);
      if (step(r, c, axis === 'row', jump, false)) return true;
    }
    if (jump) {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!used.has(r + ',' + c) && step(r, c, axis === 'row', false, loop)) return true;
      }
    }
    return false;
  };
  return dfs(run.axis, run.idx, run.free, !!tools.jump, !!tools.loop);
}
