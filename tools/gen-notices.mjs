#!/usr/bin/env node
/**
 * Writes THIRD_PARTY_NOTICES.md from tools/third-party.json.
 *
 * WHY GENERATE
 * The notices are a promise to every licensor of what ships: their name, the
 * licence and its full text. Written by hand, that list drifts from what the
 * build actually pulls in, and nothing notices. Here a runtime dependency with
 * no entry fails CI, and so does an entry whose licence text is not in
 * LICENSES/.
 *
 *   node tools/gen-notices.mjs           write the file
 *   node tools/gen-notices.mjs --check   exit 1 if the file, the entries or
 *                                        package.json disagree
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'THIRD_PARTY_NOTICES.md';

/**
 * Renders the notices.
 * @param {{components: Array<Record<string, string|null>>}} manifest
 * @returns {string} the Markdown text
 */
export function render(manifest) {
  const lines = [
    '# Third-party notices',
    '',
    'FotoGeometria is free software under the MIT License ([LICENSE](LICENSE)). The app it',
    'builds also carries the third-party software below. For each one: who holds the',
    'copyright, the licence, where it ships, and the file in [LICENSES/](LICENSES) that',
    'holds the licence text, reproduced verbatim.',
    '',
    'This file is written by `tools/gen-notices.mjs` from `tools/third-party.json`: edit',
    'those, run `npm run notices`, and CI checks that they still agree.',
    '',
    '| Component | Copyright holder | Licence | Ships in |',
    '|---|---|---|---|',
  ];
  for (const c of manifest.components) {
    lines.push(`| [${c.name}](#${c.anchor}) | ${c.holder} | ${c.license} | ${c.ships} |`);
  }
  for (const c of manifest.components) {
    lines.push('', `## ${c.name}`, '', c.about, '');
    lines.push(`- Copyright holder: ${c.holder}`);
    lines.push(`- Licence: ${c.license}, text in [${c.text}](${c.text})`);
    lines.push(`- Ships in: ${c.ships}`);
    if (c.package) lines.push(`- npm package: \`${c.package}\``);
    lines.push(`- Source: <${c.source}>`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Cross-checks the manifest against the tree.
 * @param {{components: Array<Record<string, string|null>>}} manifest
 * @param {{dependencies?: Record<string, string>}} pkg package.json
 * @param {(path: string) => boolean} exists
 * @returns {string[]} the findings
 */
export function audit(manifest, pkg, exists) {
  const findings = [];
  const packages = new Set(manifest.components.map((c) => c.package).filter(Boolean));
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!packages.has(dep)) {
      findings.push(`package.json dependency "${dep}" has no entry in tools/third-party.json`);
    }
  }
  const anchors = new Set();
  for (const c of manifest.components) {
    for (const key of ['name', 'anchor', 'about', 'holder', 'license', 'text', 'ships', 'source']) {
      if (!c[key]) findings.push(`entry "${c.name ?? '?'}" has no "${key}"`);
    }
    if (c.text && !exists(c.text)) findings.push(`entry "${c.name}": ${c.text} does not exist`);
    if (anchors.has(c.anchor)) findings.push(`entry "${c.name}": anchor "${c.anchor}" repeats`);
    anchors.add(c.anchor);
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/third-party.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const findings = audit(manifest, pkg, (p) => existsSync(join(ROOT, p)));
  const text = render(manifest);
  if (process.argv.includes('--check')) {
    const current = existsSync(join(ROOT, OUT)) ? readFileSync(join(ROOT, OUT), 'utf8') : '';
    if (current !== text) findings.push(`${OUT} is out of date: run npm run notices`);
    for (const f of findings) console.error(`NOTICES: ${f}`);
    if (findings.length) process.exit(1);
    console.log(`NOTICES: in sync (${manifest.components.length} components)`);
  } else {
    for (const f of findings) console.error(`NOTICES: ${f}`);
    writeFileSync(join(ROOT, OUT), text);
    console.log(`NOTICES: wrote ${OUT} (${manifest.components.length} components)`);
    if (findings.length) process.exit(1);
  }
}
