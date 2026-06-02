import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import type { DateRangeKey } from '@/utils/dateRanges';
import DashboardPage from '@/views/DashboardPage';
import { storyDashboardFixtures, storyProviderAccounts } from './shared';
import { jsonResponse, route, StoryApiScope } from './storyApi';

const meta = {
  title: 'App/Screens/User Journeys/Dashboard',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const handlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/analytics/balances/overview', () =>
    jsonResponse(storyDashboardFixtures.balancesOverview)
  ),
  route('GET', '/analytics/spending', () => jsonResponse(storyDashboardFixtures.spendingTotal)),
  route('GET', '/analytics/categories', () => jsonResponse(storyDashboardFixtures.categories)),
  route('GET', '/analytics/top-merchants', () => jsonResponse(storyDashboardFixtures.topMerchants)),
  route('GET', '/analytics/monthly-totals', () =>
    jsonResponse(storyDashboardFixtures.monthlyTotals)
  ),
  route('GET', '/analytics/net-worth-over-time', () =>
    jsonResponse(storyDashboardFixtures.netWorth)
  ),
];

function DashboardJourney() {
  const setDateRange = (_range: DateRangeKey) => {};

  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <DashboardPage dateRange="current-month" setDateRange={setDateRange} />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

export const Journey: Story = {
  render: () => <DashboardJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /survey your warchest/i })).toBeVisible();
    });
    await waitFor(() => {
      expect(canvas.getByText('Food & Drink')).toBeVisible();
    });

    const foodLabel = canvas.getByText('Food & Drink');
    const foodCard = foodLabel.parentElement?.parentElement;
    if (!foodCard) {
      throw new Error('Missing category card');
    }

    await userEvent.hover(foodLabel);
    await waitFor(() => {
      expect(foodCard).toHaveStyle({ borderColor: expect.any(String) });
    });
  },
};
