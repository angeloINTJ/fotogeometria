import { defineConfig } from 'vitest/config';

/**
 * Where the app is served from. GitHub Pages publishes a project site under
 * /<repository>/, so the build defaults to that; a fork or a local preview can
 * override it with FG_BASE (for example FG_BASE=/ npm run build).
 */
const base = process.env.FG_BASE ?? '/fotogeometria/';

export default defineConfig(({ mode }) => {
  // `vite build --mode harness` also builds the browser tests' harness page
  // (e2e/harness/), into a folder of its own: dist/ stays what is deployed
  // and what tools/check-budget.mjs measures.
  const harness = mode === 'harness';
  return {
    base,
    build: {
      target: 'es2022',
      sourcemap: true,
      outDir: harness ? 'dist-harness' : 'dist',
      // Vite's modulepreload polyfill only starts a download early, and every
      // browser with WebGL2 that lacks modulepreload (Safari before 17) still
      // loads the modules without it. Leaving it out keeps the bundle to our own
      // code: it was 670 of the 854 B of JavaScript on 2026-11-25.
      modulePreload: { polyfill: false },
      rolldownOptions: harness
        ? { input: { main: 'index.html', harness: 'e2e/harness/index.html' } }
        : {},
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
