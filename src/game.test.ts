import { describe, expect, it } from 'vitest';
import { generate, SIZES } from './generator';
import { SPRINTS, challengeCode, parseChallenge, parseCode } from './game';

describe('generate sizes', () => {
  const stages = SPRINTS[5].map((s, i) => ['sprint ' + (i + 1), s] as const);
  for (const [key, size] of [...Object.entries(SIZES), ...stages]) {
    it(key + ' has the right shape', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const p = generate(seed, size);
        expect(p.grid).toHaveLength(size.n);
        p.grid.forEach((row) => expect(row).toHaveLength(size.n));
        expect(p.targets.map((t) => t.length)).toEqual(size.lens);
        const sum = size.lens.reduce((a, b) => a + b, 0);
        expect(size.links.map((k) => sum - k + size.slack)).toContain(p.l);
        // Every required link exists: some target ends with the code another one starts with.
        const links = sum + size.slack - p.l;
        const pairs = p.targets.flatMap((a, i) => p.targets.filter((b, j) => i !== j && a[a.length - 1] === b[0]));
        if (links > 0) expect(pairs.length).toBeGreaterThan(0);
      }
    });
  }

  it('is deterministic per seed', () => {
    expect(generate(42, SIZES.hard)).toEqual(generate(42, SIZES.hard));
  });
});

describe('challenge links', () => {
  it('round-trips', () => {
    expect(parseCode(challengeCode('hard', 123, 42000))).toEqual({ kind: 'hard', seed: 123, time: 42000 });
    expect(parseCode(challengeCode('easy', 7, null))).toEqual({ kind: 'easy', seed: 7, time: null });
    expect(parseCode(' Sprint5.9.61000 ')).toEqual({ kind: 'sprint5', seed: 9, time: 61000 });
  });

  it('still reads old links, pasted or opened', () => {
    expect(parseCode('https://x.io/bypass/?c=hard.123&t=42000')).toEqual({ kind: 'hard', seed: 123, time: 42000 });
    expect(parseChallenge('?c=easy.7')).toEqual({ kind: 'easy', seed: 7, time: null });
    expect(parseCode('hard.123.x')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseChallenge('')).toBeNull();
    expect(parseChallenge('?c=huge.1')).toBeNull();
    expect(parseChallenge('?c=sprint4.1')).toBeNull();
    expect(parseChallenge('?c=easy.abc')).toBeNull();
    expect(parseChallenge('?c=easy.1&t=-5')?.time).toBeNull();
    expect(parseChallenge('?c=easy.1&t=<script>')?.time).toBeNull();
  });
});

describe('generate code pool', () => {
  it('draws cells and targets only from the pool', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generate(seed, { ...SIZES.normal, codes: ['AA', 'BB'] });
      expect(new Set([...p.grid.flat(), ...p.targets.flat()])).toEqual(new Set(['AA', 'BB']));
    }
  });
  it('rejects a pool with fewer than 2 codes', () => {
    expect(() => generate(1, { ...SIZES.normal, codes: ['AA', 'AA'] })).toThrow();
  });
});
