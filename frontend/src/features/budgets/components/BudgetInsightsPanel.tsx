import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Flame, Repeat2, Wallet } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { SubscriptionCalculator } from '@/domain/SubscriptionCalculator';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import {
  text as semanticTextRecipes,
  border as uiBorderRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import type { SubscriptionSummary } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { BudgetProgress } from './BudgetProgress';

export interface BudgetInsightsPanelProps {
  totalBudgeted: number;
  totalSpent: number;
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
  totalBudgeted,
  totalSpent,
  insights,
  subscriptions,
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
  const shellAccent = heroAccents.sky;

  const { monthlyTotal, yearToDate } = SubscriptionCalculator.computeSubscriptionHeroStats(
    subscriptions,
    month
  );

  const bodyContent = insights.hasActivity ? (
    <>
      <InsightCard
        title="Runway"
        icon={<Flame />}
        value={
          insights.dailyPacing != null ? (
            <>
              <span className="justify-self-start">
                {fmtUSD(insights.dailyPacing)}
                <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-1')}>
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
        accent="slate"
        flipped={!!flipped.pacing}
        onToggle={() => toggle('pacing')}
        outlined={false}
        tileLayout={!isMobile}
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
        accent="slate"
        flipped={!!flipped['free-spend']}
        onToggle={() => toggle('free-spend')}
        outlined={false}
        tileLayout={!isMobile}
        subgridRow={isMobile}
      />
      <InsightCard
        title="Sub Costs"
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
        question="What do my subscriptions cost per month and year to date?"
        accent="slate"
        flipped={!!flipped['subscription-costs']}
        onToggle={() => toggle('subscription-costs')}
        outlined={false}
        tileLayout={!isMobile}
        subgridRow={isMobile}
      />
    </>
  ) : (
    <div
      data-testid="budget-insights-empty"
      className={cn('py-4', 'text-center', uiTypographyRecipes.body, semanticTextRecipes.muted)}
    >
      No budget activity recorded for {fmtMonthName(month)} yet.
    </div>
  );

  return (
    <section
      data-testid="budget-insights-shell"
      className={cn(
        'relative',
        'overflow-hidden',
        'rounded-[0.75rem]',
        'border-2',
        shellAccent.border,
        shellAccent.borderDark,
        'bg-white/80',
        'transition-colors',
        'duration-200',
        'dark:bg-[#111a2f]/70'
      )}
    >
      <div
        className={cn(
          'hero-stat-card__gradient',
          'pointer-events-none',
          'absolute',
          'inset-0',
          'rounded-[inherit]',
          'opacity-0',
          'transition-opacity',
          'duration-300',
          'group-hover:opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${shellAccent.gradFrom}33, ${shellAccent.gradVia}1f, transparent 70%)`,
        }}
      />
      <div
        className={cn(
          'pointer-events-none',
          'absolute',
          'inset-[2px]',
          'rounded-[calc(0.75rem-2px)]'
        )}
      >
        <div
          className={cn('absolute', 'inset-0', 'rounded-[inherit]', 'ring-2')}
          style={{ '--tw-ring-color': `${shellAccent.ringHex}66` } as CSSProperties}
        />
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="budget-insights-panel-body"
        aria-label="Budget summary"
        onClick={toggleExpanded}
        className={cn('relative', 'z-10', 'w-full', 'text-left', 'p-3', 'md:p-4')}
      >
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
          <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.subtle, 'text-right')}>
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
          <div className={cn('min-w-0', 'w-full', 'self-center')}>
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
          <div className={cn('col-span-3', 'flex', 'justify-center')}>
            <ChevronDown
              className={cn(
                'h-4',
                'w-4',
                'shrink-0',
                'transition-transform',
                'duration-200',
                expanded && 'rotate-180',
                semanticTextRecipes.subtle
              )}
            />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id="budget-insights-panel-body"
            data-testid="budget-insights-panel-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn('relative', 'z-10')}
          >
            <div className={cn('px-3', 'md:px-4')}>
              <div className={cn('border-t', ...uiBorderRecipes.divider)} />
            </div>
            <div
              className={cn(
                'px-3',
                'py-2',
                'md:px-4',
                'md:py-3',
                isMobile
                  ? insights.hasActivity
                    ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
                    : 'flex flex-col gap-1.5'
                  : 'flex flex-row items-start gap-3'
              )}
            >
              {bodyContent}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
