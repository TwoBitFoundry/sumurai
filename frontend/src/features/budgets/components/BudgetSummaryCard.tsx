import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { InsightQuestion } from '@/components/widgets/InsightQuestion';
import { cn } from '@/ui/primitives';
import {
  budgetProgress as budgetProgressRecipes,
  status,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';
import BudgetProgress, { getBudgetProgressMetrics } from './BudgetProgress';

const FADE = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } as const;

interface BudgetSummaryCardProps {
  totalBudgeted: number;
  totalSpent: number;
}

const summaryAccent = heroAccents.sky;

const amountValueClass = cn(
  'shrink-0',
  'text-[1.45rem]',
  'font-semibold',
  'leading-none',
  'tracking-[-0.02em]',
  'md:text-[1.65rem]',
  'lg:text-2xl'
);

export const BudgetSummaryCard = ({ totalBudgeted, totalSpent }: BudgetSummaryCardProps) => {
  const [flipped, setFlipped] = useState(false);

  const overBudget = totalSpent > totalBudgeted;
  const { clampedPercent, isOver, remaining } = getBudgetProgressMetrics(totalBudgeted, totalSpent);
  const ringColorStyle = {
    '--tw-ring-color': `${summaryAccent.ringHex}66`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      aria-expanded={flipped}
      aria-label="Budget Summary"
      className={cn(heroStatCardRecipes.base, 'w-full text-left')}
      data-testid="budget-summary-card"
    >
      <div
        className={cn(
          heroStatCardRecipes.shellSymmetric,
          summaryAccent.border,
          summaryAccent.borderDark,
          summaryAccent.hoverBorder,
          summaryAccent.hoverBorderDark,
          'cursor-pointer'
        )}
      >
        <div className={cn(heroStatCardRecipes.ring)}>
          <div className={cn(heroStatCardRecipes.ringLine)} style={ringColorStyle} />
        </div>

        <div className="relative z-10 w-full min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              <motion.div
                key="back"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                <InsightQuestion question="How is my overall spending tracking against my plan this month?" />
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
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
                <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>
                  Total Spent
                </div>
                <div
                  className={cn(
                    'flex',
                    'min-w-0',
                    'items-baseline',
                    'justify-between',
                    'text-[0.75rem]',
                    uiTextRecipes.muted
                  )}
                >
                  <span className={cn(...budgetProgressRecipes.captionPercent)}>
                    {clampedPercent.toFixed(0)}%
                  </span>
                  <span
                    className={cn(
                      ...budgetProgressRecipes.captionPercent,
                      ...(isOver ? status.danger.text : uiTextRecipes.body)
                    )}
                  >
                    {isOver ? fmtUSD(totalSpent - totalBudgeted) : fmtUSD(remaining)}
                  </span>
                </div>
                <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'text-right')}>
                  Total Planned
                </div>

                <div
                  className={cn(
                    amountValueClass,
                    overBudget ? uiTextRecipes.danger : uiTextRecipes.body
                  )}
                >
                  {fmtUSD(totalSpent)}
                </div>
                <div className={cn('min-w-0', 'w-full', 'self-end', 'overflow-visible')}>
                  <BudgetProgress amount={totalBudgeted} spent={totalSpent} showCaptions={false} />
                </div>
                <div className={cn(amountValueClass, 'text-right', uiTextRecipes.primary)}>
                  {fmtUSD(totalBudgeted)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
};

export default BudgetSummaryCard;
