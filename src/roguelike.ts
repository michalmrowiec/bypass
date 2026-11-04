import { CODES, SIZES, type Size } from './generator';

// Roguelike mode. Stage 0: one matrix from the player's code pool; runs, sections and scoring come later.
export const RUN_POOL = [...CODES];
export const RUN_MATRIX: Size = { ...SIZES.normal, codes: RUN_POOL };
