export const CODES = ['4B', '7F', 'C9', '1D', 'E5'];

// n: grid side, l: buffer length, lens: target lengths (sum <= l). Small grids get one spare slot; bigger ones none.
export interface Size { n: number; l: number; lens: number[] }
export const SIZES = {
  easy: { n: 5, l: 8, lens: [2, 2, 3] },
  normal: { n: 6, l: 8, lens: [2, 3, 3] },
  hard: { n: 7, l: 10, lens: [3, 3, 4] },
} satisfies Record<string, Size>;
export type SizeKey = keyof typeof SIZES;

export interface Puzzle {
  grid: string[][];
  targets: string[][];
  l: number;
}

export function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// mulberry32
export function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generate(seed: number, { n: N, l: L, lens }: Size = SIZES.normal): Puzzle {
  const r = rng(seed);
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const planted = lens.reduce((a, b) => a + b, 0);
  for (;;) {
    // Walk a random legal path long enough for all targets back to back, then plant them along it.
    const path: [number, number][] = [[0, Math.floor(r() * N)]];
    let horiz = false;
    let ok = true;
    while (path.length < planted) {
      const [pr, pc] = path[path.length - 1];
      const opts: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const cell: [number, number] = horiz ? [pr, i] : [i, pc];
        if (!path.some((p) => p[0] === cell[0] && p[1] === cell[1])) opts.push(cell);
      }
      if (!opts.length) { ok = false; break; }
      path.push(pick(opts));
      horiz = !horiz;
    }
    if (!ok) continue;
    const targets = lens.map((n) => Array.from({ length: n }, () => pick(CODES)));
    if (new Set(targets.map((t) => t.join(' '))).size < targets.length) continue;
    if (targets.some((t) => t.every((c) => c === t[0]))) continue;
    const order = targets.map((_, i) => i).sort(() => r() - 0.5);
    const seq = order.flatMap((i) => targets[i]);
    const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => pick(CODES)));
    path.forEach(([pr, pc], i) => (grid[pr][pc] = seq[i]));
    return { grid, targets, l: L };
  }
}
