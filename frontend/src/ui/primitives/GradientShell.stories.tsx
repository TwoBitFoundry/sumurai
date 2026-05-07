import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GradientShell } from './GradientShell';

const meta = {
  title: 'Primitives/GradientShell',
  component: GradientShell,
  tags: ['autodocs', 'test'],
  args: {
    children: (
      <div className="rounded-2xl border border-white/10 bg-white/60 px-4 py-3 text-slate-700 shadow-sm dark:bg-slate-900/60 dark:text-slate-200">
        Shell content
      </div>
    ),
    centered: false,
  },
} satisfies Meta<typeof GradientShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Centered: Story = {
  args: {
    centered: true,
  },
};

export const CenteredDark: Story = {
  args: {
    centered: true,
  },
  decorators: [
    (StoryEl) => (
      <div className="dark">
        <StoryEl />
      </div>
    ),
  ],
};
