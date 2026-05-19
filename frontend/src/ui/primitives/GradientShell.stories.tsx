import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { cn } from '@/ui/primitives';
import { radius as uiRadiusRecipes, text as uiTextRecipes } from '@/ui/recipes';
import { GradientShell } from './GradientShell';

const meta = {
  title: 'Primitives/GradientShell',
  component: GradientShell,
  tags: ['autodocs', 'test'],
  args: {
    children: (
      <div
        className={cn(
          uiRadiusRecipes.standard,
          'border',
          'border-white/10',
          'bg-white/60',
          'px-4',
          'py-3',
          'shadow-sm',
          'dark:bg-slate-900/60',
          uiTextRecipes.body
        )}
      >
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
