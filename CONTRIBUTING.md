# Contributing to FotoGeometria

**English** | [Português](CONTRIBUTING.pt-BR.md) | [Español](CONTRIBUTING.es-ES.md)

Thanks for your interest. FotoGeometria is a web app that corrects the geometry of wide-angle photos on the device: converging verticals and stretched edges. Here is how to help, and what a change has to show before it is merged.

## Before you start

- **Open an issue first** for anything bigger than a typo, so we agree on the change before you write it.
- Read the [Security Policy](SECURITY.md) if the change touches how files are read, what the page may load, or the deploy.
- The plan the project follows is [docs/PLANO.md](docs/PLANO.md) (in Portuguese), and [docs/DECISIONS.md](docs/DECISIONS.md) records where the code departs from it, and why.

## Setting up

You need Node.js 22.13 or later (`.nvmrc` says 22) and npm.

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Serves the app with hot reload at `http://localhost:5173/fotogeometria/` |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run lint` | ESLint, then Prettier in check mode |
| `npm run typecheck` | The TypeScript compiler, in strict mode, without emitting |
| `npm run build` | Builds the app into `dist/` |
| `npm run budget` | Holds `dist/` to the sizes in `tools/budget.json` (run after a build) |
| `npm run gates` | The repository's own gates: secrets, the Ângulo standard, the third-party notices |
| `npm run format` | Rewrites the code in Prettier's format |

### Pre-commit hooks

```bash
pip install pre-commit
pre-commit install
```

They run the whitespace and YAML/JSON checks and the fast gates, so you meet a problem in the second it takes to commit rather than in the minutes CI takes to answer. The tests and the build are not hooked on purpose: a hook that takes minutes is a hook people switch off.

## The checks a pull request must pass

`main` is protected: every change arrives through a pull request, and CI must pass on it. CI runs the same commands as above, so run them before you push:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run budget && npm run gates
```

- **The budget is exact.** `tools/budget.json` records the bytes of the build per category, and any difference fails, smaller included: a budget that only goes up stops measuring anything. When your change moves a size, record it with `node tools/check-budget.mjs --write` and say why in the commit.
- **The notices are generated.** A new runtime dependency needs an entry in `tools/third-party.json` and its licence text in `LICENSES/`, verbatim; then `npm run notices` rewrites `THIRD_PARTY_NOTICES.md`.
- **Generated files are never edited by hand.** Change the source and regenerate.

## Tests first

- Before you implement a feature, a function or a refactor, write down the tests that will prove it. When it is done, run them and put the result in the pull request.
- A refactor is proved by unchanged behaviour; a fix by a reproduction that fails before and passes after; new behaviour that can be exercised automatically earns a test case.
- A test only counts if it bites: it needs a negative control, a run where the fix is undone and the test fails. A new check is proved by mutation: putting the violation back gives exactly one finding.
- The mathematics in `src/core/` is held to the validated Python in `reference/` by parity tests. A numerical difference from the reference is either a bug or a decision, and a decision is justified in the code and covered by a test.

## Code conventions

- TypeScript in strict mode, formatted by Prettier, checked by ESLint.
- Every exported function has a documentation comment (TSDoc).
- Comments explain **why**, and carry the measurement that settled it, with its date. A comment that no longer matches the code is a defect, not noise.
- `src/core/` is pure mathematics: no DOM, no WebGL, no side effects. ESLint refuses an import from the browser-facing folders, and the compiler checks the folder without the DOM's types.
- Identifiers, comments, commit messages and pull requests are written in English.

## The interface standard

Everything with a screen or a reader follows the Ângulo, in [docs/ANGULO.md](docs/ANGULO.md) (in Portuguese): one accent colour, two type families, lines before shadows, two radii and the circle, a 4 px grid, one icon set, microcopy that says what it does, and every state drawn. Values come from the tokens in `src/styles/angulo.css`, which is a pinned copy and is never edited. `tools/check-angulo.mjs` checks what a machine can; the checklist of its §8 is for you, in both themes.

The interface is in Brazilian Portuguese, English and Spanish. A new text needs all three.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, with `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` or `chore`. If the change claims to be faster, smaller or a fix, the number or the reproduction goes in the message.

## Pull requests

- Fill in the template: why, what changes, and the proof (the commands you ran and what they printed).
- Update the documents your change makes wrong, in every language they exist in: the READMEs (three), CONTRIBUTING (three) and the CHANGELOG (two). Add a line under *Unreleased* in both changelogs.
- Keep a pull request to one subject.

## Images and privacy

The repository is public. Test images must be synthetic or freely licensed, and must not show people who can be identified. Never commit a personal photo: the `local-photos/` folder is ignored by Git for the photos you check by hand.

## Licence

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
