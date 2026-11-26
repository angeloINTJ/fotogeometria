/**
 * The parameters of a correction, and the one function that turns them into
 * a projection (PLANO.md §5, "Estado do editor").
 *
 * The preview's shader, the export and the crop all start from
 * {@link buildProjection}, so they can never disagree about the mathematics.
 */
import type { Camera } from './camera';
import { DEFAULT_FOCAL_35MM, focalPixels, makeCamera } from './camera';
import type { Framing, Projection } from './framing';
import { outputFraming } from './framing';
import type { Leveling } from './leveling';
import { levelingFromVanishingPoint, withFineAdjustment, withStrength } from './leveling';
import type { Vec3 } from './linalg';
import { IDENTITY } from './linalg';

/** An axis-aligned rectangle in output pixels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The proportion of the crop: width / height, `'original'` for the photo's
 * own, or null for none (the largest rectangle of any shape).
 */
export type CropAspect = number | 'original' | null;

/** The parameters that define a correction completely (PLANO.md §5). */
export interface CorrectionParams {
  /** The 35 mm equivalent focal length, in millimetres. */
  readonly focal35mm: number;
  /** The vertical vanishing point, homogeneous, in source pixels; null = no levelling. */
  readonly vanishingPoint: Vec3 | null;
  /** How much of the levelling to apply, 0 to 1. */
  readonly strength: number;
  /** Fine adjustment added to the camera's pitch, in degrees. */
  readonly pitchOffsetDeg: number;
  /** Fine adjustment added to the camera's roll, in degrees. */
  readonly rollOffsetDeg: number;
  /** The Panini parameter d, 0 (rectilinear) to 1 (classic Panini). */
  readonly paniniD: number;
  /** The vertical compression c, 0 (none) to 1. */
  readonly verticalCompression: number;
  /** The crop's proportion. */
  readonly cropAspect: CropAspect;
  /** A crop the user placed, in output pixels; null = automatic. */
  readonly cropRect: Rect | null;
}

/**
 * The initial values of the controls: the reference case of PLANO.md §3.8
 * (13 mm, strength 0.9, Panini 0.7, compression 0.5). Its crop proportion,
 * 0.7, is not one of the proportions §4 offers, so the crop starts at the
 * photo's own (docs/DECISIONS.md).
 */
export const DEFAULT_PARAMS: CorrectionParams = {
  focal35mm: DEFAULT_FOCAL_35MM,
  vanishingPoint: null,
  strength: 0.9,
  pitchOffsetDeg: 0,
  rollOffsetDeg: 0,
  paniniD: 0.7,
  verticalCompression: 0.5,
  cropAspect: 'original',
  cropRect: null,
};

/** A projection with what was learnt on the way: the levelling and the framing. */
export interface Correction {
  readonly projection: Projection;
  /** The levelling the vanishing point implies, before strength and fine adjustment. */
  readonly leveling: Leveling | null;
  readonly framing: Framing;
}

/**
 * The camera of a photo with the focal length of the parameters.
 */
export function cameraFor(params: CorrectionParams, width: number, height: number): Camera {
  return makeCamera(width, height, focalPixels(params.focal35mm, width, height));
}

/**
 * Turns parameters into the projection and framing of a width x height photo:
 * levelling from the vanishing point, scaled by the strength, then the fine
 * adjustment.
 */
export function buildProjection(
  params: CorrectionParams,
  width: number,
  height: number,
): Correction {
  const camera = cameraFor(params, width, height);
  const leveling = params.vanishingPoint
    ? levelingFromVanishingPoint(params.vanishingPoint, camera)
    : null;
  const rotation = withFineAdjustment(
    withStrength(leveling ? leveling.rotation : IDENTITY, params.strength),
    params.pitchOffsetDeg,
    params.rollOffsetDeg,
  );
  const projection: Projection = {
    camera,
    rotation,
    paniniD: params.paniniD,
    compression: params.verticalCompression,
  };
  return { projection, leveling, framing: outputFraming(projection) };
}
