import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import {
  DateRangeLabelPill,
  DateRangePillSlider,
} from '@/features/analytics/components/DateRangePillSlider';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { sampleSankeySurplus } from '@/storybook/fixtures/analytics';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { DashboardScreenSlice } from '@/storybook/screenSlices/DashboardScreenSlice';
import type { DateRangeKey } from '@/utils/dateRanges';
import {
  storyCategoryList,
  storyProviderAccounts,
  storyTransactionCategories,
} from './user-journeys/shared';
import { jsonResponse, route, StoryApiScope } from './user-journeys/storyApi';

const handlers = [
  route('GET', '/categories', () => jsonResponse(storyCategoryList)),
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/analytics/balances/overview', () =>
    jsonResponse({
      asOf: 'latest',
      overall: {
        cash: 31260.73,
        credit: -842.4,
        loan: 0,
        investments: 0,
        positivesTotal: 31260.73,
        negativesTotal: -842.4,
        net: 30418.33,
        ratio: null,
      },
      banks: [
        {
          bankId: 'story-plaid-conn-1',
          bankName: 'Story Federal Credit Union',
          cash: 31260.73,
          credit: 0,
          loan: 0,
          investments: 0,
          positivesTotal: 31260.73,
          negativesTotal: 0,
          net: 31260.73,
          ratio: null,
        },
        {
          bankId: 'story-plaid-conn-2',
          bankName: 'Metro Digital Bank',
          cash: 0,
          credit: -842.4,
          loan: 0,
          investments: 0,
          positivesTotal: 0,
          negativesTotal: -842.4,
          net: -842.4,
          ratio: null,
        },
      ],
      mixedCurrency: false,
    })
  ),
  route('GET', '/analytics/sankey', () => jsonResponse(sampleSankeySurplus)),
  route('GET', '/transactions/categories', () => jsonResponse(storyTransactionCategories)),
  route('GET', '/transactions', (request) =>
    jsonResponse({
      transactions: [],
      total: 0,
      page: Number(request.query.get('page') ?? '1'),
      page_size: Number(request.query.get('page_size') ?? '8'),
    })
  ),
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('current-month');
  return (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={handlers}>
        <AuthenticatedScreenShell
          currentTab="dashboard"
          bottomBarContent={
            <BottomContextualBar topContent={<DateRangeLabelPill dateRange={dateRange} />}>
              <DateRangePillSlider dateRange={dateRange} onChange={setDateRange} />
            </BottomContextualBar>
          }
        >
          {children}
        </AuthenticatedScreenShell>
      </StoryApiScope>
    </AccountFilterStoryProvider>
  );
}

const meta = {
  title: 'App/Screens/Dashboard',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <DashboardShell>
        <Story />
      </DashboardShell>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const HappyPath: Story = {
  render: () => <DashboardScreenSlice variant="happy" dateRange="current-month" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId('sankey-node-income')).toBeVisible();
    });
    await userEvent.click(canvas.getByRole('tab', { name: /show balances now/i }));
    await waitFor(() => {
      expect(canvas.getByTestId('balances-chart-plot')).toBeVisible();
    });
  },
};

export const AnalyticsLoading: Story = {
  render: () => <DashboardScreenSlice variant="analyticsLoading" dateRange="current-month" />,
};

export const NetWorthLoading: Story = {
  render: () => <DashboardScreenSlice variant="netWorthLoading" dateRange="current-month" />,
};

export const NetWorthError: Story = {
  render: () => <DashboardScreenSlice variant="netWorthError" dateRange="current-month" />,
};
