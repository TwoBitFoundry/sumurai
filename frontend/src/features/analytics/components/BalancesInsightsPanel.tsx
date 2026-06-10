import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CircleDollarSign } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { AccountGroupIcon } from '@/components/AccountGroupIcon';
import { Amount } from '@/components/Amount';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { InsightCard } from '@/components/widgets/InsightCard';
import { ACCOUNT_GROUP_ACCENT, ACCOUNT_GROUP_LABELS } from '@/domain/accountCategories';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Totals } from '@/types/analytics';
import { cn } from '@/ui/primitives';
import {
  text as semanticTextRecipes,
  border as uiBorderRecipes,
  status as uiStatusRecipes,
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
  const shellAccent = heroAccents.violet;

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const showYtd = incomeYtd != null && expensesYtd != null;
  const showYtdInHeader = showYtd && !isMobile;

  const netLabel = (
    <div className={cn('flex', 'items-center', 'gap-x-1.5')}>
      <span className={cn(...heroStatCardRecipes.iconWell, shellAccent.icon)} aria-hidden>
        <CircleDollarSign />
      </span>
      <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.label)}>Net</div>
    </div>
  );

  const netAmount = (
    <div
      data-testid="overall-net"
      className={cn(
        'text-[1.45rem]',
        'font-semibold',
        'leading-none',
        'tracking-[-0.02em]',
        'md:text-[1.65rem]',
        'lg:text-2xl',
        'tabular-nums'
      )}
    >
      <Amount value={overall.net} className={cn('text-violet-500', 'dark:text-violet-300')} />
    </div>
  );

  const subCategories = [
    {
      key: 'cash',
      title: ACCOUNT_GROUP_LABELS.cash,
      accent: ACCOUNT_GROUP_ACCENT.cash,
      icon: <AccountGroupIcon group="cash" />,
      value: (
        <span data-testid="overall-cash" className={cn(uiStatusRecipes.success.text)}>
          {fmtUSD(overall.cash)}
        </span>
      ),
      question: 'How much liquid cash do you have across checking and savings?',
    },
    {
      key: 'investments',
      title: ACCOUNT_GROUP_LABELS.investments,
      accent: ACCOUNT_GROUP_ACCENT.investments,
      icon: <AccountGroupIcon group="investments" />,
      value: (
        <span data-testid="overall-investments" className={cn(uiStatusRecipes.info.text)}>
          {fmtUSD(overall.investments)}
        </span>
      ),
      question: 'What is the total value of your investment accounts?',
    },
    {
      key: 'credit',
      title: ACCOUNT_GROUP_LABELS.credit,
      accent: ACCOUNT_GROUP_ACCENT.credit,
      icon: <AccountGroupIcon group="credit" />,
      value: (
        <span data-testid="overall-credit" className={cn(uiStatusRecipes.danger.text)}>
          {fmtUSD(overall.credit)}
        </span>
      ),
      question: 'What is your total credit card balance?',
    },
    {
      key: 'loan',
      title: ACCOUNT_GROUP_LABELS.loans,
      accent: ACCOUNT_GROUP_ACCENT.loans,
      icon: <AccountGroupIcon group="loans" />,
      value: (
        <span data-testid="overall-loan" className={cn(uiStatusRecipes.warning.text)}>
          {fmtUSD(overall.loan)}
        </span>
      ),
      question: 'What is your total outstanding loan balance?',
    },
  ] as const;

  return (
    <section
      data-testid="balances-insights-shell"
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
        aria-controls="balances-insights-panel-body"
        aria-label="Net worth summary"
        onClick={toggleExpanded}
        className={cn('relative', 'z-10', 'w-full', 'text-left', 'p-3', 'md:p-4')}
      >
        <div className={cn('flex', 'flex-col', 'gap-y-1.5', 'w-full')}>
          {showYtdInHeader ? (
            <div
              data-testid="balances-ytd-row"
              className={cn('flex', 'w-full', 'items-start', 'justify-between', 'gap-x-4')}
            >
              <div className={cn('flex', 'shrink-0', 'flex-col', 'items-start', 'gap-y-1.5')}>
                {netLabel}
                {netAmount}
              </div>
              <div className={cn('flex', 'shrink-0', 'items-start', 'gap-x-4', 'md:gap-x-6')}>
                <div className={cn('flex', 'shrink-0', 'flex-col', 'items-center', 'gap-y-1.5')}>
                  <div className={cn('flex', 'items-center', 'gap-x-1.5')}>
                    <span
                      className={cn(...heroStatCardRecipes.iconWell, heroAccents.emerald.icon)}
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
                    className={cn('flex', 'items-baseline', 'gap-x-1')}
                  >
                    <span
                      data-testid="balances-ytd-income-value"
                      className={cn(
                        uiTypographyRecipes.cardTitle,
                        uiStatusRecipes.success.text,
                        'tabular-nums'
                      )}
                    >
                      {fmtUSD(incomeYtd)}
                    </span>
                    <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                      ytd
                    </span>
                  </div>
                </div>
                <div className={cn('flex', 'shrink-0', 'flex-col', 'items-center', 'gap-y-1.5')}>
                  <div className={cn('flex', 'items-center', 'gap-x-1.5')}>
                    <span
                      className={cn(...heroStatCardRecipes.iconWell, heroAccents.rose.icon)}
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
                    className={cn('flex', 'items-baseline', 'gap-x-1')}
                  >
                    <span
                      data-testid="balances-ytd-expenses-value"
                      className={cn(
                        uiTypographyRecipes.cardTitle,
                        uiStatusRecipes.danger.text,
                        'tabular-nums'
                      )}
                    >
                      {fmtUSD(expensesYtd)}
                    </span>
                    <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                      ytd
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn('flex', 'flex-col', 'items-start', 'gap-y-1.5', 'w-full')}>
              {netLabel}
              {netAmount}
            </div>
          )}
          <ChevronDown
            className={cn(
              'mx-auto',
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
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id="balances-insights-panel-body"
            data-testid="balances-insights-panel-body"
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
                  ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
                  : 'flex flex-row items-start gap-3'
              )}
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
                          className={cn(uiStatusRecipes.success.text, 'tabular-nums')}
                        >
                          {fmtUSD(incomeYtd)}
                        </span>
                        <span
                          className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}
                        >
                          ytd
                        </span>
                      </span>
                    }
                    question="How much income have you received year to date?"
                    accent="emerald"
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
                          className={cn(uiStatusRecipes.danger.text, 'tabular-nums')}
                        >
                          {fmtUSD(expensesYtd)}
                        </span>
                        <span
                          className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}
                        >
                          ytd
                        </span>
                      </span>
                    }
                    question="How much have you spent year to date?"
                    accent="rose"
                    flipped={!!flipped['expenses-ytd']}
                    onToggle={() => toggle('expenses-ytd')}
                    outlined={false}
                    tileLayout={false}
                    subgridRow
                  />
                  <div
                    data-testid="balances-ytd-divider"
                    className={cn('col-span-full', 'border-t', ...uiBorderRecipes.divider)}
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
                  subgridRow={isMobile}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
