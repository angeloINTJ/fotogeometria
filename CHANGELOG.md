# Changelog

**English** | [Português](CHANGELOG.pt-BR.md)

All notable changes to FotoGeometria. Each stage of [the plan](docs/PLANO.md) lands as one pull request and one entry under *Unreleased* until the first release.

## Unreleased

### Stage 1: the mathematics of the correction (`src/core/`), held to the reference

- **The modules.** `linalg` (vectors, 3x3 matrices, Rodrigues as OpenCV computes it, and the smallest singular vector by one-sided Jacobi), `camera` (the focal length from the 35 mm equivalent, the lens presets, rays), `panini` (the projection both ways and the vertical compression), `leveling` (the rotation from the vanishing point, the strength, the fine adjustment), `framing` (the output framing, the source pixel of each output pixel, the validity mask) and `correction` (the parameters of PLANO.md §5 and the one function that turns them into a projection).
- **Parity with the reference.** `scripts/generate_fixtures.py` runs the reference's own functions on four cases (the plan's reference case among them) and writes `tests/fixtures/parity.json`: the rotation, the framing, the source coordinates of a 21 x 21 grid of output pixels, the count of valid pixels and the crop rectangles. The TypeScript matches the rotation to 10⁻¹², the framing to 10⁻¹², every sampled coordinate to 10⁻⁶ px (the plan asks for 10⁻² px) and the count of valid pixels exactly, 1,054,636 of them in the reference case. CI regenerates the fixtures under Python 3.12 with the pinned NumPy and OpenCV and compares them (new job `fixtures`).
- **Verticals stay vertical.** Lines of a synthetic facade, seen by a camera with a known pitch and roll and corrected, lean less than 0.2° from the vertical (PLANO.md §7); without the levelling they lean more than 5°, which shows the check bites.
- **The architecture rule, both halves.** ESLint refuses an import from `gl/`, `ui/`, `io/` or `detect/` into `src/core/`, and `tsconfig.core.json` compiles `src/core/` without the DOM's types; `tests/architecture.test.ts` puts each violation back and expects exactly one finding.
- **Mutations.** Five defects put into the core by hand (Panini's latitude, the sign of the down vector, the optical centre, the Rodrigues scale, the pixel centre) each fail between 1 and 16 tests.
- **CI timeouts** are 5 minutes, twice the longest job of the first runs (14 s) rounded up, except the new `fixtures` job, provisional at 10.
- **Tests.** 183 cases.

### Stage 0: the project's structure, its gates and CI

- **The project.** Vite 8, TypeScript 6 in strict mode, ESLint 10 with the type-aware rules of typescript-eslint, Prettier 3 and Vitest 5, every version pinned exactly. `npm run dev` serves a placeholder page in the Ângulo standard; the editor arrives in stages 1 to 5.
- **The reference.** The validated Python, `reference/corrigir_geometria.py`, byte for byte (sha256 `754e5154…`, pinned by a test). Given a vanishing point built from a pitch of 17.5° and a roll of 0.8°, it reproduces the plan's reference output, 711×1016, without the reference photo.
- **The gates, each with its mutations in `tests/tools/`.** A secret scan (key files, private key material, access tokens, literal credentials); the Ângulo standard where a machine can check it (the pinned copies of simut-rx, and the app's CSS: no literal colour, gradient, card shadow, stray radius, distance off the 4 px grid or type off the scale; no emoji; flat-square badges); the third-party notices, generated from `tools/third-party.json`; and an exact size budget of the build, which fails when a category grows or shrinks without being recorded.
- **The interface standard.** `src/styles/angulo.css`, the display font and `docs/ANGULO.md` are pinned copies of simut-rx. The theme follows the device from the first paint.
- **The repository.** MIT licence; README, CONTRIBUTING and Code of Conduct in English, Portuguese and Spanish; SECURITY; issue and pull request templates; Dependabot for npm and the GitHub Actions; a path labeler for pull requests; pre-commit hooks; and CI with one job per gate.
- **Tests.** 42 cases.
