import { contains, partial, type Run } from './game';
import { BLOCK, type Puzzle } from './generator';

// Once-per-matrix moves a run may still hold: jump to a free cell, or pick a used cell again (in the lane, or anywhere with loopAny).
// rep: the Repeater cell, whose code goes into the buffer twice.
// near: the jump (Bridge v1.0) only reaches the 8 cells around the last pick; last: that pick before the search.
// mux: one pick anywhere in the row or column of the last pick.
export interface Tools { jump?: boolean; loop?: boolean; loopAny?: boolean; mux?: boolean; rep?: [number, number]; near?: boolean; last?: [number, number] }

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
  const step = (r: number, c: number, alongRow: boolean, jump: boolean, loop: boolean, mux: boolean): boolean => {
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
    const ok = alongRow ? dfs('col', c, undefined, jump, loop, mux, [r, c]) : dfs('row', r, undefined, jump, loop, mux, [r, c]);
    for (const [k, old] of was.reverse()) { if (old === undefined) burnt.delete(k); else burnt.set(k, old); }
    buf.pop();
    if (twice) buf.pop();
    if (fresh) used.delete(key);
    return ok;
  };
  const dfs = (axis: 'row' | 'col', idx: number, free: [number, number] | undefined, jump: boolean, loop: boolean, mux: boolean, last?: [number, number]): boolean => {
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
        if (!used.has(r + ',' + c)) { if (step(r, c, ax === 'row', jump, loop, mux)) return true; }
        else if (loop && !tools.loopAny && step(r, c, ax === 'row', jump, false, mux)) return true;
      }
    }
    if (loop && tools.loopAny) for (const key of [...used]) {
      const [r, c] = key.split(',').map(Number);
      if (!hot(r, c) && step(r, c, axis === 'row', jump, false, mux)) return true;
    }
    // Mux: a free cell in the row or column of the last pick; the next lane is the other line through it.
    if (mux && !free && last) for (let i = 0; i < n; i++) for (const [r, c] of [[last[0], i], [i, last[1]]]) {
      if (p.grid[r][c] !== BLOCK && !hot(r, c) && !used.has(r + ',' + c) && step(r, c, r === last[0], jump, loop, false)) return true;
    }
    if (jump && (!tools.near || last)) {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (tools.near && Math.max(Math.abs(last![0] - r), Math.abs(last![1] - c)) !== 1) continue;
        if (p.grid[r][c] !== BLOCK && !hot(r, c) && !used.has(r + ',' + c) && step(r, c, axis === 'row', false, loop, mux)) return true;
      }
    }
    return false;
  };
  return dfs(run.axis, run.idx, run.free, !!tools.jump, !!tools.loop, !!tools.mux, tools.last);
}
