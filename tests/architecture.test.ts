/**
 * The architecture rule of PLANO.md §5, in both of its halves, with the
 * mutation that proves each half bites:
 *
 * - src/core imports nothing from gl/, ui/, io/ or detect/ (ESLint);
 * - src/core compiles without the DOM's types (tsconfig.core.json).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

describe('src/core imports', () => {
  it('ESLint refuses an import from a browser-facing folder', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const lint = (code: string) =>
      eslint.lintText(code, { filePath: join(ROOT, 'src/core/linalg.ts') });
    const clean = readFileSync(join(ROOT, 'src/core/linalg.ts'), 'utf8');
    expect((await lint(clean))[0].messages).toEqual([]);
    const mutated = `import { draw } from '../gl/renderer';\nexport const x = draw;\n${clean}`;
    const rules = (await lint(mutated))[0].messages.map((m) => m.ruleId);
    expect(rules.filter((r) => r === 'no-restricted-imports')).toHaveLength(1);
  }, 30_000);
});

describe('src/core without the DOM', () => {
  function diagnostics(extra: string): string[] {
    const config = ts.getParsedCommandLineOfConfigFile(
      join(ROOT, 'tsconfig.core.json'),
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
    )!;
    const probe = join(ROOT, 'src/core/__probe__.ts');
    const host = ts.createCompilerHost(config.options);
    const read = host.readFile.bind(host);
    host.readFile = (file) => (file === probe ? extra : read(file));
    host.fileExists = (file) => file === probe || ts.sys.fileExists(file);
    const program = ts.createProgram([...config.fileNames, probe], config.options, host);
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }

  it('compiles as it is', () => {
    expect(diagnostics('export const probe = Math.PI;\n')).toEqual([]);
  }, 30_000);

  it('fails on a DOM global', () => {
    const found = diagnostics('export const probe = document.title;\n');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/Cannot find name 'document'/);
  }, 30_000);
});
