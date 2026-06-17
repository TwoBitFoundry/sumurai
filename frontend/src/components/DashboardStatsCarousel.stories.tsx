import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { sampleSankeySurplus } from '@/storybook/fixtures/analytics';
import {
  getCursorStoryTransactions,
  storyCategoryList,
  storyDashboardFixtures,
  storyProviderAccounts,
} from '@/storybook/screens/user-journeys/shared';
import { jsonResponse, route, StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';
import DashboardStatsCarousel from './DashboardStatsCarousel';

const handlers = [
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/analytics/balances/overview', () =>
    jsonResponse(storyDashboardFixtures.balancesOverview)
  ),
  route('GET', '/analytics/sankey', () => jsonResponse(sampleSankeySurplus)),
  route('GET', '/transactions', (request) =>
    jsonResponse(
      getCursorStoryTransactions({
        cursor: request.query.get('cursor'),
        limit: Number(request.query.get('limit') ?? '100'),
        search: request.query.get('search'),
        categoryPrimary: request.query.get('category_primary'),
      })
    )
  ),
];

function DashboardStatsCarouselStory() {
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <DashboardStatsCarousel dateRange="current-month" />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

const meta = {
  title: 'App/Components/DashboardStatsCarousel',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DashboardStatsCarouselStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => {
        expect(canvas.getByTestId('sankey-node-income')).toBeVisible();
      },
      { timeout: 15000 }
    );
  },
};
