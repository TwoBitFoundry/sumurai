import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { within } from 'storybook/test';
import { sampleSankeySurplus } from '@/storybook/fixtures/analytics';
import {
  buildStoryAccountFilterContextFromAccounts,
  MockAccountFilterProvider,
} from '@/storybook/mockAccountFilter';
import {
  getCursorStoryTransactions,
  storyCategoryList,
  storyDashboardFixtures,
  storyProviderAccounts,
} from '@/storybook/screens/user-journeys/shared';
import { jsonResponse, route, StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';
import { waitForDashboardSankeyIncome } from '@/storybook/screens/user-journeys/storyPlay';
import DashboardStatsCarousel from './DashboardStatsCarousel';

const handlers = [
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/analytics/balances/overview', () =>
    jsonResponse(storyDashboardFixtures.balancesOverview)
  ),
  route('GET', '/analytics/date-bounds', () =>
    jsonResponse({
      start_date: '2026-01-01',
      end_date: '2026-06-21',
    })
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

function DashboardStatsCarouselStoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MockAccountFilterProvider
        value={buildStoryAccountFilterContextFromAccounts(storyProviderAccounts)}
      >
        {children}
      </MockAccountFilterProvider>
    </QueryClientProvider>
  );
}

function DashboardStatsCarouselStory() {
  return (
    <DashboardStatsCarouselStoryProviders>
      <StoryApiScope handlers={handlers}>
        <DashboardStatsCarousel dateRange="current-month" />
      </StoryApiScope>
    </DashboardStatsCarouselStoryProviders>
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
    await waitForDashboardSankeyIncome(canvas);
  },
};
