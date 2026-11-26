/**
 * What the shader receives (src/gl/uniforms.ts): the numbers of src/core, in
 * the layout reproject.frag reads. The shader itself runs in the browser
 * tests (e2e/gl.spec.ts); these hold its inputs, in Node.
 */
import { describe, expect, it } from 'vitest';
import { focal35mm } from '../../src/core/camera';
import type { Correction } from '../../src/core/correction';
import { DEFAULT_PARAMS, buildProjection } from '../../src/core/correction';
import { outputColumn, outputRow } from '../../src/core/framing';
import type { Mat3 } from '../../src/core/linalg';
import type { View } from '../../src/gl/uniforms';
import { columnMajor, fitView, pixelView, reprojectionUniforms } from '../../src/gl/uniforms';
import { fixtures } from '../core/fixtures';

function correctionOf(c: (typeof fixtures.cases)[number]): Correction {
  return buildProjection(
    {
      ...DEFAULT_PARAMS,
      focal35mm: focal35mm(c.focal, c.width, c.height),
      vanishingPoint: c.vanishingPoint,
      strength: c.strength,
      paniniD: c.paniniD,
      verticalCompression: c.compression,
    },
    c.width,
    c.height,
  );
}

/** Where a view puts the centre of target pixel i (or row j). */
function centre(origin: number, scale: number, i: number): number {
  return origin + (i + 0.5) * scale;
}

describe('columnMajor', () => {
  it('lays the rows of a matrix out as GLSL columns', () => {
    const m: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(columnMajor(m)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
  });
});

describe('fitView', () => {
  it('fits a tall region whole, centred, at its own proportion', () => {
    const region = { x: 0, y: 0, width: 1151, height: 1226 };
    const v = fitView(region, 400, 300);
    expect(v.scale).toBeCloseTo(1226 / 300, 12);
    // The region's edges, in target pixels: the full height, centred across.
    const left = (region.x - v.originX) / v.scale;
    const right = (region.x + region.width - v.originX) / v.scale;
    expect((region.y - v.originY) / v.scale).toBeCloseTo(0, 9);
    expect((region.y + region.height - v.originY) / v.scale).toBeCloseTo(300, 9);
    expect(left).toBeCloseTo(400 - right, 9);
    expect((right - left) / 300).toBeCloseTo(1151 / 1226, 9);
  });

  it('fits a wide region by its width', () => {
    const region = { x: 10, y: 20, width: 2000, height: 500 };
    const v = fitView(region, 400, 300);
    expect(v.scale).toBe(5);
    expect((region.x - v.originX) / v.scale).toBeCloseTo(0, 9);
    expect((region.y - v.originY) / v.scale).toBeCloseTo((300 - 100) / 2, 9);
  });
});

describe('pixelView', () => {
  it('puts output pixel x + i on target pixel i', () => {
    const v = pixelView({ x: 3, y: 4, width: 50, height: 60 });
    expect(v).toMatchObject({
      originX: 3,
      originY: 4,
      scale: 1,
      targetWidth: 50,
      targetHeight: 60,
    });
    expect(centre(v.originX, v.scale, 7)).toBe(3 + 7 + 0.5);
  });
});

describe('reprojectionUniforms', () => {
  const c = fixtures.cases[0];
  const correction = correctionOf(c);
  const { framing, projection } = correction;

  for (const [name, view] of [
    ['a pixel view', pixelView({ x: 0, y: 0, width: framing.width, height: framing.height })],
    [
      'a fitted view',
      fitView({ x: 0, y: 0, width: framing.width, height: framing.height }, 390, 600),
    ],
  ] as Array<[string, View]>) {
    it(`tabulates src/core's halves at each target pixel's centre: ${name}`, () => {
      const u = reprojectionUniforms(correction, view);
      expect(u.columns).toHaveLength(view.targetWidth * 4);
      expect(u.rows).toHaveLength(view.targetHeight);
      for (let i = 0; i < view.targetWidth; i++) {
        const column = outputColumn(projection, framing, centre(view.originX, view.scale, i));
        expect([...u.columns.subarray(i * 4, i * 4 + 4)]).toEqual([
          Math.fround(column.sinLon),
          Math.fround(column.cosLon),
          Math.fround(column.inverseScale),
          0,
        ]);
      }
      for (let j = 0; j < view.targetHeight; j++) {
        expect(u.rows[j]).toBe(
          Math.fround(outputRow(projection, framing, centre(view.originY, view.scale, j))),
        );
      }
    });
  }

  it('passes the camera, the rotation and the view as src/core has them', () => {
    const view = fitView({ x: 0, y: 0, width: framing.width, height: framing.height }, 390, 600);
    const u = reprojectionUniforms(correction, view, { mode: 'coordinates', margin: 1 });
    const { camera, rotation } = projection;
    expect(u.sourceSize).toEqual([camera.width, camera.height]);
    expect(u.focal).toBe(camera.focal);
    expect(u.center).toEqual([camera.cx, camera.cy]);
    expect(u.rotation).toEqual(columnMajor(rotation));
    expect(u.viewOrigin).toEqual([view.originX, view.originY]);
    expect(u.viewScale).toBe(view.scale);
    expect([u.targetWidth, u.targetHeight]).toEqual([390, 600]);
    expect(u.region).toEqual([0, 0, framing.width, framing.height]);
    expect(u.margin).toBe(1);
    expect(u.mode).toBe(1);
    expect(reprojectionUniforms(correction, view).mode).toBe(0);
    expect(reprojectionUniforms(correction, view, { mode: 'original' }).mode).toBe(2);
  });

  it("keeps the reference's samples within 0.001 px once rounded to single precision", () => {
    // The shader's arithmetic, done in double precision on the single
    // precision tables: what the tables alone cost. The GPU adds its own
    // rounding on top (e2e/gl.spec.ts measures 0.00024 px at worst).
    let worst = 0;
    for (const k of fixtures.cases) {
      const corr = correctionOf(k);
      const { width, height } = corr.framing;
      const u = reprojectionUniforms(corr, pixelView({ x: 0, y: 0, width, height }));
      const r = u.rotation; // column-major: r[col * 3 + row]
      for (const [px, py, su, sv] of k.samples) {
        if (su === -1 && sv === -1) continue;
        const ray = [u.columns[px * 4], u.rows[py] * u.columns[px * 4 + 2], u.columns[px * 4 + 1]];
        const turned = [0, 1, 2].map(
          (row) => r[row] * ray[0] + r[3 + row] * ray[1] + r[6 + row] * ray[2],
        );
        const gu = (u.focal * turned[0]) / turned[2] + u.center[0];
        const gv = (u.focal * turned[1]) / turned[2] + u.center[1];
        worst = Math.max(worst, Math.abs(gu - su), Math.abs(gv - sv));
      }
    }
    expect(worst).toBeLessThan(1e-3);
  });
});
