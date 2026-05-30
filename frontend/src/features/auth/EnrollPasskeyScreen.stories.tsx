import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EnrollPasskeyScreen } from '@/features/auth/EnrollPasskeyScreen';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';

const meta = {
  title: 'App/EnrollPasskey',
  component: EnrollPasskeyScreen,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onEnrollmentComplete: fn(),
    onLogout: fn(),
  },
} satisfies Meta<typeof EnrollPasskeyScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultDark: Story = {
  ...storyDarkTheme,
};
