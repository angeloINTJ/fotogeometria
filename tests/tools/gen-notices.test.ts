/** tools/gen-notices.mjs: the notices are in sync, and the audit bites. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audit, render } from '../../tools/gen-notices.mjs';

const ROOT = join(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('tools/third-party.json')) as Parameters<typeof render>[0];
const pkg = JSON.parse(read('package.json')) as Parameters<typeof audit>[1];
const exists = (p: string) => existsSync(join(ROOT, p));

describe('the notices', () => {
  it('are what the manifest renders', () => {
    expect(read('THIRD_PARTY_NOTICES.md')).toBe(render(manifest));
  });

  it('cover every runtime dependency, with its licence text', () => {
    expect(audit(manifest, pkg, exists)).toEqual([]);
  });
});

describe('audit', () => {
  it('reports a runtime dependency without an entry, once', () => {
    const withDep = { ...pkg, dependencies: { ...pkg.dependencies, 'left-pad': '1.3.0' } };
    expect(audit(manifest, withDep, exists)).toEqual([
      'package.json dependency "left-pad" has no entry in tools/third-party.json',
    ]);
  });

  it('reports a missing licence text, once', () => {
    const first = manifest.components[0];
    const rest = manifest.components.slice(1);
    const broken = { components: [{ ...first, text: 'LICENSES/missing.txt' }, ...rest] };
    expect(audit(broken, pkg, exists)).toEqual([
      `entry "${first.name}": LICENSES/missing.txt does not exist`,
    ]);
  });

  it('reports a field left out, once', () => {
    const first = manifest.components[0];
    const rest = manifest.components.slice(1);
    const broken = { components: [{ ...first, holder: '' }, ...rest] };
    expect(audit(broken, pkg, exists)).toEqual([`entry "${first.name}" has no "holder"`]);
  });
});
