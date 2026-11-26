/**
 * The app itself, as a person uses it (PLANO.md §7, "Fumaça", as far as
 * stage 2 goes): open the page, choose a photo, see it corrected.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const GRID = 'tests/fixtures/grid-960x1280.png';

/** Fails the test on anything the page logs as an error, or throws. */
function watchErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));
  return problems;
}

/**
 * What the preview shows on screen: the share of its pixels that are the
 * grid's red verticals and blue horizontals (each covers about 6% of the
 * grid, letterboxed in the page's background).
 */
async function shownLines(page: Page): Promise<{ red: number; blue: number }> {
  const shot = await page.locator('canvas').screenshot();
  return page.evaluate(async (png) => {
    const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let red = 0;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] - data[i + 1] > 40) red++;
      if (data[i + 2] - data[i + 1] > 40) blue++;
    }
    return { red: red / (data.length / 4), blue: blue / (data.length / 4) };
  }, shot.toString('base64'));
}

/**
 * A JPEG made in the page: width x height of flat grey, with an EXIF
 * orientation when one is given. The browser's encoder writes no EXIF, so
 * an APP1 segment goes in right after the start of the image: a big-endian
 * TIFF header and one entry, Orientation (0x0112), a SHORT.
 */
async function jpeg(page: Page, width: number, height: number, orientation?: number) {
  const base64 = await page.evaluate(
    async ([w, h, o]) => {
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'gray';
      context.fillRect(0, 0, w, h);
      let bytes = new Uint8Array(
        await (await canvas.convertToBlob({ type: 'image/jpeg' })).arrayBuffer(),
      );
      if (o) {
        const app1 = [
          0xff,
          0xe1,
          0x00,
          0x22,
          0x45,
          0x78,
          0x69,
          0x66,
          0x00,
          0x00,
          0x4d,
          0x4d,
          0x00,
          0x2a,
          0x00,
          0x00,
          0x00,
          0x08,
          0x00,
          0x01,
          0x01,
          0x12,
          0x00,
          0x03,
          0x00,
          0x00,
          0x00,
          0x01,
          0x00,
          o,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
        ];
        const out = new Uint8Array(bytes.length + app1.length);
        out.set(bytes.subarray(0, 2));
        out.set(app1, 2);
        out.set(bytes.subarray(2), 2 + app1.length);
        bytes = out;
      }
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(new Blob([bytes]));
      });
      return url.slice(url.indexOf(',') + 1);
    },
    [width, height, orientation ?? 0] as const,
  );
  return Buffer.from(base64, 'base64');
}

test.describe('in Brazilian Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('opens a photo and shows it corrected', async ({ page }) => {
    const problems = watchErrors(page);
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'FotoGeometria' })).toBeVisible();
    await expect(page.getByText('Suas fotos não saem do aparelho.')).toBeVisible();
    const choose = page.getByRole('button', { name: 'Escolher foto' });
    await expect(choose).toBeEnabled();

    await page.locator('input[type=file]').setInputFiles(GRID);
    await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByText('Foto aberta: 960 × 1280 px.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escolher outra foto' })).toBeFocused();

    // What the screen shows: the corrected grid, over the page's background.
    const canvas = page.getByRole('img', { name: 'Prévia da foto corrigida' });
    await expect(canvas).toBeVisible();
    // The preview draws in the frame after the photo opens.
    await expect.poll(async () => (await shownLines(page)).red).toBeGreaterThan(0.01);
    const seen = await shownLines(page);
    console.log('preview', JSON.stringify(seen));
    expect(seen.blue).toBeGreaterThan(0.01);
    expect(problems).toEqual([]);
  });

  test('says so when the file is not an image, and lets you choose again', async ({ page }) => {
    await page.goto('./');
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
    await expect(page.locator('#app')).toHaveAttribute('data-state', 'error');
    await expect(page.getByRole('alert')).toHaveText(
      'Não foi possível abrir este arquivo como imagem. Escolha uma foto em JPEG, PNG ou WebP.',
    );
    await expect(page.getByRole('button', { name: 'Escolher foto' })).toBeEnabled();
    await page.locator('input[type=file]').setInputFiles(GRID);
    await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
  });

  test('opens a photo upright, by its EXIF orientation', async ({ page }) => {
    await page.goto('./');
    // Stored 160 x 120, with the orientation that turns it a quarter
    // clockwise. Chromium applies a JPEG's orientation in createImageBitmap
    // whatever imageOrientation says: with 'none' this test still passed
    // (Chrome Headless Shell 159, 2026-11-26). So it holds the browser to
    // opening photos upright; load-image.ts asks for 'from-image' anyway,
    // for any browser that would not apply the orientation unasked.
    const buffer = await jpeg(page, 160, 120, 6);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'turned.jpg', mimeType: 'image/jpeg', buffer });
    await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByText('Foto aberta: 120 × 160 px.')).toBeVisible();
  });

  test('reduces a photo past 4096 x 4096 pixels, and says from what to what', async ({ page }) => {
    await page.goto('./');
    // 20 megapixels: past MAX_PIXELS, within SwiftShader's 8192 px textures,
    // so the area decides, keeping the proportion.
    const buffer = await jpeg(page, 5000, 4000);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer });
    await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
    await expect(
      page.getByText(
        'Foto aberta e reduzida de 5000 × 4000 para 4579 × 3663 px, o máximo que o FotoGeometria abre neste aparelho.',
      ),
    ).toBeVisible();
  });

  test('says so when the browser has no WebGL2', async ({ page }) => {
    await page.addInitScript(() => {
      // Called below with the canvas as `this`, so it is not left unbound.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const getContext = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error: the overloads of getContext cannot be restated here
      HTMLCanvasElement.prototype.getContext = function (kind: string, ...rest: unknown[]) {
        return kind === 'webgl2' ? null : getContext.call(this, kind, ...rest);
      };
    });
    await page.goto('./');
    await expect(page.getByRole('alert')).toHaveText(
      'Este navegador não oferece WebGL2, que o FotoGeometria usa para corrigir a foto. Abra a página num navegador atualizado.',
    );
    await expect(page.getByRole('button', { name: 'Escolher foto' })).toBeDisabled();
  });
});

test('draws the photo again after the GPU takes the context away (PLANO.md §6)', async ({
  page,
}) => {
  const problems = watchErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').setInputFiles(GRID);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
  // WEBGL_lose_context does to the page what a GPU reset, or a phone sending
  // the tab to the background, does: the context, its textures and its
  // program are gone until the browser gives the context back.
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const lose = gl.getExtension('WEBGL_lose_context')!;
    // The browser allows a restore only once it has dispatched the loss (a
    // task after the next frame) and seen that a listener kept the context
    // (the renderer's, with preventDefault), which it notes after the last
    // listener returns: so a task after the event, not a microtask
    // (Chrome 159, 2026-11-26).
    const lost = new Promise((resolve) => canvas.addEventListener('webglcontextlost', resolve));
    lose.loseContext();
    await lost;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!gl.isContextLost()) throw new Error('the context was not lost');
    lose.restoreContext();
  });
  await expect.poll(async () => (await shownLines(page)).red).toBeGreaterThan(0.01);
  expect(problems).toEqual([]);
});

for (const [locale, button] of [
  ['en-US', 'Choose photo'],
  ['es-ES', 'Elegir foto'],
  ['de-DE', 'Escolher foto'],
] as const) {
  test.describe(`with the device in ${locale}`, () => {
    test.use({ locale });

    test(`speaks its language, or Brazilian Portuguese: "${button}"`, async ({ page }) => {
      await page.goto('./');
      await expect(page.getByRole('button', { name: button })).toBeVisible();
    });
  });
}
