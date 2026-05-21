import type { CSSProperties } from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';
import BudgetProgress from './BudgetProgress';

interface BudgetSummaryCardProps {
  totalBudgeted: number;
  totalSpent: number;
}

const summaryAccent = heroAccents.sky;

export const BudgetSummaryCard = ({ totalBudgeted, totalSpent }: BudgetSummaryCardProps) => {
  const overBudget = totalSpent > totalBudgeted;
  const ringColorStyle = {
    '--tw-ring-color': `${summaryAccent.ringHex}66`,
  } as CSSProperties;

  return (
    <div className={cn(heroStatCardRecipes.base)} data-testid="budget-summary-card">
      <div
        className={cn(
          heroStatCardRecipes.shell,
          summaryAccent.border,
          summaryAccent.borderDark,
          summaryAccent.hoverBorder,
          summaryAccent.hoverBorderDark
        )}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-[length:inherit]',
            'opacity-0',
            'transition-opacity',
            'duration-300',
            'group-hover:opacity-100'
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${summaryAccent.gradFrom}33, ${summaryAccent.gradVia}1f, transparent 70%)`,
          }}
        />
        <div className={cn(heroStatCardRecipes.ring)}>
          <div className={cn(heroStatCardRecipes.ringLine)} style={ringColorStyle} />
        </div>

        <div className={cn('relative', 'z-10', 'flex', 'flex-wrap', 'items-start', 'gap-4')}>
          <div className={cn('min-w-[10rem]', 'flex-1')}>
            <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>Total Planned</div>
            <div className={cn('mt-1', 'text-2xl', 'font-semibold', uiTextRecipes.primary)}>
              {fmtUSD(totalBudgeted)}
            </div>
          </div>
          <div className={cn('min-w-[10rem]', 'flex-1', 'text-right')}>
            <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>Total Spent</div>
            <div
              className={cn(
                'mt-1',
                'text-2xl',
                'font-semibold',
                overBudget ? uiTextRecipes.danger : uiTextRecipes.body
              )}
            >
              {fmtUSD(totalSpent)}
            </div>
          </div>
        </div>
        <div className={cn('relative', 'z-10', 'mt-4')}>
          <BudgetProgress amount={totalBudgeted} spent={totalSpent} />
        </div>
      </div>
    </div>
  );
};

export default BudgetSummaryCard;
