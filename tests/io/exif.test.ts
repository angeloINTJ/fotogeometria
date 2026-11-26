/**
 * The focal length from EXIF (src/io/exif.ts), read from JPEGs built here: a
 * start of image, an APP1 segment with a TIFF header, IFD0 pointing to the
 * Exif IFD, FocalLengthIn35mmFormat in it, and an end of image. exifr reads
 * the segments, not the picture, so no picture is needed.
 */
import { describe, expect, it } from 'vitest';
import { FOCAL_35MM_TAG, focal35mmFromExif } from '../../src/io/exif';

/**
 * FocalLengthIn35mmFormat, from the EXIF standard (2.32, table 8), written
 * here rather than taken from src/io/exif.ts: a test that built its JPEG
 * with the code's own constant would agree with any tag the code read.
 */
const SPEC_FOCAL_35MM_TAG = 0xa405;

/** Two bytes, or four, in the TIFF's byte order. */
function bytes(value: number, size: 2 | 4, bigEndian: boolean): number[] {
  const out =
    size === 2
      ? [value >> 8, value & 0xff]
      : [value >>> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  return bigEndian ? out : out.reverse();
}

/** A JPEG whose EXIF records this 35 mm focal length. */
function jpegWithFocal(mm: number, bigEndian = true): Blob {
  const b = (value: number, size: 2 | 4) => bytes(value, size, bigEndian);
  const tiff = [
    ...(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49]),
    ...b(0x2a, 2),
    ...b(8, 4),
    // IFD0: one entry, the Exif IFD's offset (LONG), then no next IFD.
    ...b(1, 2),
    ...b(0x8769, 2),
    ...b(4, 2),
    ...b(1, 4),
    ...b(26, 4),
    ...b(0, 4),
    // The Exif IFD, at 26: FocalLengthIn35mmFormat (SHORT), then no next IFD.
    ...b(1, 2),
    ...b(SPEC_FOCAL_35MM_TAG, 2),
    ...b(3, 2),
    ...b(1, 4),
    ...b(mm, 2),
    0,
    0,
    ...b(0, 4),
  ];
  const app1 = [0xff, 0xe1, 0, 2 + 6 + tiff.length, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return new Blob([new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xd9])]);
}

describe('focal35mmFromExif', () => {
  it("asks for the standard's tag", () => {
    expect(FOCAL_35MM_TAG).toBe(SPEC_FOCAL_35MM_TAG);
  });

  it('reads the 35 mm equivalent focal length', async () => {
    expect(await focal35mmFromExif(jpegWithFocal(24))).toBe(24);
    expect(await focal35mmFromExif(jpegWithFocal(13))).toBe(13);
  });

  it('reads it in either byte order', async () => {
    expect(await focal35mmFromExif(jpegWithFocal(26, false))).toBe(26);
  });

  it('takes a focal length of 0, unknown in EXIF, as none', async () => {
    expect(await focal35mmFromExif(jpegWithFocal(0))).toBeNull();
  });

  it('gives none for a JPEG without EXIF, or a file that is not a JPEG', async () => {
    expect(
      await focal35mmFromExif(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])])),
    ).toBeNull();
    expect(await focal35mmFromExif(new Blob(['not an image']))).toBeNull();
  });
});
