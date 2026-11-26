import { describe, expect, it } from 'vitest';
import { makeCamera } from '../../src/core/camera';
import type { Projection } from '../../src/core/framing';
import {
  contour,
  forwardPoint,
  outputColumn,
  outputFraming,
  outputRow,
  roundHalfEven,
  sourcePoint,
  validityMask,
} from '../../src/core/framing';
import { mulVec } from '../../src/core/linalg';
import { MIN_DEPTH } from '../../src/core/camera';
import {
  levelingFromVanishingPoint,
  vanishingPointFromAngles,
  withStrength,
} from '../../src/core/leveling';
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

describe('the column and row halves (what the shader tabulates)', () => {
  /**
   * sourcePoint rebuilt from its halves, as reproject.frag combines them: the
   * ray (sinLon, y · inverseScale, cosLon), turned, with the depth tested on
   * the unit ray.
   */
  function fromHalves(
    p: Projection,
    framing: ReturnType<typeof outputFraming>,
    px: number,
    py: number,
  ) {
    const column = outputColumn(p, framing, px + 0.5);
    const y = outputRow(p, framing, py + 0.5);
    const ray = [column.sinLon, y * column.inverseScale, column.cosLon] as const;
    const r = mulVec(p.rotation, ray);
    if (!(r[2] > MIN_DEPTH * Math.hypot(...ray))) return null;
    const { focal, cx, cy } = p.camera;
    return [(focal * r[0]) / r[2] + cx, (focal * r[1]) / r[2] + cy] as const;
  }

  for (const c of fixtures.cases) {
    it(`give sourcePoint and the reference's samples: ${c.name}`, () => {
      const p = projectionOf(c);
      const framing = outputFraming(p);
      let againstPort = 0;
      let againstReference = 0;
      for (const [px, py, u, v] of c.samples) {
        const halves = fromHalves(p, framing, px, py);
        const port = sourcePoint(p, framing, px, py);
        expect(halves === null).toBe(port === null);
        expect(halves === null).toBe(u === -1 && v === -1);
        if (!halves || !port) continue;
        againstPort = Math.max(
          againstPort,
          Math.abs(halves[0] - port[0]),
          Math.abs(halves[1] - port[1]),
        );
        againstReference = Math.max(
          againstReference,
          Math.abs(halves[0] - u),
          Math.abs(halves[1] - v),
        );
      }
      // The same ray up to its length: only the last bits differ.
      expect(againstPort).toBeLessThan(1e-9);
      expect(againstReference).toBeLessThan(1e-6);
    });
  }

  it('decide the depth on the unit ray, as sourcePoint does', () => {
    // A camera pitched 40° down, with the classic Panini: the framing reaches
    // past the source's horizon, so 2308 of its output pixels look behind
    // the camera, and the halves must place every one of them as sourcePoint
    // does. (The unscaled ray's depth would differ from the unit ray's only
    // within 1e-6 rad of the horizon, where no pixel of this scene falls: the
    // unit ray is the reference's rule, not something this test tells apart.)
    const camera = makeCamera(1000, 750, 375);
    const level = levelingFromVanishingPoint(vanishingPointFromAngles(camera, 40, 10), camera);
    const p: Projection = { camera, rotation: level.rotation, paniniD: 1, compression: 1 };
    const framing = outputFraming(p);
    let behind = 0;
    let disagree = 0;
    for (let py = 0; py < framing.height; py++) {
      for (let px = 0; px < framing.width; px++) {
        const port = sourcePoint(p, framing, px, py);
        if (!port) behind++;
        if ((fromHalves(p, framing, px, py) === null) !== (port === null)) disagree++;
      }
    }
    expect(behind).toBeGreaterThan(1000);
    expect(disagree).toBe(0);
  });
});
