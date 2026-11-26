import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/core/linalg';
import { normalize } from '../../src/core/linalg';
import { compress, expand, paniniForward, paniniInverse } from '../../src/core/panini';
import { fixtures, maxDiff } from './fixtures';

/** Rays from -80° to 80° of longitude and -60° to 60° of latitude. */
function rays(): Vec3[] {
  const out: Vec3[] = [];
  for (let lon = -80; lon <= 80; lon += 10) {
    for (let lat = -60; lat <= 60; lat += 10) {
      const a = (lon * Math.PI) / 180;
      const b = (lat * Math.PI) / 180;
      out.push([Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)]);
    }
  }
  return out;
}

describe('Panini', () => {
  it.each([0, 0.5, 1])('inverse(forward(r)) = r for d = %s (PLANO.md §7)', (d) => {
    for (const r of rays()) {
      const [x, y] = paniniForward(r, d);
      expect(maxDiff(paniniInverse(x, y, d), r)).toBeLessThan(1e-12);
    }
  });

  it('ignores the length of the ray', () => {
    const r: Vec3 = [0.3, -0.2, 0.9];
    expect(maxDiff(paniniForward(r, 0.7), paniniForward([0.6, -0.4, 1.8], 0.7))).toBeLessThan(
      1e-15,
    );
  });

  it('is rectilinear at d = 0', () => {
    for (const r of rays()) {
      const [x, y] = paniniForward(r, 0);
      expect(x).toBeCloseTo(r[0] / r[2], 12);
      expect(y).toBeCloseTo(r[1] / r[2], 12);
    }
  });

  it('keeps vertical lines vertical: the same longitude gives the same x', () => {
    for (const d of [0.5, 1]) {
      const xs = [-50, -10, 0, 30, 55].map((lat) => {
        const b = (lat * Math.PI) / 180;
        const a = (40 * Math.PI) / 180;
        return paniniForward(
          [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)],
          d,
        )[0];
      });
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-12);
    }
  });

  it.each(fixtures.panini.map((p) => [p.d, p] as const))(
    'matches the reference for d = %s',
    (d, pairs) => {
      pairs.rays.forEach((ray, i) => {
        expect(maxDiff(paniniForward(ray, d), pairs.plane[i])).toBeLessThan(1e-12);
        const [x, y] = pairs.plane[i];
        expect(maxDiff(paniniInverse(x, y, d), pairs.back[i])).toBeLessThan(1e-12);
        expect(maxDiff(normalize(ray), pairs.back[i])).toBeLessThan(1e-12);
      });
    },
  );
});

describe('vertical compression', () => {
  it.each([0.25, 0.5, 1])('expand(compress(y)) = y for c = %s (PLANO.md §7)', (c) => {
    for (let y = -2; y <= 2; y += 0.125) {
      expect(expand(compress(y, c), c)).toBeCloseTo(y, 12);
    }
  });

  it('changes nothing at c = 0', () => {
    expect(compress(1.7, 0)).toBe(1.7);
    expect(expand(1.7, 0)).toBe(1.7);
  });

  it('clips the tangent short of infinity, as the reference does', () => {
    expect(Number.isFinite(expand(100, 1))).toBe(true);
    expect(expand(100, 1)).toBeCloseTo(Math.tan(Math.PI / 2 - 1e-3), 6);
  });
});
