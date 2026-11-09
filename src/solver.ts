import { contains, halfOf, laneCells, nextLane, partner, partial, type Lane, type Run } from './game';
import { BLOCK, type Puzzle } from './generator';

// Once-per-matrix moves a run may still hold: jump to a free cell, or pick a used cell again (in the lane, or anywhere with loopAny).
// rep: the Repeater cell, whose code goes into the buffer twice.
// near: the jump (Bridge v1.0) only reaches the 8 cells around the last pick; last: that pick before the search.
// mux: one pick anywhere in the row or column of the last pick.
export interface Tools { jump?: boolean; loop?: boolean; loopAny?: boolean; mux?: boolean; rep?: [number, number]; near?: boolean; last?: [number, number] }

// True if some sequence of legal picks from this state still uploads every target.
// Gives up and answers true after `budget` nodes, so it can only ever end a game late, never wrongly.
export function canComplete(run: Run, p: Puzzle, budget = 60_000, tools: Tools = {}): boolean {
  const rows = p.grid.length, cols = p.grid[0].length;
  const buf = [...run.buffer];
  const used = new Set(run.used);
  const burnt = new Map(run.burnt);
  const hot = (r: number, c: number) => (burnt.get(r + ',' + c) ?? 0) > buf.length;
  const open = (r: number, c: number) => p.grid[r][c] !== BLOCK && !hot(r, c);
  const NEAR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let nodes = 0;
  // Picks (r, c) from `from` and goes on along the lane the board gives next; a reused cell stays used.
  const step = (r: number, c: number, from: Lane, jump: boolean, loop: boolean, mux: boolean): boolean => {
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
    const ok = dfs(nextLane(from, r, c, p), jump, loop, mux, [r, c]);
    for (const [k, old] of was.reverse()) { if (old === undefined) burnt.delete(k); else burnt.set(k, old); }
    buf.pop();
    if (twice) buf.pop();
    if (fresh) used.delete(key);
    return ok;
  };
  const dfs = (lane: Lane, jump: boolean, loop: boolean, mux: boolean, last?: [number, number]): boolean => {
    const undone = p.targets.filter((t) => !contains(buf, t));
    if (!undone.length) return true;
    const left = p.l - buf.length;
    if (undone.some((t) => t.length - partial(buf, t) > left)) return false;
    if (++nodes > budget) return true;
    for (const [r, c] of laneCells(lane, p)) {
      if (!open(r, c)) continue;
      if (!used.has(r + ',' + c)) { if (step(r, c, lane, jump, loop, mux)) return true; }
      else if (loop && !tools.loopAny && step(r, c, lane, jump, false, mux)) return true;
    }
    if (loop && tools.loopAny) for (const key of [...used]) {
      const [r, c] = key.split(',').map(Number);
      if (!hot(r, c) && step(r, c, lane, jump, false, mux)) return true;
    }
    // Mux: a free cell in the row or column of the last pick, as if the lane were both lines through it.
    if (mux && !lane.free && last) {
      const wide = { ...lane, free: last };
      for (const [r, c] of laneCells(wide, p)) if (open(r, c) && !used.has(r + ',' + c) && step(r, c, wide, jump, loop, false)) return true;
    }
    if (jump && (!tools.near || last)) {
      const at = last && (partner(p, ...last) ?? last); // after a port, Bridge v1.0 reaches around its partner
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (tools.near && (Math.max(Math.abs(at![0] - r), Math.abs(at![1] - c)) !== 1 || halfOf(p, c) !== halfOf(p, at![1]))) continue;
        if (open(r, c) && !used.has(r + ',' + c) && step(r, c, lane, false, loop, mux)) return true;
      }
    }
    return false;
  };
  return dfs(run, !!tools.jump, !!tools.loop, !!tools.mux, tools.last);
}
