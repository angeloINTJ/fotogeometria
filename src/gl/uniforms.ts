/**
 * From a correction and a view to everything the shader reads.
 *
 * Pure: no WebGL here, so Node tests check that what the shader receives is
 * what src/core computes (PLANO.md §5: the same function of core feeds the
 * shader and the crop). The trigonometry of the reprojection runs here, in
 * double precision, through src/core: the shader gets one table entry per
 * target column and per target row, and does only the rotation and the
 * division by depth. src/gl/reproject.frag says why.
 */
import type { Correction, Rect } from '../core/correction';
import { outputColumn, outputRow } from '../core/framing';
import type { Mat3 } from '../core/linalg';

/** What to draw. */
export type DrawMode = 'color' | 'coordinates' | 'original';

/** How output pixels land on a target (the canvas, or a framebuffer read back). */
export interface View {
  /** The output-pixel rectangle to show; anything outside it is drawn empty. */
  readonly region: Rect;
  /** Output coordinate of the target's top-left corner. */
  readonly originX: number;
  readonly originY: number;
  /** Output pixels per target pixel. */
  readonly scale: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
}

/** Everything reproject.frag reads, as plain numbers. */
export interface ReprojectionUniforms {
  readonly sourceSize: readonly [number, number];
  readonly focal: number;
  readonly center: readonly [number, number];
  /** Column-major, as GLSL's mat3 wants it. */
  readonly rotation: readonly number[];
  /**
   * Four numbers per target column, left to right: sinLon, cosLon and
   * inverseScale of src/core's outputColumn at the column's centre, and 0.
   */
  readonly columns: Float32Array;
  /** One number per target row, top to bottom: src/core's outputRow at its centre. */
  readonly rows: Float32Array;
  readonly viewOrigin: readonly [number, number];
  readonly viewScale: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly region: readonly [number, number, number, number];
  readonly margin: number;
  readonly mode: 0 | 1 | 2;
}

/** A row-major Mat3 as GLSL's column-major array. */
export function columnMajor(m: Mat3): number[] {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/**
 * The view that fits a region of output pixels in a target, centred, keeping
 * the proportion (letterbox), at the largest scale that shows all of it.
 */
export function fitView(region: Rect, targetWidth: number, targetHeight: number): View {
  const scale = Math.max(region.width / targetWidth, region.height / targetHeight);
  return {
    region,
    originX: region.x - (targetWidth * scale - region.width) / 2,
    originY: region.y - (targetHeight * scale - region.height) / 2,
    scale,
    targetWidth,
    targetHeight,
  };
}

/**
 * The view that renders a region at one target pixel per output pixel, for
 * the export and for reading back: the target is the region.
 */
export function pixelView(region: Rect): View {
  return {
    region,
    originX: region.x,
    originY: region.y,
    scale: 1,
    targetWidth: region.width,
    targetHeight: region.height,
  };
}

const MODES = { color: 0, coordinates: 1, original: 2 } as const;

/**
 * The uniforms of one draw.
 *
 * Target column i has its centre at output coordinate
 * originX + (i + 0.5) · scale, and row j likewise from the top: the same
 * centres the shader computes from gl_FragCoord, so in a pixelView, column i
 * is output pixel region.x + i, exactly as src/core samples it.
 *
 * @param correction from src/core/correction.ts (buildProjection)
 * @param view where the output pixels land
 * @param options margin is the distance from the source's edge below which a
 *   pixel is drawn empty
 */
export function reprojectionUniforms(
  correction: Correction,
  view: View,
  options: { mode?: DrawMode; margin?: number } = {},
): ReprojectionUniforms {
  const { projection, framing } = correction;
  const { camera, rotation } = projection;
  const columns = new Float32Array(view.targetWidth * 4);
  for (let i = 0; i < view.targetWidth; i++) {
    const column = outputColumn(projection, framing, view.originX + (i + 0.5) * view.scale);
    columns[i * 4] = column.sinLon;
    columns[i * 4 + 1] = column.cosLon;
    columns[i * 4 + 2] = column.inverseScale;
  }
  const rows = new Float32Array(view.targetHeight);
  for (let j = 0; j < view.targetHeight; j++) {
    rows[j] = outputRow(projection, framing, view.originY + (j + 0.5) * view.scale);
  }
  return {
    sourceSize: [camera.width, camera.height],
    focal: camera.focal,
    center: [camera.cx, camera.cy],
    rotation: columnMajor(rotation),
    columns,
    rows,
    viewOrigin: [view.originX, view.originY],
    viewScale: view.scale,
    targetWidth: view.targetWidth,
    targetHeight: view.targetHeight,
    region: [view.region.x, view.region.y, view.region.width, view.region.height],
    margin: options.margin ?? 0,
    mode: MODES[options.mode ?? 'color'],
  };
}
