import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GlassCard } from './GlassCard';

const meta = {
  title: 'Primitives/GlassCard',
  component: GlassCard,
  tags: ['autodocs'],
  args: {
    children: <p className="text-slate-800 dark:text-slate-100">Card body with glass styling.</p>,
    variant: 'default',
    rounded: 'lg',
    padding: 'md',
    withInnerEffects: true,
  },
} satisfies Meta<typeof GlassCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Accent: Story = {
  args: { variant: 'accent' },
};

export const DenseData: Story = {
  args: {
    padding: 'sm',
    children: (
      <div className="space-y-2 font-mono text-xs text-slate-700 dark:text-slate-200">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="flex justify-between gap-4 border-b border-white/10 pb-1">
            <span>TX-{1000 + index}</span>
            <span>{(index * 13.37).toFixed(2)}</span>
          </div>
        ))}
      </div>
    ),
  },
};

export const Overflow: Story = {
  args: {
    className: 'max-h-36 overflow-y-auto',
    children: (
      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {Array.from({ length: 40 }, (_, index) => (
          <div key={index}>Scrollable row {index + 1}</div>
        ))}
      </div>
    ),
  },
};

export const DarkCanvas: Story = {
  decorators: [
    (StoryEl) => (
      <div className="dark min-h-[200px] rounded-3xl bg-slate-950 p-8">
        <StoryEl />
      </div>
    ),
  ],
};
