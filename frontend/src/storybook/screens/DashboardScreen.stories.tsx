import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { BottomContextualBar } from '@/components/BottomContextualBar';
import { DateRangePillSlider } from '@/features/analytics/components/DateRangePillSlider';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { DashboardScreenSlice } from '@/storybook/screenSlices/DashboardScreenSlice';
import type { DateRangeKey } from '@/utils/dateRanges';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('current-month');
  return (
    <AuthenticatedScreenShell
      currentTab="dashboard"
      bottomBarContent={
        <BottomContextualBar>
          <DateRangePillSlider dateRange={dateRange} onChange={setDateRange} />
        </BottomContextualBar>
      }
    >
      {children}
    </AuthenticatedScreenShell>
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
  render: () => <DashboardScreenSlice variant="happy" />,
};

export const AnalyticsLoading: Story = {
  render: () => <DashboardScreenSlice variant="analyticsLoading" />,
};

export const NetWorthLoading: Story = {
  render: () => <DashboardScreenSlice variant="netWorthLoading" />,
};

export const NetWorthError: Story = {
  render: () => <DashboardScreenSlice variant="netWorthError" />,
};
