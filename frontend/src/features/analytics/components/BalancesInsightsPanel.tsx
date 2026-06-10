import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, CircleDollarSign } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { AccountGroupIcon } from '@/components/AccountGroupIcon';
import { Amount } from '@/components/Amount';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { InsightCard } from '@/components/widgets/InsightCard';
import { ACCOUNT_GROUP_ACCENT, ACCOUNT_GROUP_LABELS } from '@/domain/accountCategories';
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
  const [expanded, setExpanded] = useState(true);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { isMobile } = useViewportBreakpoint();
  const shellAccent = heroAccents.violet;

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const showYtd = incomeYtd != null && expensesYtd != null;

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
        onClick={() => setExpanded((value) => !value)}
        className={cn('relative', 'z-10', 'w-full', 'text-left', 'p-3', 'md:p-4')}
      >
        <div
          className={cn(
            'grid',
            'grid-cols-[auto_1fr_auto]',
            'items-center',
            'gap-x-2',
            'md:gap-x-3'
          )}
        >
          <div className={cn('flex', 'min-w-0', 'items-center', 'gap-2')}>
            <span className={cn(...heroStatCardRecipes.iconWell, shellAccent.icon)}>
              <CircleDollarSign />
            </span>
            <div className={cn(uiTypographyRecipes.label, semanticTextRecipes.subtle)}>Net</div>
          </div>
          <div aria-hidden />
          <div
            data-testid="overall-net"
            className={cn(
              'shrink-0',
              'text-[1.45rem]',
              'font-semibold',
              'leading-none',
              'tracking-[-0.02em]',
              'md:text-[1.65rem]',
              'lg:text-2xl',
              'text-right',
              'tabular-nums'
            )}
          >
            <Amount value={overall.net} className={cn('text-violet-500', 'dark:text-violet-300')} />
          </div>
        </div>
        {showYtd ? (
          <div
            data-testid="balances-ytd-row"
            className={cn(
              'mt-1.5',
              'flex',
              'flex-wrap',
              'items-baseline',
              'justify-center',
              'gap-x-4',
              'gap-y-1'
            )}
          >
            <div
              data-testid="balances-ytd-income"
              className={cn('inline-flex', 'items-baseline', 'gap-x-1')}
            >
              <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                income ytd
              </span>
              <span
                data-testid="balances-ytd-income-value"
                className={cn(
                  uiTypographyRecipes.caption,
                  uiStatusRecipes.success.text,
                  'tabular-nums'
                )}
              >
                {fmtUSD(incomeYtd)}
              </span>
            </div>
            <div
              data-testid="balances-ytd-expenses"
              className={cn('inline-flex', 'items-baseline', 'gap-x-1')}
            >
              <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
                expenses ytd
              </span>
              <span
                data-testid="balances-ytd-expenses-value"
                className={cn(
                  uiTypographyRecipes.caption,
                  uiStatusRecipes.danger.text,
                  'tabular-nums'
                )}
              >
                {fmtUSD(expensesYtd)}
              </span>
            </div>
          </div>
        ) : null}
        <div className={cn('mt-2', 'flex', 'justify-center')}>
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
