import { describe, expect, it } from 'vitest';
import { daemonsAfterMatrix, newRunState, nextSection, rackFull, scoreMatrix, unitsOf, usedSlots, type DaemonId, type ItemId } from './roguelike';

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

describe('passive bill items', () => {
  // AB (10) and BCD (25) uploaded and sharing B, XY missed; 4 empty slots; moves 4, 2, 4.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };
  const with_ = (...items: ItemId[]) => ({ ...newRunState(1), items });
  it('Null pad pays per empty slot, only with an upload', () => {
    expect(scoreMatrix(ctx, with_('nullpad')).gear).toEqual([['nullpad', { flat: 32 }]]);
    expect(scoreMatrix({ ...ctx, buf: ['X'] }, with_('nullpad')).gear).toEqual([]);
  });
  it('Zip tie adds half the data of targets sharing a code', () => {
    expect(scoreMatrix(ctx, with_('ziptie')).gear).toEqual([['ziptie', { flat: 17 }]]);
    expect(scoreMatrix({ ...ctx, buf: ['A', 'B', 'X', 'Y'] }, with_('ziptie')).gear).toEqual([]);
  });
  it('Slingshot pays for the longest move', () => {
    expect(scoreMatrix(ctx, with_('slingshot')).gear).toEqual([['slingshot', { flat: 40 }]]);
  });
  it('Overclock multiplies the matrix by 1.5', () => {
    const sc = scoreMatrix(ctx, with_('overclock'));
    expect([sc.total, sc.gear]).toEqual([60, [['overclock', { mult: 1.5 }]]]);
    expect(scoreMatrix({ ...ctx, buf: ['Q'] }, with_('overclock')).total).toBe(0);
  });
});

describe('UPS', () => {
  // 2 of 3 targets: Heartbeat would halve; starting in column 0 again resets Rotate.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };
  const run = () => ({ ...newRunState(1), items: ['ups'] as ItemId[], daemons: ['heartbeat', 'rotate'] as DaemonId[], stacks: { heartbeat: 4, rotate: 3 }, lastStart: 0 });
  it('keeps every breaking streak once per room', () => {
    const s = run();
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate, s.upsUsed]).toEqual([4, 3, true]);
    expect(s.events!.at(-1)).toBe('UPS · kept the streaks');
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate]).toEqual([2, 0]);
    nextSection(s);
    expect(s.upsUsed).toBeUndefined();
  });
  it('does nothing without UPS or when nothing breaks', () => {
    const s = { ...run(), items: [] as ItemId[] };
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate]).toEqual([2, 0]);
    const g = { ...run(), lastStart: 3, daemons: ['rotate'] as DaemonId[] };
    daemonsAfterMatrix(ctx, g, false);
    expect([g.stacks.rotate, g.upsUsed]).toEqual([4, undefined]);
  });
});
