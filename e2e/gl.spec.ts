/**
 * The shader against the reference (PLANO.md §8, stage 2: "the preview of the
 * synthetic grid matches the output of the Python").
 *
 * The harness page (e2e/harness/) renders the synthetic grid of
 * tests/fixtures/ with the app's Renderer and compares in the page. Every
 * limit below sits between what the shader measured and what a defect
 * measured, on 2026-11-26 (Chrome 158 on SwiftShader); the measurements are
 * printed on each run.
 */
import { expect, test } from '@playwright/test';

// The callbacks given to page.evaluate run in the page, not here: they reach
// the harness through window (its type is declared in e2e/harness/harness.ts)
// and can use nothing of this file's scope.

test.beforeEach(async ({ page }) => {
  await page.goto('e2e/harness/index.html');
  await expect(page).toHaveTitle('harness ready');
});

// The four cases of tests/fixtures/parity.json, in its order.
const CASES = ['reference-case', 'landscape-rectilinear', 'portrait-tilted-up', 'no-levelling'];

for (const [index, name] of CASES.entries()) {
  test(`samples the source where the reference does: ${name}`, async ({ page }) => {
    const r = await page.evaluate((i) => window.harness.coordinates(i), index);
    console.log(`coordinates ${name}`, JSON.stringify(r));
    expect(r.name).toBe(name);
    // The plan's parity tolerance (PLANO.md §7). Measured: 0.00024 px at
    // worst; with the trigonometry on the GPU it was 0.139 px.
    expect(r.worst).toBeLessThan(0.01);
  });
}

for (const scene of ['reference-case', 'behind-the-camera'] as const) {
  test(`agrees with src/core on every pixel: ${scene}`, async ({ page }) => {
    const r = await page.evaluate((s) => window.harness.everyPixel(s), scene);
    console.log(`every pixel ${scene}`, JSON.stringify(r));
    // Measured: 0.00025 and 0.00016 px at worst over 1,063,246 and 573,193
    // pixels, and no pixel placed differently behind the camera (2308 of
    // them in the second scene) or inside the photo. A pixel within the
    // GPU's error of an edge may fall either way: about 2400 pixels lie on
    // the photo's edge, so a GPU could disagree on one or two.
    expect(r.compared).toBeGreaterThan(500_000);
    expect(r.worst).toBeLessThan(0.01);
    expect(r.behindDisagree).toBeLessThanOrEqual(5);
    expect(r.insideDisagree).toBeLessThanOrEqual(5);
    if (scene === 'behind-the-camera') expect(r.behind).toBeGreaterThan(1000);
  });
}

test('keeps the margin it is given: the reference counts the same pixels', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.everyPixel('reference-case', 1));
  console.log('every pixel, margin 1', JSON.stringify(r));
  // At a margin of 1 px the reference counts 1,054,636 valid pixels
  // (tests/fixtures/parity.json), and so did the shader on 2026-11-26; at
  // a margin of 0 it draws 1,057,625.
  expect(r.insideDisagree).toBeLessThanOrEqual(5);
  expect(Math.abs(r.inside - r.referenceValid!)).toBeLessThanOrEqual(5);
});

test('draws the photo itself, unchanged, as the before of before/after', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.original());
  console.log('original', JSON.stringify(r));
  expect(r.size).toEqual(r.photo);
  expect(r.differing).toBe(0);
});

test('filters through the mipmaps where it draws small (PLANO.md §6)', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.downscaled(8));
  console.log('downscaled', JSON.stringify(r));
  // Measured: 5.1 (red) and 5.4 (blue) levels from the reference averaged
  // over each target pixel; without the mipmaps, 11.1 and 11.4. The limit
  // does not tell trilinear filtering from bilinear between levels (5.7,
  // 6.0), nor the anisotropic filtering from its absence (6.3, 6.4): either
  // limit would sit within half a level of what the shader measures.
  expect(r.compared).toBeGreaterThan(10_000);
  expect(r.red).toBeLessThan(8);
  expect(r.blue).toBeLessThan(8);
});

test('draws the lines where the reference draws them', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.lines());
  console.log('lines', JSON.stringify(r));
  // Measured: 2760 vertical and 3257 horizontal line crossings, 1 unmatched
  // each, and mean offsets of 0.028 and 0.038 px from OpenCV's. Half a pixel
  // off measures 0.50 (the next test).
  expect(r.vertical.matched).toBeGreaterThan(2500);
  expect(r.horizontal.matched).toBeGreaterThan(3000);
  expect(r.vertical.unmatched + r.horizontal.unmatched).toBeLessThan(10);
  expect(r.vertical.mean).toBeLessThan(0.1);
  expect(r.horizontal.mean).toBeLessThan(0.1);
  // Green is 40 in the whole grid, so any change of colour, alpha or channel
  // order shows here. Measured: 0 over 1,057,625 pixels.
  expect(r.green.drawn).toBeGreaterThan(1_000_000);
  expect(r.green.worst).toBe(0);
});

test('and the comparison bites: half a pixel off, it measures half a pixel', async ({ page }) => {
  const right = await page.evaluate(() => window.harness.lines([0.5, 0]));
  const down = await page.evaluate(() => window.harness.lines([0, 0.5]));
  console.log('lines, half a pixel right', JSON.stringify(right));
  console.log('lines, half a pixel down', JSON.stringify(down));
  // Measured: 0.499 and 0.500 px.
  expect(right.vertical.mean).toBeGreaterThan(0.4);
  expect(right.vertical.mean).toBeLessThan(0.6);
  expect(down.horizontal.mean).toBeGreaterThan(0.4);
  expect(down.horizontal.mean).toBeLessThan(0.6);
});

test('shows on the canvas exactly what it reads back', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.canvasMatchesReadBack());
  console.log('canvas', JSON.stringify(r));
  expect(r.drawn).toBeGreaterThan(1_000_000);
  expect(r.differing).toBe(0);
});

test('keeps verticals vertical (PLANO.md §7: within 0.2°)', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.verticals(1, [0.3, 0.7], 15));
  console.log('verticals', JSON.stringify(r));
  // Measured: 15 lines, 0.015° at worst.
  expect(r.matched).toBeGreaterThan(10);
  expect(r.worst).toBeLessThan(0.2);
});

test('and the measurement bites: without the levelling they lean', async ({ page }) => {
  const r = await page.evaluate(() => window.harness.verticals(0, [0.45, 0.55], 25));
  console.log('verticals at strength 0', JSON.stringify(r));
  // Measured: 12.4°.
  expect(r.worst).toBeGreaterThan(1);
});
