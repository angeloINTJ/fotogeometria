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
| The shader runs the seven steps of the reprojection per pixel (§3.6) | Steps 1 to 3 (the plane coordinates, the vertical expansion, the inverse Panini) are computed by `src/core` in double precision, once per output column and once per output row, and the shader reads them from two tables; it does steps 4 to 7 | Each of the three depends on the column or on the row alone, and GLSL leaves the precision of `sin`, `cos` and `tan` to the GPU: the Vulkan rules, which SwiftShader follows, allow `sin` and `cos` an absolute error of 2⁻¹¹. In the shader, they put the sampled source 0.139 px from the reference's, where the plan asks for 0.01; from the tables, 0.00025 px at worst over every pixel of the reference case (Chrome 158 and Chrome Headless Shell 159, on SwiftShader). The shader also no longer repeats the Panini of `src/core`. | 2026-11-26 |
| The reference resamples the photo with Lanczos (`cv2.INTER_LANCZOS4` in `reprojetar`) | The shader samples with the GPU's filtering: mipmaps, trilinear, and anisotropic up to 8x where the GPU has it | §6 asks for mipmaps and trilinear filtering against aliasing where the correction shrinks the photo, and a GPU has no Lanczos. The pixels differ on every edge, so the browser tests compare where the lines are: those of the synthetic grid agree with the reference's to 0.028 px (vertical) and 0.038 px (horizontal) on average, where half a pixel off measures 0.50. | 2026-11-26 |
| The levelling tool: Automatic, strength, fine adjustment, tracing lines (§4) | Stage 3 offers the fine adjustment of tilt and rotation, which levels a photo by hand; strength comes with stage 4, and Automatic with stage 6 | Strength scales the levelling a vanishing point gives, and until lines are traced (stage 4) or detected (stage 6) a photo has none: the slider would change nothing, and stage 3 is done when every control changes the preview (§8). | 2026-11-26 |
| The fine adjustment's range (not in the plan) | Tilt from -25° to +25°, rotation from -15° to +15° | Past 25° of tilt, at the widest focal length (10 mm), the far edge of a 9:16 photo reaches the horizon and its framing grows from 1.9 to 235 times the photo's area (measured on 2026-11-26, `tests/ui/controls.test.ts`). 15° of rotation covers a phone held crooked. | 2026-11-26 |
| The focal length comes first from EXIF (§3.1), and its control spans 10 to 60 mm (§4) | An EXIF focal length outside 10 to 60 mm is held to the range, and the lens tool says what the photo records | The slider cannot show a value outside its range, and a telephoto photo beyond 60 mm has little to correct. | 2026-11-26 |
| EXIF is read with `exifr` (§2) | Its mini build (`exifr/dist/mini.esm.mjs`), loaded on the first photo | The mini build reads JPEG and TIFF in 27.6 KB (8.8 KB gzipped); the full one is 75 KB and reads formats the app does not need for one tag. A HEIC photo's focal length is not read: the default and the presets remain. | 2026-11-26 |
| The controls' last values are kept in localStorage (§4) | The edges (Panini and compression) and the grid are kept; the levelling and the focal length are not | The levelling and the lens belong to one photo: the next photo has its own tilt and its own lens. | 2026-11-26 |
| "Restaurar padrões" (§4) | Restores every control but the focal length that the photo's EXIF records | That focal length is a fact about the photo, not a setting. | 2026-11-26 |
| Line detection by LSD or probabilistic Hough, in OpenCV.js (§2, §3.2) | Probabilistic Hough (`Canny` + `HoughLinesP`) | The reference uses LSD, but the OpenCV.js build on npm, `@techstark/opencv-js` 5.0.0-release.1, exports `HoughLinesP` and `Canny` and not `createLineSegmentDetector` (a search of its `dist/opencv.js`, 2026-11-25). Applies from stage 6. | 2026-11-25 |
