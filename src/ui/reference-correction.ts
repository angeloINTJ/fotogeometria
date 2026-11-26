/**
 * The correction the preview applies while it has no controls (PLANO.md §8,
 * stage 2: "fixed parameters, the reference case's, with the vanishing point
 * given in the code").
 *
 * The reference case is a photo levelled by a pitch of 17.5° and a roll of
 * 0.8° (PLANO.md §3.8). A vanishing point in pixels would only fit photos of
 * its size, so the code gives the angles, and each photo gets the point its
 * own camera implies: for a 960 x 1280 photo that is the reference's point,
 * and the 1151 x 1226 framing of tests/fixtures/parity.json.
 */
import { focal35mm } from '../core/camera';
import type { CorrectionParams } from '../core/correction';
import { DEFAULT_PARAMS, cameraFor } from '../core/correction';
import { vanishingPointFromAngles } from '../core/leveling';

/**
 * The reference case's focal length in 35 mm terms: 480 px on the 1600 px
 * diagonal of a 960 x 1280 photo (PLANO.md §3.8), 0.30 of it, which is
 * 12.98 mm. The plan rounds it to 13 mm, and DEFAULT_PARAMS starts the
 * controls there, but 13 mm is 480.7 px on that photo: the preview would
 * not be the reference case.
 */
export const REFERENCE_FOCAL_35MM = focal35mm(480, 960, 1280);

/** The reference case's pitch, in degrees (PLANO.md §3.8). */
export const REFERENCE_PITCH_DEG = 17.5;

/** The reference case's roll, in degrees (PLANO.md §3.8). */
export const REFERENCE_ROLL_DEG = 0.8;

/**
 * The parameters of the reference case for a width x height photo: the
 * initial values of the controls (DEFAULT_PARAMS), the reference's focal
 * length, and the levelling of a camera with its pitch and roll.
 */
export function referenceParams(width: number, height: number): CorrectionParams {
  const params = { ...DEFAULT_PARAMS, focal35mm: REFERENCE_FOCAL_35MM };
  const camera = cameraFor(params, width, height);
  return {
    ...params,
    vanishingPoint: vanishingPointFromAngles(camera, REFERENCE_PITCH_DEG, REFERENCE_ROLL_DEG),
  };
}
