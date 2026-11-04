import { describe, expect, it } from 'vitest';
import { DATA_BY_LEN, endMatrix, matrixData, newRunState, nextSection, sectionMatrix, SECTIONS } from './roguelike';

describe('roguelike run', () => {
  it('scores uploaded targets by length', () => {
    expect(matrixData(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']])).toBe(35);
  });

  it('sections grow 5x5 -> 7x7 with no spare buffer and max data 45/60/95', () => {
    expect(SECTIONS.map((_, i) => sectionMatrix(i).n)).toEqual([5, 6, 7]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).slack)).toEqual([0, 0, 0]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).lens.reduce((a, l) => a + DATA_BY_LEN[l], 0))).toEqual([45, 60, 95]);
  });

  it('always plays 3 matrices, even past the quota', () => {
    const s = newRunState(1);
    expect(endMatrix(s, 200, 0)).toBe('continue');
    expect(endMatrix(s, 0, 0)).toBe('continue');
    expect(endMatrix(s, 0, 0)).toBe('section');
  });

  it('pays empty slots only when something was uploaded', () => {
    const s = newRunState(1);
    endMatrix(s, 0, 6);
    expect(s.credits).toBe(0);
    endMatrix(s, 10, 5);
    expect(s.credits).toBe(2);
  });

  it('pays the section credit plus surplus over the quota', () => {
    const s = newRunState(1);
    endMatrix(s, 45, 0);
    endMatrix(s, 45, 0);
    endMatrix(s, 35, 0); // 125 vs quota 80: surplus 45
    expect(s.credits).toBe(1 + 2);
    nextSection(s);
    expect([s.section, s.data, s.played]).toEqual([1, 0, 0]);
  });

  it('ends the run below the quota after the last matrix', () => {
    const s = newRunState(1);
    endMatrix(s, 30, 0);
    endMatrix(s, 30, 0);
    expect(endMatrix(s, 10, 0)).toBe('lose');
  });

  it('wins after the last section', () => {
    const s = newRunState(1);
    s.section = SECTIONS.length - 1;
    s.played = 2;
    expect(endMatrix(s, 1000, 0)).toBe('win');
  });
});
