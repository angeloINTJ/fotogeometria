# FotoGeometria security

> Project overview in Portuguese and Spanish: [README.pt-BR.md](README.pt-BR.md) · [README.es-ES.md](README.es-ES.md) (this policy is English-only).

FotoGeometria is a web app made of static files, served by GitHub Pages. It has no server of its own, no accounts and no database: the photo is decoded, corrected and exported inside the browser. This document says what that design protects, what it does not, and how to report a vulnerability. It must be kept in step with the code: **a change to what the page loads, stores or sends needs a review of this file**.

## Supported versions

Only the version deployed from `main` receives fixes. There are no releases to backport to.

## 1. Threat model

### Protected

- **The photo stays on the device.** Nothing the app does sends image data anywhere: there is no endpoint to send it to. From stage 7 of the plan, a Content Security Policy will make that a rule the browser enforces, so that no script, ours or injected, can open a connection to another origin.
- **The metadata of the photo stays on the device.** The exported JPEG is encoded from pixels, so it carries no EXIF: no location, no device, no date (stage 5 of the plan).
- **Files from anywhere.** Photos arrive from messaging apps and downloads, so every file is untrusted. The browser's own decoder reads the pixels; the only parser of ours that reads the file is the EXIF reader (stage 3), which is asked for two tags.
- **The supply chain.** Every dependency is pinned to an exact version, and `package-lock.json` pins the tree beneath them. Dependabot watches the npm packages and the GitHub Actions. The CI workflows run with a read-only token, and the labeler workflow, which holds a write token, never checks out the code of a pull request.
- **Secrets.** The project needs none: no key, no token, no password. `tools/scan-secrets.sh` fails CI on a tracked key file, private key material, an access token or a literal credential.

### Not protected

- A compromised device or browser, or a browser extension with access to the page.
- The hosting: whoever controls this repository or its GitHub Pages site controls the code your browser runs. Once the app is installed, its service worker keeps a copy, and a new version arrives on the next load.
- What happens to a photo after you share or save it.

## 2. Reporting a vulnerability

Please report it privately, through GitHub: the **Security** tab of the repository, then **Report a vulnerability** (<https://github.com/angeloINTJ/fotogeometria/security/advisories/new>). Do not open a public issue.

Say what an attacker can do, how to reproduce it (browser, operating system, the steps) and, if it takes a file, attach one that is synthetic or yours to share. The fix ships with the next deploy from `main`, and the CHANGELOG credits the report unless you ask it not to.

## 3. Rules for changes

- The page loads nothing from another origin: no CDN, no remote font, no analytics. A new origin is a change to this document first.
- Workers and WebAssembly come from the app's own origin.
- A new runtime dependency is reviewed for what it does in the browser, and listed in `tools/third-party.json`.
