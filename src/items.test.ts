import { describe, expect, it } from 'vitest';
import { newRunState, rackFull, unitsOf, usedSlots, type ItemId } from './roguelike';

describe('rack units', () => {
  it('2U modules take two slots', () => {
    const s = { ...newRunState(1), rack: 4, items: ['thumb', 'ups'] as ItemId[] };
    expect([unitsOf('ups'), unitsOf('thumb'), unitsOf('bridge'), unitsOf('bridge2')]).toEqual([2, 1, 1, 2]);
    expect(usedSlots(s)).toBe(3);
    expect(rackFull(s, 'nullpad')).toBe(false);
    expect(rackFull(s, 'overclock')).toBe(true);
  });
  it('an upgrade that grows needs the extra slot', () => {
    const s = { ...newRunState(1), rack: 4, items: ['thumb', 'buffer1', 'shortkey', 'bridge'] as ItemId[] };
    expect(rackFull(s, 'bridge2')).toBe(true);
    expect(rackFull({ ...s, rack: 5 }, 'bridge2')).toBe(false);
    expect(rackFull(s, 'thumb2')).toBe(false);
  });
});
