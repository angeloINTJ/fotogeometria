/**
 * Opens a photo: decodes it upright and, when it is larger than the GPU or the
 * phone's memory takes, scales it down once, here, so everything after works
 * on one image of one size.
 */

/** Why a photo could not be opened. */
export class ImageLoadError extends Error {
  constructor(
    readonly reason: 'decode' | 'empty',
    options?: { cause?: unknown },
  ) {
    super(
      reason === 'decode'
        ? 'the file is not an image this browser can decode'
        : 'the image has no pixels',
      options,
    );
    this.name = 'ImageLoadError';
  }
}

/** A decoded photo, upright, at the size the app works on. */
export interface LoadedImage {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
  /** The size the file had, before any scaling down. */
  readonly originalWidth: number;
  readonly originalHeight: number;
}

/**
 * The most pixels the app works on: 4096 x 4096, about 16.8 megapixels.
 *
 * The export encodes from a canvas, and WebKit limits a canvas on iOS by its
 * area: 4096 x 4096 from 2015 (r185603) until 2024-03-15, when 276145@main
 * raised it to 8192 x 8192 (maxCanvasArea in Source/WebCore/html/
 * CanvasBase.cpp, read on 2026-11-26). An iOS whose WebKit predates that
 * change keeps the old limit, so the app keeps it too (PLANO.md §6). A
 * 12-megapixel photo, what most phones save, passes untouched.
 */
export const MAX_PIXELS = 4096 * 4096;

/**
 * The size an image is scaled to so that it fits both limits, keeping its
 * proportion; the same size when it already fits.
 */
export function fitSize(
  width: number,
  height: number,
  maxSide: number,
  maxPixels: number = MAX_PIXELS,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxSide / Math.max(width, height),
    Math.sqrt(maxPixels / (width * height)),
  );
  if (scale >= 1) return { width, height };
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/**
 * Decodes a file into an upright bitmap that fits the limits.
 *
 * `imageOrientation: 'from-image'` applies the EXIF orientation (PLANO.md §6),
 * so the bitmap is the photo as the camera's user saw it. Scaling goes through
 * a canvas rather than createImageBitmap's resize options, which older Safari
 * ignores.
 *
 * @param maxSide the GPU's largest texture side (Renderer.maxTextureSize)
 */
export async function loadImage(blob: Blob, maxSide: number): Promise<LoadedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (cause) {
    throw new ImageLoadError('decode', { cause });
  }
  const { width, height } = bitmap;
  if (width === 0 || height === 0) {
    bitmap.close();
    throw new ImageLoadError('empty');
  }
  const target = fitSize(width, height, maxSide);
  if (target.width === width && target.height === height) {
    return { bitmap, width, height, originalWidth: width, originalHeight: height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();
  const scaled = await createImageBitmap(canvas);
  // Let the canvas go: on iOS its memory is only returned when it shrinks.
  canvas.width = canvas.height = 0;
  return { bitmap: scaled, ...target, originalWidth: width, originalHeight: height };
}
