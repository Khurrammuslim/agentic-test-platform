# Agentic Test Platform (prototype)

[![PR gate](https://github.com/Khurrammuslim/agentic-test-platform/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/Khurrammuslim/agentic-test-platform/actions/workflows/pr-gate.yml)

A small, working model of an agentic test architecture: AI helps write and review test drafts, people approve them, and deterministic CI decides what ships.

**Principle: agents propose, humans approve, CI decides.**

The target app is the public [TodoMVC demo](https://demo.playwright.dev/todomvc/) (no login), so anyone can run this repo.

## How it works

1. **A QA writes a charter** in plain language (`charters/`): scenario, expected result, risk. No code.
2. **An agent drafts a test.** `npm run generate` sends the charter to an LLM, which writes a Playwright test into `tests/generated/`. The rules require accessible locators, forbid hard waits, and say every assertion must come from the charter's Expected lines.
3. **A second model reviews the draft.** `npm run review-draft` (LLM-as-judge) compares the draft with its charter and lists assertions the charter does not support and charter lines the draft misses. It is advisory only.
4. **A human reviews and promotes the draft.** The reviewer checks every assertion against the charter and moves the test to `tests/regression/` through a pull request.
5. **CI decides.** Only deterministic Playwright tests can pass or fail a PR. No LLM gates a merge.
6. **Flaky tests are managed, not hidden.** A test can be quarantined only with an owner, a ticket and an expiry date. An expired entry fails the gate.
7. **Failed locators get repair proposals, never silent fixes.** `npm run heal` reads the failed run, picks only tests that failed because a locator found no element, asks the LLM for a replacement locator using the page snapshot, and writes a proposal file with a diff and a reviewer checklist. It never edits a test and never touches assertion failures, because those may be real bugs.
8. **KPIs come from every run.** A script turns Playwright's JSON results into a short report: duration, pass rate and flake rate.

## Repository map

| Path                          | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `tests/smoke`                 | PR gate tests: few, fast, deterministic                               |
| `tests/regression`            | Broader coverage for nightly runs                                     |
| `tests/generated`             | AI drafts; never block a PR until a human promotes them               |
| `tests/pages`                 | Page object for the todo app                                          |
| `tests/fixtures.ts`           | Playwright fixture that opens the app and provides the page object    |
| `charters/`                   | Plain-language QA charters                                            |
| `CLAUDE.md`                   | Product knowledge and conventions for AI agents working in this repo  |
| `.claude/skills/`             | Agent skill: charter to test draft                                    |
| `scripts/llm.ts`              | Small adapter to the LLM (local Ollama)                               |
| `scripts/generate-test.ts`    | Charter to Playwright draft                                           |
| `scripts/review-draft.ts`     | LLM-as-judge review of a draft against its charter                    |
| `scripts/judge.ts`            | Generic LLM-as-judge for non-deterministic checks; never gates a PR   |
| `scripts/heal-proposal.ts`    | Self-healing, proposals only: suggests locator fixes for failed tests |
| `scripts/quarantine-check.ts` | Enforces owner, ticket and expiry on quarantined tests                |
| `scripts/kpi-report.ts`       | Builds `kpi.md` from `results.json`                                   |
| `quarantine.json`             | Quarantined tests (empty by default)                                  |
| `.github/workflows`           | `pr-gate.yml` (PRs and pushes to main) and `nightly.yml` (scheduled)  |

## Quality gates

| Level                  | What runs                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Local, on commit       | Husky runs lint-staged: ESLint (with Playwright rules) and Prettier on staged files        |
| Local, on push         | Husky runs the TypeScript type check                                                       |
| PR gate (blocking)     | Type check, lint, format check, quarantine rules, sharded smoke tests with a 10 minute cap |
| Nightly (non-blocking) | Regression and committed drafts in `tests/generated`, then the KPI report                  |

ESLint forbids `waitForTimeout` and tests without assertions. `tests/generated` is excluded from lint because drafts are unreviewed by definition.

## Getting started

Requires Node 20 or newer.

```bash
npm install
npx playwright install chromium
npm run test:smoke        # expect 2 passed
npm run test:regression   # expect 3 passed
npm run kpi               # writes kpi.md from the last run
```

## Commands

| Command                                     | What it does                                        |
| ------------------------------------------- | --------------------------------------------------- |
| `npm run test:smoke`                        | Runs the smoke project                              |
| `npm run test:regression`                   | Runs the regression project                         |
| `npm run generate -- <charter>`             | Drafts a test from a charter                        |
| `npm run review-draft -- <charter> <draft>` | Reviews a draft against its charter                 |
| `npm run judge -- "<text>" "<rubric>"`      | Generic LLM-as-judge for a text and a rubric        |
| `npm run heal`                              | Writes locator repair proposals from `results.json` |
| `npm run quarantine:check`                  | Validates `quarantine.json`                         |
| `npm run kpi`                               | Writes `kpi.md` from `results.json`                 |
| `npm run lint` / `npm run lint:fix`         | ESLint check / auto-fix                             |
| `npm run format` / `npm run format:check`   | Prettier write / check                              |
| `npm run typecheck`                         | TypeScript check without emitting files             |

## AI draft and review (local, free)

The LLM adapter talks to [Ollama](https://ollama.com), so no API key or cost is needed.

```bash
ollama pull qwen2.5-coder:7b
npm run generate -- charters/todo-edit.md
npm run review-draft -- charters/todo-edit.md tests/generated/todo-edit.spec.ts
npx playwright test --project=generated
```

Drafts from a small local model often need fixes, and the reviewer model can be wrong too. That is why a human always approves. The LLM sits behind one file (`scripts/llm.ts`), so switching to a hosted model such as Claude is a one-file change. That change is not made in this prototype.

## Self-healing (proposals only)

```bash
npm run test:regression   # a locator breaks, the run fails and writes results.json
npm run heal              # writes healing/proposals/*.md
```

Each proposal shows the old and new locator as a diff, a confidence level and a reviewer checklist. A person confirms that the UI change was intended (otherwise it is a bug), applies the change, runs the test and opens a pull request. Proposal files are git-ignored.

## When the workflows run

- `pr-gate.yml` runs on every pull request, and on pushes to `main` as a post-merge check.
- `nightly.yml` runs on a schedule (02:00 UTC) and can be started manually from the Actions tab.
- `generate`, `review-draft` and `heal` are not part of CI. A person runs them locally.
- Branch protection on `main` requires the `quarantine`, `smoke (1/2)` and `smoke (2/2)` checks, with no admin bypass.

## Demo walkthrough

1. Open a pull request with a small harmless change: all checks go green and the PR can merge.
2. Open a pull request that breaks an expectation in `tests/smoke`: a `smoke` check goes red and the merge is blocked.
3. Run `npm run kpi` to see duration, pass rate and flake rate.
4. Add an entry to `quarantine.json` with an expiry in the past and run `npm run quarantine:check` to see it fail.

## Limits

- It tests a public demo app, not a production system.
- The KPI report covers one run, not a trend over time.
- Test data is trivial: there is no real data lifecycle, and the demo app has no API to test.
- A small local model writes weak drafts and gives a weak review.
- Draft generation and review run locally, not in CI.
- Playwright's planner, generator and healer agents are not used here.
- Self-healing only proposes locator changes for failures with a page snapshot. A person applies them, and assertion failures are never healed.
- No load testing is done, because the target is a public site owned by someone else.
- Feature flag, test management and issue tracker integrations are not built.

## Possible next steps

- Run a scheduled job that drafts tests from new charters, reviews them, and opens a pull request for a human.
- Run healing in the nightly job and open a pull request for each proposal.
- Run tests per feature-flag state.
- Push results to a test management tool and link failures to issues.
- Check new tests by deliberately breaking the behaviour to confirm they fail.
- Track KPIs over time and the acceptance rate of generated drafts.
- Add performance checks against an environment the team owns.
