/**
 * The levelling rotation (PLANO.md §3.3).
 *
 * The vertical vanishing point, back-projected, is the direction of gravity in
 * the camera's frame. The rotation built from it takes rays of a level camera
 * (same position, optical axis as close as possible to the original's) to
 * rays of the original camera: r_orig = R · r_level.
 *
 * In this frame (x right, y down, z forward) the rotation of a camera with
 * pitch p and roll r is exactly Rz(r) · Rx(p): a camera pitched down has
 * p > 0, one pitched up p < 0. The fine adjustment relies on that form.
 */
import type { Camera } from './camera';
import type { Mat3, Vec3 } from './linalg';
import {
  IDENTITY,
  cross,
  dot,
  fromColumns,
  matrixToRodrigues,
  mul,
  normalize,
  rodriguesToMatrix,
  rotationX,
  rotationZ,
  scale,
  sub,
} from './linalg';

/** What the vanishing point says about the camera. */
export interface Leveling {
  /** Takes rays of the level camera to rays of the original camera. */
  readonly rotation: Mat3;
  /** The camera's pitch in degrees: positive when it pointed down. */
  readonly pitchDeg: number;
  /** The camera's roll in degrees. */
  readonly rollDeg: number;
}

const DEGREES = 180 / Math.PI;

/**
 * The rotation that levels the camera, from the homogeneous vertical
 * vanishing point (`rotacao_de_nivelamento`).
 *
 * down = normalize(vx - cx vw, vy - cy vw, f vw), flipped to point down;
 * forward = normalize(z - down (z · down)); right = down × forward;
 * R = [right | down | forward].
 *
 * @param vp the vanishing point in homogeneous pixel coordinates; any scale,
 *   either sign, and vw = 0 for a point at infinity
 * @param cam the camera of the image the point belongs to
 */
export function levelingFromVanishingPoint(vp: Vec3, cam: Camera): Leveling {
  let down = normalize([vp[0] - cam.cx * vp[2], vp[1] - cam.cy * vp[2], cam.focal * vp[2]]);
  if (down[1] < 0) down = scale(down, -1);
  const z: Vec3 = [0, 0, 1];
  const forward = normalize(sub(z, scale(down, dot(z, down))));
  const right = cross(down, forward);
  return {
    rotation: fromColumns(right, down, forward),
    pitchDeg: Math.asin(down[2]) * DEGREES,
    rollDeg: Math.atan2(-down[0], down[1]) * DEGREES,
  };
}

/**
 * The vertical vanishing point of a camera with this pitch and roll: the
 * inverse of {@link levelingFromVanishingPoint}. With down = (-sin roll cos
 * pitch, cos roll cos pitch, sin pitch) and w = down.z / f, the point is
 * (down.x + cx w, down.y + cy w, w); at a pitch of 0 it lies at infinity.
 *
 * Until the point is traced by hand (PLANO.md §8, stage 4) or detected
 * (stage 6), the preview levels by a pitch and a roll written in the code,
 * and this turns them into the point of any photo.
 */
export function vanishingPointFromAngles(cam: Camera, pitchDeg: number, rollDeg: number): Vec3 {
  const p = pitchDeg / DEGREES;
  const r = rollDeg / DEGREES;
  const down: Vec3 = [-Math.sin(r) * Math.cos(p), Math.cos(r) * Math.cos(p), Math.sin(p)];
  const w = down[2] / cam.focal;
  return [down[0] + cam.cx * w, down[1] + cam.cy * w, w];
}

/**
 * A fraction of a rotation (PLANO.md §3.3, "Força"): the angle of its
 * axis-angle form times the strength, about the same axis.
 *
 * At strength 1 the rotation comes back untouched, as in the reference, which
 * only interpolates when the strength is below 1 (`if args.forca < 1.0`).
 *
 * @param rotation the full correction
 * @param strength 0 (no correction) to 1 (all of it)
 */
export function withStrength(rotation: Mat3, strength: number): Mat3 {
  if (strength >= 1) return rotation;
  if (strength <= 0) return IDENTITY;
  return rodriguesToMatrix(scale(matrixToRodrigues(rotation), strength));
}

/**
 * Adds the fine adjustment (PLANO.md §3.3, "Ajuste fino") to a rotation:
 * Rz(roll offset) · R · Rx(pitch offset).
 *
 * For R = Rz(r) · Rx(p), the form of every levelling rotation, this is
 * Rz(r + roll offset) · Rx(p + pitch offset): the offsets add to the camera's
 * pitch and roll in degrees, which is what the sliders promise.
 */
export function withFineAdjustment(
  rotation: Mat3,
  pitchOffsetDeg: number,
  rollOffsetDeg: number,
): Mat3 {
  if (pitchOffsetDeg === 0 && rollOffsetDeg === 0) return rotation;
  return mul(
    mul(rotationZ(rollOffsetDeg / DEGREES), rotation),
    rotationX(pitchOffsetDeg / DEGREES),
  );
}
