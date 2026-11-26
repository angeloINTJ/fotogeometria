import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests (e2e/), against a production build that also carries the test
 * harness (`vite build --mode harness`, into dist-harness/, never deployed).
 *
 * WebGL runs on SwiftShader, the CPU renderer, on every machine: CI runners
 * have no GPU, and a local GPU would give different last bits than CI. Set
 * PW_CHANNEL=chrome to use an installed Chrome instead of Playwright's
 * Chromium (`npx playwright install chromium`).
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/fotogeometria/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npx vite build --mode harness && npx vite preview --mode harness --port 4173 --strictPort',
    url: 'http://localhost:4173/fotogeometria/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
});
