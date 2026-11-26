/**
 * Test photos made on the spot, so no binary joins the repository: the
 * browser encodes a JPEG of flat grey, and the EXIF goes in here, as an APP1
 * segment right after the start of the image (the browser's encoder writes
 * none).
 */
import type { Page } from '@playwright/test';

/** What the EXIF records. */
export interface Exif {
  /** The orientation tag (0x0112): 6 turns the image a quarter clockwise. */
  readonly orientation?: number;
  /** FocalLengthIn35mmFormat (0xA405), in the Exif IFD. */
  readonly focal35mm?: number;
}

const u16 = (v: number) => [v >> 8, v & 0xff];
const u32 = (v: number) => [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];

/** A TIFF directory entry of one value, big-endian, the value left-aligned. */
function entry(tag: number, type: 3 | 4, value: number): number[] {
  const field = type === 3 ? [...u16(value), 0, 0] : u32(value);
  return [...u16(tag), ...u16(type), ...u32(1), ...field];
}

/**
 * An APP1 Exif segment: a big-endian TIFF header; IFD0 with the orientation
 * and, for the focal length, the Exif IFD's offset; then the Exif IFD.
 */
export function exifSegment(exif: Exif): Buffer {
  const ifd0: number[][] = [];
  if (exif.orientation !== undefined) ifd0.push(entry(0x0112, 3, exif.orientation));
  const entries = ifd0.length + (exif.focal35mm !== undefined ? 1 : 0);
  // The Exif IFD follows IFD0: the 8-byte header, the count, the entries, the next offset.
  const exifOffset = 8 + 2 + 12 * entries + 4;
  if (exif.focal35mm !== undefined) ifd0.push(entry(0x8769, 4, exifOffset));
  const tiff = [
    0x4d,
    0x4d,
    ...u16(0x2a),
    ...u32(8),
    ...u16(ifd0.length),
    ...ifd0.flat(),
    ...u32(0),
  ];
  if (exif.focal35mm !== undefined) {
    tiff.push(...u16(1), ...entry(0xa405, 3, exif.focal35mm), ...u32(0));
  }
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return Buffer.from([0xff, 0xe1, ...u16(body.length + 2), ...body]);
}

/** A width x height JPEG of flat grey, encoded by the page's browser, with this EXIF. */
export async function jpeg(page: Page, width: number, height: number, exif: Exif = {}) {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'gray';
      context.fillRect(0, 0, w, h);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return url.slice(url.indexOf(',') + 1);
    },
    [width, height] as const,
  );
  const encoded = Buffer.from(base64, 'base64');
  if (exif.orientation === undefined && exif.focal35mm === undefined) return encoded;
  return Buffer.concat([encoded.subarray(0, 2), exifSegment(exif), encoded.subarray(2)]);
}
