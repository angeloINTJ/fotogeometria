# tools/

The repository's gates. Each one runs in CI on every pull request and every push to `main`, each has its own tests in `tests/tools/` (with the mutations that prove it bites), and each can be run alone:

| tool | what it holds | run |
|---|---|---|
| [scan-secrets.sh](scan-secrets.sh) | No tracked key file, private key material, access token or literal credential. Allowlist: [.secretscan-allow](.secretscan-allow), each entry with its reason. | `bash tools/scan-secrets.sh` |
| [check-angulo.mjs](check-angulo.mjs) | The Ângulo standard where a machine can check it: the pinned copies of simut-rx, the app's CSS, no emoji, flat-square badges. | `node tools/check-angulo.mjs` |
| [gen-notices.mjs](gen-notices.mjs) | `THIRD_PARTY_NOTICES.md` is what [third-party.json](third-party.json) renders, and every runtime dependency has an entry and a licence text. | `node tools/gen-notices.mjs --check` (or without `--check`, to write) |
| [check-budget.mjs](check-budget.mjs) | Every category of `dist/` equals its byte count in [budget.json](budget.json), up or down. | `npm run build && node tools/check-budget.mjs` (`--write` records) |
| [check-readme-numbers.mjs](check-readme-numbers.mjs) | The test count each README's status table quotes is the count Vitest ran. | `npm run readme-numbers` |

`npm run gates` runs the first three; the budget needs a build first, and the README numbers a test run.
