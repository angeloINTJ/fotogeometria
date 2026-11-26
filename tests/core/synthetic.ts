/**
 * Synthetic scenes for the tests: the vanishing point of a camera with a known
 * pitch and roll, built the way scripts/generate_fixtures.py builds it.
 */
import type { Camera } from '../../src/core/camera';
import type { Vec3 } from '../../src/core/linalg';

/** The homogeneous vertical vanishing point of a camera with this pitch and roll. */
export function vanishingPointOf(pitchDeg: number, rollDeg: number, cam: Camera): Vec3 {
  const p = (pitchDeg * Math.PI) / 180;
  const r = (rollDeg * Math.PI) / 180;
  const down: Vec3 = [-Math.sin(r) * Math.cos(p), Math.cos(r) * Math.cos(p), Math.sin(p)];
  const vw = down[2] / cam.focal;
  return [down[0] + cam.cx * vw, down[1] + cam.cy * vw, vw];
}
