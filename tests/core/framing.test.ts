import { describe, expect, it } from 'vitest';
import { makeCamera } from '../../src/core/camera';
import type { Projection } from '../../src/core/framing';
import {
  contour,
  forwardPoint,
  outputFraming,
  roundHalfEven,
  sourcePoint,
  validityMask,
} from '../../src/core/framing';
import { levelingFromVanishingPoint, withStrength } from '../../src/core/leveling';
import { fixtures } from './fixtures';

function projectionOf(c: (typeof fixtures.cases)[number]): Projection {
  const camera = makeCamera(c.width, c.height, c.focal);
  const rotation = withStrength(
    levelingFromVanishingPoint(c.vanishingPoint, camera).rotation,
    c.strength,
  );
  return { camera, rotation, paniniD: c.paniniD, compression: c.compression };
}

describe('roundHalfEven', () => {
  it('rounds like Python', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, 1151.4, 1151.6].map(roundHalfEven)).toEqual([
      0, 2, 2, -0, -2, 1151, 1152,
    ]);
  });
});

describe('contour', () => {
  it('has 200 points per edge, corners included', () => {
    const c = contour(960, 1280);
    expect(c).toHaveLength(800);
    expect(c[0]).toEqual([0, 0]);
    expect(c[199]).toEqual([959, 0]);
    expect(c[200]).toEqual([959, 0]);
    expect(c[399]).toEqual([959, 1279]);
    expect(c[599]).toEqual([0, 1279]);
    expect(c[799]).toEqual([0, 0]);
  });
});

describe('parity with the reference (PLANO.md §7: 0.01 px)', () => {
  for (const c of fixtures.cases) {
    describe(c.name, () => {
      const p = projectionOf(c);
      const framing = outputFraming(p);

      it('frames the output the same way', () => {
        expect(framing.width).toBe(c.framing.width);
        expect(framing.height).toBe(c.framing.height);
        for (const k of ['xMin', 'yMin', 'xMax', 'yMax'] as const) {
          expect(Math.abs(framing[k] - c.framing[k])).toBeLessThan(1e-12);
        }
      });

      it('samples the same source pixel for a grid of output pixels', () => {
        let worst = 0;
        for (const [px, py, u, v] of c.samples) {
          const s = sourcePoint(p, framing, px, py);
          if (u === -1 && v === -1) {
            expect(s).toBeNull();
            continue;
          }
          expect(s).not.toBeNull();
          worst = Math.max(worst, Math.abs(s![0] - u), Math.abs(s![1] - v));
        }
        // The plan asks for 0.01 px; the port is exact to rounding.
        expect(worst).toBeLessThan(1e-6);
      });

      it('marks the same pixels valid', () => {
        const mask = validityMask(p, framing, c.margin);
        expect(mask.data.reduce((a, b) => a + b, 0)).toBe(c.validCount);
      });
    });
  }
});

describe('forward and inverse agree', () => {
  it('maps a source pixel to the output and back', () => {
    const p = projectionOf(fixtures.cases[0]);
    const framing = outputFraming(p);
    for (const [x, y] of [
      [10, 20],
      [479.5, 639.5],
      [900, 1200],
    ] as const) {
      const [ox, oy] = forwardPoint(p, x, y);
      const px = (ox - framing.xMin) * p.camera.focal - 0.5;
      const py = (oy - framing.yMin) * p.camera.focal - 0.5;
      const back = sourcePoint(p, framing, px, py)!;
      expect(back[0]).toBeCloseTo(x, 8);
      expect(back[1]).toBeCloseTo(y, 8);
    }
  });
});
