/**
 * The focal length a photo's EXIF records (PLANO.md §3.1: the first source of
 * f35, before the lens presets and the default).
 */

/** FocalLengthIn35mmFormat, in the Exif IFD (EXIF 2.32, tag 0xA405). */
export const FOCAL_35MM_TAG = 0xa405;

/**
 * How much of the file is read: a JPEG keeps its EXIF in an APP1 segment
 * near the start, and a segment holds at most 64 KB. 128 KB leaves room for
 * the segments that may come before it.
 */
export const EXIF_READ_BYTES = 128 * 1024;

/**
 * The 35 mm equivalent focal length recorded in a photo, in millimetres, or
 * null when the photo records none: photos that come through messaging apps
 * usually have no EXIF (PLANO.md §3.1), and an unknown focal length is
 * recorded as 0.
 *
 * exifr's mini build (MIT, about 29 KB, JPEG and TIFF) reads it. It has no
 * tag names, so the tag is asked for, and found, by its number. It is loaded
 * here, on the first photo, so the first paint does not wait for it.
 */
export async function focal35mmFromExif(file: Blob): Promise<number | null> {
  try {
    const head = await file.slice(0, EXIF_READ_BYTES).arrayBuffer();
    const { default: exifr } = await import('exifr/dist/mini.esm.mjs');
    const tags = (await exifr.parse(head, { exif: { pick: [FOCAL_35MM_TAG] } })) as
      Record<number, unknown> | undefined;
    const value = tags?.[FOCAL_35MM_TAG];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    // No EXIF, or EXIF exifr cannot read: the same as none, for the focal.
    return null;
  }
}
