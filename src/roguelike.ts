import { contains } from './game';
import { CODES, SIZES, type Size } from './generator';

// Roguelike mode: a run is a chain of sections; each plays MATRICES matrices and must reach its data quota by then.
export const RUN_POOL = [...CODES];
export const DATA_BY_LEN: Record<number, number> = { 2: 10, 3: 25, 4: 45 };
export const SECTIONS = [
  { name: 'Reception', quota: 80, size: SIZES.easy },
  { name: 'Offices', quota: 110, size: SIZES.normal },
  { name: 'Archive', quota: 140, size: SIZES.hard },
];
export const MATRICES = 3;
export const RESTARTS = 1;
// Credits: one per SURPLUS_PER_CREDIT data over the quota, SECTION_CREDIT per cleared section,
// one per SLOTS_PER_CREDIT empty buffer slots in a matrix that uploaded something.
export const SURPLUS_PER_CREDIT = 20;
export const SECTION_CREDIT = 1;
export const SLOTS_PER_CREDIT = 2;

// Run buffers have no spare slots; extra buffer will come from the shop.
export const sectionMatrix = (section: number): Size => ({ ...SECTIONS[section].size, slack: 0, codes: RUN_POOL });

export interface RunState {
  seed: number;
  matrix: number; // matrices dealt so far (restarts included), feeds the per-matrix seed
  section: number;
  data: number;
  played: number; // matrices finished in this section
  restarts: number;
  credits: number;
}

export const newRunState = (seed: number): RunState =>
  ({ seed, matrix: 0, section: 0, data: 0, played: 0, restarts: RESTARTS, credits: 0 });

export const matrixData = (buf: string[], targets: string[][]) =>
  targets.filter((t) => contains(buf, t)).reduce((a, t) => a + DATA_BY_LEN[t.length], 0);

export type MatrixOutcome = 'continue' | 'section' | 'win' | 'lose';

// Banks a finished matrix; after the section's last one, checks the quota and pays the section credits.
export function endMatrix(s: RunState, data: number, emptySlots: number): MatrixOutcome {
  s.data += data;
  if (data) s.credits += Math.floor(emptySlots / SLOTS_PER_CREDIT);
  if (++s.played < MATRICES) return 'continue';
  const { quota } = SECTIONS[s.section];
  if (s.data < quota) return 'lose';
  s.credits += SECTION_CREDIT + Math.floor((s.data - quota) / SURPLUS_PER_CREDIT);
  return s.section === SECTIONS.length - 1 ? 'win' : 'section';
}

export function nextSection(s: RunState): void {
  Object.assign(s, { section: s.section + 1, data: 0, played: 0, restarts: RESTARTS });
}
