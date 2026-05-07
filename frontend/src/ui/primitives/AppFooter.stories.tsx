import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AppFooter } from './AppFooter';

const meta = {
  title: 'Primitives/AppFooter',
  component: AppFooter,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof AppFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DarkCanvas: Story = {
  decorators: [
    (StoryEl) => (
      <div className="dark min-h-[260px] bg-slate-950">
        <StoryEl />
      </div>
    ),
  ],
};
