import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { DashboardScreenSlice } from '@/storybook/screenSlices/DashboardScreenSlice';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

const meta = {
  title: 'App/Screens/Dashboard',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AuthenticatedScreenShell currentTab="dashboard">
        <Story />
      </AuthenticatedScreenShell>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const HappyPath: Story = {
  render: () => <DashboardScreenSlice variant="happy" />,
};

export const HappyPathDark: Story = {
  ...storyDarkTheme,
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
