import { expect, test } from '@playwright/test';
import { VISUAL_STORYBOOK_MATRIX_IDS } from '../storybook/visualMatrix';

test.describe('storybook visual regression', () => {
  for (const id of VISUAL_STORYBOOK_MATRIX_IDS) {
    test(`iframe ${id}`, async ({ page }) => {
      await page.goto(`/iframe?id=${encodeURIComponent(id)}&viewMode=story`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'), {
        timeout: 120000,
      });
      await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
});
