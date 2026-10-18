// Self-healing, PROPOSALS ONLY. This script never edits a test.
// It reads results.json, finds tests that failed because a LOCATOR was not found,
// asks the LLM for a replacement locator, and writes a proposal file for a human to review.
// Assertion failures are never healed: they may be real bugs.
// Usage: npm run heal            (reads results.json)
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ask } from './llm.js';

type Failure = { title: string; message: string; contextPath?: string };
type Place = { file: string; line: number; text: string };

const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const clean = (s: string) => s.replace(ANSI, '');

function collectFailures(suite: any, path: string[], out: Failure[]) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      if (t.status !== 'unexpected') continue; // flaky tests passed on retry: not our job here
      const last = t.results?.[t.results.length - 1] ?? {};
      const message = (last.errors?.length ? last.errors : [last.error])
        .map((e: any) => e?.message ?? '')
        .join('\n\n');
      const ctx = (last.attachments ?? []).find((a: any) =>
        String(a.path ?? '').endsWith('error-context.md'),
      );
      out.push({
        title: [...here, spec.title].join(' > '),
        message: clean(message),
        contextPath: ctx?.path,
      });
    }
  }
  for (const s of suite.suites ?? []) collectFailures(s, here, out);
}

function failingLocator(message: string): string | undefined {
  // Only action failures (locator.fill, locator.click, ...) with a timeout are eligible.
  // Assertion failures start with "Error: expect(" and are never healed.
  // Do not search the whole message for "expect(": the code frame can contain it.
  if (/Error: expect\(/.test(message)) return undefined;
  if (!/Error: (locator|page)\.\w+:/.test(message) || !/timeout/i.test(message)) return undefined;
  const m = message.match(/waiting for (getBy\w+\([^\n]*|locator\([^\n]*)/);
  if (!m) return undefined;
  return m[1].slice(0, m[1].lastIndexOf(')') + 1);
}

// Fallback when results.json has no attachment path: match the test-results folder by the end of the test title.
function findContext(title: string, dir = 'test-results'): string | undefined {
  if (!existsSync(dir)) return undefined;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tail = norm(title.split(' > ').pop() ?? '').slice(-14);
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'error-context.md');
    if (tail && norm(name).includes(tail) && existsSync(file)) return file;
  }
  return undefined;
}

function findInSource(dir: string, needle: string, found: Place[] = []): Place[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) findInSource(p, needle, found);
    else if (p.endsWith('.ts')) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((text, i) => {
          if (text.includes(needle)) found.push({ file: p, line: i + 1, text: text.trim() });
        });
    }
  }
  return found;
}

const system = `You propose a replacement Playwright locator for a test whose locator no longer finds an element.
Reply with JSON only, no other text:
{"new_locator": string, "reason": string, "confidence": "low" | "medium" | "high"}
Rules:
- Use only elements that appear in the page snapshot.
- Prefer getByRole, then getByTestId, getByPlaceholder, getByLabel, getByText.
- new_locator must be a single expression such as getByRole('button', { name: 'Save' }). No semicolons, no await, no assertions.
- If no element in the snapshot clearly matches, use confidence "low".`;

const resultsPath = process.argv[2] ?? 'results.json';
const data = JSON.parse(readFileSync(resultsPath, 'utf8'));
const failures: Failure[] = [];
for (const s of data.suites ?? []) collectFailures(s, [], failures);

const outDir = 'healing/proposals';
const notes: string[] = [];
let written = 0;

for (const f of failures) {
  const locator = failingLocator(f.message);
  if (!locator) {
    notes.push(
      `SKIP  ${f.title}: not a locator failure (assertion or other). A human must look at it.`,
    );
    continue;
  }
  const contextPath =
    f.contextPath && existsSync(f.contextPath) ? f.contextPath : findContext(f.title);
  if (!contextPath) {
    notes.push(`SKIP  ${f.title}: no page snapshot found, cannot propose safely.`);
    continue;
  }
  const places = findInSource('tests', locator);
  if (!places.length) {
    notes.push(`SKIP  ${f.title}: could not find ${locator} in tests/.`);
    continue;
  }

  const snapshot = readFileSync(contextPath, 'utf8').slice(0, 6000);
  const raw = await ask(
    system,
    `Failing locator: ${locator}\n\nError:\n${f.message.slice(0, 1500)}\n\nSource lines:\n${places.map((p) => p.text).join('\n')}\n\nPage snapshot:\n${snapshot}`,
    500,
  );
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  let proposal: { new_locator?: string; reason?: string; confidence?: string };
  try {
    proposal = JSON.parse(raw.slice(start, end + 1));
  } catch {
    notes.push(`SKIP  ${f.title}: model did not return JSON.`);
    continue;
  }
  const next = proposal.new_locator ?? '';
  const safe =
    /^(getBy\w+|locator)\(.*\)$/.test(next) &&
    !/[;\n]|await|expect|waitForTimeout/.test(next) &&
    next !== locator;
  if (!safe) {
    notes.push(`SKIP  ${f.title}: model proposal was unsafe or unchanged (${next || 'empty'}).`);
    continue;
  }

  mkdirSync(outDir, { recursive: true });
  const slug = f.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
  const file = join(outDir, `${written + 1}-${slug}.md`);
  const diff = places
    .map((p) => `${p.file}:${p.line}\n- ${p.text}\n+ ${p.text.replace(locator, next)}`)
    .join('\n\n');
  writeFileSync(
    file,
    [
      `# Healing proposal: ${f.title}`,
      '',
      `Confidence: ${proposal.confidence ?? 'unknown'}`,
      `Reason: ${proposal.reason ?? 'none given'}`,
      '',
      '## Proposed change (locator only, assertions untouched)',
      '',
      '```diff',
      diff,
      '```',
      '',
      '## Reviewer checklist',
      '',
      '- [ ] Open the trace or report and confirm the new locator hits the intended element.',
      '- [ ] Confirm the UI change was intended. If not, this is a bug: report it, do not heal.',
      '- [ ] Apply the change by hand, run the test, and open a pull request.',
      '',
      'This file is a proposal. Nothing has been changed in the tests.',
      '',
    ].join('\n'),
  );
  notes.push(`PROPOSAL  ${f.title}: ${file}`);
  written++;
}

console.log(`Failed tests: ${failures.length}. Proposals written: ${written}.`);
for (const n of notes) console.log(n);
