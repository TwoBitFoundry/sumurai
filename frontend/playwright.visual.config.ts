import { availableParallelism } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

const workers = Math.max(2, Math.min(8, Math.floor(availableParallelism() / 2) || 2));

export default defineConfig({
  testDir: './tests/visual',
  timeout: 120000,
  workers,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6007',
  },
  webServer: {
    command: 'npx --yes serve storybook-static -l 6007 --no-port-switching',
    cwd: __dirname,
    url: 'http://127.0.0.1:6007/',
    reuseExistingServer: false,
    timeout: 180000,
  },
});
