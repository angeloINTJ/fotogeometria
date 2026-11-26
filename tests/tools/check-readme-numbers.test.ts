/** tools/check-readme-numbers.mjs: the quoted count, in each README, and the mutations. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROWS, checkReadmeNumbers } from '../../tools/check-readme-numbers.mjs';

const ROOT = join(import.meta.dirname, '../..');
const readmes = Object.fromEntries(
  Object.keys(ROWS).map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]),
);
const quoted = Number(/\| \*\*Tests\*\* \| (\d+)/.exec(readmes['README.md'] ?? '')?.[1]);

describe('checkReadmeNumbers', () => {
  it('passes when the three READMEs quote the same count Vitest ran', () => {
    expect(checkReadmeNumbers(readmes, quoted)).toEqual([]);
  });

  it('reports each README once when the count moves', () => {
    expect(checkReadmeNumbers(readmes, quoted + 1)).toHaveLength(3);
  });

  it('reports the one README that drifted', () => {
    const drifted = {
      ...readmes,
      'README.es-ES.md': (readmes['README.es-ES.md'] ?? '').replace(
        `| **Pruebas** | ${quoted} `,
        `| **Pruebas** | ${quoted + 5} `,
      ),
    };
    expect(checkReadmeNumbers(drifted, quoted)).toEqual([
      `README.es-ES.md: **Pruebas** quotes ${quoted + 5}, Vitest ran ${quoted}`,
    ]);
  });

  it('reports a README that lost its row', () => {
    const lost = { ...readmes, 'README.md': '# FotoGeometria\n' };
    expect(checkReadmeNumbers(lost, quoted)).toEqual(['README.md: no status row **Tests**']);
  });
});
