import { contains, partial, type Run } from './game';
import { BLOCK, type Puzzle } from './generator';

// Once-per-matrix moves a run may still hold: jump to any free cell, or pick a used cell again (in the lane, or anywhere with loopAny).
// rep: the Repeater cell, whose code goes into the buffer twice.
export interface Tools { jump?: boolean; loop?: boolean; loopAny?: boolean; rep?: [number, number] }

// True if some sequence of legal picks from this state still uploads every target.
// Gives up and answers true after `budget` nodes, so it can only ever end a game late, never wrongly.
export function canComplete(run: Run, p: Puzzle, budget = 60_000, tools: Tools = {}): boolean {
  const n = p.grid.length;
  const buf = [...run.buffer];
  const used = new Set(run.used);
  const burnt = new Map(run.burnt);
  const hot = (r: number, c: number) => (burnt.get(r + ',' + c) ?? 0) > buf.length;
  const NEAR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let nodes = 0;
  // Picks (r, c) and goes on along the other axis; a reused cell stays used.
  const step = (r: number, c: number, alongRow: boolean, jump: boolean, loop: boolean): boolean => {
    const key = r + ',' + c;
    const fresh = !used.has(key);
    used.add(key);
    const twice = tools.rep?.[0] === r && tools.rep[1] === c;
    buf.push(p.grid[r][c]);
    if (twice) buf.push(p.grid[r][c]);
    const was = run.burn ? NEAR.map(([dr, dc]) => {
      const k = r + dr + ',' + (c + dc), old = burnt.get(k);
      burnt.set(k, Math.max(old ?? 0, buf.length + run.burn!));
      return [k, old] as const;
    }) : [];
    const ok = alongRow ? dfs('col', c, undefined, jump, loop) : dfs('row', r, undefined, jump, loop);
    for (const [k, old] of was.reverse()) { if (old === undefined) burnt.delete(k); else burnt.set(k, old); }
    buf.pop();
    if (twice) buf.pop();
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
        if (p.grid[r][c] === BLOCK || hot(r, c)) continue;
        if (!used.has(r + ',' + c)) { if (step(r, c, ax === 'row', jump, loop)) return true; }
        else if (loop && !tools.loopAny && step(r, c, ax === 'row', jump, false)) return true;
      }
    }
    if (loop && tools.loopAny) for (const key of [...used]) {
      const [r, c] = key.split(',').map(Number);
      if (!hot(r, c) && step(r, c, axis === 'row', jump, false)) return true;
    }
    if (jump) {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (p.grid[r][c] !== BLOCK && !hot(r, c) && !used.has(r + ',' + c) && step(r, c, axis === 'row', false, loop)) return true;
      }
    }
    return false;
  };
  return dfs(run.axis, run.idx, run.free, !!tools.jump, !!tools.loop);
}
