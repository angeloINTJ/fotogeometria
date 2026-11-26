#!/usr/bin/env node
/**
 * Holds the built app (dist/) to the sizes recorded in tools/budget.json.
 *
 * WHY EXACT
 * A budget is a high-water mark, not a ceiling: it goes down in the same
 * change that shrinks the build, or it stops measuring anything (a budget
 * that only rises is the limit, not a record). So every category must equal
 * its record, byte for byte. A change that grows or shrinks one records the
 * new size with --write, and the diff of budget.json shows the cost of the
 * change in review. Source maps are not counted: they are not downloaded by
 * the app.
 *
 *   npm run build && node tools/check-budget.mjs           check
 *   npm run build && node tools/check-budget.mjs --write   record
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = join(ROOT, 'tools/budget.json');

/**
 * Sorts the files of a build into the budget's categories.
 * @param {Array<{path: string, bytes: number}>} files paths relative to dist/
 * @param {Record<string, {match: string}>} categories in priority order
 * @returns {{sizes: Record<string, number>, unsorted: string[]}}
 */
export function measure(files, categories) {
  const sizes = Object.fromEntries(Object.keys(categories).map((k) => [k, 0]));
  const unsorted = [];
  for (const f of files) {
    if (f.path.endsWith('.map')) continue;
    const hit = Object.entries(categories).find(([, c]) => new RegExp(c.match).test(f.path));
    if (hit) sizes[hit[0]] += f.bytes;
    else unsorted.push(f.path);
  }
  return { sizes, unsorted };
}

/**
 * Compares measured sizes with the records.
 * @param {Record<string, number>} sizes
 * @param {Record<string, {bytes: number}>} categories
 * @returns {string[]} one finding per category that moved
 */
export function compare(sizes, categories) {
  const findings = [];
  for (const [name, c] of Object.entries(categories)) {
    const delta = sizes[name] - c.bytes;
    if (delta !== 0) {
      const verb = delta > 0 ? 'grew' : 'shrank';
      findings.push(
        `${name}: ${sizes[name]} B, recorded ${c.bytes} B (${verb} ${Math.abs(delta)} B): ` +
          'record it with node tools/check-budget.mjs --write',
      );
    }
  }
  return findings;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = join(ROOT, 'dist');
  if (!existsSync(dist)) {
    console.error('BUDGET: no dist/ (run npm run build first)');
    process.exit(1);
  }
  const budget = JSON.parse(readFileSync(BUDGET, 'utf8'));
  const files = walk(dist).map((p) => ({ path: relative(dist, p), bytes: statSync(p).size }));
  const { sizes, unsorted } = measure(files, budget.categories);
  for (const [name, bytes] of Object.entries(sizes)) console.log(`BUDGET: ${name} ${bytes} B`);
  if (process.argv.includes('--write')) {
    for (const name of Object.keys(sizes)) budget.categories[name].bytes = sizes[name];
    writeFileSync(BUDGET, JSON.stringify(budget, null, 2) + '\n');
    console.log('BUDGET: recorded');
  }
  const findings = [
    ...unsorted.map((p) => `${p}: in no category of tools/budget.json`),
    ...compare(sizes, budget.categories),
  ];
  for (const f of findings) console.error(`BUDGET: ${f}`);
  if (findings.length) process.exit(1);
  console.log('BUDGET: every category equals its record');
}
