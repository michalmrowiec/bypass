import { laneCells, nextLane, partner, type Lane } from './game';

export const CODES = ['4B', '7F', 'C9', '1D', 'E5'];

// n: grid side, lens: target lengths. links: how many targets get chained (one's last code starts the next),
// picked at random from the list. The buffer fits the chained sequence plus `slack` spare slots, so with
// slack 0 every link is required to win. codes: the pool cells and targets are drawn from (default CODES).
// deep: 1 makes one link overlap 2 codes instead of 1 (needs two targets of 3+ codes).
// block: a sealed row or column (BLOCK cells); the solution path never touches it.
// burn: Corruption; the solution path never steps next to any of its last `burn` cells.
// ports: a port board, two n×n matrices side by side with this many port pairs (block and burn are not supported there).
export interface Size { n: number; lens: number[]; links: number[]; slack: number; codes?: string[]; deep?: number; block?: ['row' | 'col', number]; burn?: number; ports?: number }
export const BLOCK = '##';
export const SIZES = {
  easy: { n: 5, lens: [2, 2, 3], links: [1], slack: 0 },
  normal: { n: 6, lens: [2, 3, 3], links: [0, 1, 1, 2], slack: 0 },
  hard: { n: 7, lens: [3, 3, 4], links: [2], slack: 1 },
} satisfies Record<string, Size>;
export type SizeKey = keyof typeof SIZES;

export interface Puzzle {
  grid: string[][];
  targets: string[][];
  l: number;
  path?: [number, number][]; // cells the solution was planted on (generate only)
  belt?: { row: number; base: string[] }; // Conveyor: the row's codes before any pick
  half?: number; // port boards: two n×n matrices side by side, `half` (= n) columns each
  ports?: [[number, number], [number, number]][]; // port pairs, first in the left matrix, partner in the right one
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

// Port board walk: starts in row 0 of the left matrix and must pass at least one port, or the right matrix is decoration.
function portWalk(N: number, count: number, len: number, pick: <T>(a: T[]) => T): Pick<Puzzle, 'half' | 'ports' | 'path'> | null {
  const cells = (h: number) => Array.from({ length: N * N }, (_, i): [number, number] => [Math.floor(i / N), h * N + (i % N)]);
  const a = cells(0), b = cells(1), ports: Puzzle['ports'] = [];
  for (let k = 0; k < count; k++) {
    const pa = pick(a.filter((x) => !ports.some(([q]) => q === x))), pb = pick(b.filter((x) => !ports.some(([, q]) => q === x)));
    ports.push([pa, pb]);
  }
  const shape = { grid: Array.from({ length: N }, () => new Array(2 * N)), targets: [], l: 0, half: N, ports };
  const path: [number, number][] = [];
  let lane: Lane = { axis: 'row', idx: 0, half: 0 };
  while (path.length < len) {
    const opts = laneCells(lane, shape).filter(([r, c]) => !path.some((q) => q[0] === r && q[1] === c));
    if (!opts.length) return null;
    const [r, c] = pick(opts);
    path.push([r, c]);
    lane = nextLane(lane, r, c, shape);
  }
  return path.some(([r, c]) => partner(shape, r, c)) ? { half: N, ports, path } : null;
}

export function generate(seed: number, { n: N, lens, links: linkOpts, slack, codes = CODES, deep: deepOpt = 0, block, burn, ports }: Size = SIZES.normal): Puzzle {
  // One code can't make distinct, non-uniform targets: the retry loop would never end.
  if (new Set(codes).size < 2) throw new Error('code pool needs at least 2 distinct codes');
  const r = rng(seed);
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const links = Math.min(pick(linkOpts), lens.length - 1);
  // Only between targets of 3+ codes, so neither fits inside the other.
  const deep = deepOpt && links && lens.filter((l) => l >= 3).length >= 2 ? 1 : 0;
  const planted = lens.reduce((a, b) => a + b, 0) - links - deep;
  const sealed = (c: [number, number]) => !!block && c[block[0] === 'row' ? 0 : 1] === block[1];
  const startCols = Array.from({ length: N }, (_, c) => c).filter((c) => !sealed([0, c]));
  for (;;) {
    const board = ports ? portWalk(N, ports, planted, pick) : undefined;
    if (board === null) continue;
    // Walk a random legal path long enough for the chained targets, then plant them along it.
    const path: [number, number][] = [[0, pick(startCols)]];
    let horiz = false;
    let ok = true;
    if (board) path.splice(0, 1, ...board.path!);
    while (path.length < planted) {
      const [pr, pc] = path[path.length - 1];
      const opts: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const cell: [number, number] = horiz ? [pr, i] : [i, pc];
        if (sealed(cell) || path.some((p) => p[0] === cell[0] && p[1] === cell[1])) continue;
        if (burn && path.slice(-burn).some((p) => Math.abs(p[0] - cell[0]) + Math.abs(p[1] - cell[1]) === 1)) continue;
        opts.push(cell);
      }
      if (!opts.length) { ok = false; break; }
      path.push(pick(opts));
      horiz = !horiz;
    }
    if (!ok) continue;
    // Targets keep the lens order on screen but are planted in a shuffled order; `linked` holds the planted
    // positions j whose target starts with the last code of the target planted just before it.
    const order = lens.map((_, i) => i).sort(() => r() - 0.5);
    const linked = new Set(order.slice(1).map((_, j) => j + 1).sort(() => r() - 0.5).slice(0, links));
    const deepAt = deep ? [...linked].find((j) => lens[order[j]] >= 3 && lens[order[j - 1]] >= 3) : undefined;
    if (deep && deepAt === undefined) continue;
    const targets: string[][] = [];
    order.forEach((ti, j) => {
      const t = Array.from({ length: lens[ti] }, () => pick(codes));
      if (linked.has(j)) {
        const prev = targets[order[j - 1]], k = j === deepAt ? 2 : 1;
        for (let x = 0; x < k; x++) t[x] = prev[prev.length - k + x];
      }
      targets[ti] = t;
    });
    if (new Set(targets.map((t) => t.join(' '))).size < targets.length) continue;
    if (targets.some((t) => t.every((c) => c === t[0]))) continue;
    const seq = order.flatMap((ti, j) => targets[ti].slice(j === deepAt ? 2 : linked.has(j) ? 1 : 0));
    const grid = Array.from({ length: N }, () => Array.from({ length: board ? 2 * N : N }, () => pick(codes)));
    path.forEach(([pr, pc], i) => (grid[pr][pc] = seq[i]));
    if (board) return { grid, targets, l: planted + slack, ...board };
    if (block) for (let i = 0; i < N; i++) grid[block[0] === 'row' ? block[1] : i][block[0] === 'row' ? i : block[1]] = BLOCK;
    return { grid, targets, l: planted + slack, path };
  }
}

// Conveyor: belt slots skip ## cells; after k picks the code at slot j came from slot j - k.
const beltSlots = (base: string[]) => base.flatMap((v, i) => (v === BLOCK ? [] : [i]));
const wrap = (i: number, m: number) => ((i % m) + m) % m;
// Where the code now at column c was before any pick.
export function beltSrc(base: string[], c: number, k: number): number {
  const slots = beltSlots(base);
  return slots[wrap(slots.indexOf(c) - k, slots.length)];
}
export function beltRow(base: string[], k: number): string[] {
  const out = [...base];
  for (const s of beltSlots(base)) out[s] = base[beltSrc(base, s, k)];
  return out;
}
