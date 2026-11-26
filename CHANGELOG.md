# Changelog

**English** | [Português](CHANGELOG.pt-BR.md)

All notable changes to FotoGeometria. Each stage of [the plan](docs/PLANO.md) lands as one pull request and one entry under *Unreleased* until the first release.

## Unreleased

**Stage 0 of the plan: the project's structure, its gates and CI.**

- **The project.** Vite 8, TypeScript 6 in strict mode, ESLint 10 with the type-aware rules of typescript-eslint, Prettier 3 and Vitest 5, every version pinned exactly. `npm run dev` serves a placeholder page in the Ângulo standard; the editor arrives in stages 1 to 5.
- **The reference.** The validated Python, `reference/corrigir_geometria.py`, byte for byte (sha256 `754e5154…`, pinned by a test). Given a vanishing point built from a pitch of 17.5° and a roll of 0.8°, it reproduces the plan's reference output, 711×1016, without the reference photo.
- **The gates, each with its mutations in `tests/tools/`.** A secret scan (key files, private key material, access tokens, literal credentials); the Ângulo standard where a machine can check it (the pinned copies of simut-rx, and the app's CSS: no literal colour, gradient, card shadow, stray radius, distance off the 4 px grid or type off the scale; no emoji; flat-square badges); the third-party notices, generated from `tools/third-party.json`; and an exact size budget of the build, which fails when a category grows or shrinks without being recorded.
- **The interface standard.** `src/styles/angulo.css`, the display font and `docs/ANGULO.md` are pinned copies of simut-rx. The theme follows the device from the first paint.
- **The repository.** MIT licence; README, CONTRIBUTING and Code of Conduct in English, Portuguese and Spanish; SECURITY; issue and pull request templates; Dependabot for npm and the GitHub Actions; a path labeler for pull requests; pre-commit hooks; and CI with one job per gate.
- **Tests.** 42 cases.
