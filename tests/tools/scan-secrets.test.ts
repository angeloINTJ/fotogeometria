/**
 * tools/scan-secrets.sh, run in a throwaway repository.
 *
 * The planted values are assembled at run time, so this file never holds a
 * string the gate would report in the real tree.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '../../tools/scan-secrets.sh');

function repoWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'secrets-'));
  mkdirSync(join(dir, 'tools'));
  copyFileSync(SCRIPT, join(dir, 'tools/scan-secrets.sh'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  return dir;
}

function scan(dir: string) {
  const r = spawnSync('bash', ['tools/scan-secrets.sh'], { cwd: dir, encoding: 'utf8' });
  const reports = r.stdout.split('\n').filter((l) => /^SECRET GATE: .*:$/.test(l));
  return { code: r.status, reports, out: r.stdout };
}

const pass = ['pass', 'word'].join('');
const ghToken = ['gh', 'p_', 'A'.repeat(36)].join('');
const pemHead = ['-----BEGIN ', 'PRIVATE', ' KEY-----'].join('');

describe('scan-secrets.sh', () => {
  it('passes a clean tree', () => {
    const r = scan(repoWith({ 'a.ts': 'const x = process.env.TOKEN;\n' }));
    expect(r.code).toBe(0);
  });

  it.each([
    ['a tracked key file', { 'server.pem': 'x\n' }],
    ['private key material', { 'k.txt': `${pemHead}\n${'Q'.repeat(64)}\n` }],
    ['an access token', { 'a.ts': `const t = '${ghToken}';\n` }],
    ['a literal credential', { 'a.ts': `const ${pass} = "hunter2hunter2";\n` }],
  ])('fails on %s, with one report', (_why, files) => {
    const r = scan(repoWith(files));
    expect(r.code).toBe(1);
    expect(r.reports).toHaveLength(1);
  });

  it('lets an allowlisted value through', () => {
    const line = `const ${pass} = "fixture-value-1";`;
    const r = scan(
      repoWith({ 'a.ts': `${line}\n`, 'tools/.secretscan-allow': 'fixture-value-1\n' }),
    );
    expect(r.code).toBe(0);
  });
});
