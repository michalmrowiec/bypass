// Guards for content: every ICE, item and company pool deals matrices that can be solved.
// Loops run over the content tables, so new entries are covered without editing this file.
import { describe, expect, it } from 'vitest';
import { canComplete } from './solver';
import { applyPick, canPick, dealBoard, isStuck, loopAny, type Board } from './matrix';
import { contains } from './game';
import { COMPANIES, ICE, ITEMS, newRunState, type IceId, type ItemId, type RunState } from './roguelike';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const boss = (company: number) => COMPANIES[company].sections.length - 1;

// Seeds whose deal cannot upload every target; under Throttle (by design) not even one.
// A small solver budget keeps this fast; past it the solver says yes, so this can miss a bad deal but never flags a good one.
function unsolvable(s: RunState): number[] {
  return SEEDS.filter((seed) => {
    const b = dealBoard(seed, s);
    if (b.puzzle.belt) return !beltPlanWorks(b);
    return b.ctx.ice.includes('throttle') ? isStuck(b, true) : !canComplete(b.run, b.puzzle, 20_000, { ...b.m, loopAny: loopAny(b) });
  });
}

// The solver cannot see a moving belt, so a Conveyor deal replays its planted path: every pick legal,
// then all targets uploaded (one under Throttle).
function beltPlanWorks(b: Board): boolean {
  const path = b.puzzle.path ?? [];
  for (const [r, c] of path) { if (!canPick(b, r, c)) return false; applyPick(b, r, c); }
  const up = b.puzzle.targets.filter((t) => contains(b.run.buffer, t)).length;
  return b.ctx.ice.includes('throttle') ? up > 0 : up === b.puzzle.targets.length;
}

describe('content solvability', () => {
  for (const id of Object.keys(ICE) as IceId[]) {
    it('ICE ' + id + ' deals solvable matrices', () => {
      const company = COMPANIES.findIndex((c) => c.ice.includes(id) || c.patches.includes(id));
      expect(unsolvable({ ...newRunState(3, Math.max(company, 0)), section: boss(Math.max(company, 0)), ice: id })).toEqual([]);
    });
  }

  for (const id of Object.keys(ITEMS) as ItemId[]) {
    it('item ' + id + ' deals solvable matrices', () => {
      const needs = (ITEMS[id] as { needs?: ItemId }).needs;
      const items = needs ? [needs, id] : [id];
      for (const section of [0, boss(0)]) expect(unsolvable({ ...newRunState(3), section, items })).toEqual([]);
    });
  }

  COMPANIES.forEach((co, i) => {
    it(co.name + ': its whole ICE pool at once is solvable', () => {
      const room = boss(i);
      const pool = (ids: IceId[]) => { const [ice, ...rest] = ids; return { ...newRunState(3, i), section: room, ice, patches: rest.map((p) => ({ ice: p, room, loop: 0 })) }; };
      const all = [...new Set([...co.ice, ...co.patches])];
      expect(unsolvable(pool(all))).toEqual([]);
      // Throttle only promises one target, so the rest of the pool is also checked without it, for every target.
      expect(unsolvable(pool(all.filter((id) => id !== 'throttle')))).toEqual([]);
    });
  });

  it('every ICE and item has a name and rule text', () => {
    for (const e of [...Object.values(ICE), ...Object.values(ITEMS)]) expect(e.name && e.text).toBeTruthy();
  });
});
