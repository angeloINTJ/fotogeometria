/**
 * The editor (PLANO.md §4, screen 2; §8, stage 3: every control changes the
 * preview). What the preview shows is read from screenshots of the canvas:
 * the same correction draws the same pixels, so a picture that comes back
 * byte for byte is the same correction.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { jpeg } from './photos';

const GRID = 'tests/fixtures/grid-960x1280.png';
const GALLERY = 'input[type=file]:not([capture])';

test.use({ locale: 'pt-BR' });

/** What the preview shows, as PNG bytes. */
const shot = (page: Page) => page.locator('canvas').screenshot();

/** Two frames: whatever changed has been drawn. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

/** Opens the synthetic grid and returns the preview's first picture. */
async function openGrid(page: Page, path = './'): Promise<Buffer> {
  await page.goto(path);
  await page.locator(GALLERY).setInputFiles(GRID);
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
  await frames(page);
  return shot(page);
}

/** Waits until the preview shows something other than `before`, and returns it. */
async function changedFrom(page: Page, before: Buffer): Promise<Buffer> {
  let now = before;
  await expect
    .poll(async () => {
      now = await shot(page);
      return now.equals(before);
    })
    .toBe(false);
  return now;
}

/** Waits until the preview shows `expected` again. */
async function showsAgain(page: Page, expected: Buffer): Promise<void> {
  await expect.poll(async () => (await shot(page)).equals(expected)).toBe(true);
}

test('shows one tool at a time, and the arrows move along the tabs', async ({ page }) => {
  await openGrid(page);
  const tab = (name: string) => page.getByRole('tab', { name });
  await expect(tab('Nivelar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Inclinação')).toBeVisible();
  await expect(page.getByLabel('Panini')).toBeHidden();

  await tab('Nivelar').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Bordas')).toBeFocused();
  await expect(tab('Bordas')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Panini')).toBeVisible();
  await expect(page.getByLabel('Inclinação')).toBeHidden();
  await page.keyboard.press('End');
  await expect(tab('Lente')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(tab('Nivelar')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab('Lente')).toHaveAttribute('aria-selected', 'true');
});

for (const [tool, label, end] of [
  ['Nivelar', 'Inclinação', '+25,0°'],
  ['Nivelar', 'Rotação', '+15,0°'],
  ['Bordas', 'Panini', '100%'],
  ['Bordas', 'Compressão vertical', '100%'],
  ['Lente', 'Focal equivalente', '60 mm'],
] as const) {
  test(`changes the preview with ${label}`, async ({ page }) => {
    const before = await openGrid(page);
    await page.getByRole('tab', { name: tool }).click();
    const slider = page.getByLabel(label);
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuetext', end);
    await changedFrom(page, before);
  });
}

test('changes the preview with the lens presets', async ({ page }) => {
  const before = await openGrid(page);
  await page.getByRole('tab', { name: 'Lente' }).click();
  await expect(page.getByRole('button', { name: '0,5x' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '2x' }).click();
  await expect(page.getByRole('button', { name: '2x' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Focal equivalente')).toHaveAttribute('aria-valuetext', '48 mm');
  await changedFrom(page, before);
});

test('undoes one change at a time, and restores the defaults', async ({ page }) => {
  const start = await openGrid(page);
  const undoButton = page.getByRole('button', { name: 'Desfazer' });
  await expect(undoButton).toBeDisabled();
  await page.getByRole('tab', { name: 'Bordas' }).click();
  await page.getByLabel('Panini').focus();
  await page.keyboard.press('Home');
  const flat = await changedFrom(page, start);
  await page.getByLabel('Compressão vertical').focus();
  await page.keyboard.press('Home');
  await changedFrom(page, flat);

  await undoButton.click();
  await showsAgain(page, flat);
  await undoButton.click();
  await showsAgain(page, start);
  await expect(undoButton).toBeDisabled();

  await page.getByLabel('Panini').focus();
  await page.keyboard.press('End');
  await page.getByRole('tab', { name: 'Nivelar' }).click();
  await page.getByLabel('Inclinação').focus();
  await page.keyboard.press('Home');
  await changedFrom(page, start);
  await page.getByRole('button', { name: 'Restaurar padrões' }).click();
  await showsAgain(page, start);
  // Restoring is a change too, and undo takes it back.
  await expect(undoButton).toBeEnabled();
});

test('shows the original while the preview is held, and the correction after', async ({ page }) => {
  const corrected = await openGrid(page);
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const original = await changedFrom(page, corrected);
  await expect(canvas).toHaveAttribute('aria-label', 'A foto original');
  await page.mouse.up();
  await showsAgain(page, corrected);

  // The same from the keyboard, with the button.
  const button = page.getByRole('button', { name: 'Ver original' });
  await button.focus();
  await page.keyboard.down('Space');
  await showsAgain(page, original);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Space');
  await showsAgain(page, corrected);
  await page.keyboard.down('Enter');
  await showsAgain(page, original);
  await page.keyboard.up('Enter');
  await showsAgain(page, corrected);
});

test('takes a slider dragged as one change', async ({ page }) => {
  await openGrid(page);
  const slider = page.getByLabel('Inclinação');
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  // The thumb starts in the middle, at 0°; twenty moves drag it right.
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width / 2 + i * 4, y);
  await page.mouse.up();
  await expect(slider).not.toHaveAttribute('aria-valuetext', '0,0°');
  const undoButton = page.getByRole('button', { name: 'Desfazer' });
  await undoButton.click();
  await expect(slider).toHaveAttribute('aria-valuetext', '0,0°');
  await expect(undoButton).toBeDisabled();
});

test('lays the grid over the preview, and keeps it on for the next visit', async ({ page }) => {
  await openGrid(page);
  const gridButton = page.getByRole('button', { name: 'Grade' });
  await expect(page.locator('svg.grade')).toBeHidden();
  await gridButton.click();
  await expect(gridButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('svg.grade')).toBeVisible();
  await openGrid(page);
  await expect(page.locator('svg.grade')).toBeVisible();
});

test('keeps the edges as they were left for the next photo', async ({ page }) => {
  await openGrid(page);
  await page.getByRole('tab', { name: 'Bordas' }).click();
  await page.getByLabel('Panini').focus();
  await page.keyboard.press('Home');
  await expect(page.getByLabel('Panini')).toHaveAttribute('aria-valuetext', '0%');
  await openGrid(page);
  await page.getByRole('tab', { name: 'Bordas' }).click();
  await expect(page.getByLabel('Panini')).toHaveAttribute('aria-valuetext', '0%');
  // The levelling belongs to one photo, and starts again with the next.
  await page.getByRole('tab', { name: 'Nivelar' }).click();
  await expect(page.getByLabel('Inclinação')).toHaveAttribute('aria-valuetext', '0,0°');
});

test('says it could not read the focal length of a PNG', async ({ page }) => {
  await openGrid(page);
  await page.getByRole('tab', { name: 'Lente' }).click();
  await expect(
    page.getByText(
      'Não foi possível ler a focal desta foto: escolha a lente com que ela foi feita.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Focal equivalente')).toHaveAttribute('aria-valuetext', '13 mm');
});

test('opens a photo at the focal length its EXIF records, or says it records none', async ({
  page,
}) => {
  await page.goto('./');
  const buffer = await jpeg(page, 400, 300, { focal35mm: 24 });
  await page.locator(GALLERY).setInputFiles({ name: 'lens.jpg', mimeType: 'image/jpeg', buffer });
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('tab', { name: 'Lente' }).click();
  await expect(page.getByLabel('Focal equivalente')).toHaveAttribute('aria-valuetext', '24 mm');
  await expect(page.getByRole('button', { name: '1x' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('A foto informa 24 mm.')).toBeVisible();

  const plain = await jpeg(page, 400, 300);
  await page
    .locator(GALLERY)
    .setInputFiles({ name: 'plain.jpg', mimeType: 'image/jpeg', buffer: plain });
  await expect(page.getByLabel('Focal equivalente')).toHaveAttribute('aria-valuetext', '13 mm');
  await expect(
    page.getByText('A foto não informa a focal: escolha a lente com que ela foi feita.'),
  ).toBeVisible();
});

test('takes a photo with the camera, and its button says it is opening', async ({ page }) => {
  // Decoding waits for the test, so the opening state can be seen.
  await page.addInitScript(() => {
    const decode = window.createImageBitmap.bind(window);
    const held = window as unknown as { release?: () => void };
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await new Promise<void>((resolve) => (held.release = resolve));
      return decode(...args);
    }) as typeof createImageBitmap;
  });
  await page.goto('./');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Tirar foto' }).click();
  const camera = await chooser;
  // capture asks a phone for its camera; a computer opens its files.
  expect(await camera.element().getAttribute('capture')).toBe('environment');
  await camera.setFiles(GRID);
  await expect(page.getByRole('button', { name: 'Abrindo a foto…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Escolher foto' })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { release: () => void }).release());
  await expect(page.locator('#app')).toHaveAttribute('data-state', 'ready');
});

/** The frames per second ?medir reports, once it reports. */
async function measured(page: Page): Promise<number> {
  const line = page.getByText(/^Prévia a \d+ quadros por segundo/);
  await expect(line).toBeVisible({ timeout: 15_000 });
  return Number(/(\d+) quadros/.exec((await line.textContent())!)![1]);
}

test('measures how fast the preview follows moving controls (?medir)', async ({ page }) => {
  await openGrid(page, './?medir');
  const fps = await measured(page);
  console.log('measured', fps);
  // A number from frames drawn; how high depends on the machine: 60 here,
  // 31 on CI's runner, on 2026-11-26. The next test holds what matters.
  expect(fps).toBeGreaterThan(0);
  // The parameters come back as they were.
  await page.getByRole('tab', { name: 'Bordas' }).click();
  await expect(page.getByLabel('Panini')).toHaveAttribute('aria-valuetext', '70%');
});

test('and never counts more frames than they cost: 40 ms each, 25 at most', async ({ page }) => {
  await page.addInitScript(() => {
    // Called below with the context as `this`, so it is not left unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const drawArrays = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      const start = performance.now();
      while (performance.now() - start < 40);
      drawArrays.apply(this, args);
    };
  });
  await openGrid(page, './?medir');
  const fps = await measured(page);
  console.log('measured, 40 ms slower', fps);
  // 1000 / 40: on any machine. Measured 24 here and 21 on CI.
  expect(fps).toBeLessThanOrEqual(25);
});

test('and does not count a measurement the page was hidden for', async ({ page }) => {
  await openGrid(page, './?medir');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(
    page.getByText(
      'Não foi possível medir a prévia: deixe a página visível e abra a foto de novo.',
    ),
  ).toBeVisible({ timeout: 15_000 });
});

test('nor one during which the GPU took the context away', async ({ page }) => {
  await openGrid(page, './?medir');
  await page.evaluate(() => {
    document
      .querySelector('canvas')!
      .getContext('webgl2')!
      .getExtension('WEBGL_lose_context')!
      .loseContext();
  });
  await expect(
    page.getByText(
      'Não foi possível medir a prévia: deixe a página visível e abra a foto de novo.',
    ),
  ).toBeVisible({ timeout: 15_000 });
});
