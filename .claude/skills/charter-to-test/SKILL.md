---
name: charter-to-test
description: Turn a plain-language QA charter from charters/ into a Playwright test draft in tests/generated. Use when asked to draft, generate or write a test from a charter.
---

# Charter to test

1. Read the charter file and `CLAUDE.md`.
2. Write one spec file in `tests/generated/` named after the charter.
3. Import `test` and `expect` from `../fixtures` and use the `todoPage` fixture.
4. Make every assertion trace to a line under Expected or Also check. Do not invent behaviour.
5. If the charter is ambiguous, add a `// QUESTION:` comment instead of guessing.
6. Put this header on the first line: `// AUTO-GENERATED from <charter>. NEEDS HUMAN REVIEW before moving to tests/regression.`
7. Run `npm run review-draft -- <charter> <draft>` and fix unsupported assertions.
