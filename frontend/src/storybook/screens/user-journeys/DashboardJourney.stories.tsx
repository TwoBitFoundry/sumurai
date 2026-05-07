import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';
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
  return (
    <StoryApiScope handlers={handlers}>
      <AccountFilterProvider>
        <DashboardPage />
      </AccountFilterProvider>
    </StoryApiScope>
  );
}

export const Journey: Story = {
  render: () => <DashboardJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/overview of balances/i)).toBeVisible();
    });
    await waitFor(() => {
      expect(canvas.getByText('Food And Drink')).toBeVisible();
    });

    const foodLabel = canvas.getByText('Food And Drink');
    const foodCard = foodLabel.parentElement?.parentElement;
    if (!foodCard) {
      throw new Error('Missing category card');
    }

    await userEvent.hover(foodLabel);
    await expect(foodCard).toHaveClass('-translate-y-[2px]');
  },
};
