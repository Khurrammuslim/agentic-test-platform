// Autonomous regression loop (proposals only).
// Finds charters that have no test yet, drafts a test for each, runs it, feeds failures back
// to the model (up to a few attempts), and has a second model review the passing draft.
// It never edits tests/regression, never commits, never merges. A person reviews the report and opens a PR.
// Usage: npm run autonomy
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { ask } from './llm.js';

const MAX_CHARTERS = Number(process.env.AUTONOMY_MAX_CHARTERS ?? 3);
const MAX_ATTEMPTS = Number(process.env.AUTONOMY_MAX_ATTEMPTS ?? 3);

const style = readFileSync('tests/regression/todo.regression.spec.ts', 'utf8');
const conventions = existsSync('CLAUDE.md') ? readFileSync('CLAUDE.md', 'utf8') : '';

const writerRules = `You write Playwright TypeScript tests. Rules:
- Output ONLY the TypeScript file, no explanation.
- Import test and expect from '../fixtures' and use the todoPage fixture.
- Use getByRole / getByTestId / getByPlaceholder locators only. No CSS selectors, no waitForTimeout.
- Every assertion must come directly from the charter's Expected lines. Do not invent behaviour.
- If the charter is ambiguous, add a comment starting with // QUESTION: instead of guessing.
- Follow the style of the example file.`;

const reviewerRules = `You review AI-generated Playwright tests against a QA charter.
Reply with JSON only, no other text:
{"verdict": "pass" or "fail", "unsupported_assertions": string[], "missing_coverage": string[]}
An assertion is unsupported if it checks behaviour that is not stated in the charter's Expected lines.
Coverage is missing if an Expected or Also check line has no matching assertion.
Verdict is "pass" only if both lists are empty.`;

const FENCE = '`'.repeat(3);
function extractCode(raw: string): string {
  const fenced = raw.match(new RegExp(FENCE + '(?:typescript|ts)?\\n([\\s\\S]*?)' + FENCE));
  return (fenced ? fenced[1] : raw).trim();
}

function runDraft(file: string): { ok: boolean; output: string } {
  const r = spawnSync(
    'npx',
    ['playwright', 'test', file, '--project=generated', '--reporter=line'],
    {
      encoding: 'utf8',
      timeout: 180_000,
    },
  );
  const output = ((r.stdout ?? '') + (r.stderr ?? '')).slice(-2500);
  return { ok: r.status === 0, output };
}

async function review(charter: string, code: string) {
  const raw = await ask(reviewerRules, `Charter:\n${charter}\n\nDraft test:\n${code}`, 600);
  try {
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    return { verdict: 'unknown', unsupported_assertions: [], missing_coverage: [] };
  }
}

const names = existsSync('charters')
  ? readdirSync('charters')
      .filter((f) => f.endsWith('.md'))
      .map((f) => basename(f, '.md'))
  : [];
const gaps = names.filter(
  (n) =>
    !existsSync(`tests/regression/${n}.spec.ts`) && !existsSync(`tests/generated/${n}.spec.ts`),
);
console.log(
  `Charters: ${names.length}. Without a test: ${gaps.length}. Working on: ${Math.min(gaps.length, MAX_CHARTERS)}.`,
);

const report: string[] = [
  `# Autonomous regression report (${new Date().toISOString().slice(0, 10)})`,
  '',
];

for (const name of gaps.slice(0, MAX_CHARTERS)) {
  const charter = readFileSync(`charters/${name}.md`, 'utf8');
  const target = `tests/generated/${name}.spec.ts`;
  let feedback = '';
  let code = '';
  let passed = false;
  let attempts = 0;
  let lastOutput = '';

  while (attempts < MAX_ATTEMPTS && !passed) {
    attempts++;
    const raw = await ask(
      writerRules,
      `Project conventions:\n${conventions}\n\nExample file:\n${style}\n\nCharter:\n${charter}${feedback}`,
    );
    code = extractCode(raw);
    if (!code.includes('test(')) {
      feedback =
        '\n\nYour previous reply contained no test code. Reply with the TypeScript file only.';
      continue;
    }
    writeFileSync(
      target,
      `// AUTO-GENERATED from charters/${name}.md. NEEDS HUMAN REVIEW before moving to tests/regression.\n${code}\n`,
    );
    const run = runDraft(target);
    lastOutput = run.output;
    passed = run.ok;
    if (!passed)
      feedback = `\n\nYour previous attempt failed. Fix the test, keep the assertions tied to the charter.\nPlaywright output:\n${run.output}`;
  }

  if (passed) {
    const verdict = await review(charter, code);
    report.push(
      `## ${name}: draft passes (attempts: ${attempts}), review: ${verdict.verdict}`,
      '',
      `File: ${target}`,
    );
    if (verdict.unsupported_assertions?.length)
      report.push(`Unsupported assertions: ${verdict.unsupported_assertions.join('; ')}`);
    if (verdict.missing_coverage?.length)
      report.push(`Missing coverage: ${verdict.missing_coverage.join('; ')}`);
    report.push(
      '',
      'Next step for a person: read the draft against the charter, then move it to tests/regression in a pull request.',
      '',
    );
  } else {
    mkdirSync('autonomy/rejected', { recursive: true });
    if (existsSync(target)) rmSync(target);
    if (code) writeFileSync(`autonomy/rejected/${name}.spec.ts.txt`, code);
    report.push(
      `## ${name}: rejected after ${attempts} attempts`,
      '',
      'Last Playwright output:',
      '',
      FENCE,
      lastOutput,
      FENCE,
      '',
    );
  }
}

if (report.length === 2) report.push('No charters without a test. Nothing to do.');
mkdirSync('autonomy', { recursive: true });
writeFileSync('autonomy/report.md', report.join('\n') + '\n');
console.log(report.join('\n'));
