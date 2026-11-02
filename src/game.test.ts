import { describe, expect, it } from 'vitest';
import { generate, SIZES } from './generator';
import { SPRINTS, challengeQuery, parseChallenge } from './game';

describe('generate sizes', () => {
  const stages = SPRINTS[5].map((s, i) => ['sprint ' + (i + 1), s] as const);
  for (const [key, size] of [...Object.entries(SIZES), ...stages]) {
    it(key + ' has the right shape', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const p = generate(seed, size);
        expect(p.grid).toHaveLength(size.n);
        p.grid.forEach((row) => expect(row).toHaveLength(size.n));
        expect(p.targets.map((t) => t.length)).toEqual(size.lens);
        expect(p.l).toBe(size.l);
      }
    });
  }

  it('is deterministic per seed', () => {
    expect(generate(42, SIZES.hard)).toEqual(generate(42, SIZES.hard));
  });
});

describe('challenge links', () => {
  it('round-trips', () => {
    expect(parseChallenge(challengeQuery('hard', 123, 42000))).toEqual({ kind: 'hard', seed: 123, time: 42000 });
    expect(parseChallenge(challengeQuery('easy', 7, null))).toEqual({ kind: 'easy', seed: 7, time: null });
    expect(parseChallenge(challengeQuery('sprint5', 9, 61000))).toEqual({ kind: 'sprint5', seed: 9, time: 61000 });
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
