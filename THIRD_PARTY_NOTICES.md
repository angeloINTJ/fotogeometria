# Third-party notices

FotoGeometria is free software under the MIT License ([LICENSE](LICENSE)). The app it
builds also carries the third-party software below. For each one: who holds the
copyright, the licence, where it ships, and the file in [LICENSES/](LICENSES) that
holds the licence text, reproduced verbatim.

This file is written by `tools/gen-notices.mjs` from `tools/third-party.json`: edit
those, run `npm run notices`, and CI checks that they still agree.

| Component | Copyright holder | Licence | Ships in |
|---|---|---|---|
| [Bricolage Grotesque](#bricolage-grotesque) | The Bricolage Grotesque Project Authors | SIL Open Font License 1.1 | the app |
| [exifr](#exifr) | Mike Kovařík, Mutiny.cz | MIT License | the app |

## Bricolage Grotesque

The display face of the interface, in titles. The file is simut-rx's subset of the SemiBold (600) to the Latin letters and punctuation the interface uses, renamed "Ângulo Display" because it is no longer the complete font (src/styles/fonts/angulo-display-600.woff2).

- Copyright holder: The Bricolage Grotesque Project Authors
- Licence: SIL Open Font License 1.1, text in [LICENSES/bricolage-grotesque-OFL-1.1.txt](LICENSES/bricolage-grotesque-OFL-1.1.txt)
- Ships in: the app
- Source: <https://github.com/ateliertriay/bricolage>

## exifr

Reads the 35 mm equivalent focal length from a photo's EXIF (src/io/exif.ts). The app ships its mini build, dist/mini.esm.mjs (JPEG and TIFF, no tag names), loaded on the first photo.

- Copyright holder: Mike Kovařík, Mutiny.cz
- Licence: MIT License, text in [LICENSES/exifr-MIT.txt](LICENSES/exifr-MIT.txt)
- Ships in: the app
- npm package: `exifr`
- Source: <https://github.com/MikeKovarik/exifr>
