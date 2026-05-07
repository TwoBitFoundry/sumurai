import { expect, test } from '@playwright/test';

const storyIds = [
  'primitives-button--primary',
  'primitives-button--disabled',
  'primitives-glasscard--default',
  'primitives-input--invalid',
  'features-budgets-budgetsummarycard--default',
  'features-transactions-transactionstoolbar--default',
  'features-analytics-dashboardchartcard--default',
  'storybook-fullpagesmoke--deprecated-placeholder',
];

test.describe('storybook visual regression', () => {
  for (const id of storyIds) {
    test(`iframe ${id}`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => document.body.classList.contains('sb-show-main'), {
        timeout: 120000,
      });
      await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
});
