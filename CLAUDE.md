# Project guide for AI agents

## Purpose

Prototype of an agentic test platform. Agents propose, humans approve, CI decides.

## Product knowledge (system under test: TodoMVC demo)

- Users add todos with Enter in the "What needs to be done?" input.
- Each todo has a checkbox ("Toggle Todo"), a title, and a Delete button that shows on hover.
- The counter text reads "N items left".
- Filters: All, Active, Completed.
- Double-clicking a todo edits it. Enter saves, Escape cancels.

## Conventions

- Tests live in `tests/smoke` (PR gate), `tests/regression` (nightly), `tests/generated` (AI drafts).
- Import `test` and `expect` from `tests/fixtures`. Use the `todoPage` fixture and the page object in `tests/pages`.
- Locators: getByRole, getByTestId, getByPlaceholder only. No CSS selectors, no `waitForTimeout`.
- Every assertion must come from the charter's Expected lines. If unclear, write `// QUESTION:`.
- Never merge generated tests without human review. Never add a test to `quarantine.json` without owner, ticket and expiry.
