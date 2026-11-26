import { describe, expect, it } from 'vitest';
import type { Mat3, Vec3 } from '../../src/core/linalg';
import {
  IDENTITY,
  cross,
  det,
  dot,
  matrixToRodrigues,
  mul,
  mulTransposeVec,
  mulVec,
  normalize,
  rodriguesToMatrix,
  rotationX,
  rotationZ,
  smallestRightSingularVector,
  transpose,
} from '../../src/core/linalg';
import { maxDiff } from './fixtures';

describe('vectors and matrices', () => {
  it('cross is orthogonal to both factors', () => {
    const a: Vec3 = [1, 2, 3];
    const b: Vec3 = [-4, 0.5, 2];
    const c = cross(a, b);
    expect(Math.abs(dot(a, c))).toBeLessThan(1e-12);
    expect(Math.abs(dot(b, c))).toBeLessThan(1e-12);
  });

  it('mulTransposeVec is the transpose times the vector', () => {
    const m = mul(rotationX(0.3), rotationZ(-1.1));
    const v: Vec3 = [0.2, -0.7, 1.3];
    expect(maxDiff(mulTransposeVec(m, v), mulVec(transpose(m), v))).toBeLessThan(1e-15);
  });

  it('rotations are orthonormal with determinant 1', () => {
    const r = mul(rotationZ(0.4), rotationX(-0.9));
    expect(maxDiff(mul(transpose(r), r), IDENTITY)).toBeLessThan(1e-15);
    expect(det(r)).toBeCloseTo(1, 14);
  });
});

describe('Rodrigues', () => {
  it.each<Vec3>([
    [0.1, 0, 0],
    [0, -0.4, 0],
    [0.3, 0.2, -0.5],
    [-1.2, 0.7, 1.4],
  ])('goes there and back for %j', (...v) => {
    const r = rodriguesToMatrix(v);
    expect(det(r)).toBeCloseTo(1, 14);
    expect(maxDiff(matrixToRodrigues(r), v)).toBeLessThan(1e-12);
  });

  it('agrees with the axis rotations', () => {
    expect(maxDiff(rodriguesToMatrix([0.25, 0, 0]), rotationX(0.25))).toBeLessThan(1e-15);
    expect(maxDiff(rodriguesToMatrix([0, 0, -0.6]), rotationZ(-0.6))).toBeLessThan(1e-15);
  });

  it('gives the identity for no rotation, both ways', () => {
    expect(rodriguesToMatrix([0, 0, 0])).toEqual(IDENTITY);
    expect(matrixToRodrigues(IDENTITY)).toEqual([0, 0, 0]);
  });
});

describe('smallestRightSingularVector', () => {
  it('finds the common point of lines through it', () => {
    // Lines through (300, -2000) in homogeneous form, scaled like real ones:
    // unit normal, third coefficient in the thousands.
    const point: Vec3 = [300, -2000, 1];
    const lines: Vec3[] = [];
    for (const angle of [-0.2, -0.05, 0.01, 0.08, 0.3]) {
      const n: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
      lines.push([n[0], n[1], -(n[0] * point[0] + n[1] * point[1])]);
    }
    const x = smallestRightSingularVector(lines);
    const expected = normalize(point);
    const sign = Math.sign(dot(x, expected));
    expect(
      maxDiff(
        x.map((c) => c * sign),
        expected,
      ),
    ).toBeLessThan(1e-12);
  });

  it('returns a unit vector for a rank-deficient matrix', () => {
    const rows: Vec3[] = [
      [1, 0, 0],
      [2, 0, 0],
    ];
    const x = smallestRightSingularVector(rows);
    expect(Math.hypot(...x)).toBeCloseTo(1, 14);
    expect(Math.abs(x[0])).toBeLessThan(1e-15);
  });

  it('matches a hand-checked case', () => {
    const m: Mat3 = [2, 0, 0, 0, 3, 0, 0, 0, 0.5];
    const rows: Vec3[] = [
      [m[0], m[1], m[2]],
      [m[3], m[4], m[5]],
      [m[6], m[7], m[8]],
    ];
    expect(smallestRightSingularVector(rows).map(Math.abs)).toEqual([0, 0, 1]);
  });
});
