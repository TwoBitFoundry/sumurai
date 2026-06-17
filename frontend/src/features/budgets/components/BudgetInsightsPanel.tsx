import { Flame, Repeat2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import { InsightsExpandablePanel } from '@/components/widgets/InsightsExpandablePanel';
import { InsightsPanelHeader } from '@/components/widgets/InsightsPanel';
import { InsightsPanelShell } from '@/components/widgets/InsightsPanelShell';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { FixedExpenseCalculator } from '@/domain/FixedExpenseCalculator';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { FixedExpenseSummary } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { BudgetProgress } from './BudgetProgress';

export interface BudgetInsightsPanelProps {
  totalBudgeted: number;
  totalSpent: number;
  insights: BudgetInsights;
  fixedExpenses: FixedExpenseSummary[];
  month: Date;
  filterKey: string;
}

function fmtMonthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function fmtRunoutDate(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function BudgetInsightsPanel({
  totalBudgeted,
  totalSpent,
  insights,
  fixedExpenses,
  month,
  filterKey,
}: BudgetInsightsPanelProps) {
  const resetKey = `${month.getFullYear()}-${month.getMonth()}-${filterKey}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const { expanded, toggleExpanded } = useSessionCollapsible('budget-insights');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { isMobile } = useViewportBreakpoint();

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const overBudget = totalSpent > totalBudgeted;

  const { monthlyTotal, yearToDate } = FixedExpenseCalculator.computeFixedExpenseHeroStats(
    fixedExpenses,
    month
  );

  const bodyContent = (() => {
    if (!insights.hasActivity) {
      return (
        <div
          data-testid="budget-insights-empty"
          className={cn('py-4', 'text-center', uiTypographyRecipes.body, semanticTextRecipes.muted)}
        >
          No budget activity recorded for {fmtMonthName(month)} yet.
        </div>
      );
    }

    return (
      <>
        <InsightCard
          title="Runway"
          icon={<Flame />}
          value={
            insights.dailyPacing != null ? (
              <>
                <span className="justify-self-start">
                  {fmtUSD(insights.dailyPacing)}
                  <span
                    className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-1')}
                  >
                    d
                  </span>
                </span>
                {insights.runoutDate ? (
                  <>
                    <span
                      className={cn(
                        uiTypographyRecipes.caption,
                        semanticTextRecipes.body,
                        'justify-self-center'
                      )}
                    >
                      until
                    </span>
                    <span className="justify-self-start">{fmtRunoutDate(insights.runoutDate)}</span>
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                  </>
                )}
              </>
            ) : (
              '—'
            )
          }
          question="How much am I spending per day, and when will I run out at this pace?"
          accent="sky"
          flipped={!!flipped.pacing}
          onToggle={() => toggle('pacing')}
          outlined={false}
          tileLayout={!isMobile}
          tileAlign="start"
          subgridRow={isMobile}
        />
        <InsightCard
          title="Free Spend"
          icon={<Wallet />}
          value={
            <>
              <span
                className={cn(
                  'justify-self-start',
                  insights.freeSpend < 0 && semanticTextRecipes.danger
                )}
              >
                {fmtUSD(insights.freeSpend)}
              </span>
              <span
                className={cn(
                  uiTypographyRecipes.caption,
                  semanticTextRecipes.body,
                  'justify-self-center'
                )}
              >
                /
              </span>
              <span className="justify-self-start">{fmtUSD(insights.income)}</span>
            </>
          }
          question="How much income is left after planned budgets and overages?"
          accent="sky"
          flipped={!!flipped['free-spend']}
          onToggle={() => toggle('free-spend')}
          outlined={false}
          tileLayout={!isMobile}
          tileAlign="center"
          subgridRow={isMobile}
        />
        <InsightCard
          title="Fixed Costs"
          icon={<Repeat2 />}
          value={
            <>
              <span className="justify-self-start">
                {fmtUSD(monthlyTotal)}
                <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-1')}>
                  m
                </span>
              </span>
              <span
                className={cn(
                  uiTypographyRecipes.caption,
                  semanticTextRecipes.body,
                  'justify-self-center'
                )}
              >
                of
              </span>
              <span className="justify-self-start">
                {fmtUSD(yearToDate)}
                <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-1')}>
                  ytd
                </span>
              </span>
            </>
          }
          question="What do my fixed expenses cost per month and year to date?"
          accent="sky"
          flipped={!!flipped['subscription-costs']}
          onToggle={() => toggle('subscription-costs')}
          outlined={false}
          tileLayout={!isMobile}
          tileAlign="end"
          subgridRow={isMobile}
        />
      </>
    );
  })();

  return (
    <InsightsPanelShell testId="budget-insights-shell" accent="sky">
      <InsightsExpandablePanel
        testId="budget-insights-panel"
        bodyId="budget-insights-panel-body"
        bodyTestId="budget-insights-panel-body"
        summaryLabel="Budget insights"
        expanded={expanded}
        onToggle={toggleExpanded}
        bodyClassName={cn(
          isMobile
            ? insights.hasActivity
              ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
              : 'flex flex-col gap-1.5'
            : 'flex flex-row items-start gap-3'
        )}
        summary={
          <>
            <InsightsPanelHeader label="Budget insights" />
            <div
              className={cn(
                'grid',
                'grid-cols-[auto_1fr_auto]',
                'grid-rows-[auto_auto]',
                'items-baseline',
                'gap-x-2',
                'gap-y-2',
                'md:gap-x-3',
                'md:gap-y-2.5'
              )}
            >
              <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.subtle)}>
                Total Spent
              </div>
              <div aria-hidden />
              <div
                className={cn(uiTypographyRecipes.label, semanticTextRecipes.subtle, 'text-right')}
              >
                Total Planned
              </div>

              <div
                className={cn(
                  'shrink-0',
                  'text-[1.45rem]',
                  'font-semibold',
                  'leading-none',
                  'tracking-[-0.02em]',
                  'md:text-[1.65rem]',
                  'lg:text-2xl',
                  overBudget ? semanticTextRecipes.danger : semanticTextRecipes.body
                )}
              >
                {fmtUSD(totalSpent)}
              </div>
              <div className={cn('min-w-0', 'w-full', 'self-center', 'overflow-visible')}>
                <BudgetProgress amount={totalBudgeted} spent={totalSpent} showCaptions={false} />
              </div>
              <div
                className={cn(
                  'shrink-0',
                  'text-[1.45rem]',
                  'font-semibold',
                  'leading-none',
                  'tracking-[-0.02em]',
                  'md:text-[1.65rem]',
                  'lg:text-2xl',
                  'text-right',
                  semanticTextRecipes.primary
                )}
              >
                {fmtUSD(totalBudgeted)}
              </div>
            </div>
          </>
        }
      >
        {bodyContent}
      </InsightsExpandablePanel>
    </InsightsPanelShell>
  );
}
