import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { ask } from './llm.js';

const charterPath = process.argv[2];
if (!charterPath) throw new Error('Pass a charter file, e.g. charters/todo-edit.md');

const charter = readFileSync(charterPath, 'utf8');
const style = readFileSync('tests/regression/todo.regression.spec.ts', 'utf8');

const system = `You write Playwright TypeScript tests. Rules:
- Output ONLY the TypeScript file, no explanation.
- Use getByRole / getByTestId / getByPlaceholder locators only. No CSS selectors, no waitForTimeout.
- Use web-first assertions (expect(locator)...). Every assertion must come directly from the charter's Expected lines. Do not invent behaviour.
- If the charter is ambiguous, add a comment starting with // QUESTION: instead of guessing.
- Follow the style of the example file.`;

const raw = await ask(system, `Example file:\n${style}\n\nCharter:\n${charter}`);
console.log('--- RAW MODEL OUTPUT ---\n' + raw + '\n--- END ---');

const FENCE = '`'.repeat(3);
const fenced = raw.match(new RegExp(FENCE + '(?:typescript|ts)?\\n([\\s\\S]*?)' + FENCE));
const code = (fenced ? fenced[1] : raw).trim();

if (!code.includes('test(')) {
  throw new Error('Model returned no test code. Look at the RAW MODEL OUTPUT above.');
}

const out = `tests/generated/${basename(charterPath, '.md')}.spec.ts`;
writeFileSync(
  out,
  `// AUTO-GENERATED from ${charterPath}. NEEDS HUMAN REVIEW before moving to tests/regression.\n${code}\n`,
);
console.log(`Draft written to ${out}. Review the assertions against the charter, then open a PR.`);
