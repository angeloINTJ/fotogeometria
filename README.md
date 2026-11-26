# FotoGeometria

> Fixes the geometry of wide-angle photos, in the browser: converging verticals and people stretched at the edges. Your photos never leave the device.

**English** | [Português](README.pt-BR.md) | [Español](README.es-ES.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-1f6355?style=flat-square&labelColor=5f5b54)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/angeloINTJ/fotogeometria/ci.yml?branch=main&label=CI&style=flat-square&labelColor=5f5b54)](https://github.com/angeloINTJ/fotogeometria/actions/workflows/ci.yml)
[![Platform: PWA](https://img.shields.io/badge/Platform-PWA-1f6355?style=flat-square&labelColor=5f5b54)](https://web.dev/explore/progressive-web-apps)
[![Contributions welcome](https://img.shields.io/badge/Contributions-welcome-1f6355?style=flat-square&labelColor=5f5b54)](CONTRIBUTING.md)

## Overview

The ultra-wide camera of a phone gets the whole building or the whole group into the frame, and pays for it twice: a camera tilted up makes the walls lean in, and the people near the edges come out wider than they are. FotoGeometria corrects both, on the phone, with the photo you already took.

- **Levels the camera.** It finds the vertical vanishing point of the scene, from the lines in the photo or from two lines you trace, and turns the picture into the one a level camera would have taken.
- **Relaxes the edges.** A Panini projection keeps verticals straight while it undoes the horizontal stretch of the edges, and a gentle vertical compression does the same at the top and bottom.
- **Crops what is left.** The largest rectangle with no empty corner, in the proportion you pick, preferring the highest position so heads stay in.

Every step is a slider, from automatic to off.

## Project status

| | |
|---|---|
| **Stage** | 0 of 8 of [the plan](docs/PLANO.md): the project's structure, its gates and CI. The editor arrives in stages 1 to 5. |
| **Tests** | 42 unit tests (`npm test`) of the repository's own gates and of the reference's pin, run on every pull request. |

## Privacy

There is no server. The app is a static page; the photo is decoded, corrected and exported inside your browser, on your GPU. Nothing is uploaded, nothing is collected, and there is no telemetry. The exported JPEG carries no metadata, so the location the camera recorded does not leave with it.

## Running it locally

Node.js 22.13 or later:

```bash
git clone https://github.com/angeloINTJ/fotogeometria.git
cd fotogeometria
npm ci
npm run dev        # http://localhost:5173/fotogeometria/
```

`npm test` runs the unit tests, `npm run lint` and `npm run typecheck` the static checks, and `npm run gates` the repository's own gates. [CONTRIBUTING.md](CONTRIBUTING.md) has the rest.

## How it works

The algorithm is a port of a validated Python script, kept in [reference/](reference/corrigir_geometria.py), and the TypeScript is held to it by parity tests at 0.01 px. [The plan](docs/PLANO.md) §3 has every formula: the camera model, the vanishing point, the levelling rotation, the Panini projection, the vertical compression, the reprojection that the GPU runs per pixel, and the automatic crop.

## Documentation

| | |
|---|---|
| [docs/README.md](docs/README.md) | Every document, marked Living or Snapshot |
| [docs/DECISIONS.md](docs/DECISIONS.md) | The decisions the plan left open, and where the code departs from the plan |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setting up, the checks a pull request must pass, and the conventions |
| [SECURITY.md](SECURITY.md) | What the app protects, and how to report a vulnerability |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | What the app carries that someone else wrote |

## Contributing

Issues and pull requests are welcome, in English, Portuguese or Spanish. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and the [Code of Conduct](CODE_OF_CONDUCT.md). The repository is public: test images must be synthetic or freely licensed, and must not show people who can be identified.

## Licence

[MIT](LICENSE). The display font, Bricolage Grotesque, is under the SIL Open Font License 1.1; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists every third-party component and its licence.
