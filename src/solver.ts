import { contains, partial, type Run } from './game';
import type { Puzzle } from './generator';

// True if some sequence of legal picks from this state still uploads every target.
// Gives up and answers true after `budget` nodes, so it can only ever end a game late, never wrongly.
export function canComplete(run: Run, p: Puzzle, budget = 60_000): boolean {
  const n = p.grid.length;
  const buf = [...run.buffer];
  const used = new Set(run.used);
  let nodes = 0;
  const dfs = (axis: 'row' | 'col', idx: number): boolean => {
    const undone = p.targets.filter((t) => !contains(buf, t));
    if (!undone.length) return true;
    const left = p.l - buf.length;
    if (undone.some((t) => t.length - partial(buf, t) > left)) return false;
    if (++nodes > budget) return true;
    for (let i = 0; i < n; i++) {
      const [r, c] = axis === 'row' ? [idx, i] : [i, idx];
      const key = r + ',' + c;
      if (used.has(key)) continue;
      used.add(key);
      buf.push(p.grid[r][c]);
      const ok = axis === 'row' ? dfs('col', c) : dfs('row', r);
      buf.pop();
      used.delete(key);
      if (ok) return true;
    }
    return false;
  };
  return dfs(run.axis, run.idx);
}
