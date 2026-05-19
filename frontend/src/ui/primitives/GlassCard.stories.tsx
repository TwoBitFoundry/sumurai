import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { cn } from '@/ui/primitives';
import { radius as uiRadiusRecipes, text as uiTextRecipes } from '@/ui/recipes';
import { GlassCard } from './GlassCard';

const meta = {
  title: 'Primitives/GlassCard',
  component: GlassCard,
  tags: ['autodocs', 'test'],
  args: {
    children: <p className={uiTextRecipes.body}>Card body with glass styling.</p>,
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
      <div className={cn('space-y-2', 'font-mono', 'text-xs', uiTextRecipes.muted)}>
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
      <div className={cn('space-y-2', 'text-sm', uiTextRecipes.body)}>
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
      <div className={`dark min-h-[200px] bg-slate-950 p-8 ${uiRadiusRecipes.standard}`}>
        <StoryEl />
      </div>
    ),
  ],
};
