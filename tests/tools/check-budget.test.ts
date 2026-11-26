/** tools/check-budget.mjs: sorting into categories, and both directions of a change. */
import { describe, expect, it } from 'vitest';
import { compare, measure } from '../../tools/check-budget.mjs';

const categories = {
  html: { match: '\\.html$', bytes: 100 },
  js: { match: '^assets/.*\\.js$', bytes: 1000 },
};

describe('measure', () => {
  it('sums by the first matching category and skips source maps', () => {
    const files = [
      { path: 'index.html', bytes: 100 },
      { path: 'assets/a.js', bytes: 600 },
      { path: 'assets/b.js', bytes: 400 },
      { path: 'assets/a.js.map', bytes: 5000 },
    ];
    expect(measure(files, categories)).toEqual({ sizes: { html: 100, js: 1000 }, unsorted: [] });
  });

  it('reports a file no category takes', () => {
    const { unsorted } = measure([{ path: 'stray.bin', bytes: 1 }], categories);
    expect(unsorted).toEqual(['stray.bin']);
  });
});

describe('compare', () => {
  it('passes on equality', () => {
    expect(compare({ html: 100, js: 1000 }, categories)).toEqual([]);
  });

  it('fails when a category grows, and when it shrinks', () => {
    expect(compare({ html: 100, js: 1001 }, categories)).toEqual([
      'js: 1001 B, recorded 1000 B (grew 1 B): record it with node tools/check-budget.mjs --write',
    ]);
    expect(compare({ html: 99, js: 1000 }, categories)).toHaveLength(1);
  });
});
