import { expect, userEvent, waitFor, within } from 'storybook/test';

export const storyInteractionTimeoutMs = 15_000;

export async function waitForDashboardSankeyIncome(canvas: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(canvas.getByTestId('dashboard-stats-carousel')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
  await waitFor(
    () => {
      expect(canvas.queryByText('Loading money flow')).not.toBeInTheDocument();
      expect(canvas.getByTestId('sankey-node-income')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

export async function expandBalanceInsights(canvas: ReturnType<typeof within>) {
  const summaryButton = canvas.getByRole('button', { name: /balance insights/i });
  if (summaryButton.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(summaryButton);
  }
  await waitFor(
    () => {
      expect(canvas.getByTestId('balances-chart-plot')).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}
