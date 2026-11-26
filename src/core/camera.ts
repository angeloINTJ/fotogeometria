/**
 * The camera model (PLANO.md §3.1).
 *
 * The input is assumed rectilinear: a phone already corrects the barrel
 * distortion of its ultra-wide lens before saving. The optical centre is the
 * centre of the image, and the focal length in pixels comes from the 35 mm
 * equivalent focal length and the image diagonal.
 */
import type { Vec3 } from './linalg';

/** The diagonal of a 36 x 24 mm frame, the "35 mm" of an equivalent focal length. */
export const FULL_FRAME_DIAGONAL_MM = 43.27;

/**
 * Typical 35 mm equivalents of a phone's three cameras (PLANO.md §3.1): the
 * ultra-wide (0.5x), the main (1x) and the telephoto (2x).
 */
export const LENS_PRESETS = { '0.5x': 13, '1x': 24, '2x': 48 } as const;

/** The name of a lens preset. */
export type LensPreset = keyof typeof LENS_PRESETS;

/**
 * The focal length used when the photo says nothing: 13 mm, the ultra-wide,
 * since that is the lens whose photos need correcting. Photos that arrive
 * through messaging apps usually have no EXIF.
 */
export const DEFAULT_FOCAL_35MM = 13;

/** The range the focal control offers, in millimetres (PLANO.md §4). */
export const FOCAL_35MM_RANGE = { min: 10, max: 60 } as const;

/**
 * A ray whose depth is below this is treated as behind the camera. The
 * reference's threshold (`raios[..., 2] > 1e-6` in `reprojetar`), so a pixel
 * on the edge of validity is decided the same way in both.
 */
export const MIN_DEPTH = 1e-6;

/** An image's pinhole camera: size, focal length and optical centre, in pixels. */
export interface Camera {
  readonly width: number;
  readonly height: number;
  readonly focal: number;
  readonly cx: number;
  readonly cy: number;
}

/**
 * The focal length in pixels: f = f35 / 43.27 × diagonal.
 *
 * @param focal35mm the 35 mm equivalent focal length, in millimetres
 * @param width the image width in pixels
 * @param height the image height in pixels
 */
export function focalPixels(focal35mm: number, width: number, height: number): number {
  return (focal35mm / FULL_FRAME_DIAGONAL_MM) * Math.hypot(width, height);
}

/**
 * The inverse of {@link focalPixels}: the 35 mm equivalent of a focal length
 * in pixels.
 */
export function focal35mm(focalPx: number, width: number, height: number): number {
  return (focalPx / Math.hypot(width, height)) * FULL_FRAME_DIAGONAL_MM;
}

/**
 * The camera of an image, with the optical centre at its centre:
 * cx = (W - 1) / 2, cy = (H - 1) / 2.
 */
export function makeCamera(width: number, height: number, focal: number): Camera {
  return { width, height, focal, cx: (width - 1) / 2, cy: (height - 1) / 2 };
}

/** The ray through a pixel: ((x - cx) / f, (y - cy) / f, 1). */
export function pixelToRay(cam: Camera, x: number, y: number): Vec3 {
  return [(x - cam.cx) / cam.focal, (y - cam.cy) / cam.focal, 1];
}

/**
 * The pixel a ray lands on, or null when the ray points behind the camera.
 */
export function rayToPixel(cam: Camera, r: Vec3): readonly [number, number] | null {
  if (!(r[2] > MIN_DEPTH)) return null;
  return [(cam.focal * r[0]) / r[2] + cam.cx, (cam.focal * r[1]) / r[2] + cam.cy];
}
