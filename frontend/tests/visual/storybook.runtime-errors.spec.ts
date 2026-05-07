import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

function resolveStorybookStaticDir(): string {
  const candidates = [
    join(process.cwd(), 'storybook-static'),
    join(process.cwd(), 'frontend', 'storybook-static'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.json'))) {
      return dir;
    }
  }
  return candidates[0];
}

type StorybookIndex = {
  entries: Record<
    string,
    {
      type?: string;
      subtype?: string;
      tags?: string[];
    }
  >;
};

function loadStoryIds(): string[] {
  const indexPath = join(resolveStorybookStaticDir(), 'index.json');
  const raw = readFileSync(indexPath, 'utf8');
  const index = JSON.parse(raw) as StorybookIndex;
  return Object.entries(index.entries || {})
    .filter(([, e]) => {
      if (e.type !== 'story' || e.subtype !== 'story') return false;
      if (e.tags?.includes('play-fn')) return false;
      return true;
    })
    .map(([id]) => id);
}

test.describe('storybook iframe runtime errors', () => {
  const ids = loadStoryIds();

  test(`manifest lists ${ids.length} stories`, () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  for (const id of ids) {
    test(`iframe ${id} renders without uncaught exceptions`, async ({ page }) => {
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

      await page.goto(`/iframe?id=${encodeURIComponent(id)}&viewMode=story`, {
        waitUntil: 'domcontentloaded',
      });

      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'), {
        timeout: 60000,
      });

      await page.waitForTimeout(300);

      if (process.env.PW_STRICT_STORYBOOK_CONSOLE === '1') {
        expect.soft(consoleErrors, `console errors for ${id}`).toEqual([]);
      }

      expect(pageErrors, `uncaught exceptions for ${id}`).toEqual([]);
    });
  }
});
