import { describe, expect, it } from 'vitest';
import { COMPANIES, dealRunMatrix, newRunState, type RunState } from './roguelike';
import { dealBoard } from './matrix';

const BOSS = COMPANIES[0].sections.length - 1;
const st = (over: Partial<RunState> = {}): RunState => ({ ...newRunState(3), section: BOSS, ...over });

describe('dealBoard', () => {
  it('is deterministic for a seed and run state', () => {
    const s = st({ items: ['repeater', 'wildcard1', 'datanode'], ice: 'honeypot' });
    expect(dealBoard(11, s)).toEqual(dealBoard(11, s));
  });

  it('matches the old dealRunMatrix grid when no item reshapes it', () => {
    expect(dealBoard(7, st()).puzzle).toEqual(dealRunMatrix(7, st()));
  });

  it('arms one-shot tools from the rack', () => {
    const b = dealBoard(5, st({ items: ['bridge', 'mux', 'rewind'] }));
    expect([b.m.jump, b.m.mux, b.m.rewind, b.m.loop]).toEqual([true, true, true, false]);
  });

  it('places the honeypot only under Honeypot ICE', () => {
    expect(dealBoard(5, st({ ice: 'honeypot' })).m.trap).toBeDefined();
    expect(dealBoard(5, st()).m.trap).toBeUndefined();
  });
});
