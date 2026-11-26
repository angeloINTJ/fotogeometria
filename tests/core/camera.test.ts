import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOCAL_35MM,
  LENS_PRESETS,
  focal35mm,
  focalPixels,
  makeCamera,
  pixelToRay,
  rayToPixel,
} from '../../src/core/camera';

describe('focal length', () => {
  it('is f35 / 43.27 times the diagonal (PLANO.md §3.1)', () => {
    // 960 x 1280 has a 1600 px diagonal.
    expect(focalPixels(13, 960, 1280)).toBeCloseTo((13 / 43.27) * 1600, 12);
  });

  it('defaults to 13 mm, about 0.30 of the diagonal', () => {
    expect(DEFAULT_FOCAL_35MM).toBe(13);
    expect(focalPixels(DEFAULT_FOCAL_35MM, 960, 1280) / 1600).toBeCloseTo(0.3, 2);
  });

  it('offers the three lenses of a phone', () => {
    expect(LENS_PRESETS).toEqual({ '0.5x': 13, '1x': 24, '2x': 48 });
  });

  it('converts back to millimetres', () => {
    expect(focal35mm(focalPixels(24, 4000, 3000), 4000, 3000)).toBeCloseTo(24, 12);
  });
});

describe('rays', () => {
  const cam = makeCamera(960, 1280, 480);

  it('puts the optical centre at the centre of the image', () => {
    expect([cam.cx, cam.cy]).toEqual([479.5, 639.5]);
    expect(pixelToRay(cam, 479.5, 639.5)).toEqual([0, 0, 1]);
  });

  it('goes from pixel to ray and back', () => {
    const back = rayToPixel(cam, pixelToRay(cam, 12.25, 1001.5));
    expect(back?.[0]).toBeCloseTo(12.25, 12);
    expect(back?.[1]).toBeCloseTo(1001.5, 12);
  });

  it('refuses a ray behind the camera, as the reference does', () => {
    expect(rayToPixel(cam, [0, 0, -1])).toBeNull();
    expect(rayToPixel(cam, [0, 0, 1e-6])).toBeNull();
    expect(rayToPixel(cam, [0, 0, 2e-6])).not.toBeNull();
  });
});
