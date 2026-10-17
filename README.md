# Agentic Test Platform (prototype)

[![PR gate](https://github.com/Khurrammuslim/agentic-test-platform/actions/workflows/pr-gate.yml/badge.svg)](https://github.com/Khurrammuslim/agentic-test-platform/actions/workflows/pr-gate.yml)

A small, working model of an agentic test architecture: AI helps write and triage tests, people review them, and deterministic CI decides what ships.

**Principle: agents propose, humans approve, CI decides.**

The target app is the public [TodoMVC demo](https://demo.playwright.dev/todomvc/) (no login), so anyone can run this repo.

## How it works

1. **A QA writes a charter** in plain language (`charters/`): scenario, expected result, risk. No code.
2. **An agent drafts a test.** `npm run generate` sends the charter to an LLM, which writes a Playwright test into `tests/generated/`. The prompt requires accessible locators, forbids hard waits, and says every assertion must come from the charter's Expected lines.
3. **A human reviews the draft** against the charter, then moves it to `tests/regression/` through a pull request.
4. **CI decides.** Only deterministic Playwright tests can pass or fail a PR. The LLM never gates a merge.
5. **Flaky tests are managed, not hidden.** A test can be quarantined only with an owner, a ticket and an expiry date. An expired entry fails the gate.
6. **KPIs come from every run.** A script turns Playwright's JSON results into a short report: duration, pass rate and flake rate.

## Repository map

| Path                          | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `tests/smoke`                 | PR gate tests: few, fast, deterministic                              |
| `tests/regression`            | Broader coverage for nightly runs                                    |
| `tests/generated`             | AI drafts; never block a PR until a human promotes them              |
| `charters/`                   | Plain-language QA charters                                           |
| `scripts/llm.ts`              | Small adapter to the LLM (local Ollama by default)                   |
| `scripts/generate-test.ts`    | Charter to Playwright draft                                          |
| `scripts/judge.ts`            | LLM-as-judge for non-deterministic checks only; never gates a PR     |
| `scripts/quarantine-check.ts` | Enforces owner, ticket and expiry on quarantined tests               |
| `scripts/kpi-report.ts`       | Builds `kpi.md` from `results.json`                                  |
| `quarantine.json`             | Quarantined tests (empty by default)                                 |
| `.github/workflows`           | `pr-gate.yml` (PRs and pushes to main) and `nightly.yml` (scheduled) |

## Quality gates

| Level                  | What runs                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Local, on commit       | Husky runs lint-staged: ESLint (with Playwright rules) and Prettier on staged files        |
| Local, on push         | Husky runs the TypeScript type check                                                       |
| PR gate (blocking)     | Type check, lint, format check, quarantine rules, sharded smoke tests with a 10 minute cap |
| Nightly (non-blocking) | Regression and generated drafts, then the KPI report                                       |

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

| Command                                | What it does                            |
| -------------------------------------- | --------------------------------------- |
| `npm run test:smoke`                   | Runs the smoke project                  |
| `npm run test:regression`              | Runs the regression project             |
| `npm run generate -- <charter>`        | Drafts a test from a charter            |
| `npm run judge -- "<text>" "<rubric>"` | LLM-as-judge for a text and a rubric    |
| `npm run quarantine:check`             | Validates `quarantine.json`             |
| `npm run kpi`                          | Writes `kpi.md` from `results.json`     |
| `npm run lint` / `lint:fix`            | ESLint check / auto-fix                 |
| `npm run format` / `format:check`      | Prettier write / check                  |
| `npm run typecheck`                    | TypeScript check without emitting files |

## AI draft step (local, free)

The LLM adapter talks to [Ollama](https://ollama.com), so no API key or cost is needed.

```bash
ollama pull qwen2.5-coder:7b
npm run generate -- charters/todo-edit.md
npx playwright test --project=generated
```

The draft is a starting point and often needs fixes. That is the reason the human review step exists. To use another model or server, set `LLM_MODEL` and `LLM_URL`, or change `scripts/llm.ts`.

## When the workflows run

- `pr-gate.yml` runs on every pull request, and on pushes to `main` as a post-merge check.
- `nightly.yml` runs on a schedule (02:00 UTC) and can be started manually from the Actions tab (workflow_dispatch).
- Branch protection on `main` requires the `quarantine` and `smoke` checks, with no admin bypass.

## Demo walkthrough

1. Open a pull request with a small harmless change: both checks go green and the PR can merge.
2. Open a pull request that breaks an expectation in `tests/smoke`: the `smoke` check goes red and the merge is blocked.
3. Run `npm run kpi` to see duration, pass rate and flake rate.
4. Add an entry to `quarantine.json` with an expiry in the past and run `npm run quarantine:check` to see it fail.

## Limits

- It tests a public demo app, not a production system.
- The KPI report covers one run, not a trend over time.
- Test data is trivial: there is no real data lifecycle.
- A small local model writes weaker drafts than a frontier model.
- Feature flag, test management and issue tracker integrations are not built.

## Possible next steps

- Run tests per feature-flag state.
- Push results to a test management tool and link failures to issues.
- Check new tests by deliberately breaking the behaviour to confirm they fail.
- Track KPIs over time and the acceptance rate of generated drafts.
