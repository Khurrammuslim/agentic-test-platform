import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('results.json', 'utf8'));
const counts = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } as Record<string, number>;
const flakyTitles: string[] = [];

function walk(suite: any, path: string[] = []) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
      if (t.status === 'flaky') flakyTitles.push([...here, spec.title].join(' > '));
    }
  }
  for (const s of suite.suites ?? []) walk(s, here);
}
for (const s of data.suites ?? []) walk(s);

const total = counts.expected + counts.unexpected + counts.flaky;
const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

const flakySection = flakyTitles.length
  ? [
      '## Flaky tests (fix or quarantine with owner and expiry)',
      ...flakyTitles.map((t) => '- ' + t),
    ]
  : ['No flaky tests in this run.'];

const lines = [
  `# KPI report (${new Date().toISOString().slice(0, 10)}`,
  '',
  '| Metric | Value |',
  '|---|---|',
  `| Run duration | ${(data.stats.duration / 1000).toFixed(1)} s |`,
  `| Tests run | ${total} |`,
  `| Pass rate | ${pct(counts.expected)} % |`,
  `| Flake rate (passed on retry) | ${pct(counts.flaky)} % |`,
  `| Failed | ${counts.unexpected} |`,
  '',
  ...flakySection,
];

const md = lines.join('\n') + '\n';
writeFileSync('kpi.md', md);
console.log(md);
