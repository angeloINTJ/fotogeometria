/**
 * The fixed correction of stage 2 (src/ui/reference-correction.ts) is the
 * reference case of PLANO.md §3.8.
 */
import { describe, expect, it } from 'vitest';
import { buildProjection } from '../../src/core/correction';
import {
  REFERENCE_PITCH_DEG,
  REFERENCE_ROLL_DEG,
  referenceParams,
} from '../../src/ui/reference-correction';
import { fixtures, maxDiff } from '../core/fixtures';

describe('referenceParams', () => {
  it("gives a 960 x 1280 photo the reference's rotation and framing", () => {
    const c = fixtures.cases[0];
    expect([c.width, c.height]).toEqual([960, 1280]);
    const { projection, framing, leveling } = buildProjection(
      referenceParams(960, 1280),
      960,
      1280,
    );
    expect(projection.camera.focal).toBeCloseTo(c.focal, 9);
    expect(maxDiff(projection.rotation, c.rotation)).toBeLessThan(1e-12);
    expect([framing.width, framing.height]).toEqual([c.framing.width, c.framing.height]);
    expect(framing.xMin).toBeCloseTo(c.framing.xMin, 12);
    expect(framing.yMin).toBeCloseTo(c.framing.yMin, 12);
    expect(leveling?.pitchDeg).toBeCloseTo(REFERENCE_PITCH_DEG, 10);
  });

  it("levels any photo by the reference's pitch and roll", () => {
    for (const [width, height] of [
      [4000, 3000],
      [3024, 4032],
      [1000, 1000],
    ]) {
      const { leveling } = buildProjection(referenceParams(width, height), width, height);
      expect(leveling?.pitchDeg).toBeCloseTo(REFERENCE_PITCH_DEG, 10);
      expect(leveling?.rollDeg).toBeCloseTo(REFERENCE_ROLL_DEG, 10);
    }
  });
});
