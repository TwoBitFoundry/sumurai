import { Flame, Repeat2, Wallet } from 'lucide-react';
import { useState } from 'react';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { SubscriptionCalculator } from '@/domain/SubscriptionCalculator';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { SubscriptionSummary } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { BudgetInsightCard, budgetInsightCardRecipes } from './BudgetInsightCard';

export interface BudgetInsightsPanelProps {
  insights: BudgetInsights;
  subscriptions: SubscriptionSummary[];
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
  insights,
  subscriptions,
  month,
  filterKey,
}: BudgetInsightsPanelProps) {
  const resetKey = `${month.getFullYear()}-${month.getMonth()}-${filterKey}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));

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

  const { monthlyTotal, yearToDate } = SubscriptionCalculator.computeSubscriptionHeroStats(
    subscriptions,
    month
  );

  return (
    <div
      data-testid="budget-insights-grid"
      className={cn(
        'grid',
        'grid-cols-1',
        'gap-3',
        '[&>*]:min-w-0',
        'md:grid-cols-2',
        'lg:grid-cols-3',
        '[&>*:last-child]:md:col-span-2',
        '[&>*:last-child]:lg:col-span-1'
      )}
    >
      <BudgetInsightCard
        title="Runway Pace"
        icon={<Flame />}
        value={
          insights.dailyPacing != null ? (
            <span className={cn(budgetInsightCardRecipes.metric)}>
              <span>{fmtUSD(insights.dailyPacing)}</span>
              {insights.runoutDate ? (
                <>
                  <span className={cn(budgetInsightCardRecipes.suffix)}>/ d until</span>
                  <span>{fmtRunoutDate(insights.runoutDate)}</span>
                </>
              ) : (
                <span className={cn(budgetInsightCardRecipes.suffix)}>/ d</span>
              )}
            </span>
          ) : (
            '—'
          )
        }
        question="How much am I spending per day, and when will I run out at this pace?"
        accent="sky"
        flipped={!!flipped.pacing}
        onToggle={() => toggle('pacing')}
      />
      <BudgetInsightCard
        title="Free Spend"
        icon={<Wallet />}
        value={
          <span className={cn(budgetInsightCardRecipes.metric)}>
            <span className={cn(insights.freeSpend < 0 && semanticTextRecipes.danger)}>
              {fmtUSD(insights.freeSpend)}
            </span>
            <span className={cn(budgetInsightCardRecipes.suffix)}>/</span>
            <span>{fmtUSD(insights.income)}</span>
          </span>
        }
        question="How much income is left after planned budgets and overages?"
        accent="sky"
        flipped={!!flipped['free-spend']}
        onToggle={() => toggle('free-spend')}
      />
      <BudgetInsightCard
        title="Sub Costs"
        icon={<Repeat2 />}
        value={
          <span className={cn(budgetInsightCardRecipes.metric)}>
            <span>{fmtUSD(monthlyTotal)}</span>
            <span className={cn(budgetInsightCardRecipes.suffix)}>/ m</span>
            <span>{fmtUSD(yearToDate)}</span>
            <span className={cn(budgetInsightCardRecipes.suffix)}>/ ytd</span>
          </span>
        }
        question="What do my subscriptions cost per month and year to date?"
        accent="sky"
        flipped={!!flipped['subscription-costs']}
        onToggle={() => toggle('subscription-costs')}
      />
    </div>
  );
}
