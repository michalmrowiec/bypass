import { describe, expect, it } from 'vitest';
import { generate, hashStr, SIZES, type Puzzle } from './generator';
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

  it('reads a Conveyor belt as it will be at each pick', () => {
    // YY then QQ only works if the belt slides QQ under (0,1) by the 4th pick.
    const p: Puzzle = { grid: [['QQ', 'XX'], ['ZZ', 'YY']], targets: [['YY', 'QQ']], l: 4 };
    expect(canComplete(newRun(), p, Infinity)).toBe(false);
    expect(canComplete(newRun(), { ...p, belt: { row: 0, base: ['QQ', 'XX'] } }, Infinity)).toBe(true);
  });

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

  it('walks a non-square board', () => {
    const wide: Puzzle = { grid: [['AA', 'BB', 'CC', 'DD'], ['CC', 'AA', 'BB', 'EE']], targets: [['DD', 'EE']], l: 2 };
    expect(canComplete(newRun(), wide, Infinity)).toBe(true); // DD(0,3) -> EE(1,3)
    expect(canComplete(newRun(), { ...wide, targets: [['EE', 'DD']] }, Infinity)).toBe(false);
  });

  it('answers true when the search budget runs out', () => {
    expect(canComplete(newRun(), { ...tiny, targets: [['AA', 'DD']] }, 0)).toBe(true);
  });
});

// Daily puzzles and shared challenge links rely on a seed always dealing the same square board.
// If this fails, a change altered the deal (e.g. one more rng() call); keep it unless that is intended.
it('square boards deal the same for a seed as before', () => {
  const deals = Object.values(SIZES).flatMap((z) => Array.from({ length: 30 }, (_, i) => JSON.stringify(generate(i + 1, z))));
  expect(hashStr(deals.join('|'))).toBe(2504023170);
});
