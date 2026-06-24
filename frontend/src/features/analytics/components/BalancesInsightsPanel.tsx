import { ArrowDownLeft, ArrowUpRight, CircleDollarSign } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { AccountGroupIcon } from '@/components/AccountGroupIcon';
import { BalancesOverviewChart } from '@/components/BalancesOverview';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { InsightCard, type InsightTileAlign } from '@/components/widgets/InsightCard';
import { InsightsExpandablePanel } from '@/components/widgets/InsightsExpandablePanel';
import { InsightsPanelHeader } from '@/components/widgets/InsightsPanel';
import { InsightsPanelShell } from '@/components/widgets/InsightsPanelShell';
import { ACCOUNT_GROUP_ACCENT, ACCOUNT_GROUP_LABELS } from '@/domain/accountCategories';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Totals } from '@/types/analytics';
import { cn } from '@/ui/primitives';
import {
  text as semanticTextRecipes,
  insightsPanel as uiInsightsPanelRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { fmtUSD } from '@/utils/format';

export interface BalancesInsightsPanelProps {
  overall: Totals;
  resetKey?: string;
  incomeYtd?: number;
  expensesYtd?: number;
}

export function BalancesInsightsPanel({
  overall,
  resetKey = 'default',
  incomeYtd,
  expensesYtd,
}: BalancesInsightsPanelProps) {
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const { expanded, toggleExpanded } = useSessionCollapsible('balances-insights');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { isMobile } = useViewportBreakpoint();

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const showYtd = incomeYtd != null && expensesYtd != null;
  const showYtdInHeader = showYtd && !isMobile;

  const netAccentClassName = semanticTextRecipes.info;

  const netLabel = (
    <div className={cn('flex', 'items-center', 'gap-x-1.5')}>
      <span className={cn(...heroStatCardRecipes.iconWell, netAccentClassName)} aria-hidden>
        <CircleDollarSign />
      </span>
      <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.label)}>Net</div>
    </div>
  );

  const netAmountClassName = cn(uiTypographyRecipes.cardTitle, netAccentClassName, 'tabular-nums');

  const netAmount = (
    <span data-testid="overall-net" className={netAmountClassName}>
      {fmtUSD(overall.net)}
    </span>
  );

  const subCategories: Array<{
    key: 'cash' | 'investments' | 'credit' | 'loan';
    title: string;
    accent: (typeof ACCOUNT_GROUP_ACCENT)[keyof typeof ACCOUNT_GROUP_ACCENT];
    icon: ReactNode;
    value: ReactNode;
    question: string;
    tileAlign: InsightTileAlign;
  }> = [
    {
      key: 'cash',
      title: ACCOUNT_GROUP_LABELS.cash,
      accent: ACCOUNT_GROUP_ACCENT.cash,
      icon: <AccountGroupIcon group="cash" />,
      value: (
        <span
          data-testid="overall-cash"
          className={cn(heroAccents[ACCOUNT_GROUP_ACCENT.cash].icon, 'tabular-nums')}
        >
          {fmtUSD(overall.cash)}
        </span>
      ),
      question: 'How much liquid cash do you have across checking and savings?',
      tileAlign: 'start',
    },
    {
      key: 'investments',
      title: ACCOUNT_GROUP_LABELS.investments,
      accent: ACCOUNT_GROUP_ACCENT.investments,
      icon: <AccountGroupIcon group="investments" />,
      value: (
        <span
          data-testid="overall-investments"
          className={cn(heroAccents[ACCOUNT_GROUP_ACCENT.investments].icon, 'tabular-nums')}
        >
          {fmtUSD(overall.investments)}
        </span>
      ),
      question: 'What is the total value of your investment accounts?',
      tileAlign: 'center',
    },
    {
      key: 'credit',
      title: ACCOUNT_GROUP_LABELS.credit,
      accent: ACCOUNT_GROUP_ACCENT.credit,
      icon: <AccountGroupIcon group="credit" />,
      value: (
        <span
          data-testid="overall-credit"
          className={cn(heroAccents[ACCOUNT_GROUP_ACCENT.credit].icon, 'tabular-nums')}
        >
          {fmtUSD(overall.credit)}
        </span>
      ),
      question: 'What is your total credit card balance?',
      tileAlign: 'center',
    },
    {
      key: 'loan',
      title: ACCOUNT_GROUP_LABELS.loans,
      accent: ACCOUNT_GROUP_ACCENT.loans,
      icon: <AccountGroupIcon group="loans" />,
      value: (
        <span
          data-testid="overall-loan"
          className={cn(heroAccents[ACCOUNT_GROUP_ACCENT.loans].icon, 'tabular-nums')}
        >
          {fmtUSD(overall.loan)}
        </span>
      ),
      question: 'What is your total outstanding loan balance?',
      tileAlign: 'end',
    },
  ];

  return (
    <InsightsPanelShell testId="balances-insights-shell" accent="ocean">
      <InsightsExpandablePanel
        testId="balances-insights-panel"
        bodyId="balances-insights-panel-body"
        bodyTestId="balances-insights-panel-body"
        summaryLabel="Balance insights"
        expanded={expanded}
        onToggle={toggleExpanded}
        bodyClassName={cn(
          isMobile
            ? showYtd
              ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
              : 'flex flex-col gap-1.5'
            : 'flex w-full flex-row flex-wrap items-start gap-3'
        )}
        summary={
          <>
            <InsightsPanelHeader label="Balance insights" />
            <div className={cn('flex', 'flex-col', 'gap-y-1.5', 'w-full')}>
              {showYtdInHeader ? (
                <div
                  data-testid="balances-ytd-row"
                  className={cn('flex', 'w-full', 'items-start', 'justify-between', 'gap-x-4')}
                >
                  <div
                    className={cn(
                      'inline-grid',
                      'shrink-0',
                      'grid-cols-[1fr_auto]',
                      'gap-x-1',
                      'gap-y-1.5'
                    )}
                  >
                    <div className={cn('col-start-1', 'flex', 'items-center', 'gap-x-1.5')}>
                      {netLabel}
                    </div>
                    <div
                      data-testid="balances-ytd-net"
                      className={cn('col-start-1', 'col-end-3', 'row-start-2')}
                    >
                      {netAmount}
                    </div>
                  </div>
                  <div className={cn('flex', 'shrink-0', 'items-start', 'gap-x-4', 'md:gap-x-6')}>
                    <div
                      className={cn(
                        'inline-grid',
                        'shrink-0',
                        'grid-cols-[1fr_auto]',
                        'gap-x-1',
                        'gap-y-1.5'
                      )}
                    >
                      <div
                        className={cn(
                          'col-start-1',
                          'flex',
                          'items-center',
                          'justify-end',
                          'gap-x-1.5'
                        )}
                      >
                        <span
                          className={cn(...heroStatCardRecipes.iconWell, heroAccents.teal.icon)}
                          aria-hidden
                        >
                          <ArrowUpRight />
                        </span>
                        <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.label)}>
                          income
                        </div>
                      </div>
                      <div
                        data-testid="balances-ytd-income"
                        className={cn(
                          'col-start-1',
                          'col-end-3',
                          'row-start-2',
                          'grid',
                          'grid-cols-[1fr_auto]',
                          'items-baseline',
                          'gap-x-1'
                        )}
                      >
                        <span
                          data-testid="balances-ytd-income-value"
                          className={cn(
                            'justify-self-end',
                            uiTypographyRecipes.cardTitle,
                            heroAccents.teal.icon,
                            'tabular-nums'
                          )}
                        >
                          {fmtUSD(incomeYtd)}
                        </span>
                        <span
                          className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}
                        >
                          ytd
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'inline-grid',
                        'shrink-0',
                        'grid-cols-[1fr_auto]',
                        'gap-x-1',
                        'gap-y-1.5'
                      )}
                    >
                      <div
                        className={cn(
                          'col-start-1',
                          'flex',
                          'items-center',
                          'justify-end',
                          'gap-x-1.5'
                        )}
                      >
                        <span
                          className={cn(...heroStatCardRecipes.iconWell, heroAccents.crimson.icon)}
                          aria-hidden
                        >
                          <ArrowDownLeft />
                        </span>
                        <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.label)}>
                          expenses
                        </div>
                      </div>
                      <div
                        data-testid="balances-ytd-expenses"
                        className={cn(
                          'col-start-1',
                          'col-end-3',
                          'row-start-2',
                          'grid',
                          'grid-cols-[1fr_auto]',
                          'items-baseline',
                          'gap-x-1'
                        )}
                      >
                        <span
                          data-testid="balances-ytd-expenses-value"
                          className={cn(
                            'justify-self-end',
                            uiTypographyRecipes.cardTitle,
                            heroAccents.crimson.icon,
                            'tabular-nums'
                          )}
                        >
                          {fmtUSD(expensesYtd)}
                        </span>
                        <span
                          className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}
                        >
                          ytd
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'inline-grid',
                    'w-full',
                    'min-w-0',
                    'grid-cols-[auto_minmax(0,1fr)]',
                    'items-baseline',
                    'gap-x-2',
                    'gap-y-1.5'
                  )}
                >
                  {netLabel}
                  <span
                    data-testid="overall-net"
                    className={cn(netAmountClassName, 'justify-self-end', 'text-right')}
                  >
                    {fmtUSD(overall.net)}
                  </span>
                </div>
              )}
            </div>
          </>
        }
      >
        {showYtd && isMobile ? (
          <>
            <InsightCard
              title="income"
              icon={<ArrowUpRight />}
              value={
                <span
                  data-testid="balances-ytd-income"
                  className="justify-self-start col-span-3 inline-flex items-baseline gap-x-1"
                >
                  <span
                    data-testid="balances-ytd-income-value"
                    className={cn(heroAccents.teal.icon, 'tabular-nums')}
                  >
                    {fmtUSD(incomeYtd)}
                  </span>
                  <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                    ytd
                  </span>
                </span>
              }
              question="How much income have you received year to date?"
              accent="teal"
              flipped={!!flipped['income-ytd']}
              onToggle={() => toggle('income-ytd')}
              outlined={false}
              tileLayout={false}
              subgridRow
            />
            <InsightCard
              title="expenses"
              icon={<ArrowDownLeft />}
              value={
                <span
                  data-testid="balances-ytd-expenses"
                  className="justify-self-start col-span-3 inline-flex items-baseline gap-x-1"
                >
                  <span
                    data-testid="balances-ytd-expenses-value"
                    className={cn(heroAccents.crimson.icon, 'tabular-nums')}
                  >
                    {fmtUSD(expensesYtd)}
                  </span>
                  <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                    ytd
                  </span>
                </span>
              }
              question="How much have you spent year to date?"
              accent="crimson"
              flipped={!!flipped['expenses-ytd']}
              onToggle={() => toggle('expenses-ytd')}
              outlined={false}
              tileLayout={false}
              subgridRow
            />
            <div
              data-testid="balances-ytd-divider"
              className={cn('col-span-full', 'border-t', ...uiInsightsPanelRecipes.labelDivider)}
              aria-hidden
            />
          </>
        ) : null}
        {subCategories.map((category) => (
          <InsightCard
            key={category.key}
            title={category.title}
            icon={category.icon}
            value={category.value}
            question={category.question}
            accent={category.accent}
            flipped={!!flipped[category.key]}
            onToggle={() => toggle(category.key)}
            outlined={false}
            tileLayout={!isMobile}
            tileAlign={category.tileAlign}
            subgridRow={isMobile}
          />
        ))}
        <div
          className={cn('col-span-full', 'w-full', 'min-w-0', isMobile ? 'pt-1' : 'pt-2')}
          data-testid="balances-insights-chart"
        >
          <BalancesOverviewChart />
        </div>
      </InsightsExpandablePanel>
    </InsightsPanelShell>
  );
}
