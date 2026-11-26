#!/usr/bin/env node
/**
 * The numbers the READMEs quote are the numbers the project measures.
 *
 * WHY THIS EXISTS
 * A README's status table is read as a fact, and a count typed by hand stops
 * being one the day after. simut held its READMEs' numbers to the source the
 * same way (tools/check_readme_numbers.py) after a status row stayed twelve
 * releases behind. Here the row "Tests" of each README must quote the number
 * of test cases the last Vitest run counted.
 *
 *   npx vitest run --reporter=json --outputFile.json=test-results/vitest.json
 *   node tools/check-readme-numbers.mjs test-results/vitest.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The status row that quotes the test count, per README. */
export const ROWS = {
  'README.md': '**Tests**',
  'README.pt-BR.md': '**Testes**',
  'README.es-ES.md': '**Pruebas**',
};

/**
 * Checks the test count each README quotes.
 * @param {Record<string, string>} readmes file name to text
 * @param {number} total the number of test cases Vitest ran
 * @returns {string[]} the findings
 */
export function checkReadmeNumbers(readmes, total) {
  const findings = [];
  for (const [file, label] of Object.entries(ROWS)) {
    const row = (readmes[file] ?? '').split('\n').find((line) => line.startsWith(`| ${label} |`));
    if (!row) {
      findings.push(`${file}: no status row ${label}`);
      continue;
    }
    const quoted = Number(/\d[\d,.]*/.exec(row.slice(label.length + 4))?.[0].replace(/[,.]/g, ''));
    if (quoted !== total) findings.push(`${file}: ${label} quotes ${quoted}, Vitest ran ${total}`);
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = JSON.parse(readFileSync(process.argv[2] ?? 'test-results/vitest.json', 'utf8'));
  const readmes = Object.fromEntries(
    Object.keys(ROWS).map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]),
  );
  const findings = checkReadmeNumbers(readmes, report.numTotalTests);
  for (const f of findings) console.error(`README NUMBERS: ${f}`);
  if (findings.length) process.exit(1);
  console.log(`README NUMBERS: the three READMEs quote ${report.numTotalTests} tests`);
}
