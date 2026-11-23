import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const hasMacChrome = existsSync(macChrome);

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    ...(hasMacChrome ? { channel: 'chrome' } : {})
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: true,
    timeout: 15_000
  }
});
