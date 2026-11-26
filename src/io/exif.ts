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
 * What a photo says about its focal length. "none" and "unreadable" are told
 * apart on purpose: a photo that records nothing is a fact about the photo,
 * and a reader that could not read it is not.
 */
export type FocalReading =
  /** The 35 mm equivalent focal length the photo records, in millimetres. */
  | { readonly kind: 'recorded'; readonly mm: number }
  /** Its EXIF was read and records none, or 0, which EXIF uses for unknown. */
  | { readonly kind: 'none' }
  /**
   * Not read: a format the reader does not know (PNG, HEIC), EXIF it cannot
   * parse, or the reader itself failed to load.
   */
  | { readonly kind: 'unreadable' };

/** The focal length a reading gives, or null. */
export function recordedFocal(reading: FocalReading): number | null {
  return reading.kind === 'recorded' ? reading.mm : null;
}

/**
 * Reads the 35 mm equivalent focal length a photo records. Photos that come
 * through messaging apps usually have no EXIF (PLANO.md §3.1).
 *
 * exifr's mini build reads it (MIT; JPEG and TIFF; 27.6 KB once built). It
 * has no tag names, so the tag is asked for, and found, by its number. It is
 * loaded here, on the first photo, so the first paint does not wait for it.
 */
export async function focal35mmFromExif(file: Blob): Promise<FocalReading> {
  try {
    const head = await file.slice(0, EXIF_READ_BYTES).arrayBuffer();
    const { default: exifr } = await import('exifr/dist/mini.esm.mjs');
    const tags = (await exifr.parse(head, { exif: { pick: [FOCAL_35MM_TAG] } })) as
      (Record<number, unknown> & { errors?: unknown[] }) | undefined;
    const value = tags?.[FOCAL_35MM_TAG];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return { kind: 'recorded', mm: value };
    }
    // exifr gives a broken EXIF back as errors, without the tag.
    return tags?.errors?.length ? { kind: 'unreadable' } : { kind: 'none' };
  } catch {
    return { kind: 'unreadable' };
  }
}
