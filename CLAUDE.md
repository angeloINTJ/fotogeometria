# CLAUDE.md

Read [AGENTS.md](AGENTS.md) first: it is the operating manual, and everything of substance lives there. This file exists because Claude Code loads `CLAUDE.md` automatically and not `AGENTS.md`.

The project's own instructions, from the plan (PLANO.md §10):

- Answer and explain in Brazilian Portuguese. Code, comments, commits and pull requests are in English.
- Well-commented code, formatted by Prettier. Every exported function has a TSDoc comment.
- In a targeted change, show only the functions that changed.
- Never remove a function in a refactor without confirming first.
- `src/core/` is pure mathematics: no DOM, no WebGL, no side effects.
- The reference algorithm is `reference/corrigir_geometria.py`; any numerical difference from it must be justified and covered by a test.
- Before finishing a task: `npm run lint`, `npm run typecheck`, `npm test` (and the rest of AGENTS.md §3).
- Never commit photos of identifiable people.
- Follow the plan in `docs/PLANO.md`, one stage at a time; `docs/DECISIONS.md` records where the code departs from it.
