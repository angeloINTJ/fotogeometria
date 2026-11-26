# AGENTS.md

The operating manual of the repository, for people and for coding agents. It keeps only what is true now: the history is in the [CHANGELOG](CHANGELOG.md), the decisions and the departures from the plan are in [docs/DECISIONS.md](docs/DECISIONS.md), and [docs/PLANO.md](docs/PLANO.md) is the plan as it was handed over.

## 1. Where things are

| | |
|---|---|
| `src/core/` | Pure mathematics: camera, vanishing point, levelling, Panini, framing, crop. No DOM, no WebGL, no side effects (§5) |
| `src/gl/` | WebGL2: the reprojection shader, the renderer that draws it to the canvas or reads it back, and `uniforms.ts` (pure), which turns a correction into what the shader reads |
| `src/detect/` | Line detection in a Web Worker (OpenCV.js, loaded on demand) |
| `src/io/` | Reading a photo (orientation, size limits), its EXIF focal length, saving and sharing |
| `src/ui/` | The screens, the controls, the state and the texts in three languages |
| `src/styles/` | `angulo.css`, a pinned copy of simut-rx's tokens (never edited), the display font, and the app's own CSS |
| `reference/` | `corrigir_geometria.py`, the validated Python the TypeScript is held to. Never edited: its sha256 is pinned in `tests/reference.test.ts` |
| `tests/` | Vitest: unit, parity and the gates' own tests. `tests/fixtures/` is generated (§6) |
| `e2e/` | Playwright: the shader against the reference, and the app in a browser (§3). `e2e/harness/` is a test page, built only by `vite build --mode harness` into `dist-harness/`, never deployed |
| `tools/` | The repository's gates; [tools/README.md](tools/README.md) lists them |
| `scripts/` | The fixture generator and its pinned Python requirements |
| `docs/` | [docs/README.md](docs/README.md) marks each document Living or Snapshot |

The plan's stages (PLANO.md §8) land one pull request each. The README's status table says which stage `main` is at.

## 2. Commands

```bash
npm ci                 # install exactly what package-lock.json pins
npm run dev            # http://localhost:5173/fotogeometria/
npm run lint           # ESLint + Prettier --check
npm run typecheck      # tsc --noEmit, strict
npm test               # Vitest
npm run e2e            # Playwright (once before: npx playwright install chromium)
npm run build          # dist/
npm run budget         # dist/ against tools/budget.json (after a build)
npm run gates          # secrets, Ângulo, notices
```

Node 22.13 or later. `FG_BASE=/ npm run build` builds for a site served at the root instead of `/fotogeometria/`.

In the app, `?medir` at the end of the address measures the preview: after a photo opens, the editor moves two controls every frame for 3 seconds, through the path a slider's change takes, and reports the frames the preview drew per second; a page hidden, or a context lost, meanwhile makes it report none. Stage 3 of the plan is done at 30 on a mid-range phone.

## 3. The gates

CI runs every one of these on each pull request and each push to `main`, and a pull request cannot merge with one red. Run them before you push: CI answers in minutes what your terminal answers in seconds.

- **Lint and format.** ESLint with the type-aware rules of typescript-eslint, then Prettier in check mode. Prettier leaves alone what must stay byte for byte (`.prettierignore` says what and why).
- **Types.** `tsc` in strict mode, twice: the whole program, and `src/core/` alone without the DOM's types (`tsconfig.core.json`).
- **Tests.** Every test in `tests/`, including the gates' own tests and their mutations.
- **Browser tests.** `e2e/`, with Playwright's Chromium on SwiftShader, the CPU renderer, everywhere: the runners have no GPU, and a local GPU would round differently. The shader's source positions against the reference's and against `src/core` on every pixel, the synthetic grid's lines against the reference's correction of it, the canvas against the read-back, the margin, the original mode and the mipmaps; and the app in each of its states. `PW_CHANNEL=chrome` runs them on an installed Chrome instead.
- **Budget.** `tools/check-budget.mjs` holds each category of `dist/` (HTML, CSS, fonts, JavaScript, classic scripts) to the byte count in `tools/budget.json`. It fails on any difference, smaller included: the budget is a high-water mark that goes down in the same change that shrinks the build. Record a deliberate change with `node tools/check-budget.mjs --write`, and say what moved it in the commit.
- **Secrets.** `tools/scan-secrets.sh`: a tracked key file, private key material, an access token or a literal credential. The project needs no secret at all, so a hit is a leak or a test value for `tools/.secretscan-allow`, with its reason.
- **The Ângulo.** `tools/check-angulo.mjs` (§7).
- **Third-party notices.** `tools/gen-notices.mjs --check`: `THIRD_PARTY_NOTICES.md` is what `tools/third-party.json` renders, every runtime dependency in `package.json` has an entry, and every entry's licence text is in `LICENSES/`.
- **Fixtures.** `scripts/generate_fixtures.py --check` regenerates the reference's output under Python 3.12 with the NumPy and OpenCV of `scripts/requirements.txt`, and compares it with `tests/fixtures/parity.json`: integers exactly, floats within 10⁻⁹ (§6).

## 4. Tests first

- Before implementing a feature, a function or a refactor, write down the tests that will prove it. When it is done, run them and put the result in the pull request.
- A refactor's proof is unchanged behaviour; a fix's is a reproduction that fails before and passes after. New behaviour that can be exercised automatically earns a test.
- A test only counts if it bites: it has a negative control. A new check is confirmed by mutation: putting the violation back gives exactly one finding. Each gate in `tools/` has its mutations in `tests/tools/`.
- Measure against the source of truth (the value the code wrote, the reference's output), never one reading of an instrument against another of the same instrument.

## 5. Architecture rules

From PLANO.md §5:

- `src/core/` imports nothing from `gl/`, `ui/`, `io/` or `detect/`. ESLint refuses such an import (`eslint.config.js`), and `tsconfig.core.json` compiles the folder without the DOM's types. `tests/architecture.test.ts` puts each violation back and expects one finding.
- The editor's state is one immutable object; each change makes a new state and a redraw.
- The same function of `src/core/` feeds the shader (through uniforms, and the per-column and per-row tables of `src/gl/uniforms.ts`) and the crop (on the CPU), so there are never two versions of the mathematics. The shader itself holds no trigonometry: `src/gl/reproject.frag` says why.

## 6. The reference and parity

`reference/corrigir_geometria.py` is the algorithm the plan calls validated. The TypeScript in `src/core/` is a port of it, written in the same order of operations, and the parity tests in `tests/core/` compare the two. The plan asks for 0.01 px; the port holds 10⁻⁶ px on every sampled coordinate, 10⁻¹² on the rotation and the framing, and the exact count of valid pixels. A numerical difference from the reference is either a bug or a decision; a decision is justified in the code, covered by a test, and listed in `docs/DECISIONS.md`.

The fixtures are generated, never edited. To regenerate them after a deliberate change to the generator (the reference itself is pinned):

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/generate_fixtures.py          # writes tests/fixtures/parity.json
.venv/bin/python scripts/generate_fixtures.py --check  # what CI runs
```

`--check` compares numbers within 10⁻⁹ rather than text, because the last bit of a sine can differ between two builds of NumPy; the integers (sizes, counts, rectangles) must be equal.

Conventions the port keeps, so a reader of the reference finds the same thing: pixel centres at +0.5 in the output grid, the optical centre at ((W - 1) / 2, (H - 1) / 2), a ray is behind the camera below a depth of 10⁻⁶ (`MIN_DEPTH`), the output size rounds half to even (Python's `round`), and the contour has 200 points per edge with both corners.

The shader is held to the reference too, in a browser (`e2e/gl.spec.ts`): within the plan's 0.01 px at the reference's samples, and against `src/core` on every pixel. On 2026-11-26 it measured 0.00025 px at worst, on SwiftShader. Beside `parity.json`, the generator writes a synthetic photo (a facade grid seen by the reference case's camera: red verticals, blue horizontals, constant green) and the reference's own correction of it, and `--check` compares both images exactly.

The reference reproduces the plan's reference case without its photo: a vanishing point built from a pitch of 17.5° and a roll of 0.8°, with focal 480 px, strength 0.9, Panini 0.7, vertical compression 0.5 and crop proportion 0.7, gives the 711×1016 output of PLANO.md §3.8 (measured with NumPy 2.3.5 and OpenCV 4.14.0 on 2026-11-25).

## 7. The interface standard: the Ângulo

Everything with a screen or a reader follows [docs/ANGULO.md](docs/ANGULO.md): its §2 has the eight rules, §7 the microcopy and §8 the checklist.

- **Where the values come from.** `src/styles/angulo.css` is a byte-for-byte copy of simut-rx's `web/angulo.css`, which simut-rx generates from its tokens and checks for contrast (52 pairs, both themes). The display font and its licence are copies too, and so is `docs/ANGULO.md`. `tools/check-angulo.mjs` pins the four sha256: to take a new version, recopy from simut-rx and update the pins in the same change. Never edit a copy.
- **What a machine checks** (`tools/check-angulo.mjs`): in the app's own CSS, no literal colour, no gradient, no shadow but `--sombra-flutuante`, no radius outside the three tokens, no margin, padding or gap off the `--espaco-*` grid, no font family, size, line height or tracking outside the text styles; no emoji in the guides, the Living documents, the page or the source; every README badge in `flat-square`.
- **What a person checks**: hierarchy, microcopy and that every state is drawn (§8), in both themes.
- **The theme** follows the device. `public/theme.js` is a classic script in `<head>`, so the first paint already has it; `src/main.ts` follows later changes.
- **Texts.** The interface is in pt-BR (the default), English and Spanish.

## 8. House style

- Comments explain **why**, and carry the measurement that settled it, with its date. A comment that no longer matches the code is a defect.
- A comment that enumerates ("the only", "always", "never") is checked with `grep` before it is believed.
- Every exported function has a TSDoc comment.
- Generated files (`THIRD_PARTY_NOTICES.md`, `tests/fixtures/`) are never edited by hand: change the source and regenerate.
- Test images are synthetic or freely licensed, and never show identifiable people: the repository is public.

## 9. Working agreements

- `main` is protected. Every change goes through a pull request, and the CI jobs are required checks.
- Commit messages follow Conventional Commits. Commits, pull requests, code and comments are in English; conversation with the maintainer is in Brazilian Portuguese.
- A pull request says why, what changes and the proof: the commands run and what they printed. If something was not verified (on a phone, on a real photo), it says so.
- Measure before claiming. A change described as smaller, faster or fixed carries the number or the reproduction.
