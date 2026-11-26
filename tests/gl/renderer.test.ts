/**
 * The part of src/gl/renderer.ts that needs no GPU. The rest runs in the
 * browser tests (e2e/gl.spec.ts).
 */
import { describe, expect, it } from 'vitest';
import { topRowFirst } from '../../src/gl/renderer';

describe('topRowFirst', () => {
  it('puts the rows of an RGBA read-back in the opposite order', () => {
    // 2 x 3 pixels, each pixel's four values equal to its row.
    const bottomUp = Uint8Array.from({ length: 2 * 3 * 4 }, (_, k) => Math.floor(k / 8));
    expect([...topRowFirst(bottomUp, 2, 3)]).toEqual([
      2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('keeps the order within a row, and the kind of array', () => {
    const bottomUp = Float32Array.from({ length: 3 * 2 * 4 }, (_, k) => k + 0.5);
    const out = topRowFirst(bottomUp, 3, 2);
    expect(out).toBeInstanceOf(Float32Array);
    expect([...out.subarray(0, 12)]).toEqual([...bottomUp.subarray(12, 24)]);
    expect([...out.subarray(12, 24)]).toEqual([...bottomUp.subarray(0, 12)]);
  });

  it('leaves the read-back as it was', () => {
    const bottomUp = Uint8Array.from([1, 1, 1, 1, 2, 2, 2, 2]);
    topRowFirst(bottomUp, 1, 2);
    expect([...bottomUp]).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });
});
