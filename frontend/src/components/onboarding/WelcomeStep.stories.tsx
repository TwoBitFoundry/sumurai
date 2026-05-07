import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { WelcomeStep } from './WelcomeStep';

const meta = {
  title: 'App/Onboarding/WelcomeStep',
  component: WelcomeStep,
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof WelcomeStep>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultDark: Story = {
  ...storyDarkTheme,
};
