import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { InsightsPanelHeader } from './InsightsPanel';
import { InsightsPanelShell } from './InsightsPanelShell';

const meta = {
  title: 'Widgets/Insights Panel Shell',
  component: StickyPanelShellDemo,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof StickyPanelShellDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

function StickyPanelShellDemo() {
  return (
    <div className={cn('h-[28rem]', 'overflow-y-auto', 'bg-slate-100', 'p-4', 'dark:bg-slate-950')}>
      <div className="h-24" />
      <InsightsPanelShell testId="insights-shell-story" accent="violet">
        <div className={cn('px-3', 'py-2', 'md:px-4', 'md:py-3')}>
          <InsightsPanelHeader label="Balances Now" />
          <div className={cn('space-y-1.5', uiTypographyRecipes.body, uiTextRecipes.body)}>
            <div className="flex items-center justify-between gap-4">
              <span>Net worth</span>
              <span className="font-semibold tabular-nums text-violet-500 dark:text-violet-300">
                -$107,976.32
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Cash</span>
              <span className={cn('font-semibold', 'tabular-nums', uiTextRecipes.success)}>
                $15,668.27
              </span>
            </div>
          </div>
        </div>
      </InsightsPanelShell>
      <div className="h-[36rem]" />
    </div>
  );
}

export const StickyPanelShell: Story = {
  render: () => <StickyPanelShellDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('insights-shell-story')).toBeVisible();
    await expect(canvas.getByText('Balances Now')).toBeVisible();
  },
};
