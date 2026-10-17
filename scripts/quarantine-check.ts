import { readFileSync } from 'node:fs';

type Q = { title: string; owner: string; ticket: string; expires: string };
const list: Q[] = JSON.parse(readFileSync('quarantine.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const problems = list.flatMap((q) => [
  ...(!q.owner || !q.ticket || !q.expires
    ? [`"${q.title}": owner, ticket and expires are required`]
    : []),
  ...(q.expires && q.expires < today
    ? [`"${q.title}": quarantine expired on ${q.expires}, fix the test or remove it`]
    : []),
]);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Quarantine OK (${list.length} entries)`);
