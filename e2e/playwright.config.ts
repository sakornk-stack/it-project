import { defineConfig } from '@playwright/test';

// Drives the app that is already running (`docker compose up -d`); nothing is
// started from here. Uses the installed Microsoft Edge, so no browser download
// is needed.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  // One session at a time: the demo accounts are shared, and POST /auth/login
  // is rate-limited per IP (see tests/helpers.ts).
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    channel: 'msedge',
    viewport: { width: 1366, height: 860 },
    locale: 'th-TH',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
