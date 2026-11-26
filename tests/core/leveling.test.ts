import { describe, expect, it } from 'vitest';
import { makeCamera } from '../../src/core/camera';
import {
  levelingFromVanishingPoint,
  withFineAdjustment,
  withStrength,
} from '../../src/core/leveling';
import type { Mat3 } from '../../src/core/linalg';
import {
  IDENTITY,
  det,
  matrixToRodrigues,
  mul,
  norm,
  rotationX,
  rotationZ,
  scale,
  transpose,
} from '../../src/core/linalg';
import { fixtures, maxDiff } from './fixtures';
import { vanishingPointOf } from './synthetic';

const cam = makeCamera(960, 1280, 480);
const DEG = Math.PI / 180;

describe('levelingFromVanishingPoint', () => {
  const angles: Array<[number, number]> = [];
  for (let pitch = -40; pitch <= 40; pitch += 10) {
    for (const roll of [-10, 0, 0.8, 10]) angles.push([pitch, roll]);
  }

  it.each(angles)('recovers pitch %s and roll %s (PLANO.md §7: within 0.1°)', (pitch, roll) => {
    const l = levelingFromVanishingPoint(vanishingPointOf(pitch, roll, cam), cam);
    expect(Math.abs(l.pitchDeg - pitch)).toBeLessThan(1e-9);
    expect(Math.abs(l.rollDeg - roll)).toBeLessThan(1e-9);
  });

  it.each(angles)('gives an orthonormal R with det 1, pitch %s roll %s', (pitch, roll) => {
    const r = levelingFromVanishingPoint(vanishingPointOf(pitch, roll, cam), cam).rotation;
    expect(maxDiff(mul(transpose(r), r), IDENTITY)).toBeLessThan(1e-14);
    expect(det(r)).toBeCloseTo(1, 14);
  });

  it('is Rz(roll) · Rx(pitch)', () => {
    const r = levelingFromVanishingPoint(vanishingPointOf(17.5, 0.8, cam), cam).rotation;
    expect(maxDiff(r, mul(rotationZ(0.8 * DEG), rotationX(17.5 * DEG)))).toBeLessThan(1e-14);
  });

  it('does not care about the scale or the sign of the point', () => {
    const vp = vanishingPointOf(-12, 3, cam);
    const r = levelingFromVanishingPoint(vp, cam).rotation;
    for (const k of [-1, 1e-3, 250]) {
      const other = levelingFromVanishingPoint(scale(vp, k), cam).rotation;
      expect(maxDiff(other, r)).toBeLessThan(1e-12);
    }
  });

  it('is the identity for a point at infinity straight down', () => {
    expect(levelingFromVanishingPoint([0, 1, 0], cam).rotation).toEqual(IDENTITY);
  });
});

describe('withStrength', () => {
  const r = levelingFromVanishingPoint(vanishingPointOf(17.5, 0.8, cam), cam).rotation;

  it('is the identity at 0 and R at 1 (PLANO.md §7)', () => {
    expect(withStrength(r, 0)).toEqual(IDENTITY);
    expect(withStrength(r, 1)).toBe(r);
  });

  it('scales the angle and keeps the axis', () => {
    const full = matrixToRodrigues(r);
    const half = matrixToRodrigues(withStrength(r, 0.5));
    expect(norm(half)).toBeCloseTo(norm(full) / 2, 12);
    expect(maxDiff(scale(half, 2), full)).toBeLessThan(1e-12);
  });
});

describe('withFineAdjustment', () => {
  it('adds the offsets to the pitch and the roll', () => {
    const r = levelingFromVanishingPoint(vanishingPointOf(17.5, 0.8, cam), cam).rotation;
    const adjusted = withFineAdjustment(r, -2.5, 1.2);
    const expected = levelingFromVanishingPoint(vanishingPointOf(15, 2, cam), cam).rotation;
    expect(maxDiff(adjusted, expected)).toBeLessThan(1e-12);
  });

  it('levels by hand with no vanishing point', () => {
    const r: Mat3 = withFineAdjustment(IDENTITY, 10, -3);
    expect(maxDiff(r, mul(rotationZ(-3 * DEG), rotationX(10 * DEG)))).toBeLessThan(1e-15);
  });

  it('changes nothing with zero offsets', () => {
    expect(withFineAdjustment(IDENTITY, 0, 0)).toBe(IDENTITY);
  });
});

describe('parity with the reference', () => {
  it.each(fixtures.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const camera = makeCamera(c.width, c.height, c.focal);
    const l = levelingFromVanishingPoint(c.vanishingPoint, camera);
    expect(maxDiff(l.rotation, c.rotationFull)).toBeLessThan(1e-12);
    expect(Math.abs(l.pitchDeg - c.pitchDeg)).toBeLessThan(1e-9);
    expect(Math.abs(l.rollDeg - c.rollDeg)).toBeLessThan(1e-9);
    expect(maxDiff(withStrength(l.rotation, c.strength), c.rotation)).toBeLessThan(1e-12);
  });
});
