/**
 * The Panini projection and the vertical compression (PLANO.md §3.4, §3.5).
 *
 * Panini with parameter d is rectilinear at d = 0 and the classic Panini at
 * d = 1. It keeps vertical lines straight while it reduces the horizontal
 * stretch at the edges. The vertical compression then does the same for the
 * top and the bottom. Both are ports of reference/corrigir_geometria.py
 * (`projetar_panini`, `raios_panini`, and `comprimir`/`expandir` inside
 * `reprojetar`), written in the same order of operations so the results agree
 * to the last few bits.
 */
import type { Vec3 } from './linalg';

/**
 * Projects a ray onto the Panini plane (`projetar_panini`).
 *
 * lon = atan2(X, Z), lat = asin(Y / |r|), S = (d + 1) / (d + cos lon),
 * x = S sin lon, y = S tan lat.
 *
 * @param r a ray (any length)
 * @param d the Panini parameter, 0 to 1
 * @returns the plane coordinates, in units of the focal length
 */
export function paniniForward(r: Vec3, d: number): readonly [number, number] {
  const lon = Math.atan2(r[0], r[2]);
  const lat = Math.asin(r[1] / Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]));
  const s = (d + 1) / (d + Math.cos(lon));
  return [s * Math.sin(lon), s * Math.tan(lat)];
}

/**
 * The unit ray of a point of the Panini plane (`raios_panini`), the inverse
 * of {@link paniniForward}.
 *
 * k = x² / (d + 1)², cos lon = (-k d + √(k² d² - (k + 1)(k d² - 1))) / (k + 1),
 * lon = atan2(x / S, cos lon), lat = atan(y / S).
 */
export function paniniInverse(x: number, y: number, d: number): Vec3 {
  const k = (x * x) / ((d + 1) * (d + 1));
  const discriminant = k * k * d * d - (k + 1) * (k * d * d - 1);
  const cosLon = (-k * d + Math.sqrt(discriminant)) / (k + 1);
  const inverseScale = (cosLon + d) / (d + 1);
  const lon = Math.atan2(x * inverseScale, cosLon);
  const lat = Math.atan2(y * inverseScale, 1);
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

/**
 * The vertical compression of the output plane (`comprimir`):
 * y' = atan(c y) / c, and the identity when c is 0.
 */
export function compress(y: number, c: number): number {
  return c <= 0 ? y : Math.atan(y * c) / c;
}

/**
 * The largest |c y| {@link expand} takes the tangent of: just short of π/2,
 * where the tangent goes to infinity. The reference's clip (`expandir`).
 */
export const EXPAND_LIMIT = Math.PI / 2 - 1e-3;

/**
 * The inverse of {@link compress} (`expandir`): y = tan(c y') / c, with c y'
 * clipped to ±{@link EXPAND_LIMIT}, and the identity when c is 0.
 */
export function expand(y: number, c: number): number {
  if (c <= 0) return y;
  const t = Math.min(EXPAND_LIMIT, Math.max(-EXPAND_LIMIT, y * c));
  return Math.tan(t) / c;
}
