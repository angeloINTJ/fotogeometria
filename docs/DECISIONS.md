# Decisions

The plan ([PLANO.md](PLANO.md)) left three decisions open, and the code departs from it in a few places. Each one is recorded here with its reason and its date: a departure that is written down is a decision, and one that is not is a defect.

## The open decisions of PLANO.md §2

Taken by the maintainer on 2026-11-25.

| Decision | Choice |
|---|---|
| 1. Name of the project and the repository | **FotoGeometria**, in the repository `angeloINTJ/fotogeometria` (lowercase, like `simut`), published at `angelointj.github.io/fotogeometria/`. |
| 2. Language of the code and the public documents | Like simut: identifiers, comments, commit messages and pull requests in **English**; the README, CONTRIBUTING and the Code of Conduct in English, Brazilian Portuguese and Spanish; the CHANGELOG in English and Portuguese; SECURITY in English. The plan itself stays in Portuguese. |
| 3. Language of the interface | **Brazilian Portuguese, English and Spanish**, chosen from the device's language, with Brazilian Portuguese when the device asks for any other. |

How the work lands, also chosen on 2026-11-25: one pull request per stage of PLANO.md §8, merged after CI and a review.

## Where the code departs from the plan

| The plan says | The code does | Why | Since |
|---|---|---|---|
| The plan and the script at the root of the folder (§11) | The plan is `docs/PLANO.md`, the script `reference/corrigir_geometria.py` (§5) | §5 places the reference in `reference/`; the plan joins the other documents. Both moved byte for byte: sha256 `fc3af8e3…` and `754e5154…` before and after. | 2026-11-25 |
| TypeScript in strict mode (§2) | TypeScript **6.0.3**, not 7.0.2, the newest | typescript-eslint 8.74.0, the newest, supports TypeScript `>=4.8.4 <6.1.0` (`npm view`, 2026-11-25). | 2026-11-25 |
| `scripts/gerar_fixtures.py` (§5, §7) | `scripts/generate_fixtures.py` | Decision 2: the code is in English. The reference keeps its name: it is a copy. | 2026-11-25 |
| A pixel is invalid when its ray has `r_orig.z <= 0` (§3.6) | Invalid when `r_orig.z <= 10⁻⁶` (`MIN_DEPTH`) | The reference's own threshold (`raios[..., 2] > 1e-6` in `reprojetar`), so a pixel at the edge is decided the same way in both. | 2026-11-25 |
| `cropAspect: number \| null`, null = free (§5) | `number \| 'original' \| null` | §4 offers "original" among the proportions, and a default that follows each photo cannot be a number before the photo is open. | 2026-11-25 |
| The initial crop proportion is 0.7 (§3.8) | `'original'` | 0.7 is not one of the proportions §4 offers (original, 3:4, 4:5, 1:1, 9:16, free). The parity tests still cover 0.7: it gives the reference's 711x1016. | 2026-11-25 |
| "The fine adjustment adds an extra rotation to R" (§3.3) | Rz(roll offset) · R · Rx(pitch offset) | Every levelling rotation has the form Rz(roll) · Rx(pitch) in the camera's frame (shown in `tests/core/leveling.test.ts`), so this composition adds the offsets to the camera's pitch and roll exactly, which is what a slider in degrees promises. | 2026-11-25 |
| Line detection by LSD or probabilistic Hough, in OpenCV.js (§2, §3.2) | Probabilistic Hough (`Canny` + `HoughLinesP`) | The reference uses LSD, but the OpenCV.js build on npm, `@techstark/opencv-js` 5.0.0-release.1, exports `HoughLinesP` and `Canny` and not `createLineSegmentDetector` (a search of its `dist/opencv.js`, 2026-11-25). Applies from stage 6. | 2026-11-25 |
