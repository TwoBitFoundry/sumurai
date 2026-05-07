import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

type StorybookIndex = {
  entries: Record<
    string,
    {
      type?: string;
      subtype?: string;
    }
  >;
};

function loadStoryIds(): string[] {
  const indexPath = join(process.cwd(), 'storybook-static/index.json');
  const raw = readFileSync(indexPath, 'utf8');
  const index = JSON.parse(raw) as StorybookIndex;
  return Object.entries(index.entries || {})
    .filter(([, e]) => e.type === 'story' && e.subtype === 'story')
    .map(([id]) => id);
}

test.describe('storybook iframe runtime errors', () => {
  const ids = loadStoryIds();

  test(`manifest lists ${ids.length} stories`, () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  for (const id of ids) {
    test(`iframe ${id} has no console errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`, {
        waitUntil: 'domcontentloaded',
      });

      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'), {
        timeout: 120000,
      });

      await page.waitForTimeout(800);

      expect.soft(consoleErrors, `console errors for ${id}`).toEqual([]);
      expect.soft(pageErrors, `page errors for ${id}`).toEqual([]);
    });
  }
});
