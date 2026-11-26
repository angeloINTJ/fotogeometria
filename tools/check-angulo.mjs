#!/usr/bin/env node
/**
 * The Ângulo standard (docs/ANGULO.md), where a machine can check it.
 *
 * WHY THIS EXISTS
 * A rule that lives only in prose does not last: simut-rx's copy of the guide
 * (§11) records two colour pairs that failed contrast for a whole version,
 * because nothing measured them. This is the part of the standard a machine can
 * measure, adapted from simut's tools/check_angulo.py. The rest is the §8
 * checklist, for a person.
 *
 * WHAT IT CHECKS
 *  1. The copies stay copies. src/styles/angulo.css, the display font, its
 *     licence and docs/ANGULO.md are byte-for-byte copies of simut-rx, the
 *     guide's canonical home. Their sha256 is pinned below: an edit by hand
 *     fails here, and a recopy updates the pin in the same change.
 *  2. The app's own CSS (every .css under src/ but the copy) names no colour,
 *     draws no gradient, casts no shadow but --sombra-flutuante, rounds no
 *     corner but the three radius tokens, sets no margin, padding or gap off
 *     the 4 px grid tokens, and uses no font family, size, line height or
 *     tracking outside the guide's text styles.
 *  3. No emoji plays an icon: not in the READMEs, the guides, the changelogs,
 *     the documents docs/README.md marks Living, the page or the source.
 *  4. The README badges are flat-square: shields.io's flat style draws a
 *     gradient.
 *
 * WHAT IT DOES NOT
 * Hierarchy, microcopy and whether every state is drawn are for a person
 * (docs/ANGULO.md §8). Snapshot documents are not checked: a record that gets
 * edited stops being evidence.
 *
 *   node tools/check-angulo.mjs     # exit 1 on any finding
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The copies, with the sha256 of the simut-rx files they were copied from on
 * 2026-11-25 (simut-rx web/angulo.css was in sync with its tokens that day:
 * `node design/build-tokens.mjs --check` passed, 52 contrast pairs). Never
 * edit a copy: recopy it from simut-rx and put the new hash here.
 */
export const PINNED = {
  'src/styles/angulo.css': 'f90637eda3a93dc112833fb24b582d2a2cd0e4680fcd54c84784141054488ff5',
  'src/styles/fonts/angulo-display-600.woff2':
    '9b359d39e74b1a357d2bd7374dce478623625ddf411fe0236313c1b12e4c2e38',
  'LICENSES/bricolage-grotesque-OFL-1.1.txt':
    '4b5a7d8f37f5602621c8a8d7358a6a2e71317e6c231c661e15aef0275d3e07ba',
  'docs/ANGULO.md': 'f7554bafeba1dcebeb2130b47709bacb7d59c9433bfc8ef9e317f672d0d4ce45',
};

/** Documents that are always Living, whatever docs/README.md says. */
const GUIDES = [
  'README.md',
  'README.pt-BR.md',
  'README.es-ES.md',
  'CONTRIBUTING.md',
  'CONTRIBUTING.pt-BR.md',
  'CONTRIBUTING.es-ES.md',
  'CODE_OF_CONDUCT.md',
  'CODE_OF_CONDUCT.pt-BR.md',
  'CODE_OF_CONDUCT.es-ES.md',
  'SECURITY.md',
  'AGENTS.md',
  'CLAUDE.md',
  'CHANGELOG.md',
  'CHANGELOG.pt-BR.md',
  'THIRD_PARTY_NOTICES.md',
  'docs/README.md',
  'tools/README.md',
  'index.html',
];

const READMES = ['README.md', 'README.pt-BR.md', 'README.es-ES.md'];

/**
 * Pictographs and dingbats, each with its presentation selector if it has one
 * (a warning sign is two code points and one finding), or the selector alone.
 * Arrows are left out on purpose: → and ← are punctuation in prose. The ranges
 * are simut's (tools/check_angulo.py, 2026-09-24).
 */
export const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FA}\u{231A}\u{231B}\u{2139}\u{203C}\u{2049}\u{24C2}]\u{FE0F}?|\u{FE0F}/gu;

/** The values the guide's text styles use (docs/ANGULO.md §3.2, §4.1). */
const FONT_SIZES = new Set(['13px', '15px', '16px', '18px', '24px', '34px']);
const LINE_HEIGHTS = new Set(['16px', '18px', '20px', '24px', '30px', '38px', '1', 'normal']);
const TRACKING = new Set(['-0.02em', '-0.01em', '-0.005em', '0', 'normal']);
const FAMILIES = new Set(['var(--font-display)', 'var(--font-texto)', 'var(--font-mono)']);
const RADII = new Set(['0', 'var(--raio-controle)', 'var(--raio-cartao)', 'var(--raio-total)']);
const KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert']);

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
const NAMED = /\b(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink)\b/i;
const GRADIENT = /\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
const SPACING_PROPS =
  /^(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$|^(?:row-|column-)?gap$/;

/** Splits a value on top-level whitespace, keeping parentheses together. */
function components(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * A spacing component is a token of the 4 px grid, zero, auto, or an
 * expression (calc, max, min) built only from those, unitless numbers and the
 * notch insets, which are the device's and not a design value.
 */
function spacingAllowed(component) {
  const atoms = component
    .replace(/var\(--espaco-[1-7]\)/g, ' ')
    .replace(/env\(safe-area-inset-(?:top|right|bottom|left)\)/g, ' ')
    .replace(/\b(?:calc|max|min)\(/g, ' ')
    .replace(/[(),*+/]/g, ' ')
    .replace(/(^|\s)-(?=\s|$)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return atoms.every((atom) => atom === 'auto' || atom === '0' || /^-?\d+(\.\d+)?$/.test(atom));
}

/** Line number of an offset, for findings a person can jump to. */
function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/**
 * Checks one stylesheet of the app against rule 2.
 * @param {string} text the CSS source
 * @param {string} file the path to report
 * @returns {string[]} one finding per violating declaration
 */
export function checkCss(text, file) {
  const findings = [];
  // Comments go, but their newlines stay so line numbers still point right.
  const source = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  for (const block of source.matchAll(/\{([^{}]*)\}/g)) {
    const bodyStart = block.index + 1;
    let offset = 0;
    for (const raw of block[1].split(';')) {
      const at = bodyStart + offset;
      offset += raw.length + 1;
      const colon = raw.indexOf(':');
      if (colon < 0) continue;
      const prop = raw.slice(0, colon).trim().toLowerCase();
      const value = raw
        .slice(colon + 1)
        .replace(/!important/i, '')
        .trim();
      if (!prop || !value || prop.startsWith('--')) continue;
      const where = `${file}:${lineOf(source, at + raw.search(/\S/))}`;
      const say = (why) => findings.push(`${where}: ${prop}: ${value} (${why})`);

      if (HEX.test(value) || COLOR_FUNCTION.test(value)) {
        say('a literal colour; use a colour token');
        continue;
      }
      if (/color|background|border|outline|fill|stroke|shadow/.test(prop) && NAMED.test(value)) {
        say('a named colour; use a colour token');
        continue;
      }
      if (GRADIENT.test(value)) {
        say('a gradient; the guide allows one only in a data chart');
        continue;
      }
      if (KEYWORDS.has(value)) continue;
      if (prop === 'box-shadow') {
        if (value !== 'none' && value !== 'var(--sombra-flutuante)') {
          say('a shadow other than --sombra-flutuante; a card never casts one');
        }
      } else if (/^border(-(top|bottom)-(left|right))?-radius$/.test(prop)) {
        if (!components(value).every((c) => RADII.has(c))) {
          say('a radius outside --raio-controle, --raio-cartao and --raio-total');
        }
      } else if (SPACING_PROPS.test(prop)) {
        if (!components(value).every(spacingAllowed)) {
          say('a distance off the 4 px grid; use the --espaco-* tokens');
        }
      } else if (prop === 'font-family') {
        if (!FAMILIES.has(value)) say('a font family outside the three tokens');
      } else if (prop === 'font-size') {
        if (!FONT_SIZES.has(value)) say('a font size outside the text styles');
      } else if (prop === 'line-height') {
        if (!LINE_HEIGHTS.has(value)) say('a line height outside the text styles');
      } else if (prop === 'letter-spacing') {
        if (!TRACKING.has(value)) say('a tracking outside the text styles');
      } else if (prop === 'font') {
        const m = /^(?:(\d{3})\s+)?(\d+px)\/(\S+)\s+(var\(--font-[a-z]+\))$/.exec(value);
        if (!m || !FONT_SIZES.has(m[2]) || !LINE_HEIGHTS.has(m[3]) || !FAMILIES.has(m[4])) {
          say('a font shorthand outside the text styles: weight size/line var(--font-*)');
        }
      }
    }
  }
  return findings;
}

/**
 * Finds emoji in a text (rule 6: an emoji never plays an icon or a status).
 * @param {string} text
 * @param {string} file
 * @returns {string[]}
 */
export function checkEmoji(text, file) {
  const findings = [];
  for (const m of text.matchAll(EMOJI)) {
    findings.push(`${file}:${lineOf(text, m.index)}: emoji ${JSON.stringify(m[0])}`);
  }
  return findings;
}

/**
 * Every shields.io badge is flat-square: the flat style draws a gradient.
 * @param {string} text
 * @param {string} file
 * @returns {string[]}
 */
export function checkBadges(text, file) {
  const findings = [];
  for (const m of text.matchAll(/https:\/\/img\.shields\.io\/[^\s)"']+/g)) {
    if (!/[?&]style=flat-square\b/.test(m[0])) {
      findings.push(`${file}:${lineOf(text, m.index)}: badge without style=flat-square`);
    }
  }
  return findings;
}

/**
 * The documents docs/README.md marks Living: a table row whose state cell is
 * "Living" names its document in the first cell's link.
 * @param {string} index the text of docs/README.md
 * @returns {string[]} paths relative to the repository root
 */
export function livingDocs(index) {
  const docs = [];
  for (const line of index.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4 || !cells.some((c) => /^\**Living\**$/.test(c))) continue;
    for (const link of cells[1].matchAll(/\]\(([^)#]+)\)/g)) docs.push(join('docs', link[1]));
  }
  return docs;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function walk(dir, keep) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

/**
 * Runs every check on a tree.
 * @param {string} root the repository root
 * @returns {string[]} the findings, empty when the tree follows the standard
 */
export function run(root = ROOT) {
  const findings = [];
  const rel = (p) => relative(root, p);

  for (const [file, want] of Object.entries(PINNED)) {
    const path = join(root, file);
    if (!existsSync(path)) {
      findings.push(`${file}: missing (a pinned copy of simut-rx)`);
    } else if (sha256(path) !== want) {
      findings.push(`${file}: sha256 ${sha256(path)}, pinned ${want} (recopy from simut-rx)`);
    }
  }

  const css = walk(join(root, 'src'), (p) => p.endsWith('.css')).filter(
    (p) => rel(p) !== 'src/styles/angulo.css',
  );
  for (const path of css) findings.push(...checkCss(readFileSync(path, 'utf8'), rel(path)));

  const indexPath = join(root, 'docs/README.md');
  const living = existsSync(indexPath) ? livingDocs(readFileSync(indexPath, 'utf8')) : [];
  const sources = walk(join(root, 'src'), (p) => /\.(ts|css|html|frag|vert|glsl)$/.test(p));
  const texts = [
    ...new Set([
      ...GUIDES.map((g) => join(root, g)),
      ...living.map((d) => join(root, d)),
      ...sources,
    ]),
  ];
  for (const path of texts) {
    if (existsSync(path)) findings.push(...checkEmoji(readFileSync(path, 'utf8'), rel(path)));
  }

  for (const readme of READMES) {
    const path = join(root, readme);
    if (existsSync(path)) findings.push(...checkBadges(readFileSync(path, 'utf8'), readme));
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = run();
  for (const f of findings) console.error(f);
  if (findings.length) {
    console.error(`ÂNGULO: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log('ÂNGULO: clean');
}
