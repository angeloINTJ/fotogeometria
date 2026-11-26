/**
 * The reprojection and its framing (PLANO.md §3.6), on the CPU.
 *
 * A projection is everything that maps a pixel of the corrected output to a
 * pixel of the source photo: the camera, the rotation, the Panini parameter
 * and the vertical compression. The shader runs the same per-pixel steps with
 * the same numbers, passed as uniforms (src/gl/); this module is what the
 * crop, the export's framing and the tests use. Ported from `reprojetar` in
 * reference/corrigir_geometria.py.
 */
import type { Camera } from './camera';
import { pixelToRay, rayToPixel } from './camera';
import type { Mat3 } from './linalg';
import { mulTransposeVec, mulVec } from './linalg';
import { compress, expand, paniniForward, paniniInverse } from './panini';

/** Everything that maps output pixels to source pixels. */
export interface Projection {
  readonly camera: Camera;
  /** Takes rays of the corrected (virtual) camera to rays of the source camera. */
  readonly rotation: Mat3;
  /** The Panini parameter d, 0 to 1. */
  readonly paniniD: number;
  /** The vertical compression c, 0 to 1. */
  readonly compression: number;
}

/**
 * The output canvas: the bounding box, on the output plane, of the source
 * image's projected contour, and its size in pixels.
 */
export interface Framing {
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
  /** Output width in pixels. */
  readonly width: number;
  /** Output height in pixels. */
  readonly height: number;
}

/** Points per edge of the contour, as in the reference (800 in all). */
export const CONTOUR_POINTS_PER_EDGE = 200;

/**
 * Rounds half to even, as Python's round() does on a NumPy float. The
 * reference sizes the output with `int(round(...))`, and Math.round would
 * disagree with it at every exact .5.
 */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** NumPy's linspace(start, stop, n): n points, both ends included. */
function linspace(start: number, stop: number, n: number): number[] {
  const step = (stop - start) / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(start + i * step);
  out[n - 1] = stop;
  return out;
}

/**
 * The contour of a width x height image, clockwise from the top-left corner:
 * 200 points along each edge, both corners of each edge included, exactly as
 * the reference builds `borda_x` and `borda_y`.
 */
export function contour(width: number, height: number): Array<readonly [number, number]> {
  const n = CONTOUR_POINTS_PER_EDGE;
  const w = width - 1;
  const h = height - 1;
  const top = linspace(0, w, n).map((x) => [x, 0] as const);
  const right = linspace(0, h, n).map((y) => [w, y] as const);
  const bottom = linspace(w, 0, n).map((x) => [x, h] as const);
  const left = linspace(h, 0, n).map((y) => [0, y] as const);
  return [...top, ...right, ...bottom, ...left];
}

/**
 * Where a source pixel lands on the output plane: its ray, turned into the
 * corrected camera's frame (Rᵀ r), projected by Panini, compressed in y.
 */
export function forwardPoint(p: Projection, x: number, y: number): readonly [number, number] {
  const ray = mulTransposeVec(p.rotation, pixelToRay(p.camera, x, y));
  const [px, py] = paniniForward(ray, p.paniniD);
  return [px, compress(py, p.compression)];
}

/**
 * The output framing (PLANO.md §3.6, "Enquadramento de saída"): the bounding
 * box of the projected contour, at f pixels per unit so the centre of the
 * photo keeps its resolution.
 */
export function outputFraming(p: Projection): Framing {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const [x, y] of contour(p.camera.width, p.camera.height)) {
    const [px, py] = forwardPoint(p, x, y);
    xMin = Math.min(xMin, px);
    yMin = Math.min(yMin, py);
    xMax = Math.max(xMax, px);
    yMax = Math.max(yMax, py);
  }
  return {
    xMin,
    yMin,
    xMax,
    yMax,
    width: roundHalfEven((xMax - xMin) * p.camera.focal),
    height: roundHalfEven((yMax - yMin) * p.camera.focal),
  };
}

/**
 * The source pixel an output pixel samples (PLANO.md §3.6, steps 1 to 6), or
 * null when its ray points behind the source camera.
 *
 * @param px output column; integer at a pixel's corner, so its centre is px + 0.5
 * @param py output row, likewise
 */
export function sourcePoint(
  p: Projection,
  framing: Framing,
  px: number,
  py: number,
): readonly [number, number] | null {
  const f = p.camera.focal;
  const x = framing.xMin + (px + 0.5) / f;
  const y = expand(framing.yMin + (py + 0.5) / f, p.compression);
  return rayToPixel(p.camera, mulVec(p.rotation, paniniInverse(x, y, p.paniniD)));
}

/**
 * Whether a source position can be sampled: inside the image by at least
 * `margin` pixels (the reference's `margem`; it uses 1.0 before cropping).
 */
export function isInside(cam: Camera, u: number, v: number, margin: number): boolean {
  return u >= margin && u <= cam.width - 1 - margin && v >= margin && v <= cam.height - 1 - margin;
}

/** A binary mask over a grid: 1 where the pixel is valid. Row-major. */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/**
 * The mask of output pixels that sample inside the source image, at full
 * resolution (the reference's `valida`).
 */
export function validityMask(p: Projection, framing: Framing, margin: number): Mask {
  const { width, height } = framing;
  const data = new Uint8Array(width * height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const s = sourcePoint(p, framing, px, py);
      if (s && isInside(p.camera, s[0], s[1], margin)) data[py * width + px] = 1;
    }
  }
  return { width, height, data };
}
