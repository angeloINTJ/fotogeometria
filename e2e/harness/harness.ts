/**
 * The browser tests' side of the GPU checks (e2e/gl.spec.ts).
 *
 * It renders with the app's own Renderer and the app's own uniforms, and
 * compares in the page, returning only the measurements: the megabytes of a
 * full-resolution read-back never cross to the test runner.
 */
import type { CorrectionParams } from '../../src/core/correction';
import { DEFAULT_PARAMS, buildProjection } from '../../src/core/correction';
import { focal35mm, makeCamera } from '../../src/core/camera';
import { isInside, sourcePoint } from '../../src/core/framing';
import { vanishingPointFromAngles } from '../../src/core/leveling';
import { Renderer, topRowFirst } from '../../src/gl/renderer';
import { pixelView, reprojectionUniforms } from '../../src/gl/uniforms';
import parity from '../../tests/fixtures/parity.json';
import correctedUrl from '../../tests/fixtures/grid-960x1280-corrected.png';
import gridUrl from '../../tests/fixtures/grid-960x1280.png';

interface Case {
  name: string;
  width: number;
  height: number;
  focal: number;
  vanishingPoint: [number, number, number];
  strength: number;
  paniniD: number;
  compression: number;
  samples: Array<[number, number, number, number]>;
}

const cases = parity.cases as unknown as Case[];
const reference = cases[0];

/** RGBA, row-major, top row first. */
interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

// The synthetic grid (scripts/generate_fixtures.py, synthetic_grid): grey 40
// between the lines, 220 on them; vertical lines in red, horizontal in blue,
// green 40 everywhere.
const BACKGROUND = 40;
const RED = 0;
const GREEN = 1;
const BLUE = 2;
/** Midway between the background and a line. */
const THRESHOLD = 130;
/** A run brighter than the threshold and this wide or wider is not a line across. */
const MAX_RUN = 12;

async function bitmapOf(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  return createImageBitmap(await response.blob());
}

/** A PNG's pixels, as decoded by the browser. */
async function pixelsOf(url: string): Promise<Pixels> {
  const bitmap = await bitmapOf(url);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: bitmap.width, height: bitmap.height, data };
}

function paramsOf(c: Case, overrides: Partial<CorrectionParams> = {}): CorrectionParams {
  return {
    ...DEFAULT_PARAMS,
    focal35mm: focal35mm(c.focal, c.width, c.height),
    vanishingPoint: c.vanishingPoint,
    strength: c.strength,
    paniniD: c.paniniD,
    verticalCompression: c.compression,
    ...overrides,
  };
}

/**
 * A renderer holding the synthetic grid, and a parity case's correction
 * viewed at full resolution.
 *
 * @param shift moves the view by this many output pixels: a negative control
 */
async function prepare(
  overrides: Partial<CorrectionParams>,
  c: Case,
  shift: readonly [number, number] = [0, 0],
) {
  const renderer = new Renderer(document.createElement('canvas'));
  renderer.setSource(await bitmapOf(gridUrl));
  const correction = buildProjection(paramsOf(c, overrides), c.width, c.height);
  const { width, height } = correction.framing;
  const view = pixelView({ x: shift[0], y: shift[1], width, height });
  return { renderer, correction, view, width, height };
}

/** The colour the shader draws for a parity case, read back. */
async function renderColor(
  overrides: Partial<CorrectionParams> = {},
  c: Case = reference,
  shift: readonly [number, number] = [0, 0],
): Promise<Pixels> {
  const { renderer, correction, view, width, height } = await prepare(overrides, c, shift);
  const uniforms = reprojectionUniforms(correction, view, { mode: 'color', margin: 0 });
  const read = renderer.readPixels(uniforms, width, height, 'rgba8');
  renderer.dispose();
  return read;
}

/** The source coordinates the shader samples for a parity case, read back. */
async function renderCoordinates(c: Case) {
  const { renderer, correction, view, width, height } = await prepare({}, c);
  const uniforms = reprojectionUniforms(correction, view, { mode: 'coordinates', margin: 0 });
  const read = renderer.readPixels(uniforms, width, height, 'float');
  renderer.dispose();
  return read;
}

/**
 * The shader's source coordinates against the reference's, at its 21 x 21
 * samples of a parity case: the worst difference in u or v, where it is
 * ([px, py, du, dv]), and the median.
 */
async function coordinates(index: number) {
  const c = cases[index];
  const read = await renderCoordinates(c);
  const errors: number[] = [];
  let worst = 0;
  let worstAt: number[] = [];
  let behind = 0;
  for (const [px, py, u, v] of c.samples) {
    const i = (py * read.width + px) * 4;
    if (u === -1 && v === -1) {
      behind++;
      continue;
    }
    const du = read.data[i] - u;
    const dv = read.data[i + 1] - v;
    const e = Math.max(Math.abs(du), Math.abs(dv));
    errors.push(e);
    if (e > worst) {
      worst = e;
      worstAt = [px, py, du, dv];
    }
  }
  errors.sort((a, b) => a - b);
  return {
    name: c.name,
    worst,
    worstAt,
    median: errors[errors.length >> 1],
    samples: c.samples.length,
    behind,
    size: [read.width, read.height],
  };
}

/**
 * A scene where some output pixels look behind the source camera: pitched
 * 40° down, rolled 10°, with the classic Panini and full compression, so the
 * framing reaches past the source's horizon (1381 x 621, 2.5% of it behind,
 * on 2026-11-26). The parity cases have none.
 */
const BEHIND: Case = (() => {
  const camera = makeCamera(1000, 750, 375);
  return {
    name: 'behind-the-camera',
    width: 1000,
    height: 750,
    focal: 375,
    vanishingPoint: [...vanishingPointFromAngles(camera, 40, 10)] as [number, number, number],
    strength: 1,
    paniniD: 1,
    compression: 1,
    samples: [],
  };
})();

/**
 * Every output pixel's source position, the shader's against src/core's
 * (which holds the reference's to 1e-6 px): how many pixels the two place
 * differently behind the camera, or inside and outside the photo, and the
 * worst difference where a pixel samples the photo or comes within 2 px of
 * it. Farther out, near the horizon, f · x / z grows without bound, single
 * precision keeps only its relative error (851 px off, at worst, on
 * 2026-11-26), and the pixel is drawn empty either way.
 */
async function everyPixel(scene: 'reference-case' | 'behind-the-camera') {
  const c = scene === 'reference-case' ? reference : BEHIND;
  const read = await renderCoordinates(c);
  const { projection, framing } = buildProjection(paramsOf(c), c.width, c.height);
  let worst = 0;
  let compared = 0;
  let behind = 0;
  let behindDisagree = 0;
  let insideDisagree = 0;
  for (let py = 0; py < read.height; py++) {
    for (let px = 0; px < read.width; px++) {
      const i = (py * read.width + px) * 4;
      const [u, v, inside] = [read.data[i], read.data[i + 1], read.data[i + 2]];
      const gpuBehind = u === -1 && v === -1 && inside === 0;
      const cpu = sourcePoint(projection, framing, px, py);
      if (!cpu) behind++;
      if (gpuBehind !== (cpu === null)) behindDisagree++;
      if (!cpu || gpuBehind) continue;
      if ((inside === 1) !== isInside(projection.camera, cpu[0], cpu[1], 0)) insideDisagree++;
      if (!isInside(projection.camera, cpu[0], cpu[1], -2)) continue;
      compared++;
      worst = Math.max(worst, Math.abs(u - cpu[0]), Math.abs(v - cpu[1]));
    }
  }
  return {
    scene,
    pixels: read.width * read.height,
    size: [read.width, read.height],
    behind,
    behindDisagree,
    insideDisagree,
    compared,
    worst,
  };
}

/** One channel along a row (or a column) of an image. */
function profile(image: Pixels, channel: number, along: 'row' | 'column', index: number) {
  const n = along === 'row' ? image.width : image.height;
  const values = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const x = along === 'row' ? k : index;
    const y = along === 'row' ? index : k;
    values[k] = image.data[(y * image.width + x) * 4 + channel];
  }
  return values;
}

/**
 * The centres of the lines that cross a profile: runs above the threshold and
 * narrower than MAX_RUN, each centred by its intensity above the background,
 * over the run and two pixels each side. Centres move by fractions of a
 * pixel, so they show offsets far smaller than a pixel. Only runs whose
 * surroundings the shader drew count.
 */
function centres(values: Float64Array, drawn: Float64Array): number[] {
  const out: number[] = [];
  let start = -1;
  for (let k = 0; k <= values.length; k++) {
    const bright = k < values.length && values[k] > THRESHOLD;
    if (bright && start < 0) start = k;
    if (!bright && start >= 0) {
      const from = start - 2;
      const to = k + 2;
      if (k - start < MAX_RUN && from >= 0 && to <= values.length) {
        let weight = 0;
        let sum = 0;
        let whole = true;
        for (let m = from; m < to; m++) {
          whole &&= drawn[m] === 255;
          const w = Math.max(0, values[m] - BACKGROUND);
          weight += w;
          sum += w * m;
        }
        if (whole) out.push(sum / weight);
      }
      start = -1;
    }
  }
  return out;
}

/** For each centre of `found`, the offset to the nearest of `expected`, if within 2 px. */
function offsets(found: number[], expected: number[]): { matched: number[]; unmatched: number } {
  const matched: number[] = [];
  let unmatched = 0;
  for (const x of found) {
    let best = Infinity;
    for (const e of expected) if (Math.abs(e - x) < Math.abs(best)) best = e - x;
    if (Math.abs(best) <= 2) matched.push(best);
    else unmatched++;
  }
  return { matched, unmatched };
}

function summary(values: number[], unmatched: number) {
  const absolute = values.map(Math.abs);
  return {
    matched: values.length,
    unmatched,
    worst: Math.max(0, ...absolute),
    mean: absolute.reduce((a, b) => a + b, 0) / Math.max(1, absolute.length),
  };
}

/**
 * The shader's image of the synthetic grid against the reference's (OpenCV's
 * remap, Lanczos): where the lines are, and the colour between them.
 *
 * The two resample differently (the GPU bilinear with mipmaps, OpenCV with
 * an 8 x 8 Lanczos kernel), so their pixels differ on every edge; a line's
 * centre does not depend on the filter, and its position is what the
 * correction is about. The vertical lines are found in red along every 8th
 * row, the horizontal ones in blue along every 8th column.
 *
 * @param shift renders half a pixel off, or any amount: the negative control
 */
async function lines(shift: readonly [number, number] = [0, 0]) {
  const read = await renderColor({}, reference, shift);
  const expected = await pixelsOf(correctedUrl);
  const vertical: number[] = [];
  const horizontal: number[] = [];
  let unmatchedV = 0;
  let unmatchedH = 0;
  for (let y = 0; y < read.height; y += 8) {
    const drawn = profile(read, 3, 'row', y);
    const o = offsets(
      centres(profile(read, RED, 'row', y), drawn),
      centres(profile(expected, RED, 'row', y), drawn),
    );
    vertical.push(...o.matched);
    unmatchedV += o.unmatched;
  }
  for (let x = 0; x < read.width; x += 8) {
    const drawn = profile(read, 3, 'column', x);
    const o = offsets(
      centres(profile(read, BLUE, 'column', x), drawn),
      centres(profile(expected, BLUE, 'column', x), drawn),
    );
    horizontal.push(...o.matched);
    unmatchedH += o.unmatched;
  }
  // Green is 40 in the whole grid: wherever the shader drew, it must be 40.
  let greenWorst = 0;
  let drawnCount = 0;
  for (let i = 0; i < read.data.length; i += 4) {
    if (read.data[i + 3] !== 255) continue;
    drawnCount++;
    greenWorst = Math.max(greenWorst, Math.abs(read.data[i + GREEN] - BACKGROUND));
  }
  return {
    vertical: summary(vertical, unmatchedV),
    horizontal: summary(horizontal, unmatchedH),
    green: { drawn: drawnCount, worst: greenWorst },
  };
}

/**
 * How far the facade's vertical lines lean in the shader's output: the centre
 * of each line on two rows, matched to the nearest line within maxShift px.
 * Over 490 rows a tenth of a pixel is 0.01°.
 *
 * @param strength the levelling strength to render with
 * @param rows the two rows, as fractions of the output height
 */
async function verticals(strength: number, rows: [number, number], maxShift: number) {
  const read = await renderColor({ strength });
  const top = Math.round(read.height * rows[0]);
  const bottom = Math.round(read.height * rows[1]);
  const at = (y: number) => centres(profile(read, RED, 'row', y), profile(read, 3, 'row', y));
  const below = at(bottom);
  let worst = 0;
  let matched = 0;
  for (const x of at(top)) {
    const nearest = below.reduce(
      (best, y) => (Math.abs(y - x) < Math.abs(best - x) ? y : best),
      Infinity,
    );
    if (Math.abs(nearest - x) > maxShift) continue;
    matched++;
    worst = Math.max(worst, (Math.abs(Math.atan2(nearest - x, bottom - top)) * 180) / Math.PI);
  }
  return { matched, worst };
}

/**
 * The canvas path (the default framebuffer, rows flipped) against the
 * read-back path: the preview must show exactly what the export reads.
 */
async function canvasMatchesReadBack() {
  const canvas = document.createElement('canvas');
  const renderer = new Renderer(canvas);
  renderer.setSource(await bitmapOf(gridUrl));
  const correction = buildProjection(paramsOf(reference), reference.width, reference.height);
  const { width, height } = correction.framing;
  canvas.width = width;
  canvas.height = height;
  const view = pixelView({ x: 0, y: 0, width, height });
  renderer.draw(reprojectionUniforms(correction, view));
  // Read in the same task as the draw: the drawing buffer is still there.
  const gl = canvas.getContext('webgl2')!;
  const bottomUp = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
  const shown = topRowFirst(bottomUp, width, height);
  const read = renderer.readPixels(reprojectionUniforms(correction, view), width, height, 'rgba8');
  renderer.dispose();
  let differing = 0;
  let drawn = 0;
  for (let k = 0; k < read.data.length; k++) {
    if (shown[k] !== read.data[k]) differing++;
    if (k % 4 === 3 && read.data[k] === 255) drawn++;
  }
  return { differing, drawn, size: [width, height] };
}

declare global {
  interface Window {
    harness: {
      coordinates: typeof coordinates;
      lines: typeof lines;
      verticals: typeof verticals;
      canvasMatchesReadBack: typeof canvasMatchesReadBack;
      everyPixel: typeof everyPixel;
    };
  }
}

window.harness = { coordinates, lines, verticals, canvasMatchesReadBack, everyPixel };
document.title = 'harness ready';
