import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
            storybookScript: 'npm run storybook -- --no-open',
            tags: {
              include: ['test'],
              exclude: [],
              skip: [],
            },
            disableAddonDocs: true,
          }),
        ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              api: {
                host: '0.0.0.0',
              },
              provider: playwright({}),
              headless: true,
              instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['./.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
