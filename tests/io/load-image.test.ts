/**
 * The size a photo is opened at (src/io/load-image.ts). Decoding itself needs
 * a browser: the app's browser tests open the synthetic grid through it.
 */
import { describe, expect, it } from 'vitest';
import { MAX_PIXELS, fitSize } from '../../src/io/load-image';

describe('fitSize', () => {
  it('leaves a photo that fits alone: 12 megapixels, what most phones save', () => {
    expect(fitSize(4000, 3000, 8192)).toEqual({ width: 4000, height: 3000 });
  });

  it("brings the longer side down to the GPU's texture size", () => {
    expect(fitSize(5000, 1000, 4096)).toEqual({ width: 4096, height: 819 });
    expect(fitSize(1000, 5000, 4096)).toEqual({ width: 819, height: 4096 });
  });

  it('brings the area down to MAX_PIXELS, keeping the proportion', () => {
    const { width, height } = fitSize(8000, 6000, 16384);
    expect(width * height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(width * height).toBeGreaterThan(MAX_PIXELS * 0.999);
    expect(Math.abs(width / height - 8000 / 6000)).toBeLessThan(1 / height);
  });

  it('never gives an empty side', () => {
    expect(fitSize(1, 100_000, 4096)).toEqual({ width: 1, height: 4096 });
  });
});
