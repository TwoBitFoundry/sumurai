import { availableParallelism } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

const cpu = availableParallelism();
const envCap = process.env.PW_RUNTIME_WORKERS
  ? Number(process.env.PW_RUNTIME_WORKERS)
  : 12;
const workers = Math.min(Math.max(4, cpu), Number.isFinite(envCap) ? envCap : 12);

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/storybook.runtime-errors.spec.ts',
  timeout: 90000,
  workers,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  maxFailures: process.env.PW_MAX_FAILURES
    ? Number(process.env.PW_MAX_FAILURES)
    : undefined,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6007',
  },
  webServer: {
    command: 'npx --yes serve storybook-static -l 6007 --no-port-switching',
    cwd: __dirname,
    url: 'http://127.0.0.1:6007/',
    reuseExistingServer: process.env.REUSE_STORYBOOK_SERVER === '1',
    timeout: 180000,
  },
});
