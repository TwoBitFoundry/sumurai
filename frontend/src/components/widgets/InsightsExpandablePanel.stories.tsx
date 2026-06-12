import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { InsightsExpandablePanel } from './InsightsExpandablePanel';
import { InsightsPanelHeader } from './InsightsPanel';

const meta = {
  title: 'Widgets/Insights Expandable Panel',
  component: ExpandableDemo,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof ExpandableDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

function ExpandableDemo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <InsightsExpandablePanel
      testId="insights-expandable-story"
      bodyId="insights-expandable-story-body"
      bodyTestId="insights-expandable-story-body"
      summaryLabel={expanded ? 'Hide balances now' : 'Show balances now'}
      summary={
        <div className={cn('space-y-1.5')}>
          <InsightsPanelHeader label="Balances Now" />
          <div className={cn('text-left', uiTypographyRecipes.body, uiTextRecipes.body)}>
            Net worth overview
          </div>
        </div>
      }
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
    >
      <div className={cn('space-y-2', uiTypographyRecipes.body, uiTextRecipes.body)}>
        <div className="flex items-center justify-between gap-4">
          <span>Income</span>
          <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
            $9,040.73
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Expenses</span>
          <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-300">
            $14,616.84
          </span>
        </div>
      </div>
    </InsightsExpandablePanel>
  );
}

export const ToggleInteraction: Story = {
  render: () => <ExpandableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Show balances now' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Hide balances now' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      expect(canvas.getByTestId('insights-expandable-story-body')).toBeVisible();
    });
  },
};
