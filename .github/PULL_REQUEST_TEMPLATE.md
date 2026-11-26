## Why

What problem this solves, or which stage of the plan it delivers. Link the issue: #

## What changes

The changes, grouped by subject, with the commit of each when there are several.

## Proof

The tests that prove it, written before the code, and what they printed. For a fix, the reproduction that fails before and passes after; for a refactor, the evidence that behaviour did not change. Say what was not verified (on a phone, on a real photo).

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build && npm run budget` (a size that moved is recorded, and the commit says why)
- [ ] `npm run gates`

## Checklist

- [ ] Commits follow Conventional Commits, in English
- [ ] Comments explain why, with the measurement and its date where one settled it
- [ ] `src/core/` stays pure: no DOM, no WebGL, no side effects
- [ ] A screen that changed passes the Ângulo checklist (docs/ANGULO.md §8), in both themes
- [ ] A new interface text exists in pt-BR, English and Spanish
- [ ] Documents updated in every language they exist in (README ×3, CONTRIBUTING ×3, CHANGELOG ×2)
- [ ] No photo of an identifiable person
