import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthenticatedScreenShell } from '@/storybook/screenSlices/AuthenticatedScreenShell';
import { BudgetsScreenSlice } from '@/storybook/screenSlices/BudgetsScreenSlice';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

const meta = {
  title: 'App/Screens/Budgets',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AuthenticatedScreenShell currentTab="budgets">
        <Story />
      </AuthenticatedScreenShell>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: () => <BudgetsScreenSlice state="loaded" />,
};

export const LoadedDark: Story = {
  ...storyDarkTheme,
  render: () => <BudgetsScreenSlice state="loaded" />,
};

export const Empty: Story = {
  render: () => <BudgetsScreenSlice state="empty" />,
};

export const ServerError: Story = {
  render: () => <BudgetsScreenSlice state="error" />,
};

export const AddBudgetForm: Story = {
  render: () => <BudgetsScreenSlice state="adding" />,
};
