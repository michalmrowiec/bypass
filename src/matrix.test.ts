import { describe, expect, it } from 'vitest';
import { COMPANIES, dealRunMatrix, newRunState, type RunState } from './roguelike';
import { BLOCK } from './generator';
import { newRun, pick } from './game';
import { canPick, cellView, dealBoard, EMPTY_CTX, emptyItems, type Board, type Ctx } from './matrix';

// 5x5 board with codes 'A'..'Y' in reading order.
const grid = () => Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => String.fromCharCode(65 + r * 5 + c)));
const board = (ctx: Partial<Ctx> = {}, over: Partial<Board> = {}): Board =>
  ({ puzzle: { grid: grid(), targets: [['A', 'B']], l: 4 }, run: newRun(), m: emptyItems(), armed: null, ctx: { ...EMPTY_CTX, ...ctx }, over: false, ...over });
const at = (b: Board, r: number, c: number) => { pick(b.run, b.puzzle, r, c); return b; };

describe('cell rules', () => {
  it('encryption hides codes off the lane', () => {
    const b = board({ ice: ['encryption'] });
    expect(cellView(b, 0, 3).hidden).toBe(false);
    expect(cellView(b, 2, 2)).toMatchObject({ hidden: true, code: 'M' });
    expect(cellView(b, 2, 2).cls).toContain('enc');
  });

  it('an armed bridge sees the 8 cells around the last pick', () => {
    const b = at(board({ ice: ['encryption'] }), 0, 2);
    b.armed = 'jump';
    expect(cellView(b, 1, 1).hidden).toBe(false);
    expect(cellView(b, 3, 3).hidden).toBe(true);
  });

  it('side door opens every edge before the first pick', () => {
    const b = board({ items: ['sidedoor'] });
    expect([canPick(b, 4, 0), canPick(b, 2, 4), canPick(b, 2, 2)]).toEqual([true, true, false]);
  });

  it('mux opens the row and column of the last pick', () => {
    const b = at(board(), 0, 2);
    expect(canPick(b, 0, 4)).toBe(false);
    b.armed = 'mux';
    expect([canPick(b, 0, 4), canPick(b, 3, 3)]).toEqual([true, false]);
  });

  it('a wildcard cannot go on the repeater cell', () => {
    const b = board({}, { armed: 'wild' });
    b.m.rep = [1, 1];
    expect([canPick(b, 1, 1), canPick(b, 2, 3)]).toEqual([false, true]);
  });

  it('a burning cell shows the moves left and is closed', () => {
    const b = board();
    b.run.burn = 2;
    at(b, 0, 2);
    expect(cellView(b, 1, 2)).toMatchObject({ burnLeft: 2 });
    expect(canPick(b, 1, 2)).toBe(false);
  });

  it('a board outside a run shows plain cells', () => {
    const b = board();
    b.puzzle.grid[1][1] = BLOCK;
    expect(cellView(b, 1, 1).cls).toEqual(['ice']);
    expect(cellView(b, 0, 0)).toEqual({ code: 'A', hidden: false, cls: ['lane'], tags: [] });
  });
});

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
