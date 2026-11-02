import { describe, expect, it } from 'vitest';
import { generate, SIZES, type Puzzle } from './generator';
import { SPRINTS, newRun, pick } from './game';
import { canComplete } from './solver';

describe('canComplete', () => {
  it('finds a solution for every generated matrix', () => {
    for (const size of [...Object.values(SIZES), ...SPRINTS[5]]) {
      for (let seed = 1; seed <= 60; seed++) {
        expect(canComplete(newRun(), generate(seed, size), Infinity)).toBe(true);
      }
    }
  });

  const tiny: Puzzle = {
    grid: [
      ['AA', 'BB', 'CC'],
      ['CC', 'AA', 'BB'],
      ['BB', 'CC', 'AA'],
    ],
    targets: [['AA', 'CC']],
    l: 3,
  };

  it('sees a target that is still reachable', () => {
    expect(canComplete(newRun(), tiny, Infinity)).toBe(true); // AA(0,0) -> CC(1,0)
  });

  it('detects a dead end', () => {
    const run = newRun();
    pick(run, tiny, 0, 1); // BB, then column 1 offers AA or CC
    pick(run, tiny, 2, 1); // CC, buffer BB CC: AA CC no longer fits in one slot
    expect(canComplete(run, tiny, Infinity)).toBe(false);
  });

  it('fails on a code the grid does not have', () => {
    expect(canComplete(newRun(), { ...tiny, targets: [['AA', 'DD']] }, Infinity)).toBe(false);
  });

  it('answers true when the search budget runs out', () => {
    expect(canComplete(newRun(), { ...tiny, targets: [['AA', 'DD']] }, 0)).toBe(true);
  });
});
