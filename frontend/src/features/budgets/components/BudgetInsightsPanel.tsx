import { CalendarX2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import type { BudgetStats } from '@/domain/BudgetCalculator';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { fmtUSD } from '../../../utils/format';
import { BudgetInsightCard } from './BudgetInsightCard';

export interface BudgetInsightsPanelProps {
  insights: BudgetInsights;
  stats: BudgetStats;
  month: Date;
  filterKey: string;
  isAccountFiltered?: boolean;
}

function fmtMonthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function fmtRunoutDate(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function BudgetInsightsPanel({
  insights,
  stats,
  month,
  filterKey,
  isAccountFiltered = false,
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

  const card4Title = isAccountFiltered ? 'Account Burden' : 'Budget Slack';
  const card4Value = isAccountFiltered
    ? insights.accountWeightPct != null
      ? `${insights.accountWeightPct.toFixed(1)}%`
      : '—'
    : fmtUSD(insights.budgetSlack);
  const card4Question = isAccountFiltered
    ? 'How much weight is this account carrying?'
    : 'Do I have unassigned slack left?';
  const card4HowToAct = isAccountFiltered
    ? 'High % means this account drives most of your budget spend.'
    : 'Positive slack means your upcoming subscriptions are covered.';

  return (
    <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
      <BudgetInsightCard
        title="Daily Pacing"
        icon={<TrendingDown />}
        value={insights.dailyPacing != null ? fmtUSD(insights.dailyPacing) : '—'}
        suffix={insights.dailyPacing != null ? '/ day' : undefined}
        subtext={`${stats.daysRemaining} days left`}
        question="How much can I spend every day for the rest of the month without blowing my budget?"
        howToAct="Stay at or below this daily rate to end the month in the green."
        accent="emerald"
        flipped={!!flipped['daily-pacing']}
        onToggle={() => toggle('daily-pacing')}
      />
      <BudgetInsightCard
        title="Safe-To-Spend"
        icon={<Wallet />}
        value={fmtUSD(insights.safeToSpend)}
        subtext={
          insights.upcomingSubscriptionsTotal > 0
            ? `${fmtUSD(insights.upcomingSubscriptionsTotal)} reserved`
            : 'No upcoming subscriptions'
        }
        question="How much of my cash is actually mine to spend vs. already spoken for?"
        howToAct="Upcoming subscriptions are deducted from your remaining budget."
        accent="sky"
        flipped={!!flipped['safe-to-spend']}
        onToggle={() => toggle('safe-to-spend')}
      />
      <BudgetInsightCard
        title="Exhaustion Projection"
        icon={<CalendarX2 />}
        value={insights.runoutDate ? fmtRunoutDate(insights.runoutDate) : 'On track'}
        subtext={insights.runoutDate ? 'projected empty' : undefined}
        question="At my current speed, what day will this budget run dry?"
        howToAct="Slow your spending to push this date to the end of the month."
        accent="amber"
        flipped={!!flipped['exhaustion-projection']}
        onToggle={() => toggle('exhaustion-projection')}
      />
      <BudgetInsightCard
        title={card4Title}
        icon={<TrendingUp />}
        value={card4Value}
        question={card4Question}
        howToAct={card4HowToAct}
        accent="violet"
        flipped={!!flipped['card-4']}
        onToggle={() => toggle('card-4')}
      />
    </div>
  );
}
