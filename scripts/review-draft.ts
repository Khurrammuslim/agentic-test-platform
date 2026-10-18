// LLM-as-judge in use: reviews an AI-generated draft against its charter.
// Advisory only. A human still decides. It never gates a PR.
// Usage: npm run review-draft -- charters/todo-edit.md tests/generated/todo-edit.spec.ts
import { readFileSync } from 'node:fs';
import { ask } from './llm.js';

const [charterPath, draftPath] = process.argv.slice(2);
if (!charterPath || !draftPath) {
  throw new Error('Usage: npm run review-draft -- <charter.md> <draft.spec.ts>');
}

const charter = readFileSync(charterPath, 'utf8');
const draft = readFileSync(draftPath, 'utf8');

const system = `You review AI-generated Playwright tests against a QA charter.
Reply with JSON only, no other text:
{"verdict": "pass" or "fail", "unsupported_assertions": string[], "missing_coverage": string[]}
An assertion is unsupported if it checks behaviour that is not stated in the charter's Expected lines.
Coverage is missing if an Expected or Also check line has no matching assertion.
Verdict is "pass" only if both lists are empty.`;

const raw = await ask(system, `Charter:\n${charter}\n\nDraft test:\n${draft}`, 600);
const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Judge did not return JSON. Raw reply:\n' + raw);
}
const result = JSON.parse(raw.slice(start, end + 1));
console.log(JSON.stringify(result, null, 2));
process.exit(result.verdict === 'pass' ? 0 : 1);
