import { defineConfig } from 'vitest/config';

/**
 * Where the app is served from. GitHub Pages publishes a project site under
 * /<repository>/, so the build defaults to that; a fork or a local preview can
 * override it with FG_BASE (for example FG_BASE=/ npm run build).
 */
const base = process.env.FG_BASE ?? '/fotogeometria/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: true,
    // Vite's modulepreload polyfill only starts a download early, and every
    // browser with WebGL2 that lacks modulepreload (Safari before 17) still
    // loads the modules without it. Leaving it out keeps the bundle to our own
    // code: it was 670 of the 854 B of JavaScript on 2026-11-25.
    modulePreload: { polyfill: false },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
