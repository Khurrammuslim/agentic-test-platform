import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Quarantined = { title: string; owner: string; ticket: string; expires: string };
const quarantined: Quarantined[] = JSON.parse(readFileSync('quarantine.json', 'utf8'));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const grepInvert = quarantined.length
  ? new RegExp(quarantined.map((q) => esc(q.title)).join('|'))
  : undefined;

export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: 'https://demo.playwright.dev/todomvc/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  grepInvert,
  projects: [
    { name: 'smoke', testDir: './tests/smoke' },
    { name: 'regression', testDir: './tests/regression' },
    { name: 'generated', testDir: './tests/generated' },
  ],
});
