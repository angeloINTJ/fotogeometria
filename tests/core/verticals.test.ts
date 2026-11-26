/**
 * PLANO.md §7, "Imagem": a synthetic grid with a known pitch, corrected, has
 * vertical lines that stay vertical (within 0.2°).
 *
 * This is the CPU half: the lines of a scene are projected by a tilted camera
 * into a photo, and the correction maps them onto the output plane. The GPU
 * half renders the same scene through the shader (stage 2).
 */
import { describe, expect, it } from 'vitest';
import { makeCamera, rayToPixel } from '../../src/core/camera';
import type { CorrectionParams } from '../../src/core/correction';
import { DEFAULT_PARAMS, buildProjection } from '../../src/core/correction';
import { focal35mm } from '../../src/core/camera';
import { forwardPoint } from '../../src/core/framing';
import type { Vec3 } from '../../src/core/linalg';
import { mul, mulVec, rotationX, rotationZ } from '../../src/core/linalg';
import { vanishingPointOf } from './synthetic';

const DEG = Math.PI / 180;
const W = 960;
const H = 1280;
const F = 480;

/**
 * The worst angle from the vertical, in degrees, of the corrected images of
 * vertical lines seen by a camera with this pitch and roll.
 */
function worstTilt(pitch: number, roll: number, params: Partial<CorrectionParams>): number {
  const cam = makeCamera(W, H, F);
  const camera = mul(rotationZ(roll * DEG), rotationX(pitch * DEG));
  const correction = buildProjection(
    {
      ...DEFAULT_PARAMS,
      focal35mm: focal35mm(F, W, H),
      vanishingPoint: vanishingPointOf(pitch, roll, cam),
      ...params,
    },
    W,
    H,
  );
  let worst = 0;
  // Vertical lines of a facade: x from -3 to 3, 4 units away, y from -2 to 2.
  for (let x = -3; x <= 3; x += 0.5) {
    const points: Array<readonly [number, number]> = [];
    for (let y = -2; y <= 2; y += 0.25) {
      const world: Vec3 = [x, y, 4];
      const pixel = rayToPixel(cam, mulVec(camera, world));
      if (!pixel || pixel[0] < 0 || pixel[0] > W - 1 || pixel[1] < 0 || pixel[1] > H - 1) continue;
      points.push(forwardPoint(correction.projection, pixel[0], pixel[1]));
    }
    if (points.length < 2) continue;
    const [a, b] = [points[0], points[points.length - 1]];
    worst = Math.max(worst, Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1])) / DEG);
  }
  return worst;
}

describe('verticals stay vertical', () => {
  it.each([
    [17.5, 0.8],
    [-25, 0],
    [-10, -4],
    [30, 6],
  ])('pitch %s, roll %s, full strength, Panini 0.7, compression 0.5', (pitch, roll) => {
    expect(worstTilt(pitch, roll, { strength: 1 })).toBeLessThan(0.2);
  });

  it('with the plain rectilinear projection too', () => {
    expect(worstTilt(-25, 3, { strength: 1, paniniD: 0, verticalCompression: 0 })).toBeLessThan(
      0.2,
    );
  });

  it('and not without the levelling: the check bites', () => {
    expect(worstTilt(17.5, 0.8, { strength: 0 })).toBeGreaterThan(5);
  });
});
