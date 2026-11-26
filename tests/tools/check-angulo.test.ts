/**
 * tools/check-angulo.mjs: the real tree is clean, and each rule bites.
 *
 * Every mutation below reintroduces one violation and must give exactly one
 * finding: a check that passes with the rule broken is not a check.
 */
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PINNED,
  checkBadges,
  checkCss,
  checkEmoji,
  livingDocs,
  run,
} from '../../tools/check-angulo.mjs';

const ROOT = join(import.meta.dirname, '../..');

describe('the tree', () => {
  it('follows the standard', () => {
    expect(run(ROOT)).toEqual([]);
  });
});

describe('checkCss', () => {
  const ok = `.a { color: var(--tinta); margin: 0 auto; padding: var(--espaco-3) var(--espaco-4);
    border-radius: var(--raio-controle); box-shadow: none; font-size: 15px; line-height: 20px;
    gap: calc(-1 * var(--espaco-1)); padding-bottom: max(var(--espaco-3), env(safe-area-inset-bottom));
    font: 500 15px/20px var(--font-texto); letter-spacing: -0.01em; }
    @media (min-width: 600px) { .b:hover { background: var(--superficie-2); } }`;

  it('accepts token values', () => {
    expect(checkCss(ok, 'ok.css')).toEqual([]);
  });

  it.each([
    ['a hex colour', '.x { color: #fff; }'],
    ['an rgb() colour', '.x { background: rgb(0 0 0 / 50%); }'],
    ['a named colour', '.x { border: 1px solid black; }'],
    ['a gradient', '.x { background-image: linear-gradient(var(--acento), var(--fundo)); }'],
    ['a shadow on a card', '.x { box-shadow: 0 1px 2px var(--linha); }'],
    ['a fourth radius', '.x { border-radius: 8px; }'],
    ['a distance off the grid', '.x { margin-top: 10px; }'],
    ['a pixel gap', '.x { gap: 4px; }'],
    ['a font size off the scale', '.x { font-size: 14px; }'],
    ['a line height off the scale', '.x { line-height: 1.4; }'],
    ['a tracking off the scale', '.x { letter-spacing: 0.1em; }'],
    ['a font family outside the tokens', '.x { font-family: Arial; }'],
    ['a font shorthand off the scale', '.x { font: 600 14px/20px var(--font-texto); }'],
  ])('reports %s once', (_why, css) => {
    expect(checkCss(`${ok}\n${css}`, 'm.css')).toHaveLength(1);
  });

  it('points at the line of the declaration', () => {
    const [finding] = checkCss('.a {\n  color: var(--tinta);\n  margin: 3px;\n}', 'f.css');
    expect(finding).toMatch(/^f\.css:3: margin: 3px/);
  });

  it('ignores comments', () => {
    expect(checkCss('/* color: #000; */ .a { color: var(--tinta); }', 'c.css')).toEqual([]);
  });
});

describe('checkEmoji', () => {
  it('finds a pictograph and its selector as one finding', () => {
    expect(checkEmoji('ok\nwarning: ⚠️ done', 'r.md')).toEqual(['r.md:2: emoji "⚠️"']);
  });

  it('leaves arrows and typography alone', () => {
    expect(checkEmoji('a → b, 3 × 4, “quote” – dash…', 'r.md')).toEqual([]);
  });
});

describe('checkBadges', () => {
  it('wants flat-square', () => {
    const flat = '![b](https://img.shields.io/badge/License-MIT-1f6355?style=flat-square)';
    const round = '![b](https://img.shields.io/badge/License-MIT-1f6355)';
    expect(checkBadges(flat, 'R.md')).toEqual([]);
    expect(checkBadges(`${flat}\n${round}`, 'R.md')).toHaveLength(1);
  });
});

describe('livingDocs', () => {
  it('reads the Living rows of the index', () => {
    const index = [
      '| document | state | about |',
      '|---|---|---|',
      '| [A.md](A.md) | Living | a |',
      '| [B.md](B.md) | Snapshot | b |',
      '| [C.md](C.md) · [pt-BR](C.pt-BR.md) | **Living** | c |',
    ].join('\n');
    expect(livingDocs(index)).toEqual(['docs/A.md', 'docs/C.md', 'docs/C.pt-BR.md']);
  });
});

describe('the pinned copies', () => {
  it('fails once when a copy is edited', () => {
    const root = mkdtempSync(join(tmpdir(), 'angulo-'));
    for (const file of Object.keys(PINNED)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(join(ROOT, file), join(root, file));
    }
    expect(run(root)).toEqual([]);
    writeFileSync(join(root, 'src/styles/angulo.css'), '/* edited */\n');
    const findings = run(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/^src\/styles\/angulo\.css: sha256/);
  });
});
